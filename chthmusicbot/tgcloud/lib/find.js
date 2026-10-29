// 🔎 Find music, in the private chat: type a name (or send a link or an audio
// file) and get the song, with its audio from @chethoberbot and buttons to like
// it, add it to any of your playlists or queue it on your Spotify. Also the
// personal ❤️ ➕ 🎵 buttons under the songs the bot posts (songs.js).
//
//   fd:<id>[:<op>[:<arg>…]]  a find card    sg:<id>:<op>  a posted song

import { api, db } from 'sdk';
import { and, eq, lt } from 'sdk/db';
import { finds } from '../schema.js';
import { providerOf } from './providers/index.js';
import { getAccount, listAccounts } from './accounts.js';
import { searchSongs } from './itunes.js';
import { extractRefs, describeRef, matchSong } from './tracks.js';
import { linksOfOwner, getLink, addFromBot } from './sync.js';
import { audioPending, relayAvailable } from './relay.js';
import { askSongAudio, getSong, likeSong, likedText, saveSong } from './songs.js';
import { BOT_USERNAME, CHETHOBERBOT_USERNAME } from './config.js';
import { localeFor } from './i18n.js';
import { showScreen } from './screen.js';
import { errorText } from './errors.js';
import { t } from './strings.js';
import { esc, now, trackLabel } from './util.js';

const MAX_PICK = 40; // playlists listed by ➕ Add to playlist

async function saveFind(userId, f) {
  const [row] = await db.insert(finds).values({ userId, title: f.title ?? null, artist: f.artist ?? null, album: f.album ?? null, url: f.url ?? null, createdAt: now() }).returning().run();
  return row;
}

const getFind = (id) => db.select().from(finds).where(eq(finds.id, id)).get();

const anywhere = (url) => (url ? (url.includes('song.link/') ? url : `https://song.link/${url}`) : null);

