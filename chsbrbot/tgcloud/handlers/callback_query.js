// handlers/callback_query.js — inline buttons on the private chat's screens
// (see lib/views.js and lib/admin.js for the callback data). A screen's buttons
// edit that screen in place.

import { api } from 'sdk';
import { upsertChat, getChat, setActive, setFilters } from '../lib/chats.js';
import { getSetting, saveSetting, deleteSetting } from '../lib/settings.js';
import { LEVELS, watchOf, parseWatch, addWatch } from '../lib/filters.js';
import { setLocale, localeFor, LOCALE_NAMES } from '../lib/i18n.js';
import { editScreen, showHome, showScreen } from '../lib/screen.js';
import {
  isAdmin, homeView, listView, categoriesView, cveView, settingsView, levelView, watchView, watchPromptView,
} from '../lib/views.js';
import { dashboardView, statsView, historyView, chatsView, sendTestAlert, tickView } from '../lib/admin.js';
import { t } from '../lib/strings.js';
import { aboutKeyboard, isTipCallback, onTipCallback } from '../lib/tips.js';
import { SOURCE_URL } from '../lib/config.js';

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

// The watchlist screen. 🗑 and ❌ edit it in place; ➕ asks for words, which
// handlers/message.js picks up from the next message (key watch:<chatId>).
async function onWatch(q, [action, arg], chatId, locale) {
  await deleteSetting(`watch:${chatId}`);
  const watch = watchOf(await getChat(chatId));
  if (action === 'add') {
    await saveSetting(`watch:${chatId}`, String(Date.now()));
    await answer(q);
    return editScreen(q.message, watchPromptView(locale));
  }
  if (action === 'q') {
    // From a search's results: the screen stays, without the button.
    const words = parseWatch((await getSetting(`q:${chatId}`)) ?? '').slice(0, 1);
    await setFilters(chatId, { watch: addWatch(watch, words) });
    await answer(q, t(locale, 'watch_added'));
    return editScreen(q.message, await listView('q', Number(arg) || 0, chatId, locale));
  }
  if (action === 'del') await setFilters(chatId, { watch: watch.filter((_, i) => i !== Number(arg)) });
  if (action === 'clr') await setFilters(chatId, { watch: [] });
  await answer(q);
  return editScreen(q.message, watchView(await getChat(chatId), locale));
}

async function route(q, locale) {
  const data = q.data ?? '';
  const [op, ...rest] = data.split(':');
  const chatId = q.message.chat.id;
  // Any other button cancels a pending ➕ Add to the watchlist.
  if (op !== 'wl') await deleteSetting(`watch:${chatId}`);

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
    return editScreen(q.message, await cveView(id, locale, list ? `ls:${list}:${page ?? 0}` : null));
  }
  if (op === 'cve') {
    // "Full details" on alerts sent by the old Worker: open the card as a new
    // screen, leaving the alert alone.
    await answer(q);
    return showScreen(chatId, await cveView(rest[0], locale));
  }
  if (op === 'cats') {
    await answer(q);
    return editScreen(q.message, categoriesView(locale));
  }
  if (op === 'set' || op === 'sub') {
    if (op === 'sub') {
      const on = !(await getChat(chatId))?.active;
      await setActive(chatId, on);
      await answer(q, t(locale, on ? 'alerts_on' : 'alerts_off'));
    } else await answer(q);
    return editScreen(q.message, settingsView(await getChat(chatId), q.from.id, locale));
  }
  if (op === 'lvl') {
    if (LEVELS.includes(rest[0])) {
      await setFilters(chatId, { level: rest[0] });
      await answer(q, t(locale, 'level_set'));
      return editScreen(q.message, settingsView(await getChat(chatId), q.from.id, locale));
    }
    await answer(q);
    return editScreen(q.message, levelView(await getChat(chatId), locale));
  }
  if (op === 'wl') return onWatch(q, rest, chatId, locale);
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
