// handlers/message.js — the private chat. Everything is a button on the reply
// keyboard; typing anything else searches (a CVE id opens its card), or, right
// after ⚙️ Settings → 👁 Watchlist → ➕ Add, adds to the watchlist. The only
// slash commands are /start (which also takes a CVE id from deep links) and
// the admin ones. Groups and channels only receive alerts, so their messages
// are ignored.

import { api } from 'sdk';
import { SOURCE_URL, MIN_CVSS, ADMIN_IDS } from '../lib/config.js';
import { aboutKeyboard, thankTip } from '../lib/tips.js';
import { upsertChat, getChat, migrate, setFilters } from '../lib/chats.js';
import { getSetting, saveSetting, deleteSetting } from '../lib/settings.js';
import { watchOf, parseWatch, addWatch } from '../lib/filters.js';
import { localeFor, languageKeyboard } from '../lib/i18n.js';
import { drop, showHome, showScreen } from '../lib/screen.js';
import { normalizeId } from '../lib/nvd.js';
import {
  isAdmin, matchButton, homeView, listView, categoriesView, cveView, settingsView, watchView, watchPromptView,
} from '../lib/views.js';
import { dashboardView, statsView, queueBroadcast } from '../lib/admin.js';
import { runTick } from '../lib/scheduler.js';
import { t } from '../lib/strings.js';

// How long ➕ Add waits for the words.
const WATCH_INPUT_MS = 15 * 60_000;

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
  // A pending ➕ Add takes this message, unless it's a command or a button.
  const asked = Number(await getSetting(`watch:${chatId}`));
  if (asked) await deleteSetting(`watch:${chatId}`);

  if (command?.cmd === 'start') {
    await sendHome(message.from, locale);
    const id = normalizeId(command.args);
    if (id) await showScreen(chatId, await cveView(id, locale));
    return;
  }
  if (command && ['admin', 'stats', 'broadcast'].includes(command.cmd) && isAdmin(message.from.id)) {
    return onAdminCommand(command, message);
  }

  const button = matchButton(message.text);
  if (button) return onButton(button, message, locale);

  const text = (message.text ?? '').trim();
  if (!command && Date.now() - asked < WATCH_INPUT_MS) return addToWatchlist(chatId, text, locale);
  if (command || text.length < 2) return sendHome(message.from, locale);
  await api.sendChatAction({ chat_id: chatId, action: 'typing' }).catch(() => {});
  if (/^(CVE-)?\d{4}-\d{4,7}$/i.test(text)) return showScreen(chatId, await cveView(text, locale));
  await saveSetting(`q:${chatId}`, text.slice(0, 100));
  return showScreen(chatId, await listView('q', 0, chatId, locale));
}

async function addToWatchlist(chatId, text, locale) {
  const words = parseWatch(text);
  if (!words.length) {
    await saveSetting(`watch:${chatId}`, String(Date.now()));
    return showScreen(chatId, watchPromptView(locale));
  }
  const chat = await getChat(chatId);
  await setFilters(chatId, { watch: addWatch(watchOf(chat), words) });
  return showScreen(chatId, watchView(await getChat(chatId), locale));
}

export default async function (message) {
  if (message.migrate_to_chat_id) return migrate(message.chat.id, message.migrate_to_chat_id);
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
