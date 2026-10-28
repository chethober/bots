// Groups and channels have no screens of their own: their admins change their
// alert settings from their private chat (⚙️ Settings → 📢 My groups and
// channels). A chat shows up there for whoever added the bot, and for admins
// who opened it with /settings in the group or by forwarding a channel post.
// Admin rights are checked with Telegram on every change.

import { api, db } from 'sdk';
import { and, eq, sql } from 'sdk/db';
import { managers } from '../schema.js';
import { getChat } from './chats.js';

const nowSec = () => Math.floor(Date.now() / 1000);

export async function addManager(chatId, userId) {
  await db.insert(managers).values({ chatId, userId, createdAt: nowSec() }).onConflictDoNothing().run();
}

async function removeManager(chatId, userId) {
  await db.delete(managers).where(and(eq(managers.chatId, chatId), eq(managers.userId, userId))).run();
}

// The groups and channels in the user's list, newest first.
export function managedChats(userId) {
  return db.all(sql`SELECT c.id, c.type, c.title, c.active FROM managers m JOIN chats c ON c.id = m.chat_id
    WHERE m.user_id = ${userId} ORDER BY m.id DESC LIMIT 20`);
}

async function isChatAdmin(chatId, userId) {
  try {
    const m = await api.getChatMember({ chat_id: chatId, user_id: userId });
    return m.status === 'creator' || m.status === 'administrator';
  } catch (e) {
    console.warn('getChatMember failed', chatId, e.description ?? e.message);
    return false;
  }
}

// The chat whose settings `userId` may change, or null. Their own private
// chat always; a group or channel the bot is in while they are its admin
// (which also puts it in their list, or takes it out once they aren't).
export async function manageable(userId, chatId) {
  const chat = await getChat(chatId);
  if (!chat) return null;
  if (chat.id === userId) return chat;
  if (chat.type === 'private') return null;
  if (await isChatAdmin(chatId, userId)) {
    await addManager(chatId, userId);
    return chat;
  }
  await removeManager(chatId, userId);
  return null;
}

// The chat a message points at: a forwarded channel post (or an anonymous
// admin's group message), an @username or a t.me link. Null if none.
export async function chatFromMessage(message) {
  const origin = message.forward_origin;
  const from = origin?.chat ?? origin?.sender_chat; // a channel post · an anonymous admin
  if (from?.id) return from.id;
  const m = /(?:^@|t\.me\/)([A-Za-z]\w{3,31})\b/.exec((message.text ?? '').trim());
  if (!m) return null;
  try {
    return (await api.getChat({ chat_id: `@${m[1]}` })).id;
  } catch {
    return null;
  }
}
