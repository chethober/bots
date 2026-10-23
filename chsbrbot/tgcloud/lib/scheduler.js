// One scheduler pass. Telegram Serverless has no cron: endpoints/tick.js runs
// this and a GitHub Actions workflow calls it every ~10 minutes.
//
// The platform stops a run after ~30 s of wall time (and ~3 s of CPU), so the
// work is split into steps that each fit, and whatever doesn't fit waits for
// the next run:
//   1. kev       reload the CISA KEV catalog, twice a day
//   2. poll      fetch CVEs published since the last run from NVD; queue an
//                alert for each one above MIN_CVSS
//   3. trending  queue an alert for each new KEV entry or GitHub PoC
//   4. enrich    fetch NVD details and EPSS scores for queued trending alerts
//   5. deliver   send queued alerts chat by chat, until the time budget is used
//
// The very first run records what is already out there as `seeded` instead of
// sending it, so switching the bot over doesn't flood every chat.

import { api, db, BotApiError } from 'sdk';
import { and, eq, gt, inArray, asc, sql } from 'sdk/db';
import { alerts, chats, cves, kev } from '../schema.js';
import { MIN_CVSS, KEV_DAYS, NVD_API_KEY } from './config.js';
import { getSetting, saveSetting } from './settings.js';
import { publishedBetween, lookup } from './nvd.js';
import { loadKev, epssScores, githubPocs } from './feeds.js';
import { saveCves, fromKev } from './cves.js';
import { alertMessage, esc } from './format.js';
import { isGone, migrate, setActive } from './chats.js';
import { LOCALES } from './i18n.js';

const KEV_EVERY_MS = 12 * 3600_000;
const FIRST_LOOKBACK_MS = 2 * 3600_000; // first run, or after the cursor is lost
const MAX_LOOKBACK_MS = 24 * 3600_000; // after downtime, don't alert older CVEs
const OVERLAP_MS = 15 * 60_000; // NVD can list a CVE a little after its publish time
const LOCK_STALE_MS = 60_000;
const MAX_TRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowSec = () => Math.floor(Date.now() / 1000);

export async function runTick({ budgetMs = 22_000, maxSends = 300 } = {}) {
  const started = Date.now();
  const deadline = started + budgetMs;
  const report = { at: new Date(started).toISOString(), errors: [] };
  if (!(await lock(started))) return { ...report, skipped: 'another run holds the lock' };
  try {
    const seeding = !(await getSetting('seeded'));
    if (seeding) report.seeding = true;
    // NVD allows 5 requests per 30 s without a key, 50 with one.
    const nvd = { left: NVD_API_KEY ? 20 : 3 };
    const steps = [
      ['kev', () => refreshKev(started)],
      ['poll', () => pollNew(started, nvd, seeding)],
      ['trending', () => pollTrending(seeding)],
      ['enrich', () => enrich(nvd)],
    ];
    let complete = true;
    for (const [name, step] of steps) {
      if (Date.now() > deadline) {
        complete = false;
        break;
      }
      try {
        report[name] = await step();
      } catch (e) {
        complete = false;
        console.error(`tick ${name}:`, e);
        report.errors.push(`${name}: ${e.message}`);
      }
    }
    // Seeding ends only after a run that recorded everything without errors.
    if (seeding && complete && !report.poll?.partial) await saveSetting('seeded', String(started));
    try {
      report.deliver = await deliver(deadline, maxSends);
    } catch (e) {
      console.error('tick deliver:', e);
      report.errors.push(`deliver: ${e.message}`);
    }
  } finally {
    await saveSetting('lock', '0');
  }
  report.ms = Date.now() - started;
  await saveSetting('last_tick', JSON.stringify(report)).catch(() => {});
  return report;
}

// A lease in the settings table, so an admin's "run now" can't overlap the cron.
async function lock(now) {
  await db.run(sql`INSERT OR IGNORE INTO settings (key, value) VALUES ('lock', '0')`);
  const res = await db.run(sql`UPDATE settings SET value = ${String(now)}
    WHERE key = 'lock' AND CAST(value AS INTEGER) < ${now - LOCK_STALE_MS}`);
  return res.rowsAffected === 1;
}

async function refreshKev(now) {
  const last = Number(await getSetting('kev_loaded')) || 0;
  if (now - last < KEV_EVERY_MS) return 'fresh';
  const n = await loadKev();
  await saveSetting('kev_loaded', String(now));
  return `${n} entries`;
}

