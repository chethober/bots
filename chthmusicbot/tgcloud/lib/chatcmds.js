// Commands anyone can use in a group, forum topic or channel the bot is in:
//
//   /playlist  the playlists synced with this chat (or topic), with open buttons
//   /top       who posted the most tracks that made it into those playlists
//   /random    a random track from one of those playlists
//   /song <name>  finds a song and posts it
//
// The command post is deleted (when the bot may) and the answer is posted in
// the same topic. Songs come with ❤️ ➕ 🎵 and their audio from @chethoberbot
// as a reply. /random and /song are throttled per chat.

import { api, db } from 'sdk';
import { and, eq, inArray } from 'sdk/db';
import { links, linkTracks } from '../schema.js';
import { BOT_USERNAME } from './config.js';
import { providerOf } from './providers/index.js';
import { getAccount } from './accounts.js';
import { pageUrl } from './songlink.js';
import { searchSongs } from './itunes.js';
import { askSongAudio, saveSong, songKeyboard } from './songs.js';
import { getSetting, saveSetting } from './settings.js';
import { localeFor } from './i18n.js';
import { errorText } from './errors.js';
import { t } from './strings.js';
import { esc, now } from './util.js';

export const CHAT_COMMANDS = ['playlist', 'top', 'random', 'song'];

const EVERY = { random: 30, song: 10 }; // seconds between two of them in one chat
const TOP_SIZE = 10;
const MEDALS = ['🥇', '🥈', '🥉'];

export function parseCommand(text) {
  const m = /^\/([a-z_]+)(?:@(\w+))?(?:\s+([\s\S]*))?$/i.exec(text ?? '');
  if (!m || (m[2] && m[2].toLowerCase() !== BOT_USERNAME.toLowerCase())) return null;
  return { cmd: m[1].toLowerCase(), args: (m[3] ?? '').trim() };
}

/** A playlist's address others can open (Apple Music library playlists are private). */
export function publicPlaylistUrl(link) {
  const url = providerOf(link.provider)?.playlistUrl(link.playlistId);
  return url && !url.endsWith('/library/playlists') ? url : null;
}

/**
 * The syncs a topic shows: whole-chat ones and its own. In a chat without
 * topics, or a forum's General topic, every sync of the chat (each per-topic
 * playlist included).
 */
export async function linksOfChat(chatId, threadId) {
  const rows = await db.select().from(links).where(eq(links.chatId, chatId)).all();
  return rows.filter((l) => l.playlistId && l.threadId !== -1
    && (threadId === 0 || l.threadId === 0 || l.threadId === threadId));
}

async function playlistView(rows, locale) {
  if (!rows.length) return { text: t(locale, 'chat_no_playlists') };
  const lines = [t(locale, 'chat_playlists'), ''];
  for (const l of rows.slice(0, 20)) {
    const n = await db.$count(linkTracks, eq(linkTracks.linkId, l.id));
    lines.push(`${providerOf(l.provider).icon} <b>${esc(l.playlistName ?? '—')}</b> · 🎵 ${n}`);
  }
  const buttons = rows.slice(0, 20).map((l) => ({ link: l, url: publicPlaylistUrl(l) })).filter((b) => b.url)
    .map(({ link, url }) => [{ text: `🎧 ${link.playlistName ?? providerOf(link.provider).name}`.slice(0, 60), url }]);
  return { text: lines.join('\n'), parse_mode: 'HTML', reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined };
}

/** Posters ranked by the distinct tracks they got into the chat's playlists. */
export async function topPosters(rows) {
  if (!rows.length) return [];
  const tracks = await db.select().from(linkTracks)
    .where(and(inArray(linkTracks.linkId, rows.map((l) => l.id)), eq(linkTracks.source, 'chat'))).all();
  const byPoster = new Map();
  for (const r of tracks) {
    const key = r.posterId ?? r.posterName;
    if (key == null) continue;
    const p = byPoster.get(key) ?? { name: r.posterName ?? String(r.posterId), tracks: new Set() };
    if (r.posterName) p.name = r.posterName;
    p.tracks.add(r.trackId);
    byPoster.set(key, p);
  }
  return [...byPoster.values()].map((p) => ({ name: p.name, count: p.tracks.size }))
    .sort((a, b) => b.count - a.count).slice(0, TOP_SIZE);
}

