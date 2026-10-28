// Chat ↔ playlist syncs ("links").
//
//   chat → playlist  live: every music post in the chat is added (handlers).
//   playlist → chat  on demand: 🔄 Sync now posts the playlist's tracks the chat
//                    hasn't seen, SYNC_BATCH at a time. It also retries posts
//                    whose tracks couldn't be added.
//
// link_tracks remembers every track a link has on both sides, so a track is
// never added or posted twice, and a repost is recognized.

import { api, db, BotApiError } from 'sdk';
import { and, eq, inArray, isNull } from 'sdk/db';
import { links, linkTracks } from '../schema.js';
import { ADDED_REACTION, SYNC_BATCH } from './config.js';
import { providerOf } from './providers/index.js';
import { getAccount } from './accounts.js';
import { resolveRef } from './tracks.js';
import { pageUrl } from './songlink.js';
import { getChat, topicName } from './chats.js';
import { getSetting, saveSetting } from './settings.js';
import { localeFor } from './i18n.js';
import { errorText } from './errors.js';
import { t } from './strings.js';
import { esc, now, unique } from './util.js';

export const getLink = (id) => db.select().from(links).where(eq(links.id, id)).get();

/** A user's syncs (per-topic children are shown inside their parent). */
export const linksOfOwner = (ownerId) =>
  db.select().from(links).where(and(eq(links.ownerId, ownerId), isNull(links.parentId))).all();

export const childrenOf = (id) => db.select().from(links).where(eq(links.parentId, id)).all();

export async function createLink(fields) {
  const [row] = await db.insert(links).values({ ...fields, createdAt: now() }).returning().run();
  return row;
}

export async function updateLink(link, set) {
  await db.update(links).set(set).where(eq(links.id, link.id)).run();
  // A per-topic parent's settings apply to its topics too.
  if (link.threadId === -1) await db.update(links).set(set).where(eq(links.parentId, link.id)).run();
}

export async function deleteLink(link) {
  const ids = [link.id, ...(await childrenOf(link.id)).map((c) => c.id)];
  await db.delete(linkTracks).where(inArray(linkTracks.linkId, ids)).run();
  await db.delete(links).where(inArray(links.id, ids)).run();
}

export const countTracks = (linkId) => db.$count(linkTracks, eq(linkTracks.linkId, linkId));
export const countPending = (linkId) => db.$count(linkTracks, and(eq(linkTracks.linkId, linkId), eq(linkTracks.pending, 1)));

async function knownIds(linkId) {
  const rows = await db.select({ trackId: linkTracks.trackId }).from(linkTracks).where(eq(linkTracks.linkId, linkId)).all();
  return new Set(rows.map((r) => r.trackId));
}

async function remember(linkId, trackIds, { messageId = null, source, pending = 0 }) {
  const ids = unique(trackIds);
  const claimed = [];
  for (let i = 0; i < ids.length; i += 200) {
    const rows = ids.slice(i, i + 200).map((trackId) => ({ linkId, trackId, messageId, source, pending, addedAt: now() }));
    claimed.push(...await db.insert(linkTracks).values(rows).onConflictDoNothing().returning().run());
  }
  return claimed.map((r) => r.trackId);
}

/** Mark everything already in the playlist as seen, so Sync now only posts newer tracks. */
export async function baseline(link) {
  const provider = providerOf(link.provider);
  const acct = await getAccount(link.ownerId, link.provider);
  const tracks = await provider.playlistTracks(acct, link.playlistId);
  await remember(link.id, tracks.map((x) => x.id), { source: 'playlist' });
  return tracks.length;
}

// --- chat → playlist ---------------------------------------------------------

/** Find (by name) or create the playlist of a forum topic under a per-topic link. */
async function topicLink(parent, message, threadId) {
  const name = message.reply_to_message?.forum_topic_created?.name
    ?? await topicName(parent.chatId, threadId) ?? `Topic ${threadId}`;
  const provider = providerOf(parent.provider);
  const acct = await getAccount(parent.ownerId, parent.provider);
  if (!acct) return null;
  const playlist = await provider.findPlaylistByName(acct, name)
    ?? await provider.createPlaylist(acct, name, `${name} · @${(await api.getMe()).username}`);
  const child = await createLink({
    ownerId: parent.ownerId, chatId: parent.chatId, threadId, parentId: parent.id, provider: parent.provider,
    playlistId: playlist.id, playlistName: playlist.name, direction: parent.direction,
    reaction: parent.reaction, dedupe: parent.dedupe,
  });
  await baseline(child).catch((e) => console.warn('topic baseline failed', e.message));
  return child;
}

