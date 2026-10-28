// Clean chat for the private chat, and its reply keyboard.
//
// Button taps are deleted, and the bot keeps at most two menu messages around —
//   home   — the welcome message carrying the reply keyboard (replaced on /start
//            and on a language change);
//   screen — whatever a button opened last (games menu, balance, top…), deleted as
//            soon as the next one opens.
// Game messages are content and are never deleted (they may hold stakes). The ids
// live on the player row (players.home_msg / screen_msg); the chat id is the user id.

import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { players } from '../schema.js';
import { sendHtml } from './engine.js';
import { LOCALES } from './i18n.js';
import { t } from './strings.js';

const ids = (userId) => db.select({ homeMsg: players.homeMsg, screenMsg: players.screenMsg })
  .from(players).where(eq(players.id, userId)).get();
const save = (userId, set) => db.update(players).set(set).where(eq(players.id, userId)).run();

export function drop(chatId, messageId) {
  if (!messageId) return Promise.resolve();
  return api.deleteMessage({ chat_id: chatId, message_id: messageId }).catch(() => {});
}

// Sends the chat's new `slot` message, then deletes the one it replaces (sent
// first, so the reply keyboard never blinks away).
async function replace(slot, userId, text, markup) {
  const prev = (await ids(userId))?.[slot];
  const sent = await sendHtml(userId, text, markup);
  await save(userId, { [slot]: sent.message_id });
  if (prev !== sent.message_id) await drop(userId, prev);
  return sent;
}

export const showScreen = (userId, text, markup) => replace('screenMsg', userId, text, markup);

// A new home message also clears the open screen.
export async function showHome(userId, text, markup) {
  const sent = await replace('homeMsg', userId, text, markup);
  await closeScreen(userId);
  return sent;
}

export async function closeScreen(userId) {
  const prev = (await ids(userId))?.screenMsg;
  if (!prev) return;
  await save(userId, { screenMsg: null });
  await drop(userId, prev);
}

// --- reply keyboard ---------------------------------------------------------------

const KEYS = [['kb_games', 'kb_hub'], ['kb_balance', 'kb_daily', 'kb_shop'], ['kb_top', 'kb_language', 'kb_about']];

export function mainKeyboard(locale) {
  return {
    keyboard: KEYS.map((row) => row.map((k) => ({ text: t(locale, k) }))),
    resize_keyboard: true,
    is_persistent: true,
  };
}

// A tapped reply-keyboard label, in any language → its key without "kb_", or null.
export function matchButton(text) {
  const s = (text ?? '').trim();
  if (!s) return null;
  for (const k of KEYS.flat()) {
    if (LOCALES.some((l) => t(l, k) === s)) return k.slice(3);
  }
  // 🔗 Source code, on keyboards sent before it moved into ℹ️ About.
  if (LOCALES.some((l) => t(l, 'kb_source') === s)) return 'about';
  return null;
}
