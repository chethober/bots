// Main menu, help, settings (time zone, location, quiet hours, mute, daily time),
// the notification centre and general reminders.
import { api } from 'sdk';
import { getJson, safely } from '../http.js';
import { getPrefs, savePrefs, takePending, putCache } from '../store.js';
import {
  listNotifications, describe, getNotification, setActive, deleteNotification, createNotification,
  upsertSchedule, findSchedule, rescheduleChat, CATEGORY_LABELS,
} from '../notify.js';
import { canonicalTz, isValidTz, tzLabel, parseWhen, whenLocal, parseSchedule, describePattern, nextOccurrence } from '../time.js';
import { btn, menu, show, send, notice, ask, requireManage, pagerRow, homeRow, navRow } from '../ui.js';
import { esc } from '../format.js';
import { buildDaily, SECTIONS } from '../daily.js';
import { t, SOURCE_URL } from '../strings.js';
import { languageKeyboard, LOCALE_NAMES, normalizeLocale } from '../i18n.js';

export const MENU_COMMANDS = [
  { command: 'crypto', description: '💰 Prices, watchlist, alerts, portfolio' },
  { command: 'sports', description: '🏆 Scores, fixtures, follow teams' },
  { command: 'food', description: '🍽 Recipes, cocktails, coffee' },
  { command: 'random', description: '🎲 Dice, picks, books, movies, fun' },
  { command: 'daily', description: '☀️ Your daily briefing' },
  { command: 'notifications', description: '🔔 Alerts, schedules, reminders' },
  { command: 'settings', description: '⚙️ Time zone, quiet hours, mute' },
  { command: 'language', description: '🌐 Change language' },
  { command: 'help', description: 'All commands' },
];

// The main-menu keyboard, in the chat's language, with a source-code link.
const homeKeyboard = (locale = 'en') => [
  [btn(t(locale, 'btn_crypto'), 'm:crypto'), btn(t(locale, 'btn_sports'), 'm:sports')],
  [btn(t(locale, 'btn_food'), 'm:food'), btn(t(locale, 'btn_random'), 'm:random')],
  [btn(t(locale, 'btn_daily'), 'm:daily'), btn(t(locale, 'btn_notifications'), 'n:l:*:0')],
  [btn(t(locale, 'btn_settings'), 'st:home'), btn(t(locale, 'btn_hide'), 'kb:close')],
  [{ text: t(locale, 'source'), url: SOURCE_URL }],
];

const HELP = `<b>Hubs</b> — tap through menus
/crypto · /sports · /food · /random

<b>Everywhere</b>
/daily — briefing now
/notifications — every alert, schedule and reminder
/remind &lt;30m|2h|18:00&gt; &lt;text&gt; — reminder (your time zone)
/settings — time zone, location, quiet hours, mute
/timezone Europe/Berlin · /cancel

<b>Crypto shortcuts</b>
/crypto &lt;coin&gt; — coin card · /price btc — Binance ticker
/alert crypto btc above 100k · /alert crypto eth move 5 · /alert fng below 20
/portfolio

<b>Sports shortcuts</b>
/sports arsenal — find a team · /sports nba — league menu
/scores epl · /scores laliga · /f1 · /myteams

<b>Food shortcuts</b>
/recipe [pasta] · /cocktail [mojito] · /brew v60 300 · /coldbrew 1000
/shopping · /brewlog · /barcode 3017624010701 · /breweries [city]

<b>Random shortcuts</b>
/roll 2d6 · /flip · /number 1 100 · /pick a, b, c · /teams a, b, c, d / 2 · /8ball · /cards 5 · /dice
/book [fantasy] · /movie [comedy] · /series [drama] · /anime · /game · /album · /radio [jazz] · /art · /pokemon · /dog · /cat
/fact · /joke · /quote · /advice · /wiki · /onthisday · /word · /xkcd · /bored · /trivia [top]`;

const NOTIF_PAGE = 8;

