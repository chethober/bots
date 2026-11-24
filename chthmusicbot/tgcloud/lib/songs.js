// Songs the bot posts (🔄 Sync now, /random, /song, files from @chethoberbot)
// and the personal buttons under them. Whoever taps one acts on their own
// accounts, wherever the post is:
//   sg:<id>:like  ❤️ save to their liked songs on every service they connected
//   sg:<id>:add   ➕ open the song in the private chat, to add it to one of their playlists
//   sg:<id>:aud   🎵 ask @chethoberbot for the file and post it under the song
// The callbacks are handled in find.js.

import { api, db } from 'sdk';
import { and, eq } from 'sdk/db';
import { songs } from '../schema.js';
import { providerOf } from './providers/index.js';
import { listAccounts } from './accounts.js';
import { matchSong } from './tracks.js';
import { relayAnswering, requestAudio, relayAvailable } from './relay.js';
import { localeFor } from './i18n.js';
import { errorText } from './errors.js';
import { t } from './strings.js';
import { now } from './util.js';

export const getSong = (id) => db.select().from(songs).where(eq(songs.id, id)).get();

/** The song's row, reused when the same link (or title) was saved before. */
export async function saveSong({ title, artist, url }) {
  const same = url
    ? eq(songs.url, url)
    : and(eq(songs.title, title ?? ''), eq(songs.artist, artist ?? ''));
  const existing = await db.select().from(songs).where(same).get();
  if (existing) return existing;
  const [row] = await db.insert(songs).values({ title: title ?? null, artist: artist ?? null, url: url ?? null, createdAt: now() }).returning().run();
  return row;
}

/** ❤️ ➕ 🎵 under a song, then any `extra` rows. */
export function songKeyboard(locale, song, { audio = true, extra = [] } = {}) {
  const row = [{ text: t(locale, 'btn_like'), callback_data: `sg:${song.id}:like` }, { text: t(locale, 'btn_add'), callback_data: `sg:${song.id}:add` }];
  if (audio && relayAvailable()) row.push({ text: t(locale, 'btn_audio'), callback_data: `sg:${song.id}:aud` });
  return { inline_keyboard: [row, ...extra] };
}

/** Buttons for a file @chethoberbot sent for a request (relay.js). */
export async function relayMarkup(row) {
  const song = row.songId && await getSong(row.songId);
  return song ? songKeyboard(await localeFor({ id: row.userId }), song, { audio: false }) : undefined;
}

export const songQuery = (song) => [song.artist, song.title].filter(Boolean).join(' - ');

/**
 * Post a song in a chat as its audio file: @chethoberbot is asked for it, and
 * the file it sends is copied into the chat with `caption` (HTML) and the
 * ❤️ ➕ buttons (relay.js). When the file can't be had (no @chethoberbot,
 * "not found", no answer in time, or `audio` off) the song is posted as
 * `text` (HTML) with ❤️ ➕ 🎵 instead. `extra`: more button rows. `linkId` and
 * `trackId`: the link_tracks row that gets the post's message id. While
 * @chethoberbot isn't answering, the text post goes out right away and the
 * file is still asked for, as a reply to it.
 * Returns the sent text message, or null when the file is on its way.
 */
export async function postSong(song, userId, { chatId, threadId = 0, locale, text, caption = '', extra = [], preview, audio = true, linkId = null, trackId = null }) {
  const fallback = {
    chat_id: chatId,
    message_thread_id: threadId || undefined,
    text,
    parse_mode: 'HTML',
    link_preview_options: preview ?? { is_disabled: true },
    reply_markup: songKeyboard(locale, song, { extra }),
  };
  const wantAudio = audio && relayAvailable();
  if (wantAudio && await relayAnswering()) {
    const post = { caption, reply_markup: songKeyboard(locale, song, { audio: false, extra }), fallback, linkId, trackId };
    if (await requestAudio(userId ?? 0, songQuery(song), { chatId, threadId, songId: song.id, post })) return null;
  }
  const sent = await api.sendMessage(fallback);
  if (wantAudio) await requestAudio(userId ?? 0, songQuery(song), { chatId, threadId, songId: song.id, replyTo: sent.message_id });
  return sent;
}

/** Ask @chethoberbot for the song's file; `to` as in requestAudio. */
export function askSongAudio(song, userId, to = {}) {
  return requestAudio(userId, songQuery(song), { ...to, songId: song.id });
}

/**
 * ❤️ on each of the user's services that has likes. Returns the services
 * that worked, and the errors of those that didn't.
 */
export async function likeSong(userId, song, locale) {
  const accts = (await listAccounts(userId)).filter((a) => providerOf(a.provider)?.like);
  const liked = [];
  const failed = [];
  const memo = new Map();
  for (const acct of accts) {
    const provider = providerOf(acct.provider);
    try {
      const hit = await matchSong(song, provider, acct, memo);
      if (!hit?.id) {
        failed.push(t(locale, 'find_not_on', { service: provider.name }));
        continue;
      }
      await provider.like(acct, hit.id);
      liked.push(provider.name);
    } catch (e) {
      failed.push(`${provider.name}: ${errorText(locale, e)}`);
    }
  }
  return { connected: accts.length, liked, failed };
}

/** The alert after ❤️. */
export function likedText(locale, { liked, failed }) {
  return [liked.length ? t(locale, 'liked', { services: liked.join(', ') }) : '', ...failed].filter(Boolean).join('\n').slice(0, 195);
}
