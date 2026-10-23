// Home, and the owner screens behind the reply keyboard: 🎭 My link (with its QR code), 📊 Stats
// and ⚙️ Settings with its sub-screens (invitation text, message types, blocked
// senders, new link, delete). `L` is always the owner's texts table.

import { db, InputFile } from 'sdk';
import { and, eq, sql } from 'sdk/db';
import { messages, replies, blocks } from '../schema.js';
import { PROMPT_MAX } from './config.js';
import { acceptedKinds, typesKeyboard } from './content.js';
import { qrPng } from './qr.js';
import { personalLink, supportsInline } from './util.js';
import { cancelRow, mainKeyboard, showHome, showScreen } from './chats.js';
import { getOrCreateUser } from './users.js';

// Home: the welcome message with the link, carrying the reply keyboard.
export async function sendHome(from, L) {
  const user = await getOrCreateUser(from);
  const link = await personalLink(user.code);
  return showHome(from.id, { text: L.welcome(user, link), reply_markup: mainKeyboard(L) });
}

const back = (L) => [{ text: L.btnBack, callback_data: 'st:home' }];

// 🎭 My link: the link, its invitation, and Share / QR buttons.
export async function linkView(user, L) {
  const link = await personalLink(user.code);
  const row = [{ text: L.btnQr, callback_data: 'q:me' }];
  if (await supportsInline()) row.unshift({ text: L.btnShare, switch_inline_query: '' });
  return { text: L.myLink(user, link), reply_markup: { inline_keyboard: [row] } };
}

// The QR code replaces the open screen.
export async function sendQr(user, L) {
  const link = await personalLink(user.code);
  return showScreen(user.id, {
    photo: new InputFile(qrPng(link), 'link.png', { type: 'image/png' }),
    caption: L.qrCaption(user, link),
  }, 'sendPhoto');
}

export async function statsView(user, L) {
  const byStatus = (status) => db.$count(messages, and(eq(messages.ownerId, user.id), eq(messages.status, status)));
  const [received, filtered, replyCount, blocked] = await Promise.all([
    byStatus('delivered'),
    byStatus('filtered'),
    db.$count(replies, eq(replies.ownerId, user.id)),
    db.$count(blocks, eq(blocks.ownerId, user.id)),
  ]);
  return { text: L.stats(user, { received, filtered, replies: replyCount, blocked }) };
}

// ⚙️ Settings → { text, reply_markup }. st:pause / st:resume toggle in place; the
// other buttons turn this same message into their sub-screen (with ⬅️ Back).
export function settingsView(user, L) {
  const b = (text, op) => ({ text, callback_data: `st:${op}` });
  return {
    text: `${L.settingsTitle}\n\n${user.paused ? L.settingsPaused : L.settingsReceiving}`,
    reply_markup: {
      inline_keyboard: [
        [user.paused ? b(L.stResume, 'resume') : b(L.stPause, 'pause')],
        [b(L.stText, 'text'), b(L.stTypes, 'types')],
        [b(L.btnQr, 'qr'), b(L.stBlocked, 'blocked')],
        [b(L.stNewlink, 'newlink'), b(L.stDelete, 'delete')],
      ],
    },
  };
}

// ✏️ Invitation text: waits for the next message (state setting_prompt).
export function textView(user, L) {
  const rows = [];
  if (user.prompt) rows.push([{ text: L.btnTextReset, callback_data: 'x:reset' }]);
  rows.push(cancelRow(L));
  return { text: L.textMenu(user, PROMPT_MAX), reply_markup: { inline_keyboard: rows } };
}

export function typesView(user, L) {
  return { text: L.typesMenu(acceptedKinds(user)), reply_markup: typesKeyboard(user, L) };
}

const BLOCKED_LIMIT = 30;

// 🚫 Blocked senders. Rows are addressed by rowid (ub:<rowid>) so the sender's
// Telegram id never reaches the owner's client.
export async function blockedView(ownerId, L) {
  const rows = await db.all(sql`
    SELECT rowid AS rid, created_at AS at FROM blocks
    WHERE owner_id = ${ownerId} ORDER BY created_at DESC LIMIT ${BLOCKED_LIMIT + 1}`);
  if (!rows.length) return { text: L.noBlocked, reply_markup: { inline_keyboard: [back(L)] } };
  const shown = rows.slice(0, BLOCKED_LIMIT);
  const buttons = shown.map((r, i) => ({ text: L.btnUnblock(i + 1), callback_data: `ub:${r.rid}` }));
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 5) keyboard.push(buttons.slice(i, i + 5));
  keyboard.push(back(L));
  return { text: L.blockedList(shown, rows.length > BLOCKED_LIMIT), reply_markup: { inline_keyboard: keyboard } };
}

// → true if a block was removed.
export async function unblock(ownerId, rowid) {
  const res = await db.run(sql`DELETE FROM blocks WHERE rowid = ${rowid} AND owner_id = ${ownerId}`);
  return res.rowsAffected > 0;
}

// 🔄 New link (n:) and 🗑 Delete (d:) ask first.
export function confirmView(text, prefix, yesText, L) {
  return {
    text,
    reply_markup: {
      inline_keyboard: [[
        { text: yesText, callback_data: `${prefix}:yes` },
        { text: L.btnNo, callback_data: `${prefix}:no` },
      ]],
    },
  };
}