export const commands = {
  async start(ctx) {
    await api.setMyCommands({ commands: MENU_COMMANDS }).catch(() => {});
    await home(ctx, t(ctx.locale, 'greeting'));
  },
  menu: (ctx) => home(ctx),
  language: (ctx) => menu(ctx, { text: t(ctx.locale, 'choose_language'), keyboard: languageKeyboard().inline_keyboard }),
  async daily(ctx) {
    await api.sendChatAction({ chat_id: ctx.chatId, action: 'typing' }).catch(() => {});
    return send(ctx, await buildDaily(ctx.chatId));
  },
  help: (ctx) => menu(ctx, { text: `${t(ctx.locale, 'help_header')}\n\n${HELP}`, keyboard: homeKeyboard(ctx.locale) }),
  settings: (ctx) => settingsCard(ctx),
  notifications: (ctx) => notificationsCard(ctx, null, 0),
  alerts: (ctx) => notificationsCard(ctx, null, 0),

  async cancel(ctx) {
    const had = await takePending(ctx.chatId, ctx.userId);
    await notice(ctx, had ? 'Cancelled.' : 'Nothing to cancel.');
  },

  async remind(ctx, args) {
    if (!args.length) return askReminder(ctx);
    return createReminder(ctx, args.join(' '));
  },

  async timezone(ctx, [tz]) {
    if (!tz) return askTz(ctx);
    return applyTz(ctx, tz);
  },

  async location(ctx) {
    if (ctx.chatType !== 'private') return notice(ctx, 'Send a 📍 location (attach → Location) to set it.');
    await putCache(`menu:${ctx.chatId}`, { '⬅️ Settings': 'st:home', '🏠 Main menu': 'm:home' }, 90 * 86400);
    await api.sendMessage({
      chat_id: ctx.chatId,
      text: 'Tap 📍 to share your location. It sets your time zone and adds weather to /daily.',
      reply_markup: { keyboard: [[{ text: '📍 Share location', request_location: true }], [{ text: '⬅️ Settings' }, { text: '🏠 Main menu' }]], resize_keyboard: true },
    });
  },

  // Back-compat: /digest 07:30 | off
  async digest(ctx, args) {
    if (!args.length) return askDaily(ctx);
    return applyDaily(ctx, args.join(' '));
  },

  quiet: (ctx, args) => (args.length ? applyQuiet(ctx, args.join(' ')) : askQuiet(ctx)),
};

