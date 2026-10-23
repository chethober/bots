import { db, api } from 'sdk';
import { eq, and, or, desc, gt, gte, lt, inArray, like, sql } from 'sdk/db';
import { connections, chats, messages, styleSamples, relays, examples } from '../schema.js';
import { now } from './settings.js';

export async function upsertConnection(bc) {
  const row = {
    id: bc.id,
    userId: bc.user.id,
    userChatId: bc.user_chat_id,
    firstName: bc.user.first_name ?? null,
    isEnabled: !!bc.is_enabled,
    canReply: !!(bc.rights?.can_reply ?? bc.can_reply),
    canRead: !!bc.rights?.can_read_messages,
    updatedAt: now(),
  };
  const { id, ...set } = row;
  await db.insert(connections).values(row).onConflictDoUpdate({ target: connections.id, set }).run();
  return row;
}

// Looks a connection up locally, falling back to the Bot API (e.g. connected before deploy).
export async function getConnection(id) {
  const row = await db.select().from(connections).where(eq(connections.id, id)).get();
  if (row) return row;
  try {
    return await upsertConnection(await api.getBusinessConnection({ business_connection_id: id }));
  } catch (e) {
    console.warn('getBusinessConnection failed', id, e.description ?? e.message);
    return null;
  }
}

export async function getUserConnection(userId) {
  return db.select().from(connections)
    .where(eq(connections.userId, userId))
    .orderBy(desc(connections.updatedAt)).get();
}

