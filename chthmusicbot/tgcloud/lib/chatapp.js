// The chat Mini App's server side (endpoints/chatApp): one call per action,
// { op, chat, ... }, where `chat` is the start param (applink.js).
//
// Who may do what:
//   members                 see everything, search, add to the queue, remove their own songs,
//                           preview songs, add picks to the queue
//   controllers             also ▶️ play, reorder, clear and remove anyone's songs, ⏮ ⏯ ⏭,
//   (admins, player host)   and the group player's sleep timer
//   admins                  link one of their playlists to the chat
// A chat without a group player gets a personal sleep timer instead: it pauses
// the Spotify of whoever set it.

import { api, db, EndpointError, BotApiError } from 'sdk';
import { eq } from 'sdk/db';
import { links } from '../schema.js';
import { BOT_USERNAME } from './config.js';
import { PROVIDERS, providerOf } from './providers/index.js';
import { getAccount, listAccounts } from './accounts.js';
import { getChat, topicName } from './chats.js';
import { linksOfChat, publicPlaylistUrl } from './chatcmds.js';
import { baseline, countTracks, createLink, updateLink } from './sync.js';
import { DEFAULTS, KINDS, REACTIONS, SUGGESTED, allowedReactions, setReaction, settingsOf } from './reactions.js';
import { getPlayer } from './player.js';
import { addToQueue, clearQueue, getItem, moveInQueue, playNext, queueHistory, queueOf, setStatus } from './queue.js';
import { SLEEP_MINUTES, clearTimer, fireDueTimers, getTimer, setTimer } from './sleep.js';
import { chatPicks } from './recs.js';
import { searchSongs } from './itunes.js';
import { appParam, parseAppParam } from './applink.js';
import { ProviderError } from './http.js';
import { localeFor } from './i18n.js';
import { errorText } from './errors.js';
import { t } from './strings.js';
import { now, trackLabel } from './util.js';

const refuse = (code, message = code) => { throw new EndpointError(message, { code }); };

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const httpUrl = (v) => {
  const s = str(v, 500);
  return s && /^https:\/\/[^\s"<>]+$/i.test(s) ? s : null;
};

/** A song from the page: only known fields, bounded, https links. */
function cleanSong(input) {
  const song = {
    title: str(input?.title, 200), artist: str(input?.artist, 200), url: httpUrl(input?.url),
    artwork: httpUrl(input?.artwork), preview: httpUrl(input?.preview),
  };
  if (!song.title) refuse('BAD_INPUT');
  return song;
}

async function membership(chatId, userId) {
  try {
    const m = await api.getChatMember({ chat_id: chatId, user_id: userId });
    const admin = m.status === 'creator' || m.status === 'administrator';
    return { admin, member: admin || m.status === 'member' || (m.status === 'restricted' && m.is_member !== false) };
  } catch {
    return { admin: false, member: false };
  }
}

/** The chat a call is for, and what the caller may do there. */
async function contextOf(user, input) {
  const where = parseAppParam(input.chat);
  if (!where) refuse('NO_CHAT');
  const chat = await getChat(where.chatId);
  if (!chat || chat.active === 0) refuse('NO_CHAT');
  const { admin, member } = await membership(where.chatId, user.id);
  if (!member) refuse('NOT_MEMBER');
  const player = await getPlayer(where.chatId);
  const hostAcct = player && await getAccount(player.hostId, 'spotify');
  return {
    user, ...where, chat, admin, player: hostAcct ? player : null, hostAcct,
    control: admin || (Boolean(hostAcct) && player.hostId === user.id),
    locale: await localeFor(user),
  };
}

const songOut = (r) => ({ title: r.title, artist: r.artist, url: r.url, artwork: r.artwork ?? null, preview: r.preview ?? null });

async function playlistsOf(c) {
  const rows = await linksOfChat(c.chatId, c.threadId);
  return Promise.all(rows.map(async (l) => ({
    id: l.id, provider: l.provider, name: l.playlistName, direction: l.direction,
    tracks: await countTracks(l.id), url: publicPlaylistUrl(l), mine: l.ownerId === c.user.id,
  })));
}

async function playerOf(c) {
  if (!c.player) return null;
  const out = { host: c.hostAcct.name ?? null, hostIsMe: c.player.hostId === c.user.id };
  try {
    const state = await providerOf('spotify').playerState(c.hostAcct);
    Object.assign(out, {
      playing: Boolean(state?.playing), device: state?.device ?? null,
      track: state?.track ? { ...state.track, label: trackLabel(state.track) } : null,
      next: (state?.next ?? []).map((x) => ({ ...x, label: trackLabel(x) })),
    });
  } catch (e) {
    out.error = errorText(c.locale, e);
  }
  return out;
}

async function sleepOf(c) {
  const timer = await getTimer(c.chatId);
  if (!timer) return null;
  return { at: timer.at, from: timer.createdAt, mine: timer.setBy === c.user.id, forPlayer: Boolean(c.player) && timer.userId === c.player.hostId };
}

async function stateOf(c) {
  const accounts = (await listAccounts(c.user.id)).map((a) => ({ provider: a.provider, name: a.name }));
  const topic = c.threadId ? await topicName(c.chatId, c.threadId) : null;
  return {
    now: now(),
    bot: BOT_USERNAME,
    chat: { param: appParam(c.chatId, c.threadId), title: c.chat.title, type: c.chat.type, topic, forum: Boolean(c.chat.isForum) },
    me: { id: c.user.id, admin: c.admin, control: c.control, accounts, spotify: accounts.some((a) => a.provider === 'spotify') },
    services: Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, { name: p.name, icon: p.icon }])),
    playlists: await playlistsOf(c),
    queue: (await queueOf(c.chatId, c.threadId)).map((q) => ({ id: q.id, ...songOut(q), by: q.addedByName, mine: q.addedBy === c.user.id })),
    player: await playerOf(c),
    sleep: await sleepOf(c),
    sleepMinutes: SLEEP_MINUTES,
  };
}