async function topView(rows, locale) {
  const top = await topPosters(rows);
  if (!top.length) return { text: t(locale, rows.length ? 'chat_top_empty' : 'chat_no_playlists') };
  const lines = [t(locale, 'chat_top'), '', ...top.map((p, i) => `${MEDALS[i] ?? `${i + 1}.`} ${esc(p.name)} · 🎵 ${p.count}`)];
  return { text: lines.join('\n'), parse_mode: 'HTML' };
}

/** False when the chat used `cmd` too recently. */
async function allowed(cmd, chatId) {
  const key = `${cmd}:${chatId}`;
  if (now() - (Number(await getSetting(key)) || 0) < EVERY[cmd]) return false;
  await saveSetting(key, String(now()));
  return true;
}

async function randomView(rows, locale, chatId) {
  if (!rows.length) return { text: t(locale, 'chat_no_playlists') };
  if (!(await allowed('random', chatId))) return null;
  const link = rows[Math.floor(Math.random() * rows.length)];
  const provider = providerOf(link.provider);
  try {
    const acct = await getAccount(link.ownerId, link.provider);
    if (!acct) throw new Error(t(locale, 'err_not_connected', { service: provider.name }));
    const tracks = await provider.playlistTracks(acct, link.playlistId);
    if (!tracks.length) return { text: t(locale, 'chat_random_empty', { playlist: esc(link.playlistName ?? '—') }), parse_mode: 'HTML' };
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    const song = await saveSong(track);
    const url = publicPlaylistUrl(link);
    return {
      text: [
        t(locale, 'chat_random', { playlist: esc(link.playlistName ?? '—') }),
        `🎵 <b>${esc(track.title)}</b>${track.artist ? ` — ${esc(track.artist)}` : ''}`,
        `<a href="${esc(track.url)}">${provider.name}</a> · <a href="${pageUrl(provider.id, track.id)}">${t(locale, 'listen_anywhere')}</a>`,
      ].join('\n'),
      parse_mode: 'HTML',
      link_preview_options: { url: track.url, prefer_small_media: true },
      reply_markup: songKeyboard(locale, song, { extra: url ? [[{ text: t(locale, 'open_playlist'), url }]] : [] }),
      song,
    };
  } catch (e) {
    return { text: `⚠️ ${errorText(locale, e)}` };
  }
}

async function songView(query, locale, chatId) {
  if (!query) return { text: t(locale, 'chat_song_usage') };
  if (!(await allowed('song', chatId))) return null;
  const [hit] = await searchSongs(query, 1);
  if (!hit) return { text: t(locale, 'find_none', { query: esc(query) }), parse_mode: 'HTML' };
  const song = await saveSong(hit);
  return {
    text: `🎵 <b>${esc(hit.title)}</b>${hit.artist ? ` — ${esc(hit.artist)}` : ''}\n<a href="${esc(hit.url)}">${t(locale, 'listen_anywhere')}</a>`,
    parse_mode: 'HTML',
    reply_markup: songKeyboard(locale, song),
    song,
  };
}

/**
 * /playlist, /top, /random or /song in a group, topic or channel. False if
 * the command isn't one of them.
 */
export async function onChatCommand(message, { cmd, args }, threadId) {
  if (!CHAT_COMMANDS.includes(cmd)) return false;
  const chatId = message.chat.id;
  await api.deleteMessage({ chat_id: chatId, message_id: message.message_id }).catch(() => {});
  const rows = await linksOfChat(chatId, threadId);
  // Channel posts have no sender: answer in the language of the chat's sync owner.
  const locale = await localeFor(message.from ?? (rows[0] ? { id: rows[0].ownerId } : null));
  const view = cmd === 'playlist' ? await playlistView(rows, locale)
    : cmd === 'top' ? await topView(rows, locale)
      : cmd === 'random' ? await randomView(rows, locale, chatId)
        : await songView(args, locale, chatId);
  if (!view) return true;
  const { song, ...params } = view;
  const sent = await api.sendMessage({ chat_id: chatId, message_thread_id: threadId || undefined, link_preview_options: { is_disabled: true }, ...params })
    .catch((e) => console.warn('cannot answer', cmd, chatId, e.description ?? e.message));
  // The song's file follows as a reply, asked for whoever sent the command (or the sync's owner).
  const asker = message.from?.id ?? rows[0]?.ownerId;
  if (sent && song && asker) await askSongAudio(song, asker, { chatId, threadId, replyTo: sent.message_id });
  return true;
}
