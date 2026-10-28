// The private chat's reply keyboard and screens: home, CVE lists, categories,
// a CVE card and settings. Each view returns { text, reply_markup }.
//
// Callback data:
//   ls:<list>:<page>          a list page — list is new | hot | q (the chat's last
//                             search, kept in settings as q:<chatId>) | c.<category>
//                             | f (followed CVEs)
//   cv:<id>:<list>:<page>     a CVE card opened from that list page
//   fo:<id>[:<back>]          follow / unfollow from a card · uf:<id> unfollow
//                             from an update (lib/follows.js)
//   cats · set · noop         categories · settings · nothing
//
// Settings screens act on a target chat <t>: the user's own chat, or a group or
// channel they manage (lib/managers.js), checked on every tap.
//   sub[:<t>]                 alerts on/off
//   lvl:<t>[:<level>]         the alert level picker · pick one (lib/filters.js)
//   wl:<t>[:add|clr]          the watchlist · add words (asks for them) · remove all
//   wl:<t>:del:<i> · wl:<t>:q:<page>   remove one · add the last search
//   dg:<t>[:<mode>]           delivery: instant, daily or weekly digest
//   mcs · mca · mc:<t>        my groups and channels · add one · its settings

import { api } from 'sdk';
import { MIN_CVSS, ADMIN_IDS, BOT_USERNAME } from './config.js';
import { getSetting } from './settings.js';
import { search, latest, trending, getCve, kevEntry, byIds, CATEGORIES } from './cves.js';
import { normalizeId } from './nvd.js';
import { cveCard, severityEmoji, badge, esc, cut } from './format.js';
import { LEVELS, MODES, CRITICAL_CVSS, MAX_WATCH, levelOf, watchOf, modeOf, parseWatch } from './filters.js';
import { getChat } from './chats.js';
import { followedIds, isFollowing, MAX_FOLLOWS } from './follows.js';
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
  if (list === 'f') return { items: await byIds(await followedIds(chatId, args)) };
  const q = (await getSetting(`q:${chatId}`)) ?? '';
  return { items: await search({ ...args, q }), q };
}

function listTitle(list, q, locale) {
  if (list === 'new') return t(locale, 'latest_title');
  if (list === 'hot') return t(locale, 'trending_title');
  if (list === 'f') return t(locale, 'follows_title', { max: MAX_FOLLOWS });
  if (list.startsWith('c.')) return `⚡ <b>${esc(t(locale, `cat_${list.slice(2)}`))}</b>`;
  return t(locale, 'search_title', { q: esc(cut(q, 40)) });
}

const listBack = (list) => (list.startsWith('c.') ? 'cats' : list === 'f' ? 'set' : null);

