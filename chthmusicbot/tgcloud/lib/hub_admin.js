// What the CHTH hub can ask of this bot (see hub_command.js). Counts only — never
// playlist contents, tokens or message text.

import { db, api, BotApiError } from 'sdk';
import { sql } from 'sdk/db';
import { hubCommands, accounts, links, chats, finds, queueItems } from '../schema.js';
import { makeClaim, standard } from './hub_admin_kit.js';

export const claim = makeClaim(db, hubCommands);

const BROADCAST_BATCH = 40;
const BROADCAST_MAX = 3000;

async function metrics() {
  const day = Math.floor(Date.now() / 1000) - 86400;
  const [users, syncs, chatsN, findsN, queueN, spotify, youtube, apple] = await Promise.all([
    db.get(sql`SELECT count(DISTINCT user_id) AS n FROM accounts`),
    db.$count(links),
    db.$count(chats),
    db.get(sql`SELECT count(*) AS n FROM finds WHERE created_at > ${day}`),
    db.$count(queueItems),
    db.get(sql`SELECT count(*) AS n FROM accounts WHERE provider = 'spotify'`),
    db.get(sql`SELECT count(*) AS n FROM accounts WHERE provider = 'youtube'`),
    db.get(sql`SELECT count(*) AS n FROM accounts WHERE provider = 'apple'`),
  ]);
  return {
    users: Number(users?.n ?? 0),
    syncs: Number(syncs ?? 0),
    chats: Number(chatsN ?? 0),
    finds24h: Number(findsN?.n ?? 0),
    queueItems: Number(queueN ?? 0),
    accounts: {
      spotify: Number(spotify?.n ?? 0),
      youtube: Number(youtube?.n ?? 0),
      apple: Number(apple?.n ?? 0),
    },
  };
}

export const handlers = standard({
  name: 'chthmusicbot',
  version: '1.2.1',
  metrics,
  actions: [
    { cmd: 'broadcast', label: '📣 Broadcast', ask: true, confirm: true },
  ],
  extra: {
    async broadcast(args) {
      const body = String(args.input ?? '').trim();
      if (!body) throw new Error('The message is empty.');
      if (body.length > BROADCAST_MAX) throw new Error(`Keep it under ${BROADCAST_MAX} characters.`);
      const after = Number(args.after) || 0;
      const rows = await db.all(sql`SELECT DISTINCT user_id AS id FROM accounts WHERE user_id > ${after} ORDER BY user_id LIMIT ${BROADCAST_BATCH}`);
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
