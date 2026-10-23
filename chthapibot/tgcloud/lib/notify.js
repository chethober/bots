// Notifications: rows in the `notifications` table plus a registry of kinds.
// A hub registers each kind it owns:
//   registerKind('price', {
//     describe(n, prefs) → HTML line for lists,
//     evaluate(rows, env) → [{ n, card, then, reArm? }]   (called by the scheduler)
//   })
// `then` says what happens after sending: 'deactivate' (one-shot alert),
// 'advance' (time-driven: n.nextAt = fire.nextAt), or 'touch' (stay active, record lastFiredAt).
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { notifications } from '../schema.js';
import { LIMITS } from './store.js';
import { esc } from './format.js';
import { describePattern, whenLocal, nextOccurrence } from './time.js';

const kinds = new Map();
const scheduleRenderers = new Map();

export function registerKind(kind, impl) {
  kinds.set(kind, impl);
}

export function kindImpl(kind) {
  return kinds.get(kind);
}

// Scheduled pushes share one kind ('schedule'); `params.what` picks the renderer:
//   registerSchedule('crypto_summary', { label: '💰 Crypto summary', category: 'crypto', render(chatId, prefs, env) → card })
export function registerSchedule(what, impl) {
  scheduleRenderers.set(what, impl);
}

export function scheduleImpl(what) {
  return scheduleRenderers.get(what);
}

export const CATEGORY_LABELS = { crypto: '💰 Crypto', sports: '🏆 Sports', food: '🍽 Food & drinks', random: '🎲 Random', general: '⏰ General' };

// → new id, or 'limit'
export async function createNotification(chatId, category, kind, params, nextAt = null) {
  if (await db.$count(notifications, and(eq(notifications.chatId, chatId), eq(notifications.active, 1))) >= LIMITS.notifications) return 'limit';
  const [row] = await db.insert(notifications).values({ chatId, category, kind, params, nextAt }).returning({ id: notifications.id });
  return row.id;
}

export function getNotification(chatId, id) {
  return db.select().from(notifications).where(and(eq(notifications.chatId, chatId), eq(notifications.id, id))).get();
}

export async function setActive(chatId, id, active, patch = {}) {
  await db.update(notifications).set({ active: active ? 1 : 0, ...patch })
    .where(and(eq(notifications.chatId, chatId), eq(notifications.id, id))).run();
}

export async function updateParams(chatId, id, params, extra = {}) {
  await db.update(notifications).set({ params, ...extra })
    .where(and(eq(notifications.chatId, chatId), eq(notifications.id, id))).run();
}

export async function deleteNotification(chatId, id) {
  await db.delete(notifications).where(and(eq(notifications.chatId, chatId), eq(notifications.id, id))).run();
}

export async function deleteAllForChat(chatId) {
  await db.delete(notifications).where(eq(notifications.chatId, chatId)).run();
}

export function listNotifications(chatId, category = null) {
  const where = category ? and(eq(notifications.chatId, chatId), eq(notifications.category, category)) : eq(notifications.chatId, chatId);
  return db.select().from(notifications).where(where).orderBy(notifications.category, notifications.id).all();
}

export function describe(n, prefs) {
  const impl = kinds.get(n.kind);
  try {
    return impl?.describe ? impl.describe(n, prefs) : esc(n.kind);
  } catch {
    return esc(n.kind);
  }
}

// ── built-in kinds ────────────────────────────────────────────────────────

// ⏰ Reminder: params { text }, nextAt = when. Fires even during quiet hours.
registerKind('reminder', {
  quietExempt: true,
  describe: (n, p) => `⏰ ${whenLocal(n.nextAt * 1000, p.tz)} — ${esc(n.params.text)}`,
  evaluate: (rows) => rows.map((n) => ({ n, then: 'deactivate', card: { text: `⏰ <b>Reminder</b>\n${esc(n.params.text)}` } })),
});

// 🗓 Scheduled push: params { what, time, pattern, ...extra }, nextAt = next run.
registerKind('schedule', {
  describe: (n) => {
    const impl = scheduleRenderers.get(n.params.what);
    return `🗓 ${impl?.label ?? esc(n.params.what)} — ${n.params.time} ${describePattern(n.params.pattern)}`;
  },
  // The scheduler handles schedule rows itself (it needs per-chat prefs to compute nextAt).
});

// Creates or updates the chat's schedule for `what` (one per chat per `what`).
export async function upsertSchedule(chatId, category, what, time, pattern, tz, extra = {}) {
  const nextAt = nextOccurrence(time, pattern, tz);
  const params = { what, time, pattern, ...extra };
  const existing = (await listNotifications(chatId, category)).find((n) => n.kind === 'schedule' && n.params.what === what);
  if (existing) {
    await db.update(notifications).set({ params, nextAt, active: 1 }).where(eq(notifications.id, existing.id)).run();
    return existing.id;
  }
  return createNotification(chatId, category, 'schedule', params, nextAt);
}

export async function findSchedule(chatId, category, what) {
  return (await listNotifications(chatId, category)).find((n) => n.kind === 'schedule' && n.params.what === what) ?? null;
}

// Time zone changed: recompute every schedule's next run.
export async function rescheduleChat(chatId, tz) {
  for (const n of await listNotifications(chatId)) {
    if (n.kind !== 'schedule') continue;
    await db.update(notifications).set({ nextAt: nextOccurrence(n.params.time, n.params.pattern, tz) }).where(eq(notifications.id, n.id)).run();
  }
}
