// Home, and the owner screens behind the reply keyboard: 🎭 My link (with its QR code), 📊 Stats
// and ⚙️ Settings with its sub-screens (invitation text, message types, hidden
// words, options, blocked senders, new link, delete). `L` is always the owner's texts table.

import { db, InputFile } from 'sdk';
import { sql } from 'sdk/db';
import { PROMPT_MAX, RETENTION_DAYS, WORDS_MAX, WORD_MAX_LEN } from './config.js';
import { acceptedKinds, typesKeyboard } from './content.js';
import { ownerWords } from './filter.js';
import { qrPng } from './qr.js';
import { personalLink, supportsInline } from './util.js';
import { cancelRow, mainKeyboard, showHome, showScreen } from './chats.js';
import { getOrCreateUser, OPTIONS } from './users.js';

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

// 📊 Stats. A later item of an album isn't counted as a message of its own.
// Weekdays are in UTC. Records go after RETENTION_DAYS, so totals cover that period.
export async function statsView(user, L) {
  const t = Math.floor(Date.now() / 1000);
  const owner = user.id;
  const firstOfAlbum = sql`(media_group_id IS NULL OR id = (SELECT MIN(m2.id) FROM messages m2
    WHERE m2.sender_id = messages.sender_id AND m2.media_group_id = messages.media_group_id))`;
  const [counts, replied, busiest] = await Promise.all([
    db.get(sql`SELECT
        COALESCE(SUM(status = 'delivered'), 0)                              AS received,
        COALESCE(SUM(status = 'delivered' AND created_at >= ${t - 86400}), 0)     AS day,
        COALESCE(SUM(status = 'delivered' AND created_at >= ${t - 7 * 86400}), 0) AS week,
        COUNT(DISTINCT CASE WHEN status = 'delivered' THEN sender_id END)   AS senders,
        COALESCE(SUM(status = 'filtered'), 0)                               AS filtered,
        COALESCE(SUM(status = 'muted'), 0)                                  AS muted,
        (SELECT COUNT(*) FROM replies WHERE owner_id = ${owner})            AS replies,
        (SELECT COUNT(*) FROM blocks WHERE owner_id = ${owner})             AS blocked
      FROM messages WHERE owner_id = ${owner} AND ${firstOfAlbum}`),
    db.get(sql`SELECT COUNT(DISTINCT message_id) AS n FROM replies WHERE owner_id = ${owner}`),
    db.get(sql`SELECT CAST(strftime('%w', created_at, 'unixepoch') AS INTEGER) AS weekday, COUNT(*) AS n
      FROM messages WHERE owner_id = ${owner} AND status = 'delivered' AND ${firstOfAlbum}
      GROUP BY weekday ORDER BY n DESC LIMIT 1`),
  ]);
  return {
    text: L.stats(user, {
      ...counts,
      replied: Math.min(replied.n, counts.received),
      busiest: busiest?.weekday ?? null,
      retentionDays: RETENTION_DAYS,
    }),
  };
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
        [b(L.stWords, 'words'), b(L.stOptions, 'options')],
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

// 🔤 Hidden words: waits for words to add (state setting_words); each listed word
// has a button to remove it (w:<index>), plus remove all (w:all). `note` goes on
// top (what the last message added).
export function wordsView(user, L, note) {
  const words = ownerWords(user);
  const buttons = words.map((w, i) => ({ text: `✖️ ${w}`, callback_data: `w:${i}` }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  if (words.length > 1) rows.push([{ text: L.btnWordsClear, callback_data: 'w:all' }]);
  rows.push(back(L));
  const text = L.wordsMenu(words, WORDS_MAX, WORD_MAX_LEN);
  return { text: note ? `${note}\n\n${text}` : text, reply_markup: { inline_keyboard: rows } };
}

// 🔧 Options: on/off switches (o:<option>), see OPTIONS in users.js.
export function optionsView(user, L) {
  const rows = OPTIONS.map((o) => [{ text: `${user[o] ? '✅' : '⬜️'} ${L.options[o]}`, callback_data: `o:${o}` }]);
  rows.push(back(L));
  return { text: L.optionsMenu(user), reply_markup: { inline_keyboard: rows } };
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
