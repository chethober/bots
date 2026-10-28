// handlers/message.js — the private chat. Everything is a button on the reply
// keyboard; typing anything else searches (a CVE id opens its card), unless a
// screen asked for something (lib/input.js): words for a watchlist, or a group
// or channel to manage. The only slash commands are /start (which also takes a
// CVE id, or m<chat id> to open a group's settings, from deep links) and the
// admin ones. Groups and channels only receive alerts; there the only command
// is /settings, which links an admin to the group's settings.

import { api } from 'sdk';
import { SOURCE_URL, MIN_CVSS, ADMIN_IDS, BOT_USERNAME } from '../lib/config.js';
import { aboutKeyboard, thankTip } from '../lib/tips.js';
import { upsertChat, getChat, migrate, setFilters } from '../lib/chats.js';
import { saveSetting } from '../lib/settings.js';
import { watchOf, parseWatch, addWatch } from '../lib/filters.js';
import { manageable, chatFromMessage } from '../lib/managers.js';
import { askFor, takeInput } from '../lib/input.js';
import { localeFor, languageKeyboard } from '../lib/i18n.js';
import { drop, showHome, showScreen } from '../lib/screen.js';
import { normalizeId } from '../lib/nvd.js';
import {
  isAdmin, matchButton, homeView, listView, categoriesView, cveView, settingsView, watchView, watchPromptView,
  linkPromptView,
} from '../lib/views.js';
import { dashboardView, statsView, queueBroadcast } from '../lib/admin.js';
import { runTick } from '../lib/scheduler.js';
import { t } from '../lib/strings.js';

function parseCommand(text) {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text ?? '');
  return m ? { cmd: m[1].toLowerCase(), args: (m[2] ?? '').trim() } : null;
}

async function sendHome(from, locale) {
  return showHome(from.id, await homeView(from, locale));
}

async function onButton(button, message, locale) {
  const chatId = message.chat.id;
  switch (button) {
    case 'latest': return showScreen(chatId, await listView('new', 0, chatId, locale));
    case 'trending': return showScreen(chatId, await listView('hot', 0, chatId, locale));
    case 'search': return showScreen(chatId, { text: t(locale, 'search_prompt') });
    case 'categories': return showScreen(chatId, categoriesView(locale));
    case 'settings': return showScreen(chatId, settingsView(await getChat(chatId), message.from.id, locale));
    case 'language': return showScreen(chatId, { text: t(locale, 'choose_language'), reply_markup: languageKeyboard() });
    case 'about': return showScreen(chatId, {
      text: t(locale, 'about', { min: MIN_CVSS }), reply_markup: aboutKeyboard(locale, SOURCE_URL),
    });
  }
}

async function onAdminCommand({ cmd, args }, message) {
  const chatId = message.chat.id;
  if (cmd === 'admin') return showScreen(chatId, await dashboardView());
  if (cmd === 'stats') return showScreen(chatId, await statsView());
  // broadcast
  const reply = await queueBroadcast(args);
  await showScreen(chatId, { text: reply });
  if (reply.startsWith('📢')) await runTick({ budgetMs: 15_000 });
}

