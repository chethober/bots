// The vpns, members, tries, reports, bans and states tables: everything but the screens.

import { db } from 'sdk';
import { and, desc, eq, inArray, sql } from 'sdk/db';
import { bans, members, reports, states, tries, vpns } from '../schema.js';
import { CODE_ALPHABET, CODE_LENGTH, LABEL_LENGTH, LOCK_SEC, LOCK_TRIES, STATE_TTL_SEC } from './config.js';
import { LABEL_ALPHABET } from './sources.js';
import { now, randomString } from './util.js';

// --- vpns -----------------------------------------------------------------------

export const getVpn = (id) => db.select().from(vpns).where(eq(vpns.id, id)).get();
export const getVpnByCode = (code) => db.select().from(vpns).where(eq(vpns.code, code)).get();
export const ownedVpns = (ownerId) =>
  db.select().from(vpns).where(eq(vpns.ownerId, ownerId)).orderBy(desc(vpns.createdAt)).all();
export const countOwned = (ownerId) => db.$count(vpns, eq(vpns.ownerId, ownerId));
export const findBySource = (source) => db.select().from(vpns).where(eq(vpns.source, source)).get();

async function uniqueCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomString(CODE_ALPHABET, CODE_LENGTH);
    if (!(await getVpnByCode(code))) return code;
  }
  throw new Error('could not generate a unique invite code');
}

export async function createVpn(fields) {
  const [row] = await db.insert(vpns)
    .values({ ...fields, code: await uniqueCode(), checkedAt: now(), createdAt: now() })
    .returning();
  return row;
}

export async function updateVpn(id, set) {
  await db.update(vpns).set(set).where(eq(vpns.id, id));
}

// 🔄 New invite link: the old one stops working.
export async function newCode(id) {
  const code = await uniqueCode();
  await updateVpn(id, { code });
  return code;
}

export async function deleteVpn(id) {
  await db.delete(members).where(eq(members.vpnId, id));
  await db.delete(tries).where(eq(tries.vpnId, id));
  await db.delete(reports).where(eq(reports.vpnId, id));
  await db.delete(vpns).where(eq(vpns.id, id));
}

// Listed VPNs, best first: free slots (unlimited counts as most), then newest.
export async function directory() {
  const rows = await db.select().from(vpns)
    .where(and(eq(vpns.public, true), eq(vpns.paused, false), eq(vpns.unlisted, false), eq(vpns.status, 'ok')))
    .orderBy(desc(vpns.createdAt)).limit(500).all();
  const free = (v) => (v.max > 0 ? v.max - v.active : Infinity);
  return rows.sort((a, b) => (free(b) - free(a)) || (b.createdAt - a.createdAt));
}

// --- members --------------------------------------------------------------------

export const getMember = (id) => db.select().from(members).where(eq(members.id, id)).get();
export const membership = (vpnId, userId) =>
  db.select().from(members).where(and(eq(members.vpnId, vpnId), eq(members.userId, userId))).get();

export const activeMembers = (vpnId) =>
  db.select().from(members).where(and(eq(members.vpnId, vpnId), eq(members.status, 'active')))
    .orderBy(members.joinedAt).all();

export const countActive = (vpnId) =>
  db.$count(members, and(eq(members.vpnId, vpnId), eq(members.status, 'active')));

// 📂 My VPNs: the person's active memberships with their VPNs.
export async function joinedVpns(userId) {
  const mine = await db.select().from(members)
    .where(and(eq(members.userId, userId), eq(members.status, 'active'))).orderBy(desc(members.joinedAt)).all();
  if (!mine.length) return [];
  const byId = new Map((await db.select().from(vpns).where(inArray(vpns.id, mine.map((m) => m.vpnId))).all())
    .map((v) => [v.id, v]));
  return mine.filter((m) => byId.has(m.vpnId)).map((m) => ({ member: m, vpn: byId.get(m.vpnId) }));
}

// A label nobody in this VPN has.
export async function freshLabel(vpnId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const label = randomString(LABEL_ALPHABET, LABEL_LENGTH);
    const taken = await db.select().from(members).where(and(eq(members.vpnId, vpnId), eq(members.label, label))).get();
    if (!taken) return label;
  }
  throw new Error('could not generate a unique label');
}