/** What ✨ picks start from: the chat's playlists' newest tracks, then its queue. */
async function seedsOf(c) {
  const seeds = [];
  for (const l of (await linksOfChat(c.chatId, c.threadId)).slice(0, 3)) {
    const acct = await getAccount(l.ownerId, l.provider);
    if (!acct) continue;
    const tracks = await providerOf(l.provider).playlistTracks(acct, l.playlistId).catch(() => []);
    seeds.push(...tracks.slice(-60));
  }
  const history = await queueHistory(c.chatId, c.threadId);
  seeds.push(...history);
  return { seeds: seeds.map((s) => ({ title: s.title, artist: s.artist })), exclude: [] };
}

// --- ops -----------------------------------------------------------------------

const needControl = (c) => { if (!c.control) refuse('CONTROL_ONLY'); };
const needAdmin = (c) => { if (!c.admin) refuse('ADMINS_ONLY'); };

async function ownLink(c, linkId) {
  const link = (await linksOfChat(c.chatId, c.threadId)).find((l) => l.id === Number(linkId));
  if (!link) refuse('NOT_FOUND');
  return link;
}

const OPS = {
  state: (c) => stateOf(c),

  async tracks(c, input) {
    const link = await ownLink(c, input.linkId);
    const acct = await getAccount(link.ownerId, link.provider);
    if (!acct) refuse('OWNER_GONE');
    const tracks = await providerOf(link.provider).playlistTracks(acct, link.playlistId);
    return { tracks: tracks.slice(-200).reverse().map((x) => ({ title: x.title, artist: x.artist, url: x.url })) };
  },

  async search(c, input) {
    const q = str(input.q, 100);
    if (!q || q.length < 2) return { results: [] };
    return { results: (await searchSongs(q, 12)).map(songOut) };
  },

  async picks(c, input) {
    const p = await chatPicks(c.chatId, c.threadId, () => seedsOf(c), { refresh: Boolean(input.refresh) });
    return { at: p.at, seeds: p.seeds, items: p.items };
  },

  async queueAdd(c, input) {
    const row = await addToQueue(c.chatId, c.threadId, cleanSong(input.song), c.user);
    if (row.refused) refuse(row.refused);
    return stateOf(c);
  },

  async queueRemove(c, input) {
    const item = await getItem(Number(input.id));
    if (!item || item.chatId !== c.chatId || item.threadId !== c.threadId || item.status !== 'queued') refuse('NOT_FOUND');
    if (item.addedBy !== c.user.id) needControl(c);
    await setStatus(item.id, 'removed');
    return stateOf(c);
  },

  async queueMove(c, input) {
    needControl(c);
    const dir = input.dir === 'top' ? 'top' : Number(input.dir) < 0 ? -1 : 1;
    await moveInQueue(c.chatId, c.threadId, Number(input.id), dir);
    return stateOf(c);
  },

  async queueClear(c) {
    needControl(c);
    await clearQueue(c.chatId, c.threadId);
    return stateOf(c);
  },

  async play(c, input) {
    needControl(c);
    const result = await playNext(c.chatId, c.threadId, c.user, { all: Boolean(input.all) && Boolean(c.player) });
    if (!result.played && !result.missed) refuse('EMPTY');
    return { ...await stateOf(c), result };
  },

  async control(c, input) {
    needControl(c);
    if (!c.player) refuse('NO_PLAYER');
    if (!['prev', 'play', 'next'].includes(input.action)) refuse('BAD_INPUT');
    await providerOf('spotify').control(c.hostAcct, input.action);
    return stateOf(c);
  },

  async sleep(c, input) {
    const minutes = Number(input.minutes) || 0;
    const current = await getTimer(c.chatId);
    if (c.player) needControl(c);
    else if (current && current.setBy !== c.user.id && !c.admin) refuse('CONTROL_ONLY');
    if (!minutes) {
      await clearTimer(c.chatId);
      return stateOf(c);
    }
    if (!SLEEP_MINUTES.includes(minutes)) refuse('BAD_INPUT');
    const userId = c.player ? c.player.hostId : c.user.id;
    if (!c.player && !(await getAccount(userId, 'spotify'))) refuse('NO_SPOTIFY');
    await setTimer(c.chatId, c.threadId, { userId, setBy: c.user.id, minutes });
    if (c.player) {
      const name = [c.user.first_name, c.user.last_name].filter(Boolean).join(' ');
      await api.sendMessage({ chat_id: c.chatId, message_thread_id: c.threadId || undefined, text: t(c.locale, 'sleep_set_chat', { name, minutes }) }).catch(() => {});
    }
    return stateOf(c);
  },

  // The page's clock reached a timer (or it just polls): due timers fire in fireDueTimers.
  tick: (c) => stateOf(c),

  async myPlaylists(c) {
    needAdmin(c);
    const out = [];
    for (const acct of await listAccounts(c.user.id)) {
      const provider = providerOf(acct.provider);
      try {
        const lists = await provider.listPlaylists(acct);
        out.push({ provider: acct.provider, account: acct.name, playlists: lists.slice(0, 100).map((p) => ({ id: p.id, name: p.name, total: p.total ?? null, editable: p.editable !== false })) });
      } catch (e) {
        out.push({ provider: acct.provider, account: acct.name, playlists: [], error: errorText(c.locale, e) });
      }
    }
    return { accounts: out, chatTitle: c.chat.title };
  },

  async addPlaylist(c, input) {
    needAdmin(c);
    const provider = providerOf(input.provider);
    if (!provider) refuse('BAD_INPUT');
    const acct = await getAccount(c.user.id, provider.id);
    if (!acct) refuse('NO_ACCOUNT');
    let playlist;
    if (input.create) {
      const name = str(input.name, 100) ?? (c.threadId ? await topicName(c.chatId, c.threadId) : null) ?? c.chat.title ?? 'Telegram';
      playlist = { ...(await provider.createPlaylist(acct, name, `${name} · @${BOT_USERNAME}`)), editable: true };
    } else {
      const id = str(input.playlistId, 200);
      if (!id) refuse('BAD_INPUT');
      playlist = await provider.getPlaylist(acct, id);
    }
    const direction = playlist.editable === false ? 'out' : ['in', 'out', 'both'].includes(input.direction) ? input.direction : 'both';
    const existing = await db.select().from(links).where(eq(links.chatId, c.chatId)).all();
    if (existing.some((l) => l.provider === provider.id && l.playlistId === playlist.id && l.threadId === c.threadId)) refuse('DUPLICATE');
    const link = await createLink({
      ownerId: c.user.id, chatId: c.chatId, threadId: c.threadId, provider: provider.id,
      playlistId: playlist.id, playlistName: playlist.name, direction,
    });
    if (direction !== 'in' && !input.postExisting) await baseline(link);
    return stateOf(c);
  },
};

