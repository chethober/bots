// A chat's shared queue (the Mini App's 🎶 Queue tab). Members add songs from
// search, the chat's playlists or ✨ picks; whoever controls the chat (its
// admins and the group player's host) reorders it and plays it:
//   ▶️ Play next  with a group player: the song goes to the host's Spotify queue;
//                 without one: it's posted in the chat with ❤️ ➕ 🎵 and its audio
//                 file from @chethoberbot follows, so Telegram's player plays it.
//   ⏩ All to Spotify  (group player only) the whole queue at once, up to MAX_SEND.

import { db } from 'sdk';
import { and, asc, eq, inArray } from 'sdk/db';
import { queueItems } from '../schema.js';
import { providerOf } from './providers/index.js';
import { getAccount } from './accounts.js';
import { getPlayer, refreshCard } from './player.js';
import { matchSong } from './tracks.js';
import { postSong, saveSong } from './songs.js';
import { localeFor } from './i18n.js';
import { t } from './strings.js';
import { esc, now } from './util.js';

export const MAX_QUEUE = 100;
export const PER_USER = 15;
export const MAX_SEND = 20;

const spotify = providerOf('spotify');

const inChat = (chatId, threadId) => and(eq(queueItems.chatId, chatId), eq(queueItems.threadId, threadId));

/** The queued songs, in play order. */
export const queueOf = (chatId, threadId) => db.select().from(queueItems)
  .where(and(inChat(chatId, threadId), eq(queueItems.status, 'queued'))).orderBy(asc(queueItems.position)).all();

/** Songs the chat queued lately (played ones too), newest last: ✨ picks start from them. */
export async function queueHistory(chatId, threadId, n = 50) {
  const rows = await db.select().from(queueItems)
    .where(and(inChat(chatId, threadId), inArray(queueItems.status, ['queued', 'played']))).orderBy(asc(queueItems.id)).all();
  return rows.slice(-n);
}

export const getItem = (id) => db.select().from(queueItems).where(eq(queueItems.id, id)).get();

const sameSong = (a, b) => (a.url && b.url ? a.url === b.url
  : (a.title ?? '').toLowerCase() === (b.title ?? '').toLowerCase() && (a.artist ?? '').toLowerCase() === (b.artist ?? '').toLowerCase());

/**
 * Add a song at the end. Returns the row, or { refused: 'QUEUE_FULL' |
 * 'USER_LIMIT' | 'DUPLICATE' }.
 */
export async function addToQueue(chatId, threadId, song, user) {
  const queued = await queueOf(chatId, threadId);
  if (queued.length >= MAX_QUEUE) return { refused: 'QUEUE_FULL' };
  if (queued.filter((q) => q.addedBy === user.id).length >= PER_USER) return { refused: 'USER_LIMIT' };
  if (queued.some((q) => sameSong(q, song))) return { refused: 'DUPLICATE' };
  const position = (queued.at(-1)?.position ?? 0) + 1;
  const [row] = await db.insert(queueItems).values({
    chatId, threadId, title: song.title, artist: song.artist ?? null, url: song.url ?? null,
    artwork: song.artwork ?? null, preview: song.preview ?? null,
    addedBy: user.id, addedByName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || null,
    position, createdAt: now(),
  }).returning().run();
  return row;
}

export const setStatus = (id, status) => db.update(queueItems).set({ status, playedAt: status === 'played' ? now() : null }).where(eq(queueItems.id, id)).run();

/** Swap a song with its neighbour (dir -1 = earlier, 1 = later); `top` moves it first. */
export async function moveInQueue(chatId, threadId, id, dir) {
  const queued = await queueOf(chatId, threadId);
  const i = queued.findIndex((q) => q.id === id);
  if (i < 0) return false;
  if (dir === 'top') {
    if (i === 0) return true;
    await db.update(queueItems).set({ position: queued[0].position - 1 }).where(eq(queueItems.id, id)).run();
    return true;
  }
  const j = i + (dir < 0 ? -1 : 1);
  if (j < 0 || j >= queued.length) return true;
  await db.update(queueItems).set({ position: queued[j].position }).where(eq(queueItems.id, queued[i].id)).run();
  await db.update(queueItems).set({ position: queued[i].position }).where(eq(queueItems.id, queued[j].id)).run();
  return true;
}

export async function clearQueue(chatId, threadId) {
  await db.update(queueItems).set({ status: 'removed' })
    .where(and(inChat(chatId, threadId), eq(queueItems.status, 'queued'))).run();
}

const linkLabel = (locale, url) => (/song\.link\//.test(url ?? '') ? t(locale, 'listen_anywhere') : /deezer\.com/.test(url ?? '') ? 'Deezer' : '🔗');

/** Post a queued song in the chat as its audio file (text when there's none). */
async function postItem(item, by, locale) {
  const song = await saveSong(item);
  const caption = [item.url ? `<a href="${esc(item.url)}">${linkLabel(locale, item.url)}</a>` : '', t(locale, 'queue_post', { name: esc(item.addedByName ?? '—') })].filter(Boolean).join(' · ');
  await postSong(song, by.id, {
    chatId: item.chatId, threadId: item.threadId, locale, caption,
    text: `🎵 <b>${esc(item.title)}</b>${item.artist ? ` — ${esc(item.artist)}` : ''}\n${caption}`,
  });
}

/**
 * ▶️ Play the first song (or, with `all` and a group player, up to MAX_SEND).
 * Returns { played, missed, to: 'spotify' | 'chat' }. Provider errors are thrown.
 */
export async function playNext(chatId, threadId, by, { all = false } = {}) {
  const queued = await queueOf(chatId, threadId);
  if (!queued.length) return { played: 0, missed: 0, to: null };
  const player = await getPlayer(chatId);
  const host = player && await getAccount(player.hostId, 'spotify');
  const locale = await localeFor(by);
  if (!host) {
    const [item] = queued;
    await postItem(item, by, locale);
    await setStatus(item.id, 'played');
    return { played: 1, missed: 0, to: 'chat' };
  }
  let played = 0;
  let missed = 0;
  const memo = new Map();
  for (const item of queued.slice(0, all ? MAX_SEND : 1)) {
    const hit = await matchSong(item, spotify, host, memo);
    if (!hit?.id) {
      missed++;
      await setStatus(item.id, 'missed');
      continue;
    }
    await spotify.queue(host, hit.id);
    await setStatus(item.id, 'played');
    played++;
  }
  await refreshCard(player);
  return { played, missed, to: 'spotify' };
}
