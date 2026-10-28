// 🔔 Follow on a CVE card: the chat hears when the CVE gets (or changes) its
// CVSS score, lands in CISA KEV, or gets a public exploit. Each follow keeps
// the state the chat last heard about; the scheduler compares it with what is
// known now and sends an update when it changed.

import { api, db } from 'sdk';
import { and, eq, asc, inArray, sql } from 'sdk/db';
import { alerts, cves, follows, kev } from '../schema.js';
import { lookup } from './nvd.js';
import { saveCves } from './cves.js';
import { followUpdateMessage } from './format.js';
import { LOCALES } from './i18n.js';
import { isGone } from './chats.js';

export const MAX_FOLLOWS = 50;
const REFRESH_AFTER_S = 12 * 3600; // look a followed CVE up on NVD again after this
const CHECK_BATCH = 50;

const nowSec = () => Math.floor(Date.now() / 1000);

// What is known about a CVE now: { score, severity, kev, poc }.
export async function cveState(id) {
  const [row, inKev, trend] = await Promise.all([
    db.select({ score: cves.score, severity: cves.severity, pocRefs: cves.pocRefs }).from(cves).where(eq(cves.id, id)).get(),
    db.select({ id: kev.cveId }).from(kev).where(eq(kev.cveId, id)).get(),
    db.select({ signals: alerts.signals }).from(alerts)
      .where(and(eq(alerts.cveId, id), eq(alerts.kind, 'trending'))).get(),
  ]);
  return {
    score: row?.score ?? null,
    severity: row?.severity ?? null,
    kev: !!inKev,
    poc: !!(row?.pocRefs?.length || trend?.signals?.pocs?.length),
  };
}

// What changed from `before` to `now`, as keys for followUpdateMessage.
export function changes(before, now) {
  const out = [];
  if (now.score != null && now.score !== before?.score) out.push('score');
  if (now.kev && !before?.kev) out.push('kev');
  if (now.poc && !before?.poc) out.push('poc');
  return out;
}

export async function isFollowing(chatId, cveId) {
  return !!(await db.select({ id: follows.id }).from(follows)
    .where(and(eq(follows.chatId, chatId), eq(follows.cveId, cveId))).get());
}

export const countFollows = (chatId) => db.$count(follows, eq(follows.chatId, chatId));

// Resolves to false when the chat already follows MAX_FOLLOWS CVEs.
export async function follow(chatId, cveId) {
  if (await countFollows(chatId) >= MAX_FOLLOWS) return false;
  const now = nowSec();
  await db.insert(follows).values({ chatId, cveId, state: await cveState(cveId), checkedAt: now, createdAt: now })
    .onConflictDoNothing().run();
  return true;
}

export async function unfollow(chatId, cveId) {
  await db.delete(follows).where(and(eq(follows.chatId, chatId), eq(follows.cveId, cveId))).run();
}

// The chat's followed CVE ids, newest follow first.
export async function followedIds(chatId, { limit, offset }) {
  const rows = await db.select({ cveId: follows.cveId }).from(follows).where(eq(follows.chatId, chatId))
    .orderBy(sql`${follows.id} DESC`).limit(limit).offset(offset).all();
  return rows.map((r) => r.cveId);
}

// Scheduler: look up on NVD again the followed CVEs whose details are oldest,
// using whatever NVD requests are left this run.
export async function refreshFollowed(nvd) {
  if (nvd.left <= 0) return { refreshed: 0 };
  const stale = await db.all(sql`SELECT DISTINCT f.cve_id AS id, COALESCE(c.updated_at, 0) AS at FROM follows f
    LEFT JOIN cves c ON c.id = f.cve_id
    WHERE COALESCE(c.updated_at, 0) < ${nowSec() - REFRESH_AFTER_S}
    ORDER BY at LIMIT ${nvd.left}`);
  let refreshed = 0;
  for (const { id } of stale) {
    if (nvd.left <= 0) break;
    nvd.left--;
    const cve = await lookup(id).catch((e) => {
      console.warn('NVD lookup failed', id, e.message);
      return null;
    });
    if (cve) {
      await saveCves([cve]);
      refreshed++;
    }
  }
  return { refreshed };
}

// Scheduler: compare the follows checked longest ago with what is known now,
// and tell each chat what changed.
export async function notifyFollowers(deadline, localeOf) {
  const rows = await db.select().from(follows).orderBy(asc(follows.checkedAt)).limit(CHECK_BATCH).all();
  const states = new Map();
  const quiet = [];
  let sent = 0;
  for (const f of rows) {
    if (Date.now() > deadline) break;
    if (!states.has(f.cveId)) states.set(f.cveId, await cveState(f.cveId));
    const now = states.get(f.cveId);
    const what = changes(f.state, now);
    if (!what.length) {
      quiet.push(f.id);
      continue;
    }
    const locale = await localeOf(f.chatId);
    const { text, reply_markup } = followUpdateMessage(f.cveId, f.state, now, what, LOCALES.includes(locale) ? locale : 'en');
    try {
      await api.sendMessage({ chat_id: f.chatId, text, parse_mode: 'HTML', reply_markup, link_preview_options: { is_disabled: true } });
      sent++;
    } catch (e) {
      if (e?.parameters?.retry_after) break; // rate limited: the rest wait for the next run
      console.warn('follow update not sent to', f.chatId, e.description ?? e.message);
      // The chat is gone: drop its follows. Any other failure: drop this update.
      if (isGone(e)) {
        await db.delete(follows).where(eq(follows.chatId, f.chatId)).run();
        continue;
      }
    }
    await db.update(follows).set({ state: now, checkedAt: nowSec() }).where(eq(follows.id, f.id)).run();
  }
  if (quiet.length) await db.update(follows).set({ checkedAt: nowSec() }).where(inArray(follows.id, quiet)).run();
  return { checked: rows.length, sent };
}