// Joins (or re-joins) the person: one row per person and VPN.
export async function saveMember(vpnId, userId, label, sub) {
  const set = { label, sub, status: 'active', joinedAt: now() };
  await db.insert(members).values({ vpnId, userId, ...set })
    .onConflictDoUpdate({ target: [members.vpnId, members.userId], set });
  return membership(vpnId, userId);
}

export async function setMemberStatus(id, status) {
  await db.update(members).set({ status, sub: null }).where(eq(members.id, id));
}

// --- passwords ------------------------------------------------------------------

// → seconds until the person may try again, or 0.
export async function lockedFor(vpnId, userId) {
  const row = await db.select().from(tries).where(and(eq(tries.vpnId, vpnId), eq(tries.userId, userId))).get();
  if (!row || row.count < LOCK_TRIES) return 0;
  return Math.max(0, row.since + LOCK_SEC - now());
}

// A wrong password; the count starts again an hour after the first.
export async function wrongPassword(vpnId, userId) {
  const row = await db.select().from(tries).where(and(eq(tries.vpnId, vpnId), eq(tries.userId, userId))).get();
  const fresh = !row || row.since + LOCK_SEC < now();
  const set = fresh ? { count: 1, since: now() } : { count: row.count + 1 };
  await db.insert(tries).values({ vpnId, userId, count: 1, since: now() })
    .onConflictDoUpdate({ target: [tries.vpnId, tries.userId], set });
  return LOCK_TRIES - (fresh ? 1 : row.count + 1);
}

export async function clearTries(vpnId, userId) {
  await db.delete(tries).where(and(eq(tries.vpnId, vpnId), eq(tries.userId, userId)));
}

// --- reports and bans -----------------------------------------------------------

// → the new report, or null if this person already reported this VPN.
export async function addReport(vpnId, reporterId, reason) {
  const [row] = await db.insert(reports)
    .values({ vpnId, reporterId, reason, status: 'open', createdAt: now() })
    .onConflictDoNothing().returning();
  return row ?? null;
}

export const getReport = (id) => db.select().from(reports).where(eq(reports.id, id)).get();
export const openReports = () =>
  db.select().from(reports).where(eq(reports.status, 'open')).orderBy(reports.createdAt).limit(20).all();

export async function closeReports(vpnId) {
  await db.update(reports).set({ status: 'done' }).where(eq(reports.vpnId, vpnId));
}

export const isBanned = async (userId) => !!(await db.select().from(bans).where(eq(bans.userId, userId)).get());

export async function banOwner(userId) {
  await db.insert(bans).values({ userId, createdAt: now() }).onConflictDoNothing();
  const owned = await ownedVpns(userId);
  for (const v of owned) await deleteVpn(v.id);
  return owned;
}

export async function stats() {
  const [all, listed, joined, open, banned] = await Promise.all([
    db.$count(vpns),
    db.$count(vpns, and(eq(vpns.public, true), eq(vpns.status, 'ok'), eq(vpns.unlisted, false))),
    db.$count(members, eq(members.status, 'active')),
    db.$count(reports, eq(reports.status, 'open')),
    db.$count(bans),
  ]);
  const owners = (await db.get(sql`SELECT COUNT(DISTINCT owner_id) AS n FROM vpns`))?.n ?? 0;
  return { all, listed, joined, open, banned, owners };
}

// --- conversation state -----------------------------------------------------------

// → { mode, data }. A state older than STATE_TTL_SEC reads as { mode: 'idle', expired: <old mode> }.
export async function getState(userId) {
  const row = await db.select().from(states).where(eq(states.userId, userId)).get();
  const mode = row?.mode ?? 'idle';
  if (mode !== 'idle' && row.updatedAt < now() - STATE_TTL_SEC) return { mode: 'idle', expired: mode };
  return { mode, data: row?.data ?? {} };
}

export async function setState(userId, mode, data = {}) {
  const set = { mode, data, updatedAt: now() };
  await db.insert(states).values({ userId, ...set }).onConflictDoUpdate({ target: states.userId, set });
}