// Queue an alert per CVE; existing (cve, kind) pairs are left alone.
async function queue(rows) {
  if (!rows.length) return 0;
  const added = await db.insert(alerts).values(rows).onConflictDoNothing().returning({ id: alerts.id }).run();
  return added.length;
}

async function pollNew(now, nvd, seeding) {
  const cursor = Number(await getSetting('nvd_cursor')) || 0;
  const from = cursor ? Math.max(cursor - OVERLAP_MS, now - MAX_LOOKBACK_MS) : now - FIRST_LOOKBACK_MS;
  let fetched = 0;
  let queued = 0;
  for (let start = 0; ; start += 200) {
    if (nvd.left <= 0) return { fetched, queued, partial: true }; // cursor stays: the window is fetched again
    nvd.left--;
    const page = await publishedBetween(from, now, start);
    await saveCves(page.items);
    fetched += page.items.length;
    queued += await queue(page.items
      .filter((c) => c.score != null && c.score > MIN_CVSS)
      .map((c) => ({ cveId: c.id, kind: 'new', status: seeding ? 'seeded' : 'sending', createdAt: nowSec() })));
    if (start + page.items.length >= page.total || !page.items.length) break;
  }
  await saveSetting('nvd_cursor', String(now));
  return { fetched, queued };
}

// Trending: KEV entries added in the last KEV_DAYS days, and CVEs named by
// recently updated GitHub PoC repositories.
async function pollTrending(seeding) {
  const since = new Date(Date.now() - KEV_DAYS * 86400_000).toISOString().slice(0, 10);
  const recentKev = await db.select().from(kev).where(sql`${kev.dateAdded} >= ${since}`).all();
  const pocs = await githubPocs().catch((e) => {
    console.warn('GitHub PoC search failed:', e.message);
    return {};
  });
  const kevById = new Map(recentKev.map((k) => [k.cveId, k]));
  const ids = [...new Set([...kevById.keys(), ...Object.keys(pocs)])];
  if (!ids.length) return { candidates: 0, queued: 0 };

  // KEV signals for GitHub-only candidates that are in the catalog from before.
  const ghOnly = ids.filter((id) => !kevById.has(id));
  if (ghOnly.length) {
    for (const k of await db.select().from(kev).where(inArray(kev.cveId, ghOnly)).all()) kevById.set(k.cveId, k);
  }

  const queued = await queue(ids.map((id) => ({
    cveId: id,
    kind: 'trending',
    status: seeding ? 'seeded' : 'pending',
    signals: { kev: kevSignal(kevById.get(id)), pocs: pocs[id] ?? [] },
    createdAt: nowSec(),
  })));
  return { candidates: ids.length, queued };
}

const kevSignal = (k) => (k ? {
  dateAdded: k.dateAdded, requiredAction: k.requiredAction, dueDate: k.dueDate,
} : null);

// Pending trending alerts need the CVE's details (NVD) and EPSS score before
// they go out. NVD requests left over also fill in details for seeded ones,
// so the 🔥 Trending list has descriptions.
async function enrich(nvd) {
  const pending = await db.select().from(alerts)
    .where(and(eq(alerts.kind, 'trending'), eq(alerts.status, 'pending')))
    .orderBy(asc(alerts.id)).limit(10).all();
  const backlog = await db.all(sql`SELECT a.id, a.cve_id AS cveId, a.tries FROM alerts a
    LEFT JOIN cves c ON c.id = a.cve_id
    WHERE a.kind = 'trending' AND a.status = 'seeded' AND c.id IS NULL AND a.tries < ${MAX_TRIES}
    ORDER BY a.id DESC LIMIT 5`);

  const all = [...pending, ...backlog];
  if (!all.length) return { pending: 0, ready: 0, backlog: 0 };

  // EPSS only adds a line to the alert; when it's down the alert goes without.
  const epss = pending.length
    ? await epssScores(pending.map((a) => a.cveId)).catch((e) => {
      console.warn('EPSS failed:', e.message);
      return {};
    })
    : {};

  const known = new Set((await db.select({ id: cves.id }).from(cves)
    .where(inArray(cves.id, all.map((a) => a.cveId))).all()).map((r) => r.id));

  let ready = 0;
  for (const a of all) {
    let tries = a.tries;
    let found = known.has(a.cveId);
    if (!found && nvd.left > 0) {
      nvd.left--;
      try {
        const cve = await lookup(a.cveId);
        if (cve) await saveCves([cve]);
        found = true; // NVD answered: with the CVE, or that it doesn't have it
      } catch (e) {
        console.warn('NVD lookup failed', a.cveId, e.message);
        tries++;
      }
    } else if (!found) continue;
    if (!pending.includes(a)) {
      await db.update(alerts).set({ tries: found ? MAX_TRIES : tries }).where(eq(alerts.id, a.id)).run();
      continue;
    }
    // Go ahead once details are in, or NVD failed MAX_TRIES times.
    const go = found || tries >= MAX_TRIES;
    const signals = { ...a.signals, epss: epss[a.cveId] ?? a.signals?.epss ?? null };
    await db.update(alerts).set({ tries, signals, ...(go ? { status: 'sending' } : {}) }).where(eq(alerts.id, a.id)).run();
    if (go) ready++;
  }
  return { pending: pending.length, ready, backlog: backlog.length };
}

