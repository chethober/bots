// What the CHTH hub can ask of this bot. Counts only — never saved content or
// notification payloads.

import { db, api, BotApiError } from 'sdk';
import { sql } from 'sdk/db';
import { hubCommands, prefs, follows, notifications, savedItems } from '../schema.js';
import { makeClaim, standard } from './hub_admin_kit.js';

export const claim = makeClaim(db, hubCommands);

const BROADCAST_BATCH = 40;
const BROADCAST_MAX = 3000;

async function metrics() {
  const day = Math.floor(Date.now() / 1000) - 86400;
  const [users, followN, pending, fired24h, saved] = await Promise.all([
    db.$count(prefs),
    db.$count(follows),
    db.get(sql`SELECT count(*) AS n FROM notifications WHERE active = 1`),
    db.get(sql`SELECT count(*) AS n FROM notifications WHERE last_fired_at > ${day}`),
    db.$count(savedItems),
  ]);
  return {
    users: Number(users ?? 0),
    follows: Number(followN ?? 0),
    notificationsActive: Number(pending?.n ?? 0),
    notificationsFired24h: Number(fired24h?.n ?? 0),
    savedItems: Number(saved ?? 0),
  };
}

export const handlers = standard({
  name: 'chthapibot',
  version: '1.0.0',
  metrics,
  actions: [
    { cmd: 'tick', label: '⚡ Run notifications', readOnly: true },
    { cmd: 'broadcast', label: '📣 Broadcast', ask: true, confirm: true },
  ],
  extra: {
    async tick() {
      const { default: run } = await import('../endpoints/tick.js');
      await run({}, {});
      return { text: '⚡ Tick ran.', html: true };
    },
    async broadcast(args) {
      const body = String(args.input ?? '').trim();
      if (!body) throw new Error('The message is empty.');
      if (body.length > BROADCAST_MAX) throw new Error(`Keep it under ${BROADCAST_MAX} characters.`);
      const after = Number(args.after) || 0;
      const rows = await db.all(sql`SELECT chat_id AS id FROM prefs WHERE chat_id > ${after} ORDER BY chat_id LIMIT ${BROADCAST_BATCH}`);
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
        text: `📣 Sent ${sent}, failed ${failed}.${more ? '\nMore chats left.' : ''}`,
        ...(more ? { buttons: [{ text: '▶️ Continue', cmd: 'broadcast', args: { input: body, after: rows.at(-1).id } }] } : {}),
      };
    },
  },
});
