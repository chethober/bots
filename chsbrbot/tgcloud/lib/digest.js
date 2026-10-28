// Daily and weekly digests: chats in that mode (⚙️ Settings → 📰 Delivery)
// get no alert as it happens, but one message per day or week listing the
// alerts sent since their last digest that pass their filters.

import { api, db } from 'sdk';
import { and, eq, gt, lte, inArray, sql } from 'sdk/db';
import { alerts, chats } from '../schema.js';
import { byIds } from './cves.js';
import { digestMessage } from './format.js';
import { wantsAlert, DIGEST_PERIOD_S } from './filters.js';
import { isGone, setActive } from './chats.js';
import { LOCALES } from './i18n.js';

const BATCH = 10;

const nowSec = () => Math.floor(Date.now() / 1000);

// The alerts sent in (from, to], one item per CVE: { cve, kinds }.
async function sentBetween(from, to) {
  const rows = await db.select({ cveId: alerts.cveId, kind: alerts.kind }).from(alerts)
    .where(and(eq(alerts.status, 'sent'), inArray(alerts.kind, ['new', 'trending']),
      gt(alerts.sentAt, from), lte(alerts.sentAt, to))).all();
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.cveId))];
  const items = new Map((await byIds(ids)).map((cve) => [cve.id, { cve, kinds: [] }]));
  for (const r of rows) items.get(r.cveId).kinds.push(r.kind);
  return [...items.values()];
}

// Trending first, then by score.
const order = (a, b) => (b.kinds.includes('trending') - a.kinds.includes('trending'))
  || ((b.cve.score ?? 0) - (a.cve.score ?? 0));

// Scheduler: send the digests that are due, until the deadline.
export async function sendDigests(deadline) {
  const now = nowSec();
  const due = await db.select().from(chats).where(and(eq(chats.active, true), sql`(
    (${chats.mode} = 'daily' AND COALESCE(${chats.digestAt}, 0) <= ${now - DIGEST_PERIOD_S.daily})
    OR (${chats.mode} = 'weekly' AND COALESCE(${chats.digestAt}, 0) <= ${now - DIGEST_PERIOD_S.weekly}))`))
    .limit(BATCH).all();
  let sent = 0;
  for (const chat of due) {
    if (Date.now() > deadline) break;
    const from = chat.digestAt ?? now - DIGEST_PERIOD_S[chat.mode];
    const items = (await sentBetween(from, now))
      .filter(({ cve, kinds }) => kinds.some((k) => wantsAlert(chat, k, cve)))
      .sort(order);
    if (items.length) {
      const locale = LOCALES.includes(chat.locale) ? chat.locale : 'en';
      try {
        await api.sendMessage({ chat_id: chat.id, ...digestMessage(items, chat.mode, locale), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
        sent++;
      } catch (e) {
        if (e?.parameters?.retry_after) break; // rate limited: due again next run
        console.warn('digest not sent to', chat.id, e.description ?? e.message);
        if (isGone(e)) await setActive(chat.id, false);
      }
    }
    await db.update(chats).set({ digestAt: now }).where(eq(chats.id, chat.id)).run();
  }
  return { due: due.length, sent };
}
