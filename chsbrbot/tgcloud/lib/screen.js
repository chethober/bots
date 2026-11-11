// Clean chat for the private chat: the user's button taps and searches are
// deleted, and the bot keeps at most two menu messages around —
//   home   — the welcome text carrying the reply keyboard (replaced on /start
//            and on a language change);
//   screen — whatever was opened last (a list, a CVE card, settings…), deleted
//            as soon as the next one opens; its inline buttons edit it in place.
// Alerts are content and are never deleted. The ids live on the `chats` row
// (home_msg / screen_msg); the chat id is the user id.
//
// A screen with a `widget` (the CVE card, the 🔥 / 🆕 lists) is sent as a message
// widget, else (or when that fails) as its text. A widget message can't become
// text, nor another kind of widget, so switching replaces the message instead of
// editing it.

import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { chats } from '../schema.js';
import { sendWidgetCard, editWidgetCard, widgetsOn } from './widgets/index.js';
import { NVD_HOST } from './config.js';

export function drop(chatId, messageId) {
  if (!messageId) return Promise.resolve();
  return api.deleteMessage({ chat_id: chatId, message_id: messageId }).catch(() => {});
}

const ids = (chatId) => db.select({ homeMsg: chats.homeMsg, screenMsg: chats.screenMsg })
  .from(chats).where(eq(chats.id, chatId)).get();
const save = (chatId, set) => db.update(chats).set(set).where(eq(chats.id, chatId)).run();

// The card lib/widgets sends: the widget with the screen's inline keyboard.
export const widgetCard = ({ widget, reply_markup }) => ({ widget, keyboard: reply_markup?.inline_keyboard });

async function send(chatId, { widget, ...params }) {
  if (widget) {
    const sent = await sendWidgetCard(chatId, widgetCard({ widget, reply_markup: params.reply_markup }));
    if (sent) return sent;
  }
  return api.sendMessage({
    chat_id: chatId, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...params,
  });
}

// The kind of widget a screen message shows, told by its buttons (Telegram doesn't
// say): a list opens CVEs (cv:…), a card links to NVD. Null for text, or unknown.
export function shownKind(message) {
  if (!message?.widget) return null;
  const buttons = (message.reply_markup?.inline_keyboard ?? []).flat();
  if (buttons.some((b) => b.callback_data?.startsWith('cv:'))) return 'cvelist';
  if (buttons.some((b) => b.url?.startsWith(`https://${NVD_HOST}/`))) return 'cve';
  return null;
}

// A CVE card's page holds its description and its height fits that CVE, so the
// card of another CVE is a new message; the same CVE (🔔 Follow, a refresh) is
// edited in place. The CVE a card shows is in its NVD link.
function sameCard(message, widget) {
  if (widget.kind !== 'cve') return true;
  const buttons = (message.reply_markup?.inline_keyboard ?? []).flat();
  return buttons.some((b) => b.url?.startsWith(`https://${NVD_HOST}/`) && b.url.toUpperCase().endsWith(`/${String(widget.data.i).toUpperCase()}`));
}

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
  const kind = params.widget && widgetsOn() ? params.widget.kind : null;
  if (message.widget || kind) {
    if (kind && kind === shownKind(message) && sameCard(message, params.widget)) {
      try {
        return await editWidgetCard(message, widgetCard(params));
      } catch (e) {
        console.warn('widget edit failed:', e.description ?? e.message);
      }
    }
    // Text ↔ widget, or another kind of widget: a new screen replaces this one.
    const sent = await showScreen(message.chat.id, params);
    if (sent.message_id !== message.message_id) await drop(message.chat.id, message.message_id);
    return;
  }
  try {
    await api.editMessageText({
      chat_id: message.chat.id, message_id: message.message_id,
      parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...params,
    });
  } catch (e) {
    if (/message is not modified/.test(e.description ?? '')) return;
    const { widget, ...text } = params;
    await showScreen(message.chat.id, text);
  }
}
