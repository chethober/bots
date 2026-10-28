// handlers/message.js — watches the forum's topics for music and keeps each
// topic's Spotify playlist in sync. Admin commands live in the private chat
// with the bot; commands posted in the forum are ignored.

import { api, db, BotApiError } from 'sdk';
import { and, eq, inArray } from 'sdk/db';
import { topics, tracks } from '../schema.js';
import { ADMIN_IDS, FORUM_ID, PUBLIC_PLAYLISTS, playlistDescription, SOURCE_URL } from '../lib/config.js';
import { aboutKeyboard, thankTip } from '../lib/tips.js';
import { saveSetting } from '../lib/settings.js';
import { getReaction, getDeleteDuplicates, isAdminId, sendHome, settingsView } from '../lib/panel.js';
import { localeFor, languageKeyboard, matchButton } from '../lib/i18n.js';
import { drop, showScreen } from '../lib/screen.js';
import { t } from '../lib/strings.js';

// /settings (forum admins only): reaction, repost deletion, Spotify status.
async function settingsScreen(message) {
  const locale = await localeFor(message.from);
  if (!(await isForumAdmin(message))) return reply(message, t(locale, 'admins_only'));
  const { text, reply_markup } = await settingsView(locale);
  return reply(message, text, { reply_markup });
}

import { extractTrackIds } from '../lib/music.js';
import {
  SpotifyNotConfigured, saveCredentials, trackUri, addTracks,
  me, getPlaylist, findPlaylistByName, createPlaylist, setPlaylistDescription, playlistTrackUris, dedupePlaylist,
} from '../lib/spotify.js';

function parseCommand(text) {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text ?? '');
  return m ? { cmd: m[1].toLowerCase(), args: (m[2] ?? '').trim() } : null;
}

async function isForumAdmin(message) {
  if (message.sender_chat?.id === FORUM_ID) return true; // anonymous admin
  return message.from ? isAdminId(message.from.id) : false;
}