/** The links a post in this chat/topic feeds. */
async function linksForPost(message, threadId) {
  const rows = await db.select().from(links).where(eq(links.chatId, message.chat.id)).all();
  const out = rows.filter((l) => l.threadId === 0 || (threadId > 0 && l.threadId === threadId));
  if (threadId > 0) {
    for (const parent of rows.filter((l) => l.threadId === -1)) {
      if (rows.some((l) => l.parentId === parent.id && l.threadId === threadId)) continue;
      const child = await topicLink(parent, message, threadId).catch((e) => reportError(parent, e));
      if (child) out.push(child);
    }
  }
  return out.filter((l) => l.direction !== 'out' && l.playlistId);
}

async function addPost(link, refs, message, memo) {
  const provider = providerOf(link.provider);
  const acct = await getAccount(link.ownerId, link.provider);
  if (!acct) throw new Error(t(await localeFor({ id: link.ownerId }), 'err_not_connected', { service: provider.name }));

  const found = [];
  for (const ref of refs) {
    const hit = await resolveRef(ref, provider, acct, memo);
    if (hit?.id) found.push(hit.id);
  }
  const ids = unique(found);
  if (!ids.length) return 'none';

  // Claim new tracks first; the unique index makes a concurrent repost lose.
  const fresh = await remember(link.id, ids, { messageId: message.message_id, source: 'chat' });
  if (fresh.length) {
    try {
      await provider.addTracks(acct, link.playlistId, fresh);
    } catch (e) {
      await db.update(linkTracks).set({ pending: 1 })
        .where(and(eq(linkTracks.linkId, link.id), inArray(linkTracks.trackId, fresh))).run();
      throw e;
    }
    if (link.reaction) {
      await api.setMessageReaction({ chat_id: message.chat.id, message_id: message.message_id, reaction: [{ type: 'emoji', emoji: ADDED_REACTION }] })
        .catch((e) => console.warn('cannot react', e.description ?? e.message));
    }
    return 'added';
  }
  if (!link.dedupe) return 'duplicate';

  // Every track in the post is already there: remove the repost.
  const original = await db.select().from(linkTracks)
    .where(and(eq(linkTracks.linkId, link.id), eq(linkTracks.trackId, ids[0]))).get();
  try {
    await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id });
  } catch (e) {
    if (e instanceof BotApiError) return 'duplicate'; // no "Delete messages" right
    throw e;
  }
  const locale = await localeFor({ id: link.ownerId });
  const who = message.from?.first_name ?? message.author_signature ?? t(locale, 'someone');
  await api.sendMessage({
    chat_id: message.chat.id,
    message_thread_id: message.is_topic_message ? message.message_thread_id : undefined,
    text: t(locale, 'repost_removed', { who }),
    reply_parameters: original?.messageId ? { message_id: original.messageId, allow_sending_without_reply: true } : undefined,
  }).catch(() => {});
  return 'duplicate';
}

/** A music post in a group, forum or channel: add its tracks to every playlist it feeds. */
export async function onChatPost(message, refs, threadId) {
  const memo = new Map();
  for (const link of await linksForPost(message, threadId)) {
    try {
      await addPost(link, refs, message, memo);
    } catch (e) {
      await reportError(link, e);
    }
  }
}

// --- playlist → chat ---------------------------------------------------------

function postText(locale, provider, track) {
  const head = `🎵 <b>${esc(track.title)}</b>${track.artist ? ` — ${esc(track.artist)}` : ''}`;
  return `${head}\n<a href="${esc(track.url)}">${provider.name}</a> · <a href="${pageUrl(provider.id, track.id)}">${t(locale, 'listen_anywhere')}</a>`;
}