export const callbacks = {
  // 🌐 Language picked from /language buttons: save it and re-render the menu.
  async lang(ctx, [code]) {
    const locale = normalizeLocale(code);
    await savePrefs(ctx.chatId, { locale });
    ctx.locale = locale;
    await ctx.answer(t(locale, 'language_set', { name: LOCALE_NAMES[locale] ?? locale }));
    return home(ctx);
  },
  // ✖️ Hide menu: remove the reply keyboard; /menu brings it back.
  async kb(ctx) {
    await ctx.answer();
    await putCache(`menu:${ctx.chatId}`, {}, 60);
    return api.sendMessage({ chat_id: ctx.chatId, text: 'Menu hidden. Send /menu to bring it back.', reply_markup: { remove_keyboard: true } });
  },
  async dl(ctx) {
    await ctx.answer('Refreshing…');
    return show(ctx, await buildDaily(ctx.chatId));
  },
  // m:home — other m:<hub> targets are routed by hubs/index.js
  async m(ctx, [target]) {
    await ctx.answer();
    if (target === 'home') return home(ctx);
  },

  // n:l:<cat|*>:<page>  n:t:<id>:<cat>:<page>  n:d:<id>:<cat>:<page>  n:re:<id>  n:add:<cat>
  async n(ctx, [op, a, b, c]) {
    if (op === 'l') {
      await ctx.answer();
      return notificationsCard(ctx, a === '*' ? null : a, +b || 0);
    }
    if (op === 'add') {
      await ctx.answer();
      return askReminder(ctx);
    }
    if (!(await requireManage(ctx))) return;
    const n = await getNotification(ctx.chatId, +a);
    if (op === 're') {
      if (!n) return ctx.answer('That alert no longer exists.');
      await setActive(ctx.chatId, n.id, true, { lastFiredAt: null });
      await ctx.answer('Re-armed 🔁');
      return api.editMessageReplyMarkup({ chat_id: ctx.chatId, message_id: ctx.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    }
    if (!n) {
      await ctx.answer('Already gone.');
    } else if (op === 't') {
      const activate = !n.active;
      const patch = {};
      // Resuming a schedule/reminder whose time passed while paused: move schedules forward.
      if (activate && n.kind === 'schedule') patch.nextAt = nextOccurrence(n.params.time, n.params.pattern, (await getPrefs(ctx.chatId)).tz);
      await setActive(ctx.chatId, n.id, activate, patch);
      await ctx.answer(activate ? 'Resumed' : 'Paused');
    } else if (op === 'd') {
      await deleteNotification(ctx.chatId, n.id);
      await ctx.answer('Deleted');
    }
    return notificationsCard(ctx, b === '*' ? null : b, +c || 0);
  },

  // st:home  st:tz  st:loc  st:quiet  st:mute  st:mute:<cat>  st:daily  st:daily:off  st:dsec[:<key>]
  async st(ctx, [op, arg]) {
    await ctx.answer();
    if (op === 'home') return settingsCard(ctx);
    if (op === 'dsec' && !arg) return sectionsCard(ctx);
    if (!(await requireManage(ctx))) return;
    if (op === 'tz') return askTz(ctx);
    if (op === 'loc') return commands.location(ctx);
    if (op === 'quiet') return askQuiet(ctx);
    if (op === 'daily') return arg === 'off' ? applyDaily(ctx, 'off') : askDaily(ctx);
    if (op === 'dsec') {
      const p = await getPrefs(ctx.chatId);
      await savePrefs(ctx.chatId, { daily: { ...p.daily, [arg]: !p.daily[arg] } });
      return sectionsCard(ctx);
    }
    if (op === 'mute') {
      if (arg) {
        const p = await getPrefs(ctx.chatId);
        const muted = p.muted.includes(arg) ? p.muted.filter((c) => c !== arg) : [...p.muted, arg];
        await savePrefs(ctx.chatId, { muted });
      }
      return muteCard(ctx);
    }
  },
};

export const inputs = {
  tz: (ctx, text) => applyTz(ctx, text.trim()),
  quiet: (ctx, text) => applyQuiet(ctx, text),
  daily: (ctx, text) => applyDaily(ctx, text),
  remind: (ctx, text) => createReminder(ctx, text),
};

// ── screens ───────────────────────────────────────────────────────────────

export function home(ctx, title) {
  return menu(ctx, { text: title ?? t(ctx.locale, 'menu_title'), keyboard: homeKeyboard(ctx.locale) });
}

async function settingsCard(ctx) {
  const p = await getPrefs(ctx.chatId);
  const daily = await findSchedule(ctx.chatId, 'general', 'daily');
  await menu(ctx, {
    text: [
      '⚙️ <b>Settings</b>',
      '',
      `🌍 Time zone: <b>${esc(tzLabel(p.tz))}</b>`,
      `📍 Location: <b>${p.lat != null ? `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}` : 'not set'}</b>`,
      `🌙 Quiet hours: <b>${p.quietStart ? `${p.quietStart}–${p.quietEnd}` : 'off'}</b>`,
      `🔕 Muted: <b>${p.muted.length ? esc(p.muted.map((c) => CATEGORY_LABELS[c] ?? c).join(', ')) : 'nothing'}</b>`,
      `☀️ Daily briefing: <b>${daily?.active ? `${daily.params.time} ${describePattern(daily.params.pattern)}` : 'off'}</b>`,
      `   Sections: ${esc(SECTIONS.filter((s) => p.daily[s.key]).map((s) => s.label.replace(/^\S+ /, '')).join(', ') || 'none')}`,
    ].join('\n'),
    keyboard: [
      [btn('🌍 Time zone', 'st:tz'), btn('📍 Location', 'st:loc')],
      [btn('🌙 Quiet hours', 'st:quiet'), btn('🔕 Mute', 'st:mute')],
      [btn('⏰ Briefing time', 'st:daily'), btn('🧩 Briefing sections', 'st:dsec')],
      ...(daily?.active ? [[btn('🚫 Stop daily briefing', 'st:daily:off')]] : []),
      [btn('🔔 Notifications', 'n:l:*:0'), btn('🏠 Main menu', 'm:home')],
    ],
  });
}

async function sectionsCard(ctx) {
  const p = await getPrefs(ctx.chatId);
  const daily = await findSchedule(ctx.chatId, 'general', 'daily');
  const rows = [];
  for (let i = 0; i < SECTIONS.length; i += 2) {
    rows.push(SECTIONS.slice(i, i + 2).map((s) => btn(`${p.daily[s.key] ? '✅' : '⬜️'} ${s.label}`, `st:dsec:${s.key}`)));
  }
  await menu(ctx, {
    text: `🧩 <b>Daily briefing sections</b>
Tap to switch a section on or off.

Delivery: <b>${daily?.active ? `${daily.params.time} ${describePattern(daily.params.pattern)}` : 'not scheduled — use /daily or set a time'}</b>`,
    keyboard: [...rows, [btn('⏰ Briefing time', 'st:daily'), btn('👀 Preview', 'm:daily')], navRow('⬅️ Settings', 'st:home')],
  });
}

const pairs = (items) => items.reduce((rows, x, i) => (i % 2 ? rows[rows.length - 1].push(x) : rows.push([x]), rows), []);

async function muteCard(ctx) {
  const p = await getPrefs(ctx.chatId);
  await menu(ctx, {
    text: '🔕 <b>Mute categories</b>\nMuted categories send no alerts or scheduled pushes. Reminders still fire.',
    keyboard: [
      ...pairs(Object.entries(CATEGORY_LABELS).filter(([c]) => c !== 'general')
        .map(([c, label]) => btn(`${p.muted.includes(c) ? '🔕' : '🔔'} ${label}`, `st:mute:${c}`))),
      navRow('⬅️ Settings', 'st:home'),
    ],
  });
}

export async function notificationsCard(ctx, category, page) {
  const [p, all] = await Promise.all([getPrefs(ctx.chatId), listNotifications(ctx.chatId, category)]);
  const pages = Math.max(1, Math.ceil(all.length / NOTIF_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const slice = all.slice(page * NOTIF_PAGE, (page + 1) * NOTIF_PAGE);
  const cat = category ?? '*';
  const title = category ? `${esc(CATEGORY_LABELS[category] ?? category)} notifications` : '🔔 Notifications';

  const lines = [`<b>${title}</b>`, ''];
  if (!all.length) lines.push('<i>Nothing yet.</i>');
  slice.forEach((n, i) => {
    const num = page * NOTIF_PAGE + i + 1;
    const where = category ? '' : ` <i>· ${esc((CATEGORY_LABELS[n.category] ?? n.category).replace(/^\S+ /, ''))}</i>`;
    lines.push(`${num}. ${n.active ? '' : '⏸ '}${describe(n, p)}${where}`);
  });
  if (p.muted.length) lines.push('', `🔕 Muted: ${esc(p.muted.map((c) => CATEGORY_LABELS[c] ?? c).join(', '))}`);
  if (p.quietStart) lines.push(`🌙 Quiet hours ${p.quietStart}–${p.quietEnd}`);

  const keyboard = slice.map((n, i) => {
    const num = page * NOTIF_PAGE + i + 1;
    return [btn(`${n.active ? '⏸' : '▶️'} ${num}`, `n:t:${n.id}:${cat}:${page}`), btn(`🗑 ${num}`, `n:d:${n.id}:${cat}:${page}`)];
  });
  keyboard.push(...pagerRow(page, pages, (pg) => `n:l:${cat}:${pg}`));
  keyboard.push([btn('➕ Reminder', 'n:add:general'), btn('⚙️ Settings', 'st:home')]);
  keyboard.push(category && category !== 'general' ? [btn('⬅️ Back', `m:${category}`)] : homeRow());
  await show(ctx, { text: lines.join('\n'), keyboard });
}

// ── actions ───────────────────────────────────────────────────────────────

function askReminder(ctx) {
  return ask(ctx, 'main.remind', '⏰ When and what? e.g. <code>30m stretch</code>, <code>1h30m call mom</code>, <code>18:00 standup</code>', { placeholder: '30m stretch' });
}

async function createReminder(ctx, text) {
  const [when, ...words] = text.trim().split(/\s+/);
  const p = await getPrefs(ctx.chatId);
  const at = parseWhen(when, p.tz);
  const body = words.join(' ').trim().slice(0, 500);
  if (!at || !body) return notice(ctx, 'Usage: <code>/remind 30m stretch</code>, <code>/remind 1h30m call mom</code> or <code>/remind 18:00 standup</code>');
  const id = await createNotification(ctx.chatId, 'general', 'reminder', { text: body }, at);
  if (id === 'limit') return notice(ctx, 'You have 50 active notifications. Remove some in /notifications.');
  await notice(ctx, `⏰ I'll remind you around <b>${whenLocal(at * 1000, p.tz)}</b>.`);
}

function askTz(ctx) {
  return ask(ctx, 'main.tz', '🌍 Send your time zone, e.g. <code>Europe/Berlin</code>, <code>America/New_York</code>, <code>Asia/Tehran</code>. Or share a 📍 location.', { placeholder: 'Europe/Berlin' });
}

async function applyTz(ctx, tz) {
  if (!(await requireManage(ctx))) return;
  const name = canonicalTz(tz.replace(/\s+/g, '_'));
  if (!name) return notice(ctx, `⚠️ Unknown time zone <b>${esc(tz)}</b>. Use an IANA name like <code>Europe/Berlin</code>.`);
  await savePrefs(ctx.chatId, { tz: name });
  await rescheduleChat(ctx.chatId, name);
  await notice(ctx, `🌍 Time zone set to <b>${esc(tzLabel(name))}</b>.`);
}

// Location message: saves coordinates and, when found, the matching time zone.
export async function saveLocation(ctx, { latitude, longitude }) {
  if (!(await requireManage(ctx))) return;
  const tz = await safely(async () => (await getJson(`https://timeapi.io/api/timezone/coordinate?latitude=${latitude}&longitude=${longitude}`)).timeZone);
  const patch = { lat: latitude, lon: longitude };
  if (tz && isValidTz(tz)) patch.tz = canonicalTz(tz);
  await savePrefs(ctx.chatId, patch);
  if (patch.tz) await rescheduleChat(ctx.chatId, patch.tz);
  await notice(ctx, `📍 Location saved${patch.tz ? `, time zone ${esc(tzLabel(patch.tz))}` : ''}. /daily now includes your weather.`);
  if (ctx.chatType === 'private') await settingsCard(ctx);
}

function askQuiet(ctx) {
  return ask(ctx, 'main.quiet', '🌙 Send quiet hours in your time zone, e.g. <code>23:00-07:00</code>, or <code>off</code>. Alerts and scheduled pushes wait until they end; reminders still fire.', { placeholder: '23:00-07:00' });
}

async function applyQuiet(ctx, text) {
  if (!(await requireManage(ctx))) return;
  if (/^\s*off\s*$/i.test(text)) {
    await savePrefs(ctx.chatId, { quietStart: null, quietEnd: null });
    return notice(ctx, '🌙 Quiet hours off.');
  }
  const m = /^\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*[-–to ]+\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*$/i.exec(text);
  if (!m) return notice(ctx, 'Usage: <code>23:00-07:00</code> or <code>off</code>');
  const start = `${m[1].padStart(2, '0')}:${m[2]}`;
  const end = `${m[3].padStart(2, '0')}:${m[4]}`;
  if (start === end) return notice(ctx, 'Start and end must differ.');
  await savePrefs(ctx.chatId, { quietStart: start, quietEnd: end });
  await notice(ctx, `🌙 Quiet hours <b>${start}–${end}</b>.`);
}

function askDaily(ctx) {
  return ask(ctx, 'main.daily', '☀️ When should the daily briefing arrive? e.g. <code>07:30</code>, <code>08:00 weekdays</code>, <code>09:00 sat</code>, or <code>off</code>.', { placeholder: '07:30' });
}

async function applyDaily(ctx, text) {
  if (!(await requireManage(ctx))) return;
  if (/^\s*off\s*$/i.test(text)) {
    const n = await findSchedule(ctx.chatId, 'general', 'daily');
    if (n) await deleteNotification(ctx.chatId, n.id);
    return notice(ctx, '☀️ Daily briefing off.');
  }
  const s = parseSchedule(text);
  if (!s) return notice(ctx, 'Usage: <code>07:30</code>, <code>08:00 weekdays</code>, <code>09:00 sat</code> or <code>off</code>');
  const p = await getPrefs(ctx.chatId);
  const id = await upsertSchedule(ctx.chatId, 'general', 'daily', s.time, s.pattern, p.tz);
  if (id === 'limit') return notice(ctx, 'You have 50 active notifications. Remove some in /notifications.');
  await notice(ctx, `☀️ Daily briefing at <b>${s.time}</b> ${describePattern(s.pattern)} (${esc(p.tz)}).` +
    (p.tz === 'UTC' ? '\n<i>Tip: set your time zone in /settings.</i>' : ''));
}
