// What the widgets show next to a CVE's NVD record (lib/cvewidget.js): its KEV
// entry, its EPSS score and when the bot first saw a public PoC for it.
//   kev    from the `kev` table
//   epss   saved on its trending alert; with `live`, else asked from FIRST (one
//          request for all ids, given up after a short wait: the widget then goes
//          without it)
//   pocAt  when the trending alert that named a GitHub PoC was queued (not for
//          alerts recorded as `seeded` on the first run: their date is the bot's,
//          not the PoC's)

import { db } from 'sdk';
import { and, eq, inArray } from 'sdk/db';
import { alerts, kev } from '../schema.js';
import { epssScores } from './feeds.js';

const LIVE_WAIT_MS = 2500;

// → Map of id → { kev, epss, pocAt }.
export async function signalsFor(ids, { live = false } = {}) {
  const out = new Map(ids.map((id) => [id, { kev: null, epss: null, pocAt: null }]));
  if (!ids.length) return out;
  const [kevRows, trend] = await Promise.all([
    db.select({ cveId: kev.cveId, dateAdded: kev.dateAdded, dueDate: kev.dueDate }).from(kev)
      .where(inArray(kev.cveId, ids)).all(),
    db.select({ cveId: alerts.cveId, signals: alerts.signals, status: alerts.status, createdAt: alerts.createdAt })
      .from(alerts).where(and(eq(alerts.kind, 'trending'), inArray(alerts.cveId, ids))).all(),
  ]);
  for (const k of kevRows) out.get(k.cveId).kev = { dateAdded: k.dateAdded, dueDate: k.dueDate };
  for (const a of trend) {
    const s = out.get(a.cveId);
    if (a.signals?.epss?.score != null) s.epss = a.signals.epss;
    if (a.signals?.pocs?.length && a.status !== 'seeded') s.pocAt = a.createdAt;
  }
  const missing = ids.filter((id) => !out.get(id).epss);
  if (live && missing.length) {
    const scores = await Promise.race([
      epssScores(missing),
      new Promise((resolve) => setTimeout(() => resolve({}), LIVE_WAIT_MS)),
    ]).catch((e) => {
      console.warn('EPSS failed:', e.message);
      return {};
    });
    for (const [id, e] of Object.entries(scores)) if (out.has(id)) out.get(id).epss = e;
  }
  return out;
}

// One CVE's signals.
export async function signalsOf(id, opts) {
  return (await signalsFor([id], opts)).get(id);
}