export async function listView(list, page, chatId, locale) {
  const { items, q } = await fetchList(list, page, chatId);
  const shown = items.slice(0, PAGE);
  const title = listTitle(list, q, locale);
  if (!shown.length && page === 0) {
    const empty = { q: () => t(locale, 'nothing_found', { q: esc(cut(q, 40)) }), f: () => t(locale, 'follows_empty') }[list]?.()
      ?? t(locale, 'empty_list');
    const back = listBack(list);
    const rows = back ? [[{ text: t(locale, 'btn_back'), callback_data: back }]] : [];
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
  if (listBack(list)) rows.push([{ text: t(locale, 'btn_back'), callback_data: listBack(list) }]);
  if (list === 'q') {
    // Searched for a product: offer to get its alerts only.
    const [word] = parseWatch(q);
    const watch = watchOf(await getChat(chatId));
    if (word && !watch.includes(word) && watch.length < MAX_WATCH) {
      rows.push([{ text: t(locale, 'btn_watch_q', { q: cut(word, 24) }), callback_data: `wl:${chatId}:q:${page}` }]);
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
// With `chatId` (a private chat) it has a 🔔 Follow button.
export async function cveView(input, locale, back = null, chatId = null) {
  const id = normalizeId(input);
  const cve = id ? await getCve(id) : null;
  if (!cve) {
    const rows = back ? [[{ text: t(locale, 'btn_back'), callback_data: back }]] : [];
    return { text: t(locale, 'cve_not_found', { id: esc(id ?? input) }), reply_markup: { inline_keyboard: rows } };
  }
  const following = chatId ? await isFollowing(chatId, cve.id) : null;
  return cveCard(cve, locale, { kev: await kevEntry(cve.id), back, following });
}

// --- settings -----------------------------------------------------------------------

// The settings of `chat`: the user's own private chat, or a group or channel
// they manage (with its name on top and the way back to the list).
export function settingsView(chat, userId, locale) {
  const own = chat?.type == null || chat.type === 'private';
  const id = chat?.id ?? userId;
  const on = !!chat?.active;
  const watch = watchOf(chat);
  const vars = { min: MIN_CVSS, crit: CRITICAL_CVSS.toFixed(1) };
  const rows = [
    [{ text: t(locale, on ? 'btn_alerts_off' : 'btn_alerts_on'), callback_data: own ? 'sub' : `sub:${id}` }],
    [{ text: t(locale, 'btn_level'), callback_data: `lvl:${id}` }, { text: t(locale, 'btn_delivery'), callback_data: `dg:${id}` }],
    [{ text: t(locale, 'btn_watchlist', { n: watch.length }), callback_data: `wl:${id}` }],
  ];
  if (own) {
    rows.push([{ text: t(locale, 'btn_follows'), callback_data: 'ls:f:0' }]);
    rows.push([{ text: t(locale, 'btn_managed'), callback_data: 'mcs' }]);
    if (isAdmin(userId)) rows.push([{ text: t(locale, 'btn_admin'), callback_data: 'adm' }]);
  } else rows.push([{ text: t(locale, 'btn_back'), callback_data: 'mcs' }]);
  let text = on
    ? t(locale, 'settings_on', {
      level: t(locale, `level_${levelOf(chat)}`, vars),
      mode: t(locale, `mode_${modeOf(chat)}`),
      watch: watch.length ? t(locale, 'watch_some', { words: esc(watch.join(', ')) }) : t(locale, 'watch_none'),
    })
    : t(locale, 'settings_off');
  if (!own) text = `${chatIcon(chat)} <b>${esc(chat.title ?? '—')}</b>\n${text}`;
  return { text, reply_markup: { inline_keyboard: rows } };
}

const chatIcon = (chat) => (chat.type === 'channel' ? '📢' : '👥');
const backTo = (chat, locale) => [{
  text: t(locale, 'btn_back'), callback_data: chat?.type && chat.type !== 'private' ? `mc:${chat.id}` : 'set',
}];

export function levelView(chat, locale) {
  const current = levelOf(chat);
  const rows = LEVELS.map((l) => [{
    text: `${l === current ? '✅ ' : ''}${t(locale, `btn_level_${l}`)}`, callback_data: `lvl:${chat.id}:${l}`,
  }]);
  rows.push(backTo(chat, locale));
  const vars = { min: MIN_CVSS, crit: CRITICAL_CVSS.toFixed(1) };
  const text = [t(locale, 'level_title'), '', ...LEVELS.map((l) => `• ${t(locale, `level_${l}`, vars)}`)].join('\n');
  return { text, reply_markup: { inline_keyboard: rows } };
}

export function deliveryView(chat, locale) {
  const current = modeOf(chat);
  const rows = MODES.map((m) => [{
    text: `${m === current ? '✅ ' : ''}${t(locale, `btn_mode_${m}`)}`, callback_data: `dg:${chat.id}:${m}`,
  }]);
  rows.push(backTo(chat, locale));
  return { text: t(locale, 'delivery_title'), reply_markup: { inline_keyboard: rows } };
}

export function watchView(chat, locale) {
  const watch = watchOf(chat);
  const rows = [];
  for (let i = 0; i < watch.length; i += 2) {
    rows.push(watch.slice(i, i + 2).map((w, j) => ({ text: `❌ ${cut(w, 28)}`, callback_data: `wl:${chat.id}:del:${i + j}` })));
  }
  const tools = [];
  if (watch.length < MAX_WATCH) tools.push({ text: t(locale, 'btn_watch_add'), callback_data: `wl:${chat.id}:add` });
  if (watch.length) tools.push({ text: t(locale, 'btn_watch_clear'), callback_data: `wl:${chat.id}:clr` });
  rows.push(tools, backTo(chat, locale));
  const text = watch.length
    ? t(locale, 'watch_title_some', { words: watch.map((w) => `• <code>${esc(w)}</code>`).join('\n') })
    : t(locale, 'watch_title_none');
  return { text, reply_markup: { inline_keyboard: rows } };
}

export function watchPromptView(chat, locale) {
  return {
    text: t(locale, 'watch_prompt', { max: MAX_WATCH }),
    reply_markup: { inline_keyboard: [[{ text: t(locale, 'btn_cancel'), callback_data: `wl:${chat.id}` }]] },
  };
}

// 📢 My groups and channels. `list` rows are { id, type, title, active }.
export function managedView(list, locale) {
  const rows = list.map((c) => [{
    text: `${c.active ? '🟢' : '🔴'} ${chatIcon(c)} ${cut(c.title ?? String(c.id), 40)}`, callback_data: `mc:${c.id}`,
  }]);
  rows.push([{ text: t(locale, 'btn_managed_add'), callback_data: 'mca' }], [{ text: t(locale, 'btn_back'), callback_data: 'set' }]);
  return { text: t(locale, list.length ? 'managed_title' : 'managed_empty'), reply_markup: { inline_keyboard: rows } };
}

export function linkPromptView(locale) {
  return {
    text: t(locale, 'managed_prompt', { bot: BOT_USERNAME }),
    reply_markup: { inline_keyboard: [[{ text: t(locale, 'btn_cancel'), callback_data: 'mcs' }]] },
  };
}
