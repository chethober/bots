// Small data-access helpers for the shared tables: config, cache, prefs,
// follows, saved items, pending input, portfolio.
import { db } from 'sdk';
import { eq, and, desc, sql, lt } from 'sdk/db';
import { config, cache, prefs, follows, savedItems, pendingInput, portfolio } from '../schema.js';

export const LIMITS = { coins: 30, teams: 20, notifications: 50, saved: 200 };

const now = () => Math.floor(Date.now() / 1000);

// ── config ────────────────────────────────────────────────────────────────
export async function getConfig(key) {
  return (await db.select().from(config).where(eq(config.key, key)).get())?.value ?? null;
}

export async function setConfig(key, value) {
  if (value == null) return db.delete(config).where(eq(config.key, key)).run();
  return db.insert(config).values({ key, value: String(value) })
    .onConflictDoUpdate({ target: config.key, set: { value: String(value) } }).run();
}

// ── cache ─────────────────────────────────────────────────────────────────
// Returns the cached value, or runs `fn`, stores a non-null result for `ttl` seconds and returns it.
export async function cached(key, ttl, fn) {
  const hit = await db.select().from(cache).where(eq(cache.key, key)).get();
  if (hit && hit.expiresAt > now()) return hit.value;
  const value = await fn();
  if (value != null) {
    await db.insert(cache).values({ key, value, expiresAt: now() + ttl })
      .onConflictDoUpdate({ target: cache.key, set: { value, expiresAt: now() + ttl } }).run();
  }
  return value ?? hit?.value ?? null; // stale beats nothing
}

export async function putCache(key, value, ttl) {
  await db.insert(cache).values({ key, value, expiresAt: now() + ttl })
    .onConflictDoUpdate({ target: cache.key, set: { value, expiresAt: now() + ttl } }).run();
}

export async function getCache(key) {
  const hit = await db.select().from(cache).where(eq(cache.key, key)).get();
  return hit && hit.expiresAt > now() ? hit.value : null;
}

export async function sweepCache() {
  await db.delete(cache).where(lt(cache.expiresAt, now())).run();
}

// ── prefs ─────────────────────────────────────────────────────────────────
// Keep in sync with SECTIONS in lib/daily.js (defaults for chats that never changed them).
export const DEFAULT_DAILY = { weather: true, crypto: true, teams: true, f1: false, book: true, movie: false, recipe: true, quote: false, fact: false, word: false };

export async function getPrefs(chatId) {
  const row = await db.select().from(prefs).where(eq(prefs.chatId, chatId)).get();
  return { chatId, tz: 'UTC', muted: [], ...row, daily: { ...DEFAULT_DAILY, ...(row?.daily ?? {}) }, muted: row?.muted ?? [] };
}

export async function savePrefs(chatId, patch) {
  await db.insert(prefs).values({ chatId, ...patch })
    .onConflictDoUpdate({ target: prefs.chatId, set: { ...patch, updatedAt: sql`(unixepoch())` } }).run();
}

// ── follows ───────────────────────────────────────────────────────────────
export function listFollows(chatId, kind) {
  return db.select().from(follows).where(and(eq(follows.chatId, chatId), eq(follows.kind, kind))).orderBy(follows.id).all();
}

export async function isFollowing(chatId, kind, ref) {
  return !!(await db.select({ id: follows.id }).from(follows)
    .where(and(eq(follows.chatId, chatId), eq(follows.kind, kind), eq(follows.ref, ref))).get());
}

// → 'added' | 'exists' | 'limit'
export async function addFollow(chatId, category, kind, ref, label, meta = null, limit = LIMITS.coins) {
  if (await isFollowing(chatId, kind, ref)) return 'exists';
  if (await db.$count(follows, and(eq(follows.chatId, chatId), eq(follows.kind, kind))) >= limit) return 'limit';
  await db.insert(follows).values({ chatId, category, kind, ref, label, meta }).onConflictDoNothing().run();
  return 'added';
}

export async function removeFollow(chatId, kind, ref) {
  await db.delete(follows).where(and(eq(follows.chatId, chatId), eq(follows.kind, kind), eq(follows.ref, ref))).run();
}

