// handlers/callback_query.js — inline buttons on the private chat's screens
// (see lib/views.js and lib/admin.js for the callback data). A screen's buttons
// edit that screen in place.

import { api } from 'sdk';
import { upsertChat, getChat, setActive, setFilters } from '../lib/chats.js';
import { getSetting } from '../lib/settings.js';
import { LEVELS, MODES, watchOf, parseWatch, addWatch } from '../lib/filters.js';
import { follow, unfollow, isFollowing, MAX_FOLLOWS } from '../lib/follows.js';
import { manageable, managedChats } from '../lib/managers.js';
import { askFor, cancelInput } from '../lib/input.js';
import { setLocale, localeFor, LOCALE_NAMES } from '../lib/i18n.js';
import { editScreen, showHome, showScreen } from '../lib/screen.js';
import {
  isAdmin, homeView, listView, categoriesView, cveView, settingsView, levelView, deliveryView, watchView,
  watchPromptView, managedView, linkPromptView,
} from '../lib/views.js';
import { dashboardView, statsView, historyView, chatsView, sendTestAlert, tickView } from '../lib/admin.js';
import { t } from '../lib/strings.js';
import { aboutKeyboard, isTipCallback, onTipCallback } from '../lib/tips.js';
import { SOURCE_URL, deepLink } from '../lib/config.js';

const answer = (q, text, alert = false) =>
  api.answerCallbackQuery({ callback_query_id: q.id, text, show_alert: alert }).catch(() => {});

async function onAdmin(q, action, locale) {
  if (!isAdmin(q.from.id)) return answer(q, t(locale, 'admins_only'), true);
  if (action === 'test') {
    const sent = await sendTestAlert(q.from.id, locale);
    return answer(q, sent ? '🧪 Sent.' : 'No CVE stored yet — run the scheduler first.', !sent);
  }
  if (action === 'tick') {
    await answer(q, '⚡ Running…');
    return editScreen(q.message, await tickView());
  }
  await answer(q);
  const view = { stats: statsView, hist: historyView, chats: chatsView }[action] ?? dashboardView;
  return editScreen(q.message, await view());
}

// The watchlist screen of `chat`. 🗑 and ❌ edit it in place; ➕ asks for
// words, which handlers/message.js picks up from the next message.
async function onWatch(q, chat, [action, arg], locale) {
  const watch = watchOf(chat);
  if (action === 'add') {
    await askFor(q.from.id, 'watch', chat.id);
    await answer(q);
    return editScreen(q.message, watchPromptView(chat, locale));
  }
  if (action === 'q') {
    // From a search's results: the screen stays, without the button.
    const words = parseWatch((await getSetting(`q:${chat.id}`)) ?? '').slice(0, 1);
    await setFilters(chat.id, { watch: addWatch(watch, words) });
    await answer(q, t(locale, 'watch_added'));
    return editScreen(q.message, await listView('q', Number(arg) || 0, chat.id, locale));
  }
  if (action === 'del') await setFilters(chat.id, { watch: watch.filter((_, i) => i !== Number(arg)) });
  if (action === 'clr') await setFilters(chat.id, { watch: [] });
  await answer(q);
  return editScreen(q.message, watchView(await getChat(chat.id), locale));
}

// Buttons of the settings screens: `op` acts on the chat `rest[0]` (the user's
// own chat when left out), after checking they may change it.
async function onSettings(q, op, rest, locale) {
  const userId = q.from.id;
  const chat = await manageable(userId, rest[0] ? Number(rest[0]) : userId);
  if (!chat) return answer(q, t(locale, 'manage_denied'), true);
  const [, choice, arg] = rest;
  const settings = async (toast) => {
    await answer(q, toast);
    return editScreen(q.message, settingsView(await getChat(chat.id), userId, locale));
  };
  if (op === 'set' || op === 'mc') return settings();
  if (op === 'sub') {
    await setActive(chat.id, !chat.active);
    return settings(t(locale, chat.active ? 'alerts_off' : 'alerts_on'));
  }
  if (op === 'lvl') {
    if (!LEVELS.includes(choice)) return answer(q).then(() => editScreen(q.message, levelView(chat, locale)));
    await setFilters(chat.id, { level: choice });
    return settings(t(locale, 'level_set'));
  }
  if (op === 'dg') {
    if (!MODES.includes(choice)) return answer(q).then(() => editScreen(q.message, deliveryView(chat, locale)));
    // A digest covers what is sent from now on.
    await setFilters(chat.id, { mode: choice, digestAt: choice === 'instant' ? null : Math.floor(Date.now() / 1000) });
    return settings(t(locale, `mode_set_${choice}`));
  }
  return onWatch(q, chat, [choice, arg], locale);
}

