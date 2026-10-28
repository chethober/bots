// Clean chat for the private chat: the user's button taps are deleted, and
// each chat keeps at most two bot messages around —
//   home   — the welcome text carrying the reply keyboard (replaced on /start
//            and on a language change);
//   screen — whatever a button opened last (language picker, source link…),
//            deleted as soon as the next one opens.
// The ids are kept in the settings table under `home:<chatId>` / `screen:<chatId>`.

import { api } from 'sdk';
import { getSetting, saveSetting } from './settings.js';

export function drop(chatId, messageId) {
  if (!messageId) return Promise.resolve();
  return api.deleteMessage({ chat_id: chatId, message_id: Number(messageId) }).catch(() => {});
}

// Send `params` as the chat's new `slot` message, then delete the one it replaces
// (sent first, so the reply keyboard never blinks away).
async function replace(slot, chatId, params) {
  const key = `${slot}:${chatId}`;
  const prev = await getSetting(key);
  const sent = await api.sendMessage({ chat_id: chatId, link_preview_options: { is_disabled: true }, ...params });
  await saveSetting(key, String(sent.message_id));
  await drop(chatId, prev);
  return sent;
}

export const showScreen = (chatId, params) => replace('screen', chatId, params);

// A new home message also clears the open screen.
export async function showHome(chatId, params) {
  const sent = await replace('home', chatId, params);
  await closeScreen(chatId);
  return sent;
}

export async function closeScreen(chatId) {
  const key = `screen:${chatId}`;
  const prev = await getSetting(key);
  if (!prev) return;
  await saveSetting(key, '');
  await drop(chatId, prev);
}
