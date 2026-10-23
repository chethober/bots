// One scheduler pass over the `notifications` table. Telegram Serverless has no
// cron: endpoints/tick.js runs this and GitHub Actions calls it every ~10 minutes.
//
// For each due row: muted categories are skipped (schedules still advance), quiet
// hours hold everything except reminders, then the kind's evaluator decides what
// fires. Each fire is claimed in the DB before sending, so overlapping runs can't
// double-send.
import { db } from 'sdk';
import { eq, and, inArray, sql } from 'sdk/db';
import { notifications, prefs as prefsTable } from '../schema.js';
import { kindImpl, scheduleImpl, deleteAllForChat } from './notify.js';
import { DEFAULT_DAILY, sweepCache } from './store.js';
import { createMemo } from './daily.js';
import { localParts, inWindow, nextOccurrence } from './time.js';
import { sendCard, isChatGone } from './telegram.js';
import './hubs/index.js'; // registers every kind

// The platform stops a run after ~30 s of wall time (and ~3 s of CPU), so a run stops
// starting new sends after `budgetMs`; anything left stays due for the next run.
export async function runTick({ now = new Date(), maxSends = 25, budgetMs = 20000 } = {}) {
  const started = Date.now();
  const nowSec = Math.floor(now / 1000);
  const report = { at: now.toISOString(), active: 0, due: 0, sent: 0, held: 0, muted: 0, errors: [] };

  const rows = await db.select().from(notifications).where(eq(notifications.active, 1)).all();
  report.active = rows.length;
  const due = rows.filter((n) => n.nextAt == null || n.nextAt <= nowSec);
  report.due = due.length;
  if (!due.length) {
    await sweepCache().catch(() => {});
    return report;
  }

  const prefsMap = await loadPrefs([...new Set(due.map((n) => n.chatId))]);
  const env = { now, prefsOf: (chatId) => prefsMap.get(chatId), memo: createMemo() };

  const byKind = new Map();
  for (const n of due) {
    const p = env.prefsOf(n.chatId);
    const exempt = n.kind === 'reminder';
    if (!exempt && p.muted.includes(n.category)) {
      report.muted++;
      if (n.kind === 'schedule') await advance(n, p.tz, now); // skip this run, keep the schedule
      continue;
    }
    if (!exempt && inWindow(localParts(now, p.tz).hhmm, p.quietStart, p.quietEnd)) {
      report.held++;
      continue;
    }
    if (!byKind.has(n.kind)) byKind.set(n.kind, []);
    byKind.get(n.kind).push(n);
  }

  const fires = [];
  for (const [kind, list] of byKind) {
    try {
      if (kind === 'schedule') fires.push(...await scheduleFires(list, env));
      else fires.push(...(await kindImpl(kind)?.evaluate?.(list, env)) ?? []);
    } catch (e) {
      report.errors.push(`${kind}: ${e.message}`);
    }
  }

  let budget = maxSends;
  for (const f of fires) {
    if (f.card && (budget-- <= 0 || Date.now() - started > budgetMs)) { report.deferred = (report.deferred ?? 0) + 1; continue; }
    if (!(await claim(f, nowSec))) continue;
    try {
      await sendCard(f.n.chatId, f.card);
      report.sent++;
    } catch (e) {
      report.errors.push(`#${f.n.id}: ${e.description ?? e.message}`);
      if (isChatGone(e)) await deleteAllForChat(f.n.chatId);
    }
  }
  await sweepCache().catch(() => {});
  return report;
}

async function loadPrefs(chatIds) {
  const rows = chatIds.length ? await db.select().from(prefsTable).where(inArray(prefsTable.chatId, chatIds)).all() : [];
  const map = new Map(rows.map((r) => [r.chatId, r]));
  return new Map(chatIds.map((id) => {
    const r = map.get(id) ?? {};
    return [id, { ...r, chatId: id, tz: r.tz ?? 'UTC', muted: r.muted ?? [], daily: { ...DEFAULT_DAILY, ...(r.daily ?? {}) } }];
  }));
}

async function scheduleFires(list, env) {
  const out = [];
  for (const n of list) {
    const impl = scheduleImpl(n.params.what);
    const tz = env.prefsOf(n.chatId).tz;
    const nextAt = nextOccurrence(n.params.time, n.params.pattern, tz, env.now);
    if (!impl) {
      out.push({ n, then: 'advance', nextAt, card: null });
      continue;
    }
    out.push({ n, then: 'advance', nextAt, card: await impl.render(n.chatId, env) });
  }
  return out;
}

async function advance(n, tz, now) {
  await db.update(notifications).set({ nextAt: nextOccurrence(n.params.time, n.params.pattern, tz, now) })
    .where(and(eq(notifications.id, n.id), eq(notifications.nextAt, n.nextAt))).run();
}

// Marks the fire as handled; true only for the run that changed the row.
async function claim(f, nowSec) {
  const { n } = f;
  let res;
  if (f.then === 'advance') {
    res = await db.update(notifications).set({ nextAt: f.nextAt, lastFiredAt: nowSec })
      .where(and(eq(notifications.id, n.id), eq(notifications.nextAt, n.nextAt))).run();
    return res.rowsAffected > 0 && !!f.card;
  }
  if (f.then === 'touch') {
    // Optionally carries state (e.g. which match events were already announced) in `patch`.
    res = await db.update(notifications).set({ lastFiredAt: nowSec, ...(f.patch ?? {}) })
      .where(and(eq(notifications.id, n.id), sql`last_fired_at IS ${n.lastFiredAt ?? null}`)).run();
    return res.rowsAffected > 0 && !!f.card;
  }
  if (n.kind === 'reminder') {
    res = await db.delete(notifications).where(and(eq(notifications.id, n.id), eq(notifications.active, 1))).run();
    return res.rowsAffected > 0;
  }
  res = await db.update(notifications).set({ active: 0, lastFiredAt: nowSec })
    .where(and(eq(notifications.id, n.id), eq(notifications.active, 1))).run();
  return res.rowsAffected > 0;
}