export async function touchChat(ownerId, chat) {
  const title = [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || null;
  await db.insert(chats)
    .values({ ownerId, chatId: chat.id, title, username: chat.username ?? null, lastAt: now() })
    .onConflictDoUpdate({
      target: [chats.ownerId, chats.chatId],
      set: { title, username: chat.username ?? null, lastAt: now() },
    }).run();
  return db.select().from(chats).where(eq(chats.ownerId, ownerId), eq(chats.chatId, chat.id)).get();
}

export async function getChat(ownerId, chatId) {
  return db.select().from(chats).where(eq(chats.ownerId, ownerId), eq(chats.chatId, chatId)).get();
}

export async function listChats(ownerId, limit = 50) {
  return db.select().from(chats).where(eq(chats.ownerId, ownerId)).orderBy(desc(chats.lastAt)).limit(limit).all();
}

export async function updateChat(ownerId, chatId, set) {
  await db.update(chats).set(set).where(eq(chats.ownerId, ownerId), eq(chats.chatId, chatId)).run();
}

export async function addMessage(ownerId, chatId, role, text, messageId = null) {
  const [row] = await db.insert(messages)
    .values({ ownerId, chatId, role, text: text.slice(0, 4000), messageId, createdAt: now() })
    .returning({ id: messages.id });
  return row.id;
}

// Oldest-first history, at most `limit` messages from the last 3 days.
export async function getHistory(ownerId, chatId, limit) {
  if (limit <= 0) return [];
  const rows = await db.select().from(messages)
    .where(eq(messages.ownerId, ownerId), eq(messages.chatId, chatId), gte(messages.createdAt, now() - 3 * 86400))
    .orderBy(desc(messages.id)).limit(limit).all();
  return rows.reverse();
}

// True if the contact sent something newer than `afterId` (used to batch bursts).
export async function hasNewerContactMessage(ownerId, chatId, afterId) {
  const n = await db.$count(messages, and(
    eq(messages.ownerId, ownerId), eq(messages.chatId, chatId),
    eq(messages.role, 'contact'), gt(messages.id, afterId),
  ));
  return n > 0;
}

export async function deleteMessagesByTelegramId(ownerId, chatId, ids) {
  if (!ids.length) return;
  await db.delete(messages)
    .where(eq(messages.ownerId, ownerId), eq(messages.chatId, chatId), inArray(messages.messageId, ids)).run();
}

export async function clearHistory(ownerId, chatId = null) {
  const where = chatId == null
    ? eq(messages.ownerId, ownerId)
    : and(eq(messages.ownerId, ownerId), eq(messages.chatId, chatId));
  await db.delete(messages).where(where).run();
}

export async function pruneOld() {
  await db.delete(messages).where(lt(messages.createdAt, now() - 7 * 86400)).run();
}

export async function countRepliesToday(ownerId) {
  const midnight = Math.floor(Date.now() / 86400000) * 86400; // 00:00 UTC, when the AI quota resets
  return db.$count(messages, and(eq(messages.ownerId, ownerId), eq(messages.role, 'bot'), gte(messages.createdAt, midnight)));
}

// ---- Style samples ("speak as me") ----

const MAX_SAMPLES = 300;

// Worth learning from: real sentences, not commands, links-only or one-word replies.
export function isUsefulSample(text) {
  const t = (text ?? '').trim();
  return t.length >= 4 && t.length <= 600 && !t.startsWith('/') && !/^\[sent a /.test(t) && !/^https?:\/\/\S+$/.test(t);
}

export async function addSamples(ownerId, texts, source) {
  const rows = texts.map((t) => t.trim()).filter(isUsefulSample)
    .map((text) => ({ ownerId, text, source, createdAt: now() }));
  if (!rows.length) return 0;
  await db.insert(styleSamples).values(rows).run();
  // Keep only the newest MAX_SAMPLES per owner.
  const cutoff = await db.select({ id: styleSamples.id }).from(styleSamples)
    .where(eq(styleSamples.ownerId, ownerId)).orderBy(desc(styleSamples.id)).limit(1).offset(MAX_SAMPLES).get();
  if (cutoff) await db.delete(styleSamples).where(eq(styleSamples.ownerId, ownerId), lt(styleSamples.id, cutoff.id + 1)).run();
  return rows.length;
}

// A random mix of samples so replies don't overfit to the same few lines.
export async function getSamples(ownerId, limit) {
  if (limit <= 0) return [];
  const rows = await db.select({ text: styleSamples.text }).from(styleSamples)
    .where(eq(styleSamples.ownerId, ownerId)).orderBy(sql`random()`).limit(limit).all();
  return rows.map((r) => r.text);
}

export async function countSamples(ownerId) {
  return db.$count(styleSamples, eq(styleSamples.ownerId, ownerId));
}

export async function clearSamples(ownerId) {
  await db.delete(styleSamples).where(eq(styleSamples.ownerId, ownerId)).run();
}

// ---- Relays (non-text messages forwarded to the owner) ----

export async function createRelay(row) {
  const [r] = await db.insert(relays).values({ ...row, createdAt: now() }).returning();
  return r;
}

export async function getRelay(ownerId, id) {
  return db.select().from(relays).where(eq(relays.ownerId, ownerId), eq(relays.id, id)).get();
}

// Finds the relay a message in the owner's chat refers to (header, media copy or answer prompt).
export async function findRelayByOwnerMessage(ownerId, messageId) {
  return db.select().from(relays).where(eq(relays.ownerId, ownerId), or(
    eq(relays.headerMsgId, messageId), eq(relays.mediaMsgId, messageId), eq(relays.promptMsgId, messageId),
  )).get();
}

export async function updateRelay(id, set) {
  await db.update(relays).set(set).where(eq(relays.id, id)).run();
}

export async function pruneRelays() {
  await db.delete(relays).where(lt(relays.createdAt, now() - 7 * 86400)).run();
}

// ---- Conversation examples (imported chat exports) ----

const STOPWORDS = new Set(('که من تو نه هم از به و ولی رو یه این با حالا دیگه دگ خب نیست منم بود چی باشه الان اگر شما میشه '
  + 'دارم تا کن بابا بخدا در چرا چه واقعا بله واسه خودت ما خودم داره فعلا داری بگو همین اون کردم بذار هنوز برو خوب '
  + 'جدی خیلی فقط شد وا خونه باید مرسی بودم پس ندارم میاد میگی عزیزم آره اره سلام خوبی چطوری the and you what').split(' '));

function keywords(text, max = 4) {
  const words = (text.match(/[\u0600-\u06FF\u200c]{3,}|[a-zA-Z]{3,}/g) ?? [])
    .map((w) => w.replace(/\u200c/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, max);
}

export async function addExamples(ownerId, pairs, source) {
  const rows = pairs
    .filter((p) => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string' && p[0].trim() && p[1].trim())
    .map(([prompt, reply, sentAt]) => ({
      ownerId, prompt: prompt.slice(0, 400), reply: reply.slice(0, 400), source, sentAt: Number(sentAt) || null,
    }));
  for (let i = 0; i < rows.length; i += 100) await db.insert(examples).values(rows.slice(i, i + 100)).run();
  return rows.length;
}

// Past exchanges whose incoming side shares words with `text`, topped up with random ones.
export async function findExamples(ownerId, text, limit) {
  if (limit <= 0) return [];
  const picked = new Map();
  const kws = keywords(text);
  const perWord = Math.max(2, Math.ceil((limit * 0.6) / Math.max(1, kws.length)));
  for (const kw of kws) {
    const rows = await db.select({ id: examples.id, prompt: examples.prompt, reply: examples.reply }).from(examples)
      .where(eq(examples.ownerId, ownerId), like(examples.prompt, `%${kw}%`))
      .orderBy(sql`random()`).limit(perWord).all();
    for (const r of rows) if (picked.size < limit) picked.set(r.id, r);
  }
  if (picked.size < limit) {
    const rows = await db.select({ id: examples.id, prompt: examples.prompt, reply: examples.reply }).from(examples)
      .where(eq(examples.ownerId, ownerId)).orderBy(sql`random()`).limit(limit - picked.size + 5).all();
    for (const r of rows) if (picked.size < limit && !picked.has(r.id)) picked.set(r.id, r);
  }
  return [...picked.values()];
}

export async function countExamples(ownerId) {
  return db.$count(examples, eq(examples.ownerId, ownerId));
}

export async function clearExamples(ownerId) {
  await db.delete(examples).where(eq(examples.ownerId, ownerId)).run();
}
