// What the CHTH hub can ask of this bot (see hub_command.js). Reports stay here: reviewing them
// needs message contents, which don't leave the bot. Bans are addressed by reference, so a
// sender's id never reaches the hub unless an admin typed it.

import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { hubCommands, users, bans as bansTable, reports } from '../schema.js';
import { ban, bansView, dashboardView, runBroadcast, unban, unbanAt } from './admin.js';
import { textsOf } from './chats.js';
import { makeClaim, numericOnly } from './hub_admin_kit.js';

export const claim = makeClaim(db, hubCommands);

const textsFor = (args) => textsOf(Number(args.admin) || 0);

function userId(args) {
  const id = String(args.input ?? '').trim();
  if (!/^\d+$/.test(id)) throw new Error('Give a Telegram user id.');
  return Number(id);
}

const BROADCAST_MAX = 3000; // the hub's Continue button carries the text back
const BROADCAST_RUN = 150;  // per command, to stay inside the platform's run time

async function bans(args) {
  const { text, reply_markup } = await bansView(await textsFor(args));
  const buttons = (reply_markup?.inline_keyboard ?? []).flat().map((b) => ({
    text: b.text, cmd: 'unbanref', args: { ref: b.callback_data.slice(3) },
  }));
  return { text, buttons };
}

export const handlers = {
  async version() {
    return { text: '<b>chthbrbot</b>\nVersion <code>1.0.0</code>', html: true };
  },
  async health() {
    const open = await db.$count(reports, eq(reports.status, 'open'));
    return { text: `<b>🩺 Health</b>\nopenReports: <b>${open}</b>`, html: true };
  },
  async metrics() {
    const day = Math.floor(Date.now() / 1000) - 86400;
    const [userN, fresh, banN, open] = await Promise.all([
      db.$count(users),
      db.get(sql`SELECT count(*) AS n FROM users WHERE created_at > ${day}`),
      db.$count(bansTable),
      db.$count(reports, eq(reports.status, 'open')),
    ]);
    const m = numericOnly({ users: userN, newUsers24h: fresh?.n ?? 0, bans: banN, openReports: open });
    return { text: JSON.stringify(m), metrics: m };
  },
  dashboard: async (args) => ({ text: (await dashboardView(await textsFor(args))).text }),
  bans,

  async unbanref(args) {
    await unbanAt(String(args.ref ?? ''));
    return bans(args);
  },

  async ban(args) {
    const id = userId(args);
    const L = await textsFor(args);
    return { text: (await ban(id)) ? L.adminBanned(id) : L.adminAlreadyBanned(id) };
  },

  async unban(args) {
    const id = userId(args);
    const L = await textsFor(args);
    return { text: (await unban(id)) ? L.adminUnbanned(id) : L.adminNotBanned(id) };
  },

  async broadcast(args) {
    const text = String(args.input ?? '').trim();
    if (!text) throw new Error('The message is empty.');
    if (text.length > BROADCAST_MAX) throw new Error(`Keep it under ${BROADCAST_MAX} characters.`);
    const L = await textsFor(args);
    const admin = Number(args.admin);
    // A broadcast row is keyed by a number: the first time, the moment it started.
    const ref = Number(args.ref) || Math.floor(Date.now() / 1000);
    let summary = '';
    const state = await runBroadcast(admin, ref, async (line) => { summary = line; }, L, { text, limit: BROADCAST_RUN });
    if (state === 'more') {
      return { text: `${summary}\nMore people left.`, buttons: [{ text: '▶️ Continue', cmd: 'broadcast', args: { input: text, ref } }] };
    }
    return { text: summary || 'That broadcast has already finished.' };
  },
};
