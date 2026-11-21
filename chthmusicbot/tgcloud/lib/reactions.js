// Which emoji the bot reacts with on a group, channel or forum post:
//   added   its track went into a playlist        (default 👌)
//   queued  its song was queued on the group player (default ⚡)
//   repost  its songs were all in the playlist already (default off)
// Admins set them in the Mini App (⚙︎ Reactions) for the whole chat, and a forum
// topic can differ. A sync's own 🙂 Reaction switch still turns them off for it.

import { api, db } from 'sdk';
import { and, eq } from 'sdk/db';
import { chatSettings } from '../schema.js';
import { ADDED_REACTION, QUEUED_REACTION } from './config.js';

export const KINDS = ['added', 'queued', 'repost'];
export const DEFAULTS = { added: ADDED_REACTION, queued: QUEUED_REACTION, repost: '' };
const COLUMN = { added: 'addedReaction', queued: 'queuedReaction', repost: 'repostReaction' };

// The emoji Telegram lets bots react with (ReactionTypeEmoji).
export const REACTIONS = ['❤', '👍', '👎', '🔥', '🥰', '👏', '😁', '🤔', '🤯', '😱', '🤬', '😢', '🎉', '🤩', '🤮', '💩', '🙏', '👌',
  '🕊', '🤡', '🥱', '🥴', '😍', '🐳', '❤‍🔥', '🌚', '🌭', '💯', '🤣', '⚡', '🍌', '🏆', '💔', '🤨', '😐', '🍓', '🍾', '💋', '🖕',
  '😈', '😴', '😭', '🤓', '👻', '👨‍💻', '👀', '🎃', '🙈', '😇', '😨', '🤝', '✍', '🤗', '🫡', '🎅', '🎄', '☃', '💅', '🤪', '🗿',
  '🆒', '💘', '🙉', '🦄', '😘', '💊', '🙊', '😎', '👾', '🤷‍♂', '🤷', '🤷‍♀', '😡'];

// The ones the Mini App offers first: they suit music.
export const SUGGESTED = ['👌', '⚡', '🔥', '❤', '❤‍🔥', '👍', '🎉', '💯', '🤩', '😍', '🏆', '👏', '🆒', '😎', '🦄', '🐳',
  '🕊', '👀', '🗿', '🤝', '🍾', '🌚', '😴', '💘'];

const rowOf = (chatId, threadId) => db.select().from(chatSettings)
  .where(and(eq(chatSettings.chatId, chatId), eq(chatSettings.threadId, threadId))).get();

/** The raw settings of a chat (threadId 0) or topic: { added, queued, repost }, null = inherit. */
export async function settingsOf(chatId, threadId = 0) {
  const row = await rowOf(chatId, threadId);
  return Object.fromEntries(KINDS.map((k) => [k, row?.[COLUMN[k]] ?? null]));
}

/** The emoji to react with ('' = none): the topic's choice, else the chat's, else the default. */
export async function reactionFor(chatId, threadId, kind) {
  const topic = threadId > 0 ? (await settingsOf(chatId, threadId))[kind] : null;
  if (topic != null) return topic;
  const chat = (await settingsOf(chatId, 0))[kind];
  return chat ?? DEFAULTS[kind];
}

/** Set one kind for a chat or topic: an emoji, '' (off) or null (inherit). */
export async function setReaction(chatId, threadId, kind, emoji) {
  const set = { [COLUMN[kind]]: emoji };
  const existing = await rowOf(chatId, threadId);
  if (existing) await db.update(chatSettings).set(set).where(eq(chatSettings.id, existing.id)).run();
  else await db.insert(chatSettings).values({ chatId, threadId, ...set }).run();
}

/**
 * The reactions a chat allows: null = any, [] = none (from getChat's
 * available_reactions; custom emoji ones don't count, bots can't use them).
 */
export async function allowedReactions(chatId) {
  try {
    const chat = await api.getChat({ chat_id: chatId });
    if (!Array.isArray(chat.available_reactions)) return null;
    return chat.available_reactions.filter((r) => r.type === 'emoji').map((r) => r.emoji);
  } catch {
    return null;
  }
}

/** React to a post with this chat's (or topic's) emoji for `kind`, if any. Never throws. */
export async function react(message, threadId, kind) {
  try {
    const emoji = await reactionFor(message.chat.id, threadId, kind);
    if (!emoji) return false;
    await api.setMessageReaction({ chat_id: message.chat.id, message_id: message.message_id, reaction: [{ type: 'emoji', emoji }] });
    return true;
  } catch (e) {
    console.warn('cannot react', e.description ?? e.message);
    return false;
  }
}
