// Clean chat for the private chat: the user's button taps, commands and typed
// answers are deleted, and the bot keeps at most two menu messages around —
//   home   — the greeting carrying the reply keyboard (replaced on /start and
//            on a language change);
//   screen — the menu, prompt or notice shown last, deleted as soon as the next
//            one opens; its inline buttons edit it in place.
// Cards posted with send() (recipes, briefings, picks, alerts…) are content and
// are never deleted; views a screen's buttons open in place go with it. The ids
// live on the chat's `prefs` row (home_msg / screen_msg).

import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { prefs } from '../schema.js';
import { savePrefs } from './store.js';

export function drop(chatId, messageId) {
  if (!messageId) return Promise.resolve();
  return api.deleteMessage({ chat_id: chatId, message_id: messageId }).catch(() => {});
}

const ids = (chatId) => db.select({ homeMsg: prefs.homeMsg, screenMsg: prefs.screenMsg })
  .from(prefs).where(eq(prefs.chatId, chatId)).get();

export async function screenId(chatId) {
  return (await ids(chatId))?.screenMsg ?? null;
}

// Send the chat's new `slot` message with `send()`, then delete the one it
// replaces (sent first, so the reply keyboard never blinks away).
async function replace(slot, chatId, send) {
  const prev = (await ids(chatId))?.[slot];
  const sent = await send();
  await savePrefs(chatId, { [slot]: sent.message_id });
  if (prev && prev !== sent.message_id) await drop(chatId, prev);
  return sent;
}

export const showScreen = (chatId, send) => replace('screenMsg', chatId, send);

// A new home message also clears the open screen.
export async function showHome(chatId, send) {
  const sent = await replace('homeMsg', chatId, send);
  await closeScreen(chatId);
  return sent;
}

export async function closeScreen(chatId) {
  const prev = (await ids(chatId))?.screenMsg;
  if (!prev) return;
  await savePrefs(chatId, { screenMsg: null });
  await drop(chatId, prev);
}