function reply(message, text, extra = {}) {
  return api.sendMessage({
    chat_id: message.chat.id,
    message_thread_id: message.is_topic_message ? message.message_thread_id : undefined,
    text,
    reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true },
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

async function handleReactionCommand(message, args) {
  if (!(await isForumAdmin(message))) {
    await reply(message, t(await localeFor(message.from), 'admins_only'));
    return;
  }
  const current = await getReaction();
  const arg = args.toLowerCase();
  let enabled = !current.enabled; // bare /reaction toggles
  if (arg === 'on') enabled = true;
  else if (arg === 'off') enabled = false;
  else if (arg) {
    await saveSetting('reaction_emoji', args);
    enabled = true;
  }
  await saveSetting('reaction_enabled', enabled ? '1' : '0');
  const { emoji } = await getReaction();
  await reply(message, enabled ? `Reaction on: ${emoji}` : 'Reaction off.');
}

const playlistUrl = (id) => `https://open.spotify.com/playlist/${id}`;

function parsePlaylistId(arg) {
  const m = /(?:playlist[/:])([A-Za-z0-9]{22})/.exec(arg) ?? /^([A-Za-z0-9]{22})$/.exec(arg);
  return m?.[1] ?? null;
}

async function importPlaylist(threadId, playlistId) {
  const ids = [...new Set((await playlistTrackUris(playlistId)).map((u) => u.split(':')[2]))];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < ids.length; i += 200) {
    const rows = ids.slice(i, i + 200).map((trackId) => ({ threadId, trackId, addedAt: now }));
    await db.insert(tracks).values(rows).onConflictDoNothing().run();
  }
  return ids.length;
}

async function bindTopic(threadId, name, playlistId) {
  await setPlaylistDescription(playlistId, playlistDescription(name))
    .catch((e) => console.warn('cannot set playlist description', e.message));
  await db.insert(topics).values({ threadId, name, playlistId })
    .onConflictDoUpdate({ target: topics.threadId, set: { playlistId, ...(name ? { name } : {}) } }).run();
  await db.delete(tracks).where(eq(tracks.threadId, threadId)).run();
  return importPlaylist(threadId, playlistId);
}

function topicName(message, row) {
  return message.reply_to_message?.forum_topic_created?.name ?? row?.name ?? `Topic ${message.message_thread_id}`;
}

/** The topic's playlist id, finding (by name) or creating one on first use. */
async function ensurePlaylist(message) {
  const threadId = message.message_thread_id;
  const row = await db.select().from(topics).where(eq(topics.threadId, threadId)).get();
  if (row?.playlistId) return row.playlistId;

  const name = topicName(message, row);
  const playlist = await findPlaylistByName(name)
    ?? await createPlaylist(name, PUBLIC_PLAYLISTS, playlistDescription(name));
  await bindTopic(threadId, name, playlist.id);
  return playlist.id;
}

/**
 * Add the post's new tracks to the topic's playlist. Returns 'none' (no
 * track found), 'added' or 'duplicate'. With `backfill`, duplicates are only
 * reported, never deleted.
 */
export async function handleMusic(message, { backfill = false } = {}) {
  const ids = await extractTrackIds(message);
  if (!ids.length) return 'none';

  const threadId = message.message_thread_id;
  const playlistId = await ensurePlaylist(message);

  // Claim new tracks atomically; the unique index makes concurrent reposts lose.
  const now = Math.floor(Date.now() / 1000);
  const claimed = await db.insert(tracks)
    .values(ids.map((trackId) => ({ threadId, trackId, messageId: message.message_id, addedAt: now })))
    .onConflictDoNothing().returning().run();
  const fresh = claimed.map((r) => r.trackId);

  if (fresh.length) {
    try {
      await addTracks(playlistId, fresh.map(trackUri));
    } catch (e) {
      await db.delete(tracks).where(and(eq(tracks.threadId, threadId), inArray(tracks.trackId, fresh))).run();
      throw e;
    }
    const reaction = await getReaction();
    if (reaction.enabled) {
      await api.setMessageReaction({
        chat_id: message.chat.id,
        message_id: message.message_id,
        reaction: [{ type: 'emoji', emoji: reaction.emoji }],
      }).catch((e) => console.warn('cannot react', e.description ?? e.message));
    }
    return 'added';
  }

  // Everything in this post is already in the playlist → it's a duplicate.
  if (backfill || !(await getDeleteDuplicates())) return 'duplicate';
  const original = await db.select().from(tracks)
    .where(and(eq(tracks.threadId, threadId), eq(tracks.trackId, ids[0]))).get();
  try {
    await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id });
  } catch (e) {
    if (e instanceof BotApiError) {
      console.warn('cannot delete duplicate (is the bot an admin with "Delete messages"?)', e.description);
      return 'duplicate';
    }
    throw e;
  }
  const locale = await localeFor(message.from);
  const who = message.from ? message.from.first_name : t(locale, 'someone');
  await api.sendMessage({
    chat_id: message.chat.id,
    message_thread_id: threadId,
    text: t(locale, 'repost_removed', { who }),
    reply_parameters: original?.messageId
      ? { message_id: original.messageId, allow_sending_without_reply: true }
      : undefined,
  });
  return 'duplicate';
}

/** A known topic by (case-insensitive) name. */
async function findTopic(name) {
  const all = await db.select().from(topics).all();
  return all.find((t) => t.name?.toLowerCase() === name.trim().toLowerCase()) ?? null;
}

async function topicList() {
  return (await db.select().from(topics).all()).map((t) => t.name).filter(Boolean).join(', ') || 'none yet';
}

async function handleAdminCommand(message, { cmd, args }) {
  if (cmd === 'status') {
    const all = await db.select().from(topics).all();
    if (!all.length) return reply(message, 'No topics yet.');
    const lines = [];
    for (const t of all) {
      lines.push(t.playlistId
        ? `🎧 ${t.name}: ${await db.$count(tracks, eq(tracks.threadId, t.threadId))} tracks\n${playlistUrl(t.playlistId)}`
        : `▫️ ${t.name}: no playlist yet`);
    }
    return reply(message, lines.join('\n\n'));
  }

  if (cmd === 'playlist') {
    const playlistId = parsePlaylistId(args.split(/\s+/).pop() ?? '');
    const name = args.replace(/\s*\S+$/, '');
    const topic = name && await findTopic(name);
    if (!playlistId || !topic) {
      return reply(message, `Usage: /playlist <topic> https://open.spotify.com/playlist/…\nTopics: ${await topicList()}`);
    }
    const playlist = await getPlaylist(playlistId);
    const count = await bindTopic(topic.threadId, topic.name, playlistId);
    return reply(message, `✅ ${topic.name} now feeds “${playlist.name}” (${count} tracks already there).\n${playlistUrl(playlistId)}`);
  }

  if (cmd === 'dedupe') {
    const topic = args && await findTopic(args);
    if (!topic) return reply(message, `Usage: /dedupe <topic>\nTopics: ${await topicList()}`);
    if (!topic.playlistId) return reply(message, `${topic.name} has no playlist yet.`);
    const { removed } = await dedupePlaylist(topic.playlistId);
    await importPlaylist(topic.threadId, topic.playlistId);
    return reply(message, removed ? `🧹 ${topic.name}: removed ${removed} duplicate track(s).` : `${topic.name}: no duplicates found.`);
  }
}

