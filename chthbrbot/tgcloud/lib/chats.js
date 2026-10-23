// Per-chat language and clean chat (the chats table).
//
// Language: the choice made with 🌐 Language, else the legacy users.locale, else
// Telegram's language_code (refreshed whenever the person does something), else
// DEFAULT_LOCALE.
//
// Clean chat: the person's button taps are deleted, and the bot keeps at most two
// menu messages in the chat —
//   home   — the welcome message carrying the reply keyboard (replaced on /start
//            and on a language change);
//   screen — whatever a button opened last (stats, settings, a prompt…), deleted
//            as soon as the next one opens.
// Content (anonymous messages, replies, "delivered" confirmations) is never touched.

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { chats, users } from '../schema.js';
import { LOCALES, normalizeLocale } from './i18n.js';
import { DEFAULT_LOCALE, texts } from './texts.js';
import { safeApi } from './util.js';

const getChat = (id) => db.select().from(chats).where(eq(chats.id, id)).get();

async function upsert(id, set) {
  await db.insert(chats).values({ id, ...set }).onConflictDoUpdate({ target: chats.id, set });
}

async function resolve(id, chat) {
  if (chat?.locale) return chat.locale;
  const legacy = (await db.select({ locale: users.locale }).from(users).where(eq(users.id, id)).get())?.locale;
  return legacy || chat?.lang || DEFAULT_LOCALE;
}

// The texts of the person behind `from` (a Telegram User), recording their
// Telegram language on the way.
export async function textsFor(from) {
  let chat = await getChat(from.id);
  const lang = from.language_code ? normalizeLocale(from.language_code) : null;
  if (lang && chat?.lang !== lang) {
    await upsert(from.id, { lang });
    chat = { ...chat, lang };
  }
  return texts(await resolve(from.id, chat));
}

// The texts of someone who isn't the one acting (the owner a message goes to…).
export async function textsOf(id) {
  return texts(await resolve(id, await getChat(id)));
}

export async function setLocale(id, locale) {
  await upsert(id, { locale: LOCALES.includes(locale) ? locale : normalizeLocale(locale) });
}

// --- clean chat -------------------------------------------------------------------

export function drop(chatId, messageId) {
  return messageId ? safeApi('deleteMessage', { chat_id: chatId, message_id: messageId }) : null;
}

// Sends the chat's new `slot` message (api[method](params)), then deletes the one
// it replaces — sent first, so the reply keyboard never blinks away.
async function replace(slot, chatId, params, method) {
  const prev = (await getChat(chatId))?.[slot];
  const sent = await safeApi(method, { chat_id: chatId, link_preview_options: { is_disabled: true }, ...params });
  if (!sent) return null;
  await upsert(chatId, { [slot]: sent.message_id });
  if (prev !== sent.message_id) await drop(chatId, prev);
  return sent;
}

export const showScreen = (chatId, params, method = 'sendMessage') => replace('screenMsg', chatId, params, method);

// A new home message also clears the open screen.
export async function showHome(chatId, params) {
  const sent = await replace('homeMsg', chatId, params, 'sendMessage');
  await closeScreen(chatId);
  return sent;
}

export async function closeScreen(chatId) {
  const prev = (await getChat(chatId))?.screenMsg;
  if (!prev) return;
  await upsert(chatId, { screenMsg: null });
  await drop(chatId, prev);
}

// The open screen is `messageId` (a button on it was pressed): it can be edited in place.
export async function isScreen(chatId, messageId) {
  return (await getChat(chatId))?.screenMsg === messageId;
}

// --- keyboards ----------------------------------------------------------------------

const KEYS = [['link', 'stats'], ['settings', 'language'], ['privacy', 'source']];

export function mainKeyboard(L) {
  return {
    keyboard: KEYS.map((row) => row.map((k) => ({ text: L.kb[k] }))),
    resize_keyboard: true,
    is_persistent: true,
  };
}

// A tapped reply-keyboard label, in any language → its key, or null.
export function matchButton(text) {
  const t = (text ?? '').trim();
  if (!t) return null;
  for (const L of LOCALES.map(texts)) {
    for (const [key, label] of Object.entries(L.kb)) if (label === t) return key;
  }
  return null;
}

// The ✖️ Cancel button under a prompt (send, reply, invitation text, broadcast).
export const cancelRow = (L) => [{ text: L.btnCancel, callback_data: 'c:x' }];