/** ⚙︎ Reactions: the chat's and (in a topic) the topic's settings, what they resolve to, and the syncs' switches. */
async function reactionsOf(c) {
  const chat = await settingsOf(c.chatId, 0);
  const topic = c.threadId ? await settingsOf(c.chatId, c.threadId) : null;
  const effective = Object.fromEntries(KINDS.map((k) => [k, topic?.[k] ?? chat[k] ?? DEFAULTS[k]]));
  const allowed = await allowedReactions(c.chatId);
  const usable = (e) => !allowed || allowed.includes(e);
  const syncs = (await linksOfChat(c.chatId, c.threadId)).map((l) => ({ id: l.id, provider: l.provider, name: l.playlistName, reaction: Boolean(l.reaction), direction: l.direction }));
  return {
    kinds: c.chat.type === 'channel' ? KINDS.filter((k) => k !== 'queued') : KINDS,
    chat, topic, defaults: DEFAULTS, effective,
    suggested: SUGGESTED.filter(usable), more: REACTIONS.filter((e) => !SUGGESTED.includes(e) && usable(e)),
    restricted: Boolean(allowed), none: Array.isArray(allowed) && !allowed.length,
    syncs: syncs.filter((l) => l.direction !== 'out'),
  };
}

Object.assign(OPS, {
  async reactions(c) {
    needAdmin(c);
    return reactionsOf(c);
  },

  // { scope: 'chat' | 'topic', kind, emoji }: an emoji, '' = off, null = same as the chat (topics only).
  async setReaction(c, input) {
    needAdmin(c);
    if (!KINDS.includes(input.kind)) refuse('BAD_INPUT');
    const topic = input.scope === 'topic';
    if (topic && !c.threadId) refuse('BAD_INPUT');
    const emoji = input.emoji === null ? null : String(input.emoji ?? '');
    if (emoji === null && !topic) refuse('BAD_INPUT');
    if (emoji) {
      if (!REACTIONS.includes(emoji)) refuse('BAD_INPUT');
      const allowed = await allowedReactions(c.chatId);
      if (allowed && !allowed.includes(emoji)) refuse('NOT_ALLOWED');
    }
    await setReaction(c.chatId, topic ? c.threadId : 0, input.kind, emoji);
    return reactionsOf(c);
  },

  async syncReaction(c, input) {
    needAdmin(c);
    const link = await ownLink(c, input.linkId);
    await updateLink(link, { reaction: input.on ? 1 : 0 });
    return reactionsOf(c);
  },
});

/** The chats a user can open the Mini App for without a link: where they have syncs or queued songs. */
async function homeOf(user) {
  const rows = await db.select().from(links).where(eq(links.ownerId, user.id)).all();
  const ids = [...new Set(rows.map((l) => l.chatId))];
  const chats = [];
  for (const id of ids.slice(0, 30)) {
    const chat = await getChat(id);
    if (chat && chat.active !== 0) chats.push({ param: appParam(id), title: chat.title ?? String(id), type: chat.type });
  }
  return { bot: BOT_USERNAME, chats };
}

export async function handleChatApp(user, input) {
  await fireDueTimers();
  if (input.op === 'home') return homeOf(user);
  const op = OPS[input.op];
  if (!op) refuse('BAD_INPUT');
  const c = await contextOf(user, input);
  try {
    return await op(c, input);
  } catch (e) {
    if (e instanceof EndpointError) throw e;
    if (e instanceof ProviderError || e instanceof BotApiError) throw new EndpointError(errorText(c.locale, e), { code: 'PROVIDER' });
    throw e;
  }
}
