// Clean chat for the private chat: the user's button taps and searches are
// deleted, and the bot keeps at most two menu messages around —
//   home   — the welcome text carrying the reply keyboard (replaced on /start
//            and on a language change);
//   screen — whatever was opened last (a list, a CVE card, settings…), deleted
//            as soon as the next one opens; its inline buttons edit it in place.
// Alerts are content and are never deleted. The ids live on the `chats` row
// (home_msg / screen_msg); the chat id is the user id.

import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { chats } from '../schema.js';

export function drop(chatId, messageId) {
  if (!messageId) return Promise.resolve();
  return api.deleteMessage({ chat_id: chatId, message_id: messageId }).catch(() => {});
}

const ids = (chatId) => db.select({ homeMsg: chats.homeMsg, screenMsg: chats.screenMsg })
  .from(chats).where(eq(chats.id, chatId)).get();
const save = (chatId, set) => db.update(chats).set(set).where(eq(chats.id, chatId)).run();

const send = (chatId, params) => api.sendMessage({
  chat_id: chatId, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...params,
});

// Send the chat's new `slot` message, then delete the one it replaces (sent
// first, so the reply keyboard never blinks away).
async function replace(slot, chatId, params) {
  const prev = (await ids(chatId))?.[slot];
  const sent = await send(chatId, params);
  await save(chatId, { [slot]: sent.message_id });
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
  const prev = (await ids(chatId))?.screenMsg;
  if (!prev) return;
  await save(chatId, { screenMsg: null });
  await drop(chatId, prev);
}

// Replace the screen a callback came from with new content, in place. A message
// that can't be edited any more (too old, deleted) is replaced by a new screen.
export async function editScreen(message, params) {
  try {
    await api.editMessageText({
      chat_id: message.chat.id, message_id: message.message_id,
      parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...params,
    });
  } catch (e) {
    if (/message is not modified/.test(e.description ?? '')) return;
    await showScreen(message.chat.id, params);
  }
}
