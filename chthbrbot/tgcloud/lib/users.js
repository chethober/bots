import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users, states, messages, replies, blocks, reports, chats } from '../schema.js';
import { STATE_TTL_SEC } from './config.js';
import { encodeState, parseState } from './state.js';
import { now, randomCode } from './util.js';

export async function getUser(id) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function getUserByCode(code) {
  return db.select().from(users).where(eq(users.code, code)).get();
}

const nameOf = (from) => (from.first_name ?? '').trim().slice(0, 64) || null;

// A link code no one has yet.
async function uniqueCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    if (!(await getUserByCode(code))) return code;
  }
  throw new Error('could not generate a unique link code');
}

// Returns the existing user (refreshing their stored name) or creates one with a
// fresh, unique code. `from` is a Telegram User.
export async function getOrCreateUser(from) {
  const name = nameOf(from);
  const existing = await getUser(from.id);
  if (existing) {
    if (name && existing.name !== name) {
      await db.update(users).set({ name }).where(eq(users.id, from.id));
      existing.name = name;
    }
    return existing;
  }
  await db.insert(users)
    .values({ id: from.id, code: await uniqueCode(), name, paused: false, createdAt: now() })
    .onConflictDoNothing({ target: users.id });
  return getUser(from.id);
}

// New link: a fresh code; the old link stops working. Returns the new code.
export async function resetCode(id) {
  const code = await uniqueCode();
  await db.update(users).set({ code }).where(eq(users.id, id));
  // People who opened the old link and haven't sent yet can't anymore.
  await db.delete(states).where(eq(states.mode, `sending_to:${id}`));
  return code;
}

// Delete my data: everything kept for this person as a link owner, plus their state.
// Rows where they are the *sender* (messages sent to others, blocks and bans
// against them, reports about them) stay: they belong to the recipients and to
// moderation, and deleting them would lift bans.
export async function deleteUserData(id) {
  await db.delete(replies).where(eq(replies.ownerId, id));
  await db.delete(reports).where(eq(reports.ownerId, id));
  await db.delete(blocks).where(eq(blocks.ownerId, id));
  await db.delete(messages).where(eq(messages.ownerId, id));
  await db.delete(states).where(eq(states.userId, id));
  await db.delete(chats).where(eq(chats.id, id));
  await db.delete(users).where(eq(users.id, id));
}

export async function setPaused(id, paused) {
  await db.update(users).set({ paused }).where(eq(users.id, id));
}

// kinds: array of KINDS (see lib/content.js).
export async function setAccepts(id, kinds) {
  await db.update(users).set({ accepts: kinds }).where(eq(users.id, id));
}

// null clears it (back to the default invitation).
export async function setPrompt(id, prompt) {
  await db.update(users).set({ prompt }).where(eq(users.id, id));
}

// The owner's hidden words; [] clears them.
export async function setWords(id, words) {
  await db.update(users).set({ words: words.length ? words : null }).where(eq(users.id, id));
}

// ⚙️ Settings → 🔧 Options: the owner's on/off switches.
export const OPTIONS = ['blurMedia', 'protectReplies', 'seenReceipts', 'typingIndicator'];

export async function setOption(id, option, on) {
  if (!OPTIONS.includes(option)) return;
  await db.update(users).set({ [option]: on }).where(eq(users.id, id));
}

// --- conversation state ---------------------------------------------------

// Returns { kind: 'idle' } | { kind: 'sending_to', id } | { kind: 'replying_to', id }
//       | { kind: 'setting_prompt' } | { kind: 'setting_words' } | { kind: 'broadcasting' }
// A state older than STATE_TTL_SEC reads as { kind: 'idle', expired: <old kind> }.
export async function getState(userId) {
  const row = await db.select().from(states).where(eq(states.userId, userId)).get();
  return parseState(row, now(), STATE_TTL_SEC);
}

export async function setState(userId, kind, id) {
  const mode = encodeState(kind, id);
  await db.insert(states)
    .values({ userId, mode, updatedAt: now() })
    .onConflictDoUpdate({ target: states.userId, set: { mode, updatedAt: now() } });
}