// 🔔 Follow / 🔕 Unfollow on a CVE card (fo:<id>[:<back>]) or an update (uf:<id>).
async function onFollow(q, op, [id, ...back], locale) {
  const chatId = q.message.chat.id;
  if (op === 'uf' || await isFollowing(chatId, id)) {
    await unfollow(chatId, id);
    await answer(q, t(locale, 'unfollowed'));
  } else if (await follow(chatId, id)) {
    await answer(q, t(locale, 'followed'));
  } else return answer(q, t(locale, 'follow_limit', { max: MAX_FOLLOWS }), true);
  if (op === 'uf') {
    // The update stays in the chat, with only its link to the card.
    return api.editMessageReplyMarkup({
      chat_id: chatId, message_id: q.message.message_id,
      reply_markup: { inline_keyboard: [[{ text: t(locale, 'btn_details'), url: deepLink(id) }]] },
    }).catch(() => {});
  }
  return editScreen(q.message, await cveView(id, locale, back.length ? back.join(':') : null, chatId));
}

async function route(q, locale) {
  const data = q.data ?? '';
  const [op, ...rest] = data.split(':');
  const chatId = q.message.chat.id;
  // Any button cancels a question waiting for a message (➕ Add asks again).
  await cancelInput(q.from.id);

  if (op === 'lang') {
    await setLocale(q.from.id, rest[0]);
    const next = await localeFor(q.from);
    await answer(q, t(next, 'language_set', { name: LOCALE_NAMES[next] ?? next }));
    return showHome(chatId, await homeView(q.from, next));
  }
  if (op === 'ls') {
    await answer(q);
    return editScreen(q.message, await listView(rest[0], Number(rest[1]) || 0, chatId, locale));
  }
  if (op === 'cv') {
    await answer(q);
    const [id, list, page] = rest;
    return editScreen(q.message, await cveView(id, locale, list ? `ls:${list}:${page ?? 0}` : null, chatId));
  }
  if (op === 'cve') {
    // "Full details" on alerts sent by the old Worker: open the card as a new
    // screen, leaving the alert alone.
    await answer(q);
    return showScreen(chatId, await cveView(rest[0], locale, null, chatId));
  }
  if (op === 'cats') {
    await answer(q);
    return editScreen(q.message, categoriesView(locale));
  }
  if (['set', 'sub', 'lvl', 'dg', 'wl', 'mc'].includes(op)) return onSettings(q, op, rest, locale);
  if (op === 'fo' || op === 'uf') return onFollow(q, op, rest, locale);
  if (op === 'mcs') {
    await answer(q);
    return editScreen(q.message, managedView(await managedChats(q.from.id), locale));
  }
  if (op === 'mca') {
    await askFor(q.from.id, 'link');
    await answer(q);
    return editScreen(q.message, linkPromptView(locale));
  }
  if (op === 'adm') return onAdmin(q, rest[0], locale);
  if (isTipCallback(data)) return onTipCallback(q, locale, aboutKeyboard(locale, SOURCE_URL));
  return answer(q);
}

export default async function (q) {
  // Only the private chat has screens; old buttons elsewhere just get answered.
  if (!q.message || q.message.chat.type !== 'private') return answer(q);
  const locale = await localeFor(q.from);
  try {
    await upsertChat(q.message.chat);
    await route(q, locale);
  } catch (e) {
    console.error(e);
    await answer(q, t(locale, 'error'), true);
  }
}
