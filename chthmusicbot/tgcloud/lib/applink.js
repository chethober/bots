// The chat Mini App's link. Web App buttons only work in private chats, so a
// group gets a t.me/<bot>?startapp=<param> link: it opens the bot's main Mini
// App (set in @BotFather) in place, and the param says which chat it's for:
// c<chat id without the minus>[t<topic id>]. Anyone can make such a link, so
// every call checks that the caller is a member of the chat (chatapp.js).

import { api } from 'sdk';
import { BOT_USERNAME } from './config.js';
import { localeFor } from './i18n.js';
import { t } from './strings.js';

export const appParam = (chatId, threadId = 0) => `c${Math.abs(chatId)}${threadId > 0 ? `t${threadId}` : ''}`;

export const appLink = (chatId, threadId = 0) => `https://t.me/${BOT_USERNAME}?startapp=${appParam(chatId, threadId)}`;

/** { chatId, threadId } of a start param, or null. */
export function parseAppParam(param) {
  const m = /^c(\d{1,16})(?:t(\d{1,10}))?$/.exec(String(param ?? ''));
  return m ? { chatId: -Number(m[1]), threadId: Number(m[2] ?? 0) } : null;
}

/** /app in a group, topic or channel: a post with the button that opens the Mini App. */
export async function postAppButton(message, threadId) {
  const chatId = message.chat.id;
  const locale = await localeFor(message.from);
  await api.deleteMessage({ chat_id: chatId, message_id: message.message_id }).catch(() => {});
  return api.sendMessage({
    chat_id: chatId, message_thread_id: threadId || undefined,
    text: t(locale, 'app_here'),
    reply_markup: { inline_keyboard: [[{ text: t(locale, 'app_open'), url: appLink(chatId, threadId) }]] },
  }).catch((e) => console.warn('cannot post /app', chatId, e.description ?? e.message));
}
