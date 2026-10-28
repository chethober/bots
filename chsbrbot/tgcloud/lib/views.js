// The private chat's reply keyboard and screens: home, CVE lists, categories,
// a CVE card and settings. Each view returns { text, reply_markup }.
//
// Callback data:
//   ls:<list>:<page>          a list page — list is new | hot | q (the chat's last
//                             search, kept in settings as q:<chatId>) | c.<category>
//   cv:<id>:<list>:<page>     a CVE card opened from that list page
//   cats · set · sub · noop   categories · settings · alerts on/off · nothing
//   lvl · lvl:<level>         the alert level picker · pick one (lib/filters.js)
//   wl · wl:add · wl:del:<i>  the watchlist · add words (asks for them) ·
//   wl:clr · wl:q:<page>      remove one · remove all · add the last search

import { api } from 'sdk';
import { MIN_CVSS, ADMIN_IDS } from './config.js';
import { getSetting } from './settings.js';
import { search, latest, trending, getCve, kevEntry, CATEGORIES } from './cves.js';
import { normalizeId } from './nvd.js';
import { cveCard, severityEmoji, badge, esc, cut } from './format.js';
import { LEVELS, CRITICAL_CVSS, MAX_WATCH, levelOf, watchOf, parseWatch } from './filters.js';
import { getChat } from './chats.js';
import { LOCALES } from './i18n.js';
import { t } from './strings.js';

export const isAdmin = (userId) => ADMIN_IDS.includes(Number(userId));

export const ADMIN_COMMANDS = [
  { command: 'admin', description: 'Admin dashboard' },
  { command: 'stats', description: 'Subscribers, CVEs and alerts' },
  { command: 'broadcast', description: 'Message every subscriber: /broadcast [channel] <text>' },
];

// --- reply keyboard -----------------------------------------------------------

const KEYS = [['kb_latest', 'kb_trending'], ['kb_search', 'kb_categories'], ['kb_settings', 'kb_language', 'kb_about']];

export function mainKeyboard(locale) {
  return {
    keyboard: KEYS.map((row) => row.map((k) => ({ text: t(locale, k) }))),
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: t(locale, 'placeholder'),
  };
}

// A tapped reply-keyboard label, in any language → its key without "kb_", or null.
export function matchButton(text) {
  const s = (text ?? '').trim();
  if (!s) return null;
  for (const k of KEYS.flat()) {
    if (LOCALES.some((l) => t(l, k) === s)) return k.slice(3);
  }
  // 🔗 Source code, on keyboards sent before it moved into ℹ️ About.
  if (LOCALES.some((l) => t(l, 'kb_source') === s)) return 'about';
  return null;
}

// --- home -----------------------------------------------------------------------

export async function homeView(from, locale) {
  let text = t(locale, 'welcome', { name: esc(from.first_name ?? ''), min: MIN_CVSS });
  if (isAdmin(from.id)) {
    text += '\n\n👑 Admin: /admin dashboard · /stats · /broadcast [channel] &lt;text&gt;';
    await api.setMyCommands({ commands: ADMIN_COMMANDS, scope: { type: 'chat', chat_id: from.id } }).catch(() => {});
  }
  return { text, reply_markup: mainKeyboard(locale) };
}

// --- lists ------------------------------------------------------------------------

const PAGE = 5;

async function fetchList(list, page, chatId) {
  const args = { limit: PAGE + 1, offset: page * PAGE };
  if (list === 'new') return { items: await latest(args) };
  if (list === 'hot') return { items: await trending(args) };
  if (list.startsWith('c.')) return { items: await search({ ...args, category: list.slice(2) }) };
  const q = (await getSetting(`q:${chatId}`)) ?? '';
  return { items: await search({ ...args, q }), q };
}

function listTitle(list, q, locale) {
  if (list === 'new') return t(locale, 'latest_title');
  if (list === 'hot') return t(locale, 'trending_title');
  if (list.startsWith('c.')) return `⚡ <b>${esc(t(locale, `cat_${list.slice(2)}`))}</b>`;
  return t(locale, 'search_title', { q: esc(cut(q, 40)) });
}

