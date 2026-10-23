// The owner's chat with the bot: language, clean chat and the reply keyboard.
//
// Language: the uiLocale setting, or — when it is 'auto' — the language Telegram
// reports for the owner (recorded in the ui table whenever they write to the bot).
//
// Clean chat: button taps are deleted, and the bot keeps at most two menu
// messages in the chat —
//   home   — the help message carrying the reply keyboard (replaced on /start and
//            on a language change);
//   screen — whatever a button opened last (status, settings, setup steps…),
//            deleted as soon as the next one opens.
// Content (relayed contact messages, previews, notices) is never touched.

import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { ui } from '../schema.js';
import { getSettings } from './settings.js';
import { LOCALES, normalizeLocale } from './i18n.js';
import { t } from './strings.js';

const getUi = (userId) => db.select().from(ui).where(eq(ui.userId, userId)).get();

async function upsert(userId, set) {
  await db.insert(ui).values({ userId, ...set }).onConflictDoUpdate({ target: ui.userId, set }).run();
}

// The owner's UI language. With `from` (a Telegram User) their Telegram language
// is recorded first.
export async function localeOf(userId, from) {
  const [s, row] = await Promise.all([getSettings(userId), getUi(userId)]);
  let lang = row?.lang;
  if (from?.language_code) {
    const detected = normalizeLocale(from.language_code);
    if (detected !== lang) await upsert(userId, { lang: (lang = detected) });
  }
  if (s.uiLocale && s.uiLocale !== 'auto') return s.uiLocale;
  return LOCALES.includes(lang) ? lang : 'en';
}

// --- clean chat -------------------------------------------------------------------

export function drop(chatId, messageId) {
  if (!messageId) return Promise.resolve();
  return api.deleteMessage({ chat_id: chatId, message_id: messageId }).catch(() => {});
}

// Sends the chat's new `slot` message, then deletes the one it replaces (sent
// first, so the reply keyboard never blinks away).
async function replace(slot, chatId, params) {
  const prev = (await getUi(chatId))?.[slot];
  const sent = await api.sendMessage({ chat_id: chatId, link_preview_options: { is_disabled: true }, ...params });
  await upsert(chatId, { [slot]: sent.message_id });
  if (prev !== sent.message_id) await drop(chatId, prev);
  return sent;
}

export const showScreen = (chatId, params) => replace('screenMsg', chatId, params);

// A new home message also clears the open screen.
export async function showHome(chatId, params) {
  const sent = await replace('homeMsg', chatId, params);
  await closeScreen(chatId);
  return sent;
}

export async function closeScreen(chatId) {
  const prev = (await getUi(chatId))?.screenMsg;
  if (!prev) return;
  await upsert(chatId, { screenMsg: null });
  await drop(chatId, prev);
}

// Edits the open screen in place when `messageId` is it; otherwise opens a new one.
export async function updateScreen(chatId, messageId, { text, reply_markup }) {
  if (messageId && (await getUi(chatId))?.screenMsg === messageId) {
    try {
      return await api.editMessageText({
        chat_id: chatId, message_id: messageId, text, reply_markup, link_preview_options: { is_disabled: true },
      });
    } catch (e) {
      if (/not modified/i.test(e.description ?? '')) return null;
    }
  }
  return showScreen(chatId, { text, reply_markup });
}

// --- reply keyboard -------------------------------------------------------------------

const KEYS = [['kb_status', 'kb_settings'], ['kb_learn', 'kb_setup'], ['kb_language', 'kb_help', 'kb_source']];

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
  return null;
}
