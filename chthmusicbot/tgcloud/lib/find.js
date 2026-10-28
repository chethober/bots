// 🔎 Find music, in the private chat: type a name (or send a link or an audio
// file) and get the song with buttons to add it to a synced playlist, queue it
// on your Spotify, or get the audio from @chethoberbot.

import { api, db } from 'sdk';
import { and, eq, lt } from 'sdk/db';
import { finds } from '../schema.js';
import { providerOf } from './providers/index.js';
import { getAccount } from './accounts.js';
import { searchSongs } from './itunes.js';
import { extractRefs, refOfUrl, resolveRef, describeRef } from './tracks.js';
import { linksOfOwner, getLink, addFromBot } from './sync.js';
import { getChat } from './chats.js';
import { requestAudio, relayAvailable } from './relay.js';
import { CHETHOBERBOT_USERNAME } from './config.js';
import { localeFor } from './i18n.js';
import { showScreen } from './screen.js';
import { errorText } from './errors.js';
import { t } from './strings.js';
import { esc, now, trackLabel } from './util.js';

async function saveFind(userId, f) {
  const [row] = await db.insert(finds).values({ userId, title: f.title ?? null, artist: f.artist ?? null, album: f.album ?? null, url: f.url ?? null, createdAt: now() }).returning().run();
  return row;
}

const getFind = (id) => db.select().from(finds).where(eq(finds.id, id)).get();

const anywhere = (url) => (url ? (url.includes('song.link/') ? url : `https://song.link/${url}`) : null);

async function cardView(find, locale) {
  const lines = [`🎵 <b>${esc(find.title ?? '?')}</b>${find.artist ? `\n👤 ${esc(find.artist)}` : ''}${find.album ? `\n💿 ${esc(find.album)}` : ''}`];
  const rows = [];
  const syncs = (await linksOfOwner(find.userId)).filter((l) => l.playlistId);
  if (syncs.length) rows.push([{ text: t(locale, 'find_add'), callback_data: `fd:${find.id}:add` }]);
  if (await getAccount(find.userId, 'spotify')) rows.push([{ text: t(locale, 'find_queue'), callback_data: `fd:${find.id}:q` }]);
  if (relayAvailable()) rows.push([{ text: t(locale, 'find_audio', { bot: CHETHOBERBOT_USERNAME }), callback_data: `fd:${find.id}:aud` }]);
  if (find.url) rows.push([{ text: t(locale, 'listen_anywhere'), url: anywhere(find.url) }]);
  return { text: lines.join('\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } };
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
    return showScreen(userId, await cardView(await saveFind(userId, { ...meta, url: ref.url }), locale));
  }
  const query = (message.text ?? '').trim();
  if (query.length < 2) return showScreen(userId, { text: t(locale, 'find_prompt') });
  const results = await searchSongs(query);
  if (!results.length) return showScreen(userId, { text: t(locale, 'find_none', { query: esc(query) }), parse_mode: 'HTML' });
  const rows = [];
  for (const r of results) {
    const row = await saveFind(userId, r);
    rows.push([{ text: trackLabel(r).slice(0, 60), callback_data: `fd:${row.id}` }]);
  }
  return showScreen(userId, { text: t(locale, 'find_results', { query: esc(query) }), parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
}

async function addToLink(find, link, locale) {
  const provider = providerOf(link.provider);
  const acct = await getAccount(link.ownerId, link.provider);
  if (!acct) throw new Error(t(locale, 'err_not_connected', { service: provider.name }));
  const ref = (find.url && refOfUrl(find.url)) || { query: { title: find.title, artist: find.artist } };
  let hit = await resolveRef(ref, provider, acct);
  if (!hit && find.title) hit = await provider.search(acct, { title: find.title, artist: find.artist }).catch(() => null);
  if (!hit?.id) throw new Error(t(locale, 'find_not_on', { service: provider.name }));

  const added = await addFromBot(link, { id: hit.id, title: find.title, artist: find.artist, url: provider.trackUrl(hit.id) });
  if (!added) throw new Error(t(locale, 'find_already', { playlist: link.playlistName }));
}

/** fd:<id>[:<op>[:<arg>]] buttons. */
export async function onFindCallback(q, arg) {
  const locale = await localeFor(q.from);
  const [idStr, op, extra] = arg.split(':');
  const find = await getFind(Number(idStr));
  const edit = (view) => api.editMessageText({ chat_id: q.message.chat.id, message_id: q.message.message_id, link_preview_options: { is_disabled: true }, ...view }).catch(() => {});
  const answer = (text, alert = false) => api.answerCallbackQuery({ callback_query_id: q.id, text, show_alert: alert }).catch(() => {});
  if (!find || find.userId !== q.from.id) return answer(t(locale, 'expired'), true);

  try {
    if (!op) {
      await answer();
      return edit(await cardView(find, locale));
    }
    if (op === 'add') {
      await answer();
      const syncs = (await linksOfOwner(q.from.id)).filter((l) => l.playlistId);
      const rows = [];
      for (const l of syncs) {
        const chat = await getChat(l.chatId);
        rows.push([{ text: `${providerOf(l.provider).icon} ${l.playlistName} · ${chat?.title ?? ''}`.slice(0, 60), callback_data: `fd:${find.id}:to:${l.id}` }]);
      }
      rows.push([{ text: t(locale, 'back'), callback_data: `fd:${find.id}` }]);
      return edit({ text: t(locale, 'find_pick_sync', { song: esc(trackLabel(find)) }), parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
    }
    if (op === 'to') {
      const link = await getLink(Number(extra));
      if (!link || link.ownerId !== q.from.id) return answer(t(locale, 'expired'), true);
      await addToLink(find, link, locale);
      await answer(t(locale, 'find_added', { playlist: link.playlistName }), true);
      return edit(await cardView(find, locale));
    }
    if (op === 'q') {
      const acct = await getAccount(q.from.id, 'spotify');
      const spotify = providerOf('spotify');
      const hit = await resolveRef((find.url && refOfUrl(find.url)) || { query: { title: find.title, artist: find.artist } }, spotify, acct)
        ?? await spotify.search(acct, { title: find.title, artist: find.artist });
      if (!hit?.id) return answer(t(locale, 'find_not_on', { service: 'Spotify' }), true);
      await spotify.queue(acct, hit.id);
      return answer(t(locale, 'find_queued'), true);
    }
    if (op === 'aud') {
      const ok = await requestAudio(q.from.id, [find.artist, find.title].filter(Boolean).join(' - '));
      return answer(ok ? t(locale, 'find_audio_asked', { bot: CHETHOBERBOT_USERNAME }) : t(locale, 'find_audio_failed', { bot: CHETHOBERBOT_USERNAME }), true);
    }
  } catch (e) {
    console.error(e);
    return answer(errorText(locale, e).slice(0, 190), true);
  }
  return answer();
}
