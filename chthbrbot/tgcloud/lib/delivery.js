import { db } from 'sdk';
import { and, asc, eq } from 'sdk/db';
import { messages, replies, blocks, bans } from '../schema.js';
import { ALBUM_MAX, ALBUM_WINDOW_SEC } from './config.js';
import { acceptedKinds, kindOf } from './content.js';
import { isFiltered } from './filter.js';
import { T } from './texts.js';
import { getUser, setState } from './users.js';
import { botUsername, now, safeApi } from './util.js';

async function getLinkButton() {
  return { text: T.btnGetLink, url: `https://t.me/${await botUsername()}` };
}

// Buttons under an anonymous message in the owner's chat.
export async function ownerKeyboard(messageId) {
  return {
    inline_keyboard: [
      [
        { text: T.btnReply, callback_data: `r:${messageId}` },
        { text: T.btnBlock, callback_data: `b:${messageId}` },
        { text: T.btnReport, callback_data: `p:${messageId}` },
      ],
      [await getLinkButton()],
    ],
  };
}

// Buttons under an owner's reply in the sender's chat.
export async function replyKeyboard() {
  return { inline_keyboard: [[await getLinkButton()]] };
}

// Buttons under the sender's "delivered" confirmation: unsend (u:<messageId>) and,
// when they came through the link, send another (s:<code> — the code they opened,
// so the button dies with the link after /newlink).
export function senderKeyboard(messageId, code) {
  const row = [{ text: T.btnUnsend, callback_data: `u:${messageId}` }];
  if (code) row.push({ text: T.btnSendAnother, callback_data: `s:${code}` });
  return { inline_keyboard: [row] };
}

async function recordAttempt(msg, owner, status) {
  const [row] = await db.insert(messages).values({
    ownerId: owner.id,
    senderId: msg.from.id,
    senderChatId: msg.chat.id,
    senderMsgId: msg.message_id,
    mediaGroupId: msg.media_group_id ?? null,
    status,
    createdAt: now(),
  }).returning({ id: messages.id });
  return row.id;
}

const notify = (chat_id, text, extra = {}) => safeApi('sendMessage', { chat_id, text, ...extra });

const replyTo = (message_id) => message_id ? { reply_parameters: { message_id, allow_sending_without_reply: true } } : {};

// 'banned' (bot-wide, by the admin), 'blocked' (by this owner) or null.
export async function dropReason(ownerId, senderId) {
  if (await db.select().from(bans).where(eq(bans.senderId, senderId)).get()) return 'banned';
  const blocked = await db.select().from(blocks)
    .where(and(eq(blocks.ownerId, ownerId), eq(blocks.senderId, senderId))).get();
  return blocked ? 'blocked' : null;
}

// --- message pairs ----------------------------------------------------------
// Every relayed message exists twice: the original in one chat and the bot's copy
// in the other. These find the row behind a message the user replied, reacted to or edited.

// The copy of an anonymous message in the owner's chat → messages row.
export async function findOwnerCopy(chatId, messageId) {
  return db.select().from(messages)
    .where(and(eq(messages.ownerId, chatId), eq(messages.ownerMsgId, messageId))).get();
}

// The sender's original of an anonymous message → messages row.
export async function findOriginal(chatId, messageId) {
  return db.select().from(messages)
    .where(and(eq(messages.senderChatId, chatId), eq(messages.senderMsgId, messageId))).get();
}

// The copy of an owner's reply in the sender's chat → replies row.
export async function findReplyCopy(chatId, messageId) {
  return db.select().from(replies)
    .where(and(eq(replies.senderChatId, chatId), eq(replies.senderMsgId, messageId))).get();
}

// --- albums -----------------------------------------------------------------
// Telegram delivers each album item as its own update. The first one to arrive
// goes through the normal flow; later ones find its row and follow it, without a
// header, a confirmation or a rate-limit check.

// The first recorded item of a sender's album → messages row, or null.
export async function findAlbumStart(senderId, mediaGroupId) {
  return db.select().from(messages)
    .where(and(eq(messages.senderId, senderId), eq(messages.mediaGroupId, mediaGroupId)))
    .orderBy(asc(messages.id)).limit(1).get();
}

async function deliverAlbumItem(msg, owner, first) {
  const items = await db.$count(messages,
    and(eq(messages.senderId, msg.from.id), eq(messages.mediaGroupId, msg.media_group_id)));
  if (items >= ALBUM_MAX || now() - first.createdAt > ALBUM_WINDOW_SEC) return;

  // Filter first, so a blocked sender gets the same answers as anyone else.
  if (isFiltered(msg.caption)) {
    await recordAttempt(msg, owner, 'filtered');
    return notify(msg.chat.id, T.filtered);
  }
  // Dropped albums stay dropped; 'failed' may just mean the first is still in flight.
  if (first.status !== 'delivered' && first.status !== 'failed') {
    await recordAttempt(msg, owner, first.status);
    return;
  }

  const id = await recordAttempt(msg, owner, 'failed');
  const copy = await safeApi('copyMessage', {
    chat_id: owner.id,
    from_chat_id: msg.chat.id,
    message_id: msg.message_id,
    reply_markup: await ownerKeyboard(id),
    ...replyTo(first.ownerMsgId),
  });
  if (copy) await db.update(messages).set({ status: 'delivered', ownerMsgId: copy.message_id }).where(eq(messages.id, id));
}

