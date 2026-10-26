// Seen receipts and the typing indicator: what an owner can choose to let senders
// see (⚙️ Settings → 🔧 Options). Bots get no read receipts, so "seen" means the
// owner did something in the bot's chat (a message, a tap, a reaction) after the
// message arrived; that chat is where the message is. The sender then finds a 👀
// reaction on their original. An owner's own reaction replaces it, as before.

import { db } from 'sdk';
import { and, eq, isNull } from 'sdk/db';
import { messages } from '../schema.js';
import { SEEN_WINDOW_SEC } from './config.js';
import { now, safeApi } from './util.js';

const SEEN = [{ type: 'emoji', emoji: '👀' }];

// `ownerId` was active: marks their delivered, unseen messages seen and puts 👀 on
// the senders' originals (on an album's first item only). Does nothing unless the
// owner has seen receipts on — checked in the same statement, so for everyone
// else this is one cheap query.
export async function markSeen(ownerId) {
  const t = now();
  const { rows } = await db.run(`
    UPDATE messages SET seen_at = :t
    WHERE owner_id = :owner AND status = 'delivered' AND seen_at IS NULL AND created_at >= :since
      AND EXISTS (SELECT 1 FROM users WHERE id = :owner AND seen_receipts = 1)
    RETURNING sender_chat_id AS chatId, sender_msg_id AS msgId, sender_id AS senderId, media_group_id AS album`,
  { ':t': t, ':owner': ownerId, ':since': t - SEEN_WINDOW_SEC });
  const albums = new Set();
  for (const r of rows ?? []) {
    if (r.album) {
      const key = `${r.senderId}:${r.album}`;
      if (albums.has(key)) continue;
      albums.add(key);
    }
    await safeApi('setMessageReaction', { chat_id: r.chatId, message_id: r.msgId, reaction: SEEN });
  }
}

// Marks one message seen without a 👀 (the owner reacted to it; their reaction
// is mirrored instead, and a later markSeen mustn't replace it).
export async function markOneSeen(messageId) {
  await db.update(messages).set({ seenAt: now() })
    .where(and(eq(messages.id, messageId), isNull(messages.seenAt)));
}

// Seen receipts just turned on: what the owner has received so far counts as seen,
// so old messages don't all get 👀 at once.
export async function markAllSeenQuietly(ownerId) {
  await db.update(messages).set({ seenAt: now() })
    .where(and(eq(messages.ownerId, ownerId), isNull(messages.seenAt)));
}

// The owner tapped ↩️ Reply on a message from `senderChatId`: "typing…" in the
// sender's chat. Telegram shows it for about five seconds, or until the reply lands.
export async function showTyping(owner, senderChatId) {
  if (owner?.typingIndicator) await safeApi('sendChatAction', { chat_id: senderChatId, action: 'typing' });
}
