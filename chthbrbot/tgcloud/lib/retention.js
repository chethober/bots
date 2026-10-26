// Data retention (RETENTION_DAYS). The platform has no scheduler, so the cleanup
// runs from the message handler, at most once an hour per isolate.
//
// Deleted once older than RETENTION_DAYS: dismissed reports, then the records of
// anonymous messages no report points at, with their replies. Kept: open and
// banned reports and their messages (moderation), blocks and bans (they'd lift),
// states (they're the broadcast's recipient list). Finished broadcasts go after 30 days.

import { db } from 'sdk';
import { sql } from 'sdk/db';
import { RETENTION_DAYS } from './config.js';
import { now } from './util.js';

const EVERY_MS = 60 * 60 * 1000;
const BROADCAST_DAYS = 30;
let lastRun = 0;

export async function maybePrune() {
  if (Date.now() - lastRun < EVERY_MS) return;
  lastRun = Date.now();
  try {
    await prune();
  } catch (e) {
    console.warn('prune failed', e);
  }
}

export async function prune() {
  const t = now();
  if (RETENTION_DAYS > 0) {
    const cutoff = t - RETENTION_DAYS * 86400;
    await db.run(sql`DELETE FROM reports WHERE status = 'dismissed' AND created_at < ${cutoff}`);
    const old = sql`SELECT id FROM messages
      WHERE created_at < ${cutoff} AND id NOT IN (SELECT message_id FROM reports)`;
    await db.run(sql`DELETE FROM replies WHERE message_id IN (${old})`);
    await db.run(sql`DELETE FROM messages WHERE id IN (${old})`);
  }
  await db.run(sql`DELETE FROM broadcasts WHERE status = 'done' AND created_at < ${t - BROADCAST_DAYS * 86400}`);
}