// ── saved items ───────────────────────────────────────────────────────────
export const SAVED_PAGE = 8;

// → 'added' | 'exists' | 'limit'
export async function saveItem(chatId, category, kind, ref, title, data) {
  const exists = await db.select({ id: savedItems.id }).from(savedItems)
    .where(and(eq(savedItems.chatId, chatId), eq(savedItems.kind, kind), eq(savedItems.ref, ref))).get();
  if (exists) return 'exists';
  if (await db.$count(savedItems, and(eq(savedItems.chatId, chatId), eq(savedItems.category, category))) >= LIMITS.saved) return 'limit';
  await db.insert(savedItems).values({ chatId, category, kind, ref, title, data }).onConflictDoNothing().run();
  return 'added';
}

export async function listSaved(chatId, category, page = 0) {
  const where = and(eq(savedItems.chatId, chatId), eq(savedItems.category, category));
  const [rows, total] = await Promise.all([
    db.select({ id: savedItems.id, kind: savedItems.kind, title: savedItems.title }).from(savedItems)
      .where(where).orderBy(desc(savedItems.id)).limit(SAVED_PAGE).offset(page * SAVED_PAGE).all(),
    db.$count(savedItems, where),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / SAVED_PAGE)) };
}

export function getSaved(chatId, id) {
  return db.select().from(savedItems).where(and(eq(savedItems.chatId, chatId), eq(savedItems.id, id))).get();
}

export async function deleteSaved(chatId, id) {
  await db.delete(savedItems).where(and(eq(savedItems.chatId, chatId), eq(savedItems.id, id))).run();
}

// ── pending input ─────────────────────────────────────────────────────────
export async function setPending(chatId, userId, action, data = null, ttl = 600) {
  await db.delete(pendingInput).where(and(eq(pendingInput.chatId, chatId), eq(pendingInput.userId, userId))).run();
  await db.insert(pendingInput).values({ chatId, userId, action, data, expiresAt: now() + ttl }).run();
}

// Returns and clears the pending action, or null if none / expired.
export async function takePending(chatId, userId) {
  const where = and(eq(pendingInput.chatId, chatId), eq(pendingInput.userId, userId));
  const row = await db.select().from(pendingInput).where(where).get();
  if (!row) return null;
  await db.delete(pendingInput).where(where).run();
  return row.expiresAt > now() ? row : null;
}

// ── portfolio ─────────────────────────────────────────────────────────────
export function listPositions(chatId) {
  return db.select().from(portfolio).where(eq(portfolio.chatId, chatId)).orderBy(portfolio.coin).all();
}

// Adds to a position; the average price is amount-weighted when both sides have one.
export async function addPosition(chatId, coin, symbol, amount, price) {
  const where = and(eq(portfolio.chatId, chatId), eq(portfolio.coin, coin));
  const cur = await db.select().from(portfolio).where(where).get();
  if (!cur) {
    await db.insert(portfolio).values({ chatId, coin, symbol, amount, avgPrice: price ?? null }).run();
    return { amount, avgPrice: price ?? null };
  }
  const total = cur.amount + amount;
  let avgPrice = cur.avgPrice;
  if (price != null) avgPrice = cur.avgPrice != null ? (cur.amount * cur.avgPrice + amount * price) / total : (cur.amount === 0 ? price : null);
  await db.update(portfolio).set({ amount: total, avgPrice }).where(where).run();
  return { amount: total, avgPrice };
}

// Removes `amount` (or everything when null). Returns the remaining amount, or null if no position.
export async function reducePosition(chatId, coin, amount) {
  const where = and(eq(portfolio.chatId, chatId), eq(portfolio.coin, coin));
  const cur = await db.select().from(portfolio).where(where).get();
  if (!cur) return null;
  const left = amount == null ? 0 : cur.amount - amount;
  if (left <= 1e-12) {
    await db.delete(portfolio).where(where).run();
    return 0;
  }
  await db.update(portfolio).set({ amount: left }).where(where).run();
  return left;
}
