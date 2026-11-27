// What the CHTH hub can ask of this bot. Stats and metrics only — never business
// message contents, samples, or credentials.

import { db } from 'sdk';
import { sql } from 'sdk/db';
import { hubCommands, connections, settings, relays, styleSamples } from '../schema.js';
import { makeClaim, standard } from './hub_admin_kit.js';

export const claim = makeClaim(db, hubCommands);

async function metrics() {
  const day = Math.floor(Date.now() / 1000) - 86400;
  const [owners, live, ownKeys, relays24h, samples] = await Promise.all([
    db.$count(settings),
    db.get(sql`SELECT count(*) AS n FROM connections WHERE is_enabled = 1`),
    db.get(sql`SELECT count(*) AS n FROM settings WHERE cf_account_id IS NOT NULL AND cf_account_id != ''`),
    db.get(sql`SELECT count(*) AS n FROM relays WHERE created_at > ${day}`),
    db.$count(styleSamples),
  ]);
  return {
    owners: Number(owners ?? 0),
    businessConnections: Number(live?.n ?? 0),
    ownKeys: Number(ownKeys?.n ?? 0),
    relays24h: Number(relays24h?.n ?? 0),
    styleSamples: Number(samples ?? 0),
  };
}

export const handlers = standard({
  name: 'chthgrambot',
  version: '1.0.0',
  metrics,
});