async function syncOne(link, budget, locale) {
  const provider = providerOf(link.provider);
  const acct = await getAccount(link.ownerId, link.provider);
  if (!acct) throw new Error(t(locale, 'err_not_connected', { service: provider.name }));
  const result = { posted: 0, remaining: 0, retried: 0 };

  // Posts whose tracks couldn't be added before.
  if (link.direction !== 'out') {
    const pending = await db.select().from(linkTracks).where(and(eq(linkTracks.linkId, link.id), eq(linkTracks.pending, 1))).all();
    if (pending.length) {
      await provider.addTracks(acct, link.playlistId, pending.map((r) => r.trackId));
      await db.update(linkTracks).set({ pending: 0 }).where(inArray(linkTracks.id, pending.map((r) => r.id))).run();
      result.retried = pending.length;
    }
  }
  if (link.direction === 'in') return result;

  const known = await knownIds(link.id);
  const seen = new Set();
  const fresh = (await provider.playlistTracks(acct, link.playlistId))
    .filter((x) => !known.has(x.id) && !seen.has(x.id) && seen.add(x.id));
  for (const track of fresh.slice(0, budget)) {
    try {
      const sent = await api.sendMessage({
        chat_id: link.chatId,
        message_thread_id: link.threadId > 0 ? link.threadId : undefined,
        text: postText(locale, provider, track),
        parse_mode: 'HTML',
        link_preview_options: { url: track.url, prefer_small_media: true },
      });
      await remember(link.id, [track.id], { messageId: sent.message_id, source: 'playlist' });
      result.posted++;
    } catch (e) {
      if (e instanceof BotApiError && e.code === 429) break; // flood limit: the rest wait for the next tap
      throw e;
    }
  }
  result.remaining = fresh.length - result.posted;
  return result;
}

/**
 * A track added from 🔎 Find music. Both-ways links also get it posted in the
 * chat; playlist → chat links leave that to Sync now. False if it's already there.
 */
export async function addFromBot(link, track) {
  const provider = providerOf(link.provider);
  const acct = await getAccount(link.ownerId, link.provider);
  if (link.direction === 'out') {
    await provider.addTracks(acct, link.playlistId, [track.id]);
    return true;
  }
  if (!(await remember(link.id, [track.id], { source: 'bot' })).length) return false;
  try {
    await provider.addTracks(acct, link.playlistId, [track.id]);
  } catch (e) {
    await db.delete(linkTracks).where(and(eq(linkTracks.linkId, link.id), eq(linkTracks.trackId, track.id))).run();
    throw e;
  }
  if (link.direction === 'both') {
    const locale = await localeFor({ id: link.ownerId });
    const sent = await api.sendMessage({
      chat_id: link.chatId,
      message_thread_id: link.threadId > 0 ? link.threadId : undefined,
      text: postText(locale, provider, track),
      parse_mode: 'HTML',
      link_preview_options: { url: track.url, prefer_small_media: true },
    }).catch(() => null);
    if (sent) {
      await db.update(linkTracks).set({ messageId: sent.message_id })
        .where(and(eq(linkTracks.linkId, link.id), eq(linkTracks.trackId, track.id))).run();
    }
  }
  return true;
}

/** 🔄 Sync now for a link (and its per-topic children). */
export async function syncNow(link) {
  const locale = await localeFor({ id: link.ownerId });
  const targets = link.threadId === -1 ? await childrenOf(link.id) : [link];
  const total = { posted: 0, remaining: 0, retried: 0 };
  for (const target of targets) {
    const r = await syncOne(target, Math.max(0, SYNC_BATCH - total.posted), locale);
    total.posted += r.posted;
    total.remaining += r.remaining;
    total.retried += r.retried;
  }
  return total;
}

// --- errors ------------------------------------------------------------------

/** Tell the link's owner what went wrong, at most once an hour per link. */
export async function reportError(link, e) {
  console.warn('sync error', link.id, e?.message);
  const key = `err:${link.id}`;
  const last = Number(await getSetting(key)) || 0;
  if (now() - last < 3600) return null;
  await saveSetting(key, String(now()));
  const locale = await localeFor({ id: link.ownerId });
  const chat = await getChat(link.chatId);
  await api.sendMessage({
    chat_id: link.ownerId,
    text: t(locale, 'sync_failed', { playlist: link.playlistName ?? '—', chat: chat?.title ?? link.chatId, error: errorText(locale, e) }),
  }).catch(() => {});
  return null;
}
