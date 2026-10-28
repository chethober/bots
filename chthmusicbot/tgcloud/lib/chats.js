// Groups, forums and channels the bot is in, and their forum topics.

import { api, db } from 'sdk';
import { and, eq } from 'sdk/db';
import { chats, topics } from '../schema.js';

export async function getChat(chatId) {
  return db.select().from(chats).where(eq(chats.chatId, chatId)).get();
}

export async function upsertChat(chat, { active = true } = {}) {
  const row = { title: chat.title ?? null, type: chat.type, isForum: chat.is_forum ? 1 : 0, active: active ? 1 : 0 };
  await db.insert(chats).values({ chatId: chat.id, ...row })
    .onConflictDoUpdate({ target: chats.chatId, set: row }).run();
}

export async function setTopicName(chatId, threadId, name) {
  const existing = await db.select().from(topics).where(and(eq(topics.chatId, chatId), eq(topics.threadId, threadId))).get();
  if (existing) await db.update(topics).set({ name }).where(eq(topics.id, existing.id)).run();
  else await db.insert(topics).values({ chatId, threadId, name }).run();
}

export async function topicName(chatId, threadId) {
  return (await db.select().from(topics).where(and(eq(topics.chatId, chatId), eq(topics.threadId, threadId))).get())?.name ?? null;
}

/** The topic a group message belongs to (0 = General or a group without topics). */
export const threadOf = (message) => (message.is_topic_message && message.message_thread_id) || 0;

export async function isChatAdmin(chatId, userId) {
  try {
    const m = await api.getChatMember({ chat_id: chatId, user_id: userId });
    return m.status === 'creator' || m.status === 'administrator';
  } catch {
    return false;
  }
}
