// Owner tools shared by commands and buttons: the QR code (/qr) and the block list (/blocked).

import { api, db, InputFile } from 'sdk';
import { sql } from 'sdk/db';
import { qrPng } from './qr.js';
import { T } from './texts.js';
import { personalLink } from './util.js';

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