// --- sending ------------------------------------------------------------------

// The sender sent `msg` for owner `ownerId` — in sending_to mode, as a later item
// of an album, or as a native reply to one of the owner's replies (`replyToMsgId` =
// the owner's reply, in their chat; `keepState` leaves the conversation state alone).
export async function deliverAnonymous(msg, ownerId, { replyToMsgId, keepState = false } = {}) {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const endState = () => keepState || setState(senderId, 'idle');

  const owner = await getUser(ownerId);
  if (!owner || owner.paused) {
    await endState();
    return notify(chatId, owner ? T.ownerPaused(owner) : T.invalidLink);
  }

  // Wrong kind of message: say so and stay in send mode.
  const kind = kindOf(msg);
  if (!kind) return notify(chatId, T.unsupported);
  if (!acceptedKinds(owner).includes(kind)) return notify(chatId, T.kindNotAccepted(owner));

  if (msg.media_group_id) {
    const first = await findAlbumStart(senderId, msg.media_group_id);
    if (first && first.ownerId === owner.id) {
      await endState();
      return deliverAlbumItem(msg, owner, first);
    }
  }

  // Record before ending the state, so later album items find this row.
  // Filter before the block check, so a blocked sender can't tell from the answers.
  const filtered = isFiltered(msg.text ?? msg.caption);
  const dropped = filtered ? null : await dropReason(owner.id, senderId);
  const id = await recordAttempt(msg, owner, dropped ?? (filtered ? 'filtered' : 'failed'));
  await endState();

  // Came through the link (not a native reply): offer to send another.
  const confirm = { reply_markup: senderKeyboard(id, replyToMsgId ? null : owner.code) };
  if (dropped) return notify(chatId, T.delivered(owner), confirm); // silently dropped
  if (filtered) return notify(chatId, T.filtered);

  const header = await safeApi('sendMessage', {
    chat_id: owner.id,
    text: T.newMessageHeader(owner),
    ...replyTo(replyToMsgId),
  });
  const copy = header && await safeApi('copyMessage', {
    chat_id: owner.id,
    from_chat_id: chatId,
    message_id: msg.message_id,
    reply_markup: await ownerKeyboard(id),
  });
  if (!copy) return notify(chatId, T.deliveryFailed(owner));

  await db.update(messages)
    .set({ status: 'delivered', ownerMsgId: copy.message_id, ownerHeaderId: header.message_id })
    .where(eq(messages.id, id));
  return notify(chatId, T.delivered(owner), confirm);
}

// Unsend: removes the header and copy (of every item, for an album) from the
// owner's chat. Dropped rows have nothing to remove but are marked the same way,
// so the sender can't tell a blocked message from a delivered one.
export async function unsend(row) {
  const rows = row.mediaGroupId
    ? await db.select().from(messages)
      .where(and(eq(messages.senderId, row.senderId), eq(messages.mediaGroupId, row.mediaGroupId)))
    : [row];
  for (const r of rows) {
    if (r.status === 'delivered') {
      for (const message_id of [r.ownerMsgId, r.ownerHeaderId]) {
        if (message_id) await safeApi('deleteMessage', { chat_id: r.ownerId, message_id });
      }
    }
    await db.update(messages).set({ status: 'unsent' }).where(eq(messages.id, r.id));
  }
}

// --- replying -----------------------------------------------------------------

// The owner sent `msg` as a reply to messages row `messageId` — in replying_to
// mode, or as a native reply to the copy (`keepState` leaves the state alone).
export async function deliverReply(msg, messageId, { keepState = false } = {}) {
  const chatId = msg.chat.id;
  if (!kindOf(msg)) return notify(chatId, T.unsupported); // stay in reply mode

  if (!keepState) await setState(msg.from.id, 'idle');

  const original = await db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!original || original.ownerId !== msg.from.id || original.status !== 'delivered') {
    return notify(chatId, T.replyTargetGone);
  }

  const header = await safeApi('sendMessage', {
    chat_id: original.senderChatId,
    text: T.replyHeader(await getUser(msg.from.id)),
    ...replyTo(original.senderMsgId),
  });
  const copy = header && await safeApi('copyMessage', {
    chat_id: original.senderChatId,
    from_chat_id: chatId,
    message_id: msg.message_id,
    reply_markup: await replyKeyboard(),
  });
  if (!copy) return notify(chatId, T.replyFailed);

  await db.insert(replies).values({
    messageId: original.id,
    ownerId: original.ownerId,
    ownerMsgId: msg.message_id,
    senderChatId: original.senderChatId,
    senderMsgId: copy.message_id,
    createdAt: now(),
  });
  return notify(chatId, T.replySent);
}
