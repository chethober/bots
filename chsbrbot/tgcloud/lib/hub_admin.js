// What the CHTH hub can ask of this bot (see hub_command.js). The hub holds the admin screens and
// checks who is asking; this only touches the bot's own data.

import { db } from 'sdk';
import { sql } from 'sdk/db';
import { hubCommands, chats, cves, alerts, follows } from '../schema.js';
import { chatsView, dashboardView, historyView, queueBroadcast, sendTestAlert, statsView, tickView } from './admin.js';
import { runTick } from './scheduler.js';
import { makeClaim, numericOnly } from './hub_admin_kit.js';

export const claim = makeClaim(db, hubCommands);

const html = (text) => ({ text, html: true });
const view = (build) => async () => html((await build()).text);

export const handlers = {
  async version() {
    return { text: '<b>chsbrbot</b>\nVersion <code>1.0.0</code>', html: true };
  },
  async health() {
    const last = await db.get(sql`SELECT value FROM settings WHERE key = 'tick:last'`).catch(() => null);
    return { text: `<b>🩺 Health</b>\nlastTick: <b>${last?.value ?? 'never'}</b>`, html: true };
  },
  async metrics() {
    const day = Math.floor(Date.now() / 1000) - 86400;
    const [subs, chatN, cveN, alerts24h, followN] = await Promise.all([
      db.get(sql`SELECT count(*) AS n FROM chats WHERE type = 'private' AND active = 1`),
      db.get(sql`SELECT count(*) AS n FROM chats WHERE type != 'private' AND active = 1`),
      db.$count(cves),
      db.get(sql`SELECT count(*) AS n FROM alerts WHERE created_at > ${day}`).catch(() => ({ n: 0 })),
      db.$count(follows),
    ]);
    const m = numericOnly({
      subscribers: subs?.n ?? 0, chats: chatN?.n ?? 0, cvesStored: cveN ?? 0,
      alertsSent24h: alerts24h?.n ?? 0, follows: followN ?? 0,
    });
    return { text: JSON.stringify(m), metrics: m };
  },
  dashboard: view(dashboardView),
  stats: view(statsView),
  history: view(historyView),
  chats: view(chatsView),
  tick: view(tickView),

  async test(args) {
    const sent = await sendTestAlert(Number(args.admin), 'en');
    return html(sent ? '🧪 Sent to your chat with this bot.' : 'No CVE stored yet. Run the scheduler first.');
  },

  async broadcast(args) {
    const reply = await queueBroadcast(String(args.input ?? ''));
    if (reply.startsWith('📢')) await runTick({ budgetMs: 15_000 });
    return html(reply);
  },
};
