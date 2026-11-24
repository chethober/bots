// Getting a song's audio from @chethoberbot over bot-to-bot messages: the bot
// sends it "Artist - Title", and its reply is copied to whoever asked — the user
// in the private chat (every reply, so its "not found" too), or a group or
// channel (only the file: as the song's post itself, with its caption and
// ❤️ ➕, or as a reply to a post). A song post whose file doesn't come
// ("not found", or no answer in WAIT) is sent as text instead (flushRelays).
// Replies are matched by reply_to_message, else by the file's title, else to
// the oldest open request. Bot-to-bot communication must be turned on for
// both bots in @BotFather (otherwise Telegram answers USER_BOT_TO_BOT_DISABLED).

import { api, db } from 'sdk';
import { and, asc, eq, gt, lt } from 'sdk/db';
import { linkTracks, relays } from '../schema.js';
import { CHETHOBERBOT_ID, CHETHOBERBOT_USERNAME } from './config.js';
import { getSetting, saveSetting } from './settings.js';
import { now } from './util.js';

const WAIT = 3 * 60; // a request older than this is given up on

export const relayAvailable = () => Boolean(CHETHOBERBOT_USERNAME);

export const isRelayBot = (user) => Boolean(user?.is_bot && CHETHOBERBOT_USERNAME
  && user.username?.toLowerCase() === CHETHOBERBOT_USERNAME.toLowerCase());

async function relayBotId() {
  if (CHETHOBERBOT_ID) return CHETHOBERBOT_ID;
  const saved = Number(await getSetting('relay_bot_id'));
  if (saved) return saved;
  const chat = await api.getChat({ chat_id: `@${CHETHOBERBOT_USERNAME}` }).catch(() => null);
  if (chat?.id) await saveSetting('relay_bot_id', String(chat.id));
  return chat?.id ?? null;
}

const openRelays = (where) => db.select().from(relays)
  .where(and(eq(relays.done, 0), gt(relays.createdAt, now() - WAIT), where)).orderBy(asc(relays.id)).all();

/** True while a chat already waits for this song's audio. */
export async function audioPending(chatId, songId) {
  return (await openRelays(and(eq(relays.chatId, chatId), eq(relays.songId, songId)))).length > 0;
}

/**
 * Ask for a song: to = { chatId, threadId, replyTo, songId } for a group or
 * channel, empty for the user's private chat. False if the other bot can't be reached.
 */
export async function requestAudio(userId, query, to = {}) {
  const botId = await relayBotId();
  if (!botId || !query) return false;
  try {
    const sent = await api.sendMessage({ chat_id: botId, text: query });
    await db.insert(relays).values({
      userId, query, sentMessageId: sent.message_id, createdAt: now(),
      chatId: to.chatId ?? null, threadId: to.threadId || null, replyTo: to.replyTo ?? null, songId: to.songId ?? null,
      post: to.post ?? null,
    }).run();
    return true;
  } catch (e) {
    console.warn('relay failed', e.description ?? e.message);
    return false;
  }
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The open request whose song the file is, by its title. */
function byTitle(rows, message) {
  const file = norm(message.audio?.title ?? message.audio?.file_name ?? message.document?.file_name ?? message.caption);
  if (!file) return null;
  return rows.find((r) => {
    const title = norm(String(r.query).split(' - ').at(-1));
    return title && (file.includes(title) || title.includes(file));
  }) ?? null;
}

// @chethoberbot's answer when it has no file.
const NOT_FOUND = /not found|no results?|nothing found|couldn['’]?t find|can['’]?t find|unable to find|پیدا نشد|یافت نشد|نتیجه‌ای|لم يتم العثور|не найден|ничего не найдено|no se encontr/i;

/** The post's message id goes on its link_tracks row, for replies to the original. */
async function notePosted(post, messageId) {
  if (!post?.linkId || !post.trackId || !messageId) return;
  await db.update(linkTracks).set({ messageId })
    .where(and(eq(linkTracks.linkId, post.linkId), eq(linkTracks.trackId, post.trackId))).run();
}

/** No file for a song post: send its text version instead (once). */
async function postFallback(row) {
  const res = await db.update(relays).set({ done: 1 }).where(and(eq(relays.id, row.id), eq(relays.done, 0))).run();
  if (res && res.rowsAffected === 0) return;
  const sent = await api.sendMessage(row.post.fallback)
    .catch((e) => console.warn('fallback post failed', row.chatId, e.description ?? e.message));
  await notePosted(row.post, sent?.message_id);
}

/** Song posts whose file didn't come in time are sent as text. Never throws. */
export async function flushRelays() {
  try {
    const stale = await db.select().from(relays)
      .where(and(eq(relays.done, 0), lt(relays.createdAt, now() - WAIT))).orderBy(asc(relays.id)).limit(10).all();
    for (const row of stale) {
      if (row.post) await postFallback(row);
      else await db.update(relays).set({ done: 1 }).where(eq(relays.id, row.id)).run();
    }
  } catch (e) {
    console.warn('relay flush failed', e.message);
  }
}

/** A message from @chethoberbot: pass it to whoever is waiting. `markup(request)` gives the file's buttons. */
export async function onRelayMessage(message, markup = async () => undefined) {
  await saveSetting('relay_bot_id', String(message.from.id));
  const media = Boolean(message.audio || message.voice || message.document || message.video);
  const replyTo = message.reply_to_message?.message_id;
  let row = replyTo ? await db.select().from(relays).where(eq(relays.sentMessageId, replyTo)).get() : null;
  if (!row) {
    const open = await openRelays();
    row = (media && byTitle(open, message)) || open.find((r) => media || !r.chatId) || null;
  }
  if (!row) return;
  if (row.post) {
    if (row.done) return; // already posted, or given up on
    // The file is the song's post; "not found" gets the text post instead.
    if (!media) return NOT_FOUND.test(message.text ?? message.caption ?? '') ? postFallback(row) : undefined;
    await db.update(relays).set({ done: 1 }).where(eq(relays.id, row.id)).run();
    const sent = await api.copyMessage({
      chat_id: row.chatId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
      message_thread_id: row.threadId || undefined,
      caption: row.post.caption || undefined,
      parse_mode: row.post.caption ? 'HTML' : undefined,
      reply_markup: row.post.reply_markup,
    }).catch((e) => console.warn('relay copy failed', e.description));
    return notePosted(row.post, sent?.message_id);
  }
  if (row.chatId && !media) return; // groups only get the file
  await api.copyMessage({
    chat_id: row.chatId ?? row.userId,
    from_chat_id: message.chat.id,
    message_id: message.message_id,
    message_thread_id: row.threadId || undefined,
    reply_parameters: row.replyTo ? { message_id: row.replyTo, allow_sending_without_reply: true } : undefined,
    reply_markup: media && row.songId ? await markup(row) : undefined,
  }).catch((e) => console.warn('relay copy failed', e.description));
  if (media) await db.update(relays).set({ done: 1 }).where(eq(relays.id, row.id)).run();
}