// Private chat. Everyone gets the reply keyboard (ℹ️ About, with 🔗 Source code and
// ⭐ Tip · 🌐 Language); the only slash commands are the admin ones.
async function handlePrivate(message, command) {
  const chatId = message.chat.id;
  if (message.successful_payment) return thankTip(message, await localeFor(message.from), ADMIN_IDS);
  const button = matchButton(message.text);
  if (button) {
    await drop(chatId, message.message_id);
    const locale = await localeFor(message.from);
    if (button === 'about') return showScreen(chatId, { text: t(locale, 'about'), reply_markup: aboutKeyboard(locale, SOURCE_URL) });
    return showScreen(chatId, { text: t(locale, 'choose_language'), reply_markup: languageKeyboard() });
  }
  if (command?.cmd === 'settings') return settingsScreen(message);
  if (command?.cmd === 'reaction') return handleReactionCommand(message, command.args);
  if (['status', 'playlist', 'dedupe'].includes(command?.cmd)) {
    if (!(await isForumAdmin(message))) return reply(message, t(await localeFor(message.from), 'admins_only'));
    try {
      return await handleAdminCommand(message, command);
    } catch (e) {
      if (e instanceof SpotifyNotConfigured) return reply(message, '⚠️ Spotify isn\'t connected yet — send /spotify.');
      console.error(e);
      return reply(message, `⚠️ ${e.message}`);
    }
  }
  if (command?.cmd === 'spotify') {
    if (!(await isForumAdmin(message))) {
      await reply(message, t(await localeFor(message.from), 'admins_only'));
      return;
    }
    // Either /spotify <refresh_token> (app from config.js) or /spotify <id> <secret> <refresh_token>.
    const parts = command.args.split(/\s+/).filter(Boolean);
    const [clientId, clientSecret, refreshToken] = parts.length === 1 ? [null, null, parts[0]] : parts;
    await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id }).catch(() => {});
    if (!refreshToken) {
      await reply(message, 'Usage: /spotify <refresh_token>');
      return;
    }
    await saveCredentials({ clientId, clientSecret, refreshToken });
    try {
      const user = await me();
      await api.sendMessage({ chat_id: message.chat.id, text: `✅ Spotify connected as ${user.display_name ?? user.id}. (I deleted your message with the secrets.)` });
    } catch (e) {
      await api.sendMessage({ chat_id: message.chat.id, text: `❌ Spotify rejected the credentials: ${e.message}` });
    }
    return;
  }
  // /start, an unknown command or stray text: tidy up and show home again.
  await drop(chatId, message.message_id);
  return sendHome(message.from);
}

export default async function (message) {
  const command = parseCommand(message.text);

  if (message.chat.type === 'private') return handlePrivate(message, command);
  if (message.chat.id !== FORUM_ID) return;

  if (message.forum_topic_created && message.message_thread_id) {
    await db.insert(topics).values({ threadId: message.message_thread_id, name: message.forum_topic_created.name })
      .onConflictDoUpdate({ target: topics.threadId, set: { name: message.forum_topic_created.name } }).run();
    return;
  }
  if (message.forum_topic_edited?.name && message.message_thread_id) {
    const name = message.forum_topic_edited.name;
    await db.update(topics).set({ name }).where(eq(topics.threadId, message.message_thread_id)).run();
    const row = await db.select().from(topics).where(eq(topics.threadId, message.message_thread_id)).get();
    if (row?.playlistId) {
      await setPlaylistDescription(row.playlistId, playlistDescription(name))
        .catch((e) => console.warn('cannot set playlist description', e.message));
    }
    return;
  }
  if (!message.is_topic_message || !message.message_thread_id) return; // ignore General
  if (message.from?.is_bot) return;

  if (command) return; // management happens in the private chat

  try {
    await handleMusic(message);
  } catch (e) {
    if (e instanceof SpotifyNotConfigured) {
      await reply(message, t(await localeFor(message.from), 'spotify_missing_group'));
      return;
    }
    console.error(e);
    await reply(message, t(await localeFor(message.from), 'failed', { error: e.message })).catch(() => {});
  }
}
