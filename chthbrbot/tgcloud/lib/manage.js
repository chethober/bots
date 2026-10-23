// Owner tools shared by commands and buttons: the QR code (/qr), the block list
// (/blocked) and the ⚙️ Settings screen.

import { api, db, InputFile } from 'sdk';
import { sql } from 'sdk/db';
import { qrPng } from './qr.js';
import { T } from './texts.js';
import { personalLink } from './util.js';
import { t } from './strings.js';

export async function sendQr(user) {
  const link = await personalLink(user.code);
  return api.sendPhoto({
    chat_id: user.id,
    photo: new InputFile(qrPng(link), 'link.png', { type: 'image/png' }),
    caption: T.qrCaption(user, link),
  });
}

const BLOCKED_LIMIT = 30;

// The /blocked message → { text, reply_markup? }. Rows are addressed by rowid
// (ub:<rowid>) so the sender's Telegram id never reaches the owner's client.
export async function blockedView(ownerId) {
  const rows = await db.all(sql`
    SELECT rowid AS rid, created_at AS at FROM blocks
    WHERE owner_id = ${ownerId} ORDER BY created_at DESC LIMIT ${BLOCKED_LIMIT + 1}`);
  if (!rows.length) return { text: T.noBlocked };
  const shown = rows.slice(0, BLOCKED_LIMIT);
  const buttons = shown.map((r, i) => ({ text: T.btnUnblock(i + 1), callback_data: `ub:${r.rid}` }));
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 5) keyboard.push(buttons.slice(i, i + 5));
  return { text: T.blockedList(shown, rows.length > BLOCKED_LIMIT), reply_markup: { inline_keyboard: keyboard } };
}

// → true if a block was removed.
export async function unblock(ownerId, rowid) {
  const res = await db.run(sql`DELETE FROM blocks WHERE rowid = ${rowid} AND owner_id = ${ownerId}`);
  return res.rowsAffected > 0;
}

// Yes / No buttons for /newlink (n:) and /delete (d:).
export const confirmKeyboard = (prefix, yesText) => ({
  inline_keyboard: [[
    { text: yesText, callback_data: `${prefix}:yes` },
    { text: T.btnNo, callback_data: `${prefix}:no` },
  ]],
});

// The ⚙️ Settings screen → { text, reply_markup }. Each button (st:<op>) opens
// the same flow as its command; st:pause / st:resume toggle in place.
export function settingsView(user, locale) {
  const b = (key, op) => ({ text: t(locale, key), callback_data: `st:${op}` });
  return {
    text: `${t(locale, 'settings_title')}\n\n${t(locale, user.paused ? 'settings_paused' : 'settings_receiving')}`,
    reply_markup: {
      inline_keyboard: [
        [user.paused ? b('st_resume', 'resume') : b('st_pause', 'pause')],
        [b('st_text', 'text'), b('st_types', 'types')],
        [b('btnQr', 'qr'), b('st_blocked', 'blocked')],
        [b('st_newlink', 'newlink'), b('st_delete', 'delete')],
      ],
    },
  };
}
