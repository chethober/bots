// The private chat's reply keyboard and screens: home, CVE lists, categories,
// a CVE card and settings. Each view returns { text, reply_markup }.
//
// Callback data:
//   ls:<list>:<page>          a list page — list is new | hot | q (the chat's last
//                             search, kept in settings as q:<chatId>) | c.<category>
//   cv:<id>:<list>:<page>     a CVE card opened from that list page
//   cats · set · sub · noop   categories · settings · alerts on/off · nothing

import { api } from 'sdk';
import { MIN_CVSS, ADMIN_IDS } from './config.js';
import { getSetting } from './settings.js';
import { search, latest, trending, getCve, kevEntry, CATEGORIES } from './cves.js';
import { normalizeId } from './nvd.js';
import { cveCard, severityEmoji, badge, esc, cut } from './format.js';
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
  const rows = [[{ text: t(locale, on ? 'btn_alerts_off' : 'btn_alerts_on'), callback_data: 'sub' }]];
  if (isAdmin(userId)) rows.push([{ text: t(locale, 'btn_admin'), callback_data: 'adm' }]);
  return { text: t(locale, on ? 'settings_on' : 'settings_off', { min: MIN_CVSS }), reply_markup: { inline_keyboard: rows } };
}