async function onPrivate(message) {
  const chatId = message.chat.id;
  await upsertChat(message.chat);
  const locale = await localeFor(message.from);
  const command = parseCommand(message.text);
  await drop(chatId, message.message_id);
  // A question on the screen takes this message, unless it's a command or a button.
  const input = await takeInput(message.from.id);

  if (command?.cmd === 'start') {
    await sendHome(message.from, locale);
    const managed = /^m(-?\d+)$/.exec(command.args);
    if (managed) return openManaged(message.from.id, Number(managed[1]), locale);
    const id = normalizeId(command.args);
    if (id) await showScreen(chatId, await cveView(id, locale, null, chatId));
    return;
  }
  if (command && ['admin', 'stats', 'broadcast'].includes(command.cmd) && isAdmin(message.from.id)) {
    return onAdminCommand(command, message);
  }

  const button = matchButton(message.text);
  if (button) return onButton(button, message, locale);

  const text = (message.text ?? '').trim();
  if (!command && input?.kind === 'watch') return addToWatchlist(message.from.id, input.chatId, text, locale);
  if (!command && input?.kind === 'link') return linkChat(message, locale);
  if (command || text.length < 2) return sendHome(message.from, locale);
  await api.sendChatAction({ chat_id: chatId, action: 'typing' }).catch(() => {});
  if (/^(CVE-)?\d{4}-\d{4,7}$/i.test(text)) return showScreen(chatId, await cveView(text, locale, null, chatId));
  await saveSetting(`q:${chatId}`, text.slice(0, 100));
  return showScreen(chatId, await listView('q', 0, chatId, locale));
}

async function addToWatchlist(userId, chatId, text, locale) {
  const chat = await manageable(userId, chatId ?? userId);
  if (!chat) return showScreen(userId, { text: t(locale, 'manage_denied') });
  const words = parseWatch(text);
  if (!words.length) {
    await askFor(userId, 'watch', chat.id);
    return showScreen(userId, watchPromptView(chat, locale));
  }
  await setFilters(chat.id, { watch: addWatch(watchOf(chat), words) });
  return showScreen(userId, watchView(await getChat(chat.id), locale));
}

// The settings of a group or channel, if the user is its admin.
async function openManaged(userId, chatId, locale) {
  const chat = await manageable(userId, chatId);
  if (!chat || chat.type === 'private') return showScreen(userId, { text: t(locale, 'manage_denied') });
  return showScreen(userId, settingsView(chat, userId, locale));
}

// 📢 → ➕ Add: a forwarded post, an @username or a t.me link.
async function linkChat(message, locale) {
  const userId = message.from.id;
  const chatId = await chatFromMessage(message);
  const chat = chatId && chatId !== userId ? await getChat(chatId) : null;
  if (!chat?.active) {
    await askFor(userId, 'link');
    const { text, reply_markup } = linkPromptView(locale);
    return showScreen(userId, { text: `${t(locale, 'link_unknown')}\n\n${text}`, reply_markup });
  }
  return openManaged(userId, chat.id, locale);
}

// /settings in a group: a button that opens the group's settings in the
// admin's private chat (where they are checked again).
async function onGroup(message) {
  const command = parseCommand(message.text);
  if (command?.cmd !== 'settings') return;
  const mention = /^\/\w+@(\w+)/.exec(message.text)?.[1];
  if (mention && mention.toLowerCase() !== BOT_USERNAME.toLowerCase()) return;
  // Admins only (an anonymous admin posts as the group itself).
  const anonymous = message.sender_chat?.id === message.chat.id;
  if (!anonymous && !(await manageable(message.from.id, message.chat.id))) return;
  const locale = 'en';
  await api.sendMessage({
    chat_id: message.chat.id,
    text: t(locale, 'group_settings'),
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{
      text: t(locale, 'btn_open_settings'), url: `https://t.me/${BOT_USERNAME}?start=m${message.chat.id}`,
    }]] },
  });
}

export default async function (message) {
  if (message.migrate_to_chat_id) return migrate(message.chat.id, message.migrate_to_chat_id);
  if (message.chat.type === 'group' || message.chat.type === 'supergroup') {
    return onGroup(message).catch((e) => console.warn('group message:', e.description ?? e.message));
  }
  if (message.chat.type !== 'private' || message.from?.is_bot) return;
  try {
    // A ⭐ tip from the About screen (lib/tips.js).
    if (message.successful_payment) return await thankTip(message, await localeFor(message.from), ADMIN_IDS);
    await onPrivate(message);
  } catch (e) {
    console.error(e);
    const locale = await localeFor(message.from).catch(() => 'en');
    await showScreen(message.chat.id, { text: t(locale, 'error') }).catch(() => {});
  }
}
