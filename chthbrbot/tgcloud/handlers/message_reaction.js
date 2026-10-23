// handlers/message_reaction.js — mirrors reactions on relayed messages to the other chat:
// the owner reacting to an anonymous message → on the sender's original; the sender
// reacting to an owner's reply → on the owner's original. The bot shows up as the reactor,
// so nobody's identity leaks.

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { messages } from '../schema.js';
import { dropReason, findOwnerCopy, findReplyCopy } from '../lib/delivery.js';
import { safeApi } from '../lib/util.js';

const emojis = (list) => (list ?? []).filter((r) => r.type === 'emoji').map((r) => r.emoji);

// Bots may set only one reaction per message, and only plain emoji: the one just
// added, else one that's still there, else none (clears ours).
function pick(r) {
  const before = emojis(r.old_reaction);
  const now = emojis(r.new_reaction);
  const emoji = now.find((e) => !before.includes(e)) ?? now[0];
  return emoji ? [{ type: 'emoji', emoji }] : [];
}

// → { chat_id, message_id } of the other side's message, or null.
async function counterpart(r) {
  const chatId = r.chat.id;

  const received = await findOwnerCopy(chatId, r.message_id);
  if (received) return { chat_id: received.senderChatId, message_id: received.senderMsgId };

  const answer = await findReplyCopy(chatId, r.message_id);
  if (!answer?.ownerMsgId) return null;
  const original = await db.select().from(messages).where(eq(messages.id, answer.messageId)).get();
  if (!original) return null;
  // A blocked or banned sender can't reach the owner, reactions included.
  if (await dropReason(answer.ownerId, original.senderId)) return null;
  return { chat_id: answer.ownerId, message_id: answer.ownerMsgId };
}

export default async function (r, ctx) {
  if (r.chat?.type !== 'private' || !r.user || r.user.is_bot) return;
  try {
    const target = await counterpart(r);
    if (target) await safeApi('setMessageReaction', { ...target, reaction: pick(r) });
  } catch (e) {
    console.error('message_reaction handler failed', e);
  }
}