export async function listView(list, page, chatId, locale) {
  const { items, q } = await fetchList(list, page, chatId);
  const shown = items.slice(0, PAGE);
  const title = listTitle(list, q, locale);
  if (!shown.length && page === 0) {
    const empty = list === 'q' ? t(locale, 'nothing_found', { q: esc(cut(q, 40)) }) : t(locale, 'empty_list');
    const rows = list.startsWith('c.') ? [[{ text: t(locale, 'btn_back'), callback_data: 'cats' }]] : [];
    return { text: `${title}\n\n${empty}`, reply_markup: { inline_keyboard: rows } };
  }

  const lines = [title, ''];
  const buttons = [];
  shown.forEach((c, i) => {
    const n = page * PAGE + i + 1;
    lines.push(`${n}. ${severityEmoji(c.severity)} <b>${c.id}</b> · ${esc(badge(c, locale))}`);
    if (c.description) lines.push(esc(cut(c.description, 110)));
    lines.push('');
    buttons.push({ text: `${n}. ${c.id}`, callback_data: `cv:${c.id}:${list}:${page}` });
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  const hasNext = items.length > PAGE;
  if (page > 0 || hasNext) {
    rows.push([
      ...(page > 0 ? [{ text: '⬅️', callback_data: `ls:${list}:${page - 1}` }] : []),
      { text: t(locale, 'page', { n: page + 1 }), callback_data: 'noop' },
      ...(hasNext ? [{ text: '➡️', callback_data: `ls:${list}:${page + 1}` }] : []),
    ]);
  }
  if (list.startsWith('c.')) rows.push([{ text: t(locale, 'btn_back'), callback_data: 'cats' }]);
  if (list === 'q') {
    // Searched for a product: offer to get its alerts only.
    const [word] = parseWatch(q);
    const watch = watchOf(await getChat(chatId));
    if (word && !watch.includes(word) && watch.length < MAX_WATCH) {
      rows.push([{ text: t(locale, 'btn_watch_q', { q: cut(word, 24) }), callback_data: `wl:q:${page}` }]);
    }
  }
  return { text: lines.join('\n').trimEnd(), reply_markup: { inline_keyboard: rows } };
}

export function categoriesView(locale) {
  const buttons = Object.keys(CATEGORIES).map((c) => ({ text: t(locale, `cat_${c}`), callback_data: `ls:c.${c}:0` }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { text: t(locale, 'categories_title'), reply_markup: { inline_keyboard: rows } };
}

// --- a CVE --------------------------------------------------------------------------

// The card for a CVE id (or something containing one), or a "not found" screen.
export async function cveView(input, locale, back = null) {
  const id = normalizeId(input);
  const cve = id ? await getCve(id) : null;
  if (!cve) {
    const rows = back ? [[{ text: t(locale, 'btn_back'), callback_data: back }]] : [];
    return { text: t(locale, 'cve_not_found', { id: esc(id ?? input) }), reply_markup: { inline_keyboard: rows } };
  }
  return cveCard(cve, locale, { kev: await kevEntry(cve.id), back });
}

// --- settings -----------------------------------------------------------------------

export function settingsView(chat, userId, locale) {
  const on = chat?.active ?? false;
  const watch = watchOf(chat);
  const rows = [
    [{ text: t(locale, on ? 'btn_alerts_off' : 'btn_alerts_on'), callback_data: 'sub' }],
    [{ text: t(locale, 'btn_level'), callback_data: 'lvl' }],
    [{ text: t(locale, 'btn_watchlist', { n: watch.length }), callback_data: 'wl' }],
  ];
  if (isAdmin(userId)) rows.push([{ text: t(locale, 'btn_admin'), callback_data: 'adm' }]);
  const text = on
    ? t(locale, 'settings_on', {
      level: t(locale, `level_${levelOf(chat)}`, { min: MIN_CVSS, crit: CRITICAL_CVSS.toFixed(1) }),
      watch: watch.length ? t(locale, 'watch_some', { words: esc(watch.join(', ')) }) : t(locale, 'watch_none'),
    })
    : t(locale, 'settings_off');
  return { text, reply_markup: { inline_keyboard: rows } };
}

const backToSettings = (locale) => [{ text: t(locale, 'btn_back'), callback_data: 'set' }];

export function levelView(chat, locale) {
  const current = levelOf(chat);
  const rows = LEVELS.map((l) => [{
    text: `${l === current ? '✅ ' : ''}${t(locale, `btn_level_${l}`)}`, callback_data: `lvl:${l}`,
  }]);
  rows.push(backToSettings(locale));
  const vars = { min: MIN_CVSS, crit: CRITICAL_CVSS.toFixed(1) };
  const text = [t(locale, 'level_title'), '', ...LEVELS.map((l) => `• ${t(locale, `level_${l}`, vars)}`)].join('\n');
  return { text, reply_markup: { inline_keyboard: rows } };
}

export function watchView(chat, locale) {
  const watch = watchOf(chat);
  const rows = [];
  for (let i = 0; i < watch.length; i += 2) {
    rows.push(watch.slice(i, i + 2).map((w, j) => ({ text: `❌ ${cut(w, 28)}`, callback_data: `wl:del:${i + j}` })));
  }
  const tools = [];
  if (watch.length < MAX_WATCH) tools.push({ text: t(locale, 'btn_watch_add'), callback_data: 'wl:add' });
  if (watch.length) tools.push({ text: t(locale, 'btn_watch_clear'), callback_data: 'wl:clr' });
  rows.push(tools, backToSettings(locale));
  const text = watch.length
    ? t(locale, 'watch_title_some', { words: watch.map((w) => `• <code>${esc(w)}</code>`).join('\n') })
    : t(locale, 'watch_title_none');
  return { text, reply_markup: { inline_keyboard: rows } };
}

export function watchPromptView(locale) {
  return {
    text: t(locale, 'watch_prompt', { max: MAX_WATCH }),
    reply_markup: { inline_keyboard: [[{ text: t(locale, 'btn_cancel'), callback_data: 'wl' }]] },
  };
}