// Send alerts oldest first. Each alert walks the active chats in id order;
// `cursor` remembers the last chat it reached, so a run that stops halfway is
// picked up by the next one. Admin broadcasts (kind 'broadcast', the text in
// `signals`) travel the same way.
async function deliver(deadline, maxSends) {
  let sent = 0;
  let failed = 0;
  let done = 0;
  for (;;) {
    const alert = await db.select().from(alerts).where(eq(alerts.status, 'sending')).orderBy(asc(alerts.id)).get();
    if (!alert) break;
    const broadcast = alert.kind === 'broadcast';
    const cve = broadcast ? null : await alertCve(alert.cveId);
    const rendered = {};
    let cursor = alert.cursor;
    for (;;) {
      if (Date.now() > deadline || sent >= maxSends) return { sent, failed, done, more: true };
      const where = [eq(chats.active, true)];
      if (cursor != null) where.push(gt(chats.id, cursor));
      if (broadcast && alert.signals?.channelsOnly) where.push(eq(chats.type, 'channel'));
      const batch = await db.select({ id: chats.id, locale: chats.locale }).from(chats)
        .where(and(...where)).orderBy(asc(chats.id)).limit(25).all();
      if (!batch.length) break;
      for (const chat of batch) {
        if (Date.now() > deadline || sent >= maxSends) return { sent, failed, done, more: true };
        const locale = LOCALES.includes(chat.locale) ? chat.locale : 'en';
        rendered[locale] ??= broadcast
          ? { text: `📢 ${esc(alert.signals?.text)}` }
          : alertMessage(cve, alert.kind, alert.signals, locale);
        const outcome = await sendAlert(chat.id, rendered[locale]);
        if (outcome === 'retry') return { sent, failed, done, more: true, rateLimited: true };
        if (outcome === 'sent') sent++;
        else failed++;
        cursor = chat.id;
        await db.update(alerts).set({ cursor }).where(eq(alerts.id, alert.id)).run();
        await sleep(40);
      }
    }
    await db.update(alerts).set({ status: 'sent', sentAt: nowSec() }).where(eq(alerts.id, alert.id)).run();
    done++;
  }
  return { sent, failed, done };
}

// The CVE to show in an alert: NVD's details, else the KEV entry, else the id.
async function alertCve(id) {
  const row = await db.select().from(cves).where(eq(cves.id, id)).get();
  if (row) return row;
  const k = await db.select().from(kev).where(eq(kev.cveId, id)).get();
  return k ? fromKev(k) : { id, description: '', score: null, severity: null, bugTypes: [], software: [], pocRefs: [] };
}

// 'sent', 'failed' (skip this chat) or 'retry' (rate limited: stop this run).
async function sendAlert(chatId, { text, reply_markup }) {
  for (let attempt = 0; ; attempt++) {
    try {
      await api.sendMessage({
        chat_id: chatId, text, parse_mode: 'HTML', reply_markup, link_preview_options: { is_disabled: true },
      });
      return 'sent';
    } catch (e) {
      if (!(e instanceof BotApiError)) throw e;
      const wait = e.parameters?.retry_after;
      if (e.code === 429 && wait != null) {
        if (attempt === 0 && wait <= 3) {
          await sleep(wait * 1000);
          continue;
        }
        return 'retry';
      }
      if (e.parameters?.migrate_to_chat_id) await migrate(chatId, e.parameters.migrate_to_chat_id);
      else if (isGone(e)) await setActive(chatId, false);
      console.warn('alert not sent to', chatId, e.description);
      return 'failed';
    }
  }
}
