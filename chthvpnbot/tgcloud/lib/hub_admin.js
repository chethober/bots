// What the CHTH hub can ask of this bot (see hub_command.js). Reports stay here:
// reviewing them needs a VPN's details, which don't leave the bot.

import { db, api, BotApiError } from 'sdk';
import { sql } from 'sdk/db';
import { hubCommands, vpns, members, reports, bans, servers } from '../schema.js';
import { textsOf } from './chats.js';
import { stats } from './store.js';
import { makeClaim, standard } from './hub_admin_kit.js';

export const claim = makeClaim(db, hubCommands);

const BROADCAST_BATCH = 40;
const BROADCAST_MAX = 3000;

async function metrics() {
  const s = await stats();
  const serversN = await db.$count(servers);
  const failing = await db.get(sql`SELECT count(*) AS n FROM vpns WHERE status != 'ok'`);
  return {
    vpns: Number(s.all ?? 0),
    public: Number(s.listed ?? 0),
    members: Number(s.joined ?? 0),
    openReports: Number(s.open ?? 0),
    bans: Number(s.banned ?? 0),
    owners: Number(s.owners ?? 0),
    servers: Number(serversN ?? 0),
    failingChecks: Number(failing?.n ?? 0),
  };
}

export const handlers = standard({
  name: 'chthvpnbot',
  version: '1.0.0',
  metrics,
  actions: [
    { cmd: 'reports', label: '🚨 Open reports', readOnly: true },
    { cmd: 'tick', label: '⚡ Run health checks', readOnly: true },
    { cmd: 'broadcast', label: '📣 Broadcast', ask: true, confirm: true },
  ],
  extra: {
    stats: async (args) => ({ text: (await textsOf(Number(args.admin) || 0)).adminStats(await stats()) }),
    async reports(args) {
      const open = Number((await stats()).open ?? 0);
      return {
        text: open
          ? `🚨 <b>${open}</b> open report(s).\nReview them in @chthvpnbot with /reports (details stay in the bot).`
          : '✅ No open reports.',
        html: true,
      };
    },
    async tick() {
      const { default: run } = await import('../endpoints/tick.js');
      const result = await run({}, {});
      const n = typeof result?.checked === 'number' ? result.checked : null;
      return { text: n != null ? `⚡ Checked ${n} VPN(s).` : '⚡ Health checks ran.', html: true };
    },
    async broadcast(args) {
      const body = String(args.input ?? '').trim();
      if (!body) throw new Error('The message is empty.');
      if (body.length > BROADCAST_MAX) throw new Error(`Keep it under ${BROADCAST_MAX} characters.`);
      const after = Number(args.after) || 0;
      // Owners and members: distinct user ids from vpns + members.
      const rows = await db.all(sql`
        SELECT id FROM (
          SELECT owner_id AS id FROM vpns
          UNION
          SELECT user_id AS id FROM members WHERE status = 'active'
        ) WHERE id > ${after} ORDER BY id LIMIT ${BROADCAST_BATCH}`);
      let sent = 0, failed = 0;
      for (const { id } of rows) {
        try {
          await api.sendMessage({ chat_id: id, text: body });
          sent++;
        } catch (e) {
          if (!(e instanceof BotApiError)) throw e;
          failed++;
        }
      }
      const more = rows.length === BROADCAST_BATCH;
      return {
        text: `📣 Sent ${sent}, failed ${failed}.${more ? '\nMore users left.' : ''}`,
        ...(more ? { buttons: [{ text: '▶️ Continue', cmd: 'broadcast', args: { input: body, after: rows.at(-1).id } }] } : {}),
      };
    },
  },
});