async function cardView(find, locale, note = '') {
  const lines = [`🎵 <b>${esc(find.title ?? '?')}</b>${find.artist ? `\n👤 ${esc(find.artist)}` : ''}${find.album ? `\n💿 ${esc(find.album)}` : ''}`];
  if (note) lines.push('', note);
  const rows = [];
  if ((await listAccounts(find.userId)).length) {
    rows.push([{ text: t(locale, 'btn_like'), callback_data: `fd:${find.id}:like` }, { text: t(locale, 'find_add'), callback_data: `fd:${find.id}:add` }]);
  }
  if (await getAccount(find.userId, 'spotify')) rows.push([{ text: t(locale, 'find_queue'), callback_data: `fd:${find.id}:q` }]);
  if (relayAvailable()) rows.push([{ text: t(locale, 'find_audio', { bot: CHETHOBERBOT_USERNAME }), callback_data: `fd:${find.id}:aud` }]);
  if (find.url) rows.push([{ text: t(locale, 'listen_anywhere'), url: anywhere(find.url) }]);
  return { text: lines.join('\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } };
}

/** Ask @chethoberbot for the find's file, for the user's private chat. The card's note says how it went. */
async function audioNote(find, locale) {
  if (!relayAvailable()) return '';
  const ok = await askSongAudio(await saveSong(find), find.userId);
  return t(locale, ok ? 'find_audio_asked' : 'find_audio_failed', { bot: CHETHOBERBOT_USERNAME });
}

/** A song opened in the private chat (➕ under a posted song, /start sg<id>). */
export async function showSongCard(from, song) {
  const locale = await localeFor(from);
  return showScreen(from.id, await cardView(await saveFind(from.id, song), locale));
}

/** A name, a link or an audio file sent in the private chat. */
export async function findFromMessage(message) {
  const userId = message.from.id;
  const locale = await localeFor(message.from);
  await db.delete(finds).where(and(eq(finds.userId, userId), lt(finds.createdAt, now() - 86400))).run();

  const refs = extractRefs(message);
  if (refs.length) {
    const ref = refs[0];
    const meta = await describeRef(ref).catch(() => null);
    if (!meta?.title) return showScreen(userId, { text: t(locale, 'find_unknown') });
    const find = await saveFind(userId, { ...meta, url: ref.url });
    // An audio file is already the audio; a link gets it from @chethoberbot.
    return showScreen(userId, await cardView(find, locale, ref.query ? '' : await audioNote(find, locale)));
  }
  const query = (message.text ?? '').trim();
  if (query.length < 2) return showScreen(userId, { text: t(locale, 'find_prompt') });
  const results = await searchSongs(query);
  if (!results.length) return showScreen(userId, { text: t(locale, 'find_none', { query: esc(query) }), parse_mode: 'HTML' });
  const rows = [];
  for (const r of results) {
    const row = await saveFind(userId, r);
    rows.push([{ text: trackLabel(r).slice(0, 60), callback_data: `fd:${row.id}:open` }]);
  }
  return showScreen(userId, { text: t(locale, 'find_results', { query: esc(query) }), parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
}

/** The song's id on `provider`, or an error saying it isn't there. */
async function trackOn(find, provider, acct, locale) {
  if (!acct) throw new Error(t(locale, 'err_not_connected', { service: provider.name }));
  const hit = await matchSong(find, provider, acct);
  if (!hit?.id) throw new Error(t(locale, 'find_not_on', { service: provider.name }));
  return hit.id;
}

async function addToLink(find, link, locale) {
  const provider = providerOf(link.provider);
  const id = await trackOn(find, provider, await getAccount(link.ownerId, link.provider), locale);
  const added = await addFromBot(link, { id, title: find.title, artist: find.artist, url: provider.trackUrl(id) });
  if (!added) throw new Error(t(locale, 'find_already', { playlist: link.playlistName }));
}

/** ➕ to one of the user's playlists: through its sync when it has one (so the chat gets it too). */
async function addToPlaylist(find, providerId, playlistId, locale) {
  const synced = (await linksOfOwner(find.userId)).find((l) => l.provider === providerId && l.playlistId === playlistId);
  if (synced) {
    await addToLink(find, synced, locale);
    return synced.playlistName;
  }
  const provider = providerOf(providerId);
  const acct = await getAccount(find.userId, providerId);
  const id = await trackOn(find, provider, acct, locale);
  const playlist = await provider.getPlaylist(acct, playlistId).catch(() => ({ name: '—' }));
  if ((await provider.playlistTracks(acct, playlistId)).some((x) => x.id === id)) {
    throw new Error(t(locale, 'find_already', { playlist: playlist.name }));
  }
  await provider.addTracks(acct, playlistId, [id]);
  return playlist.name;
}

/** The user's playlists they can add to, synced ones first. */
async function pickView(find, locale) {
  const synced = (await linksOfOwner(find.userId)).filter((l) => l.playlistId);
  const rows = [];
  const seen = new Set();
  for (const l of synced) {
    seen.add(`${l.provider}:${l.playlistId}`);
    rows.push([{ text: `${providerOf(l.provider).icon} ${l.playlistName ?? '—'} 🔗`.slice(0, 60), callback_data: `fd:${find.id}:pl:${l.provider}:${l.playlistId}` }]);
  }
  for (const acct of await listAccounts(find.userId)) {
    const provider = providerOf(acct.provider);
    const lists = await provider.listPlaylists(acct).catch((e) => { console.warn('playlists failed', e.message); return []; });
    for (const p of lists) {
      const key = `${provider.id}:${p.id}`;
      if (!p.editable || seen.has(key) || rows.length >= MAX_PICK) continue;
      seen.add(key);
      rows.push([{ text: `${provider.icon} ${p.name ?? '—'}`.slice(0, 60), callback_data: `fd:${find.id}:pl:${key}` }]);
    }
  }
  if (!rows.length) return null;
  rows.push([{ text: t(locale, 'back'), callback_data: `fd:${find.id}` }]);
  return { text: t(locale, 'find_pick_sync', { song: esc(trackLabel(find)) }), parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } };
}

/** fd:<id>[:<op>[:<arg>…]] buttons. */
export async function onFindCallback(q, arg) {
  const locale = await localeFor(q.from);
  const [idStr, op, ...extra] = arg.split(':');
  const find = await getFind(Number(idStr));
  const edit = (view) => api.editMessageText({ chat_id: q.message.chat.id, message_id: q.message.message_id, link_preview_options: { is_disabled: true }, ...view }).catch(() => {});
  const answer = (text, alert = false) => api.answerCallbackQuery({ callback_query_id: q.id, text, show_alert: alert }).catch(() => {});
  if (!find || find.userId !== q.from.id) return answer(t(locale, 'expired'), true);

  try {
    if (!op || op === 'open') {
      await answer();
      return edit(await cardView(find, locale, op === 'open' ? await audioNote(find, locale) : ''));
    }
    if (op === 'like') {
      const r = await likeSong(q.from.id, find, locale);
      return answer(likedText(locale, r), true);
    }
    if (op === 'add') {
      const view = await pickView(find, locale);
      if (!view) return answer(t(locale, 'find_no_playlists'), true);
      await answer();
      return edit(view);
    }
    if (op === 'pl') {
      const [providerId, playlistId] = extra;
      const name = await addToPlaylist(find, providerId, playlistId, locale);
      await answer(t(locale, 'find_added', { playlist: name ?? '—' }), true);
      return edit(await cardView(find, locale));
    }
    if (op === 'to') { // cards from before ➕ listed every playlist
      const link = await getLink(Number(extra[0]));
      if (!link || link.ownerId !== q.from.id) return answer(t(locale, 'expired'), true);
      await addToLink(find, link, locale);
      await answer(t(locale, 'find_added', { playlist: link.playlistName }), true);
      return edit(await cardView(find, locale));
    }
    if (op === 'q') {
      const spotify = providerOf('spotify');
      const acct = await getAccount(q.from.id, 'spotify');
      await spotify.queue(acct, await trackOn(find, spotify, acct, locale));
      return answer(t(locale, 'find_queued'), true);
    }
    if (op === 'aud') {
      const ok = await askSongAudio(await saveSong(find), q.from.id);
      return answer(t(locale, ok ? 'find_audio_asked' : 'find_audio_failed', { bot: CHETHOBERBOT_USERNAME }), true);
    }
  } catch (e) {
    console.error(e);
    return answer(errorText(locale, e).slice(0, 190), true);
  }
  return answer();
}

/** sg:<id>:<op>: the personal buttons under a song the bot posted. */
export async function onSongCallback(q, arg) {
  const locale = await localeFor(q.from);
  const answer = (params) => api.answerCallbackQuery({ callback_query_id: q.id, ...params }).catch(() => {});
  const [idStr, op] = arg.split(':');
  const song = await getSong(Number(idStr));
  if (!song) return answer({ text: t(locale, 'expired'), show_alert: true });
  const chat = q.message?.chat;
  const inPrivate = chat?.type === 'private';
  // Someone without the bot open in private, or without accounts, is sent there.
  const openBot = (start) => answer({ url: `https://t.me/${BOT_USERNAME}?start=${start}` });

  if (op === 'like') {
    const r = await likeSong(q.from.id, song, locale);
    if (!r.connected) return openBot('accounts');
    return answer({ text: likedText(locale, r), show_alert: true });
  }
  if (op === 'add') {
    if (!inPrivate) return openBot(`sg${song.id}`);
    await answer({});
    return showSongCard(q.from, song);
  }
  if (op === 'aud' && chat) {
    if (!inPrivate && await audioPending(chat.id, song.id)) return answer({ text: t(locale, 'audio_coming') });
    const to = inPrivate ? {} : {
      chatId: chat.id,
      threadId: q.message.is_topic_message ? q.message.message_thread_id : 0,
      replyTo: q.message.message_id,
    };
    const ok = await askSongAudio(song, q.from.id, to);
    return answer({ text: t(locale, ok ? 'audio_asked' : 'find_audio_failed', { bot: CHETHOBERBOT_USERNAME }), show_alert: !ok });
  }
  return answer({});
}
