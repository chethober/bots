// The admin dashboard (⚙️ Settings → 👑, or /admin) and /broadcast. Admin
// screens stay English.
//
// Callback data: adm (dashboard) · adm:stats · adm:hist · adm:chats ·
// adm:test (a sample alert to yourself) · adm:tick (run the scheduler now)

import { api, db } from 'sdk';
import { desc, eq, inArray, sql } from 'sdk/db';
import { alerts, chats, cves } from '../schema.js';
import { MIN_CVSS, MIN_EPSS } from './config.js';
import { getSetting } from './settings.js';
import { alertMessage, esc } from './format.js';
import { runTick } from './scheduler.js';

const back = [{ text: '⬅️ Dashboard', callback_data: 'adm' }];
const kb = (...rows) => ({ inline_keyboard: rows });
const time = (sec) => (sec ? new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 16) : '—');

export async function dashboardView() {
  const last = JSON.parse((await getSetting('last_tick')) ?? 'null');
  const lines = ['👑 <b>Admin dashboard</b>', ''];
  if (last) {
    lines.push(`Last scheduler run: <code>${last.at.replace('T', ' ').slice(0, 16)} UTC</code> (${last.ms ?? '?'} ms)`);
    if (last.skipped) lines.push(`• skipped: ${esc(last.skipped)}`);
    for (const e of last.errors ?? []) lines.push(`• ⚠️ ${esc(e)}`);
  } else lines.push('The scheduler has not run yet.');
  return {
    text: lines.join('\n'),
    reply_markup: kb(
      [{ text: '📊 Stats', callback_data: 'adm:stats' }, { text: '📋 History', callback_data: 'adm:hist' }],
      [{ text: '📢 Groups and channels', callback_data: 'adm:chats' }, { text: '🧪 Test alert', callback_data: 'adm:test' }],
      [{ text: '⚡ Run the scheduler now', callback_data: 'adm:tick' }],
    ),
  };
}

export async function statsView() {
  const byType = await db.all(sql`SELECT type, active, count(*) AS n FROM chats GROUP BY type, active`);
  const count = (pred) => byType.filter(pred).reduce((s, r) => s + r.n, 0);
  const byStatus = await db.all(sql`SELECT kind, status, count(*) AS n FROM alerts GROUP BY kind, status`);
  const alertsOf = (kind, status) => byStatus.find((r) => r.kind === kind && r.status === status)?.n ?? 0;
  const queued = byStatus.filter((r) => r.status === 'pending' || r.status === 'sending').reduce((s, r) => s + r.n, 0);
  const text = [
    '📊 <b>Stats</b>',
    '',
    '<b>Receiving alerts</b>',
    `• 👤 users: <code>${count((r) => r.active && r.type === 'private')}</code>`,
    `• 👥 groups: <code>${count((r) => r.active && (r.type === 'group' || r.type === 'supergroup'))}</code>`,
    `• 📢 channels: <code>${count((r) => r.active && r.type === 'channel')}</code>`,
    `• 🔕 turned off or gone: <code>${count((r) => !r.active)}</code>`,
    '',
    '<b>Alerts</b>',
    `• 🚨 new CVEs sent: <code>${alertsOf('new', 'sent')}</code>`,
    `• 🔥 trending sent: <code>${alertsOf('trending', 'sent')}</code>`,
    `• ⏳ queued: <code>${queued}</code>`,
    `• 🌱 recorded at switch-over: <code>${alertsOf('new', 'seeded') + alertsOf('trending', 'seeded')}</code>`,
    '',
    `💾 CVEs stored: <code>${await db.$count(cves)}</code>`,
    `⚙️ Thresholds: CVSS above <code>${MIN_CVSS}</code>, EPSS signal from <code>${MIN_EPSS}</code>`,
  ].join('\n');
  return { text, reply_markup: kb([{ text: '🔄 Refresh', callback_data: 'adm:stats' }], back) };
}

export async function historyView() {
  const rows = await db.select().from(alerts)
    .where(inArray(alerts.status, ['sent', 'sending', 'pending']))
    .orderBy(desc(alerts.id)).limit(10).all();
  const icon = { new: '🚨', trending: '🔥', broadcast: '📢' };
  const lines = ['📋 <b>Recent alerts</b>', ''];
  if (!rows.length) lines.push('<i>None yet.</i>');
  for (const a of rows) {
    const what = a.kind === 'broadcast' ? esc((a.signals?.text ?? '').slice(0, 40)) : `<b>${a.cveId}</b>`;
    lines.push(`${icon[a.kind] ?? '•'} ${what} · ${a.status === 'sent' ? time(a.sentAt) : a.status}`);
  }
  return { text: lines.join('\n'), reply_markup: kb([{ text: '🔄 Refresh', callback_data: 'adm:hist' }], back) };
}

export async function chatsView() {
  const rows = await db.select().from(chats).where(sql`${chats.type} != 'private'`)
    .orderBy(desc(chats.createdAt)).limit(30).all();
  const lines = ['📢 <b>Groups and channels</b>', ''];
  if (!rows.length) lines.push('<i>None yet. Add the bot to a channel or group as an admin who can post messages.</i>');
  for (const c of rows) {
    lines.push(`${c.active ? '🟢' : '🔴'} ${c.type === 'channel' ? '📢' : '👥'} <b>${esc(c.title ?? '—')}</b>${c.username ? ` @${esc(c.username)}` : ''} · <code>${c.id}</code>`);
  }
  return { text: lines.join('\n'), reply_markup: kb(back) };
}

// The newest stored CVE above the threshold, sent to `chatId` as a new-CVE
// alert. Resolves to false when no such CVE is stored yet.
export async function sendTestAlert(chatId, locale) {
  const cve = await db.select().from(cves).where(sql`${cves.score} > ${MIN_CVSS}`)
    .orderBy(desc(cves.published)).get();
  if (!cve) return false;
  const { text, reply_markup } = alertMessage(cve, 'new', null, locale);
  await api.sendMessage({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup, link_preview_options: { is_disabled: true } });
  return true;
}

export async function tickView() {
  const report = await runTick({ budgetMs: 15_000, maxSends: 100 });
  const parts = Object.entries(report).filter(([k]) => !['at', 'errors', 'ms'].includes(k))
    .map(([k, v]) => `• ${k}: <code>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</code>`);
  const text = ['⚡ <b>Scheduler run</b>', '', ...parts, ...report.errors.map((e) => `• ⚠️ ${esc(e)}`), '', `${report.ms ?? 0} ms`].join('\n');
  return { text, reply_markup: kb([{ text: '⚡ Run again', callback_data: 'adm:tick' }], back) };
}

// /broadcast [channel] <text>: queued like an alert, so the scheduler delivers
// it to every active chat (or only channels) across as many runs as it takes.
export async function queueBroadcast(args) {
  const channelsOnly = /^channel\b/i.test(args);
  const text = (channelsOnly ? args.replace(/^channel\s*/i, '') : args).trim();
  if (!text) return 'Usage: /broadcast [channel] &lt;text&gt;';
  const now = Date.now();
  await db.insert(alerts).values({
    cveId: `broadcast:${now}`, kind: 'broadcast', status: 'sending',
    signals: { text, channelsOnly }, createdAt: Math.floor(now / 1000),
  }).run();
  const n = await db.$count(chats, channelsOnly
    ? sql`${chats.active} = 1 AND ${chats.type} = 'channel'`
    : eq(chats.active, true));
  return `📢 Queued for ${n} ${channelsOnly ? 'channel(s)' : 'chat(s)'}. Delivery starts now and continues with each scheduler run.`;
}
