import { table, integer, text, json, index, uniqueIndex } from 'sdk/db';

// Key/value settings: language choices, clean-chat message ids, error throttles.
export const settings = table('settings', {
  key:   text('key').primaryKey(),
  value: text('value'),
});

// A user's connected music account. `extra` holds (Spotify user id, Apple storefront).
export const accounts = table('accounts', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  userId:       integer('user_id').notNull(),
  provider:     text('provider').notNull(),          // spotify | youtube | apple
  accessToken:  text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt:    integer('expires_at'),               // ms; null = doesn't expire
  clientId:     text('client_id'),                   // the user's own Spotify app, if any
  name:         text('name'),
  extra:        json('extra'),
}, (t) => ({
  userProvider: uniqueIndex('idx_accounts_user_provider').on(t.userId, t.provider),
}));

// A login in progress: Spotify PKCE (verifier) or Google device flow (device code).
export const logins = table('logins', {
  state:       text('state').primaryKey(),
  userId:      integer('user_id').notNull(),
  provider:    text('provider').notNull(),
  verifier:    text('verifier'),
  clientId:    text('client_id'),
  redirectUri: text('redirect_uri'),
  deviceCode:  text('device_code'),
  createdAt:   integer('created_at').notNull(),
});

// Groups, forums and channels the bot is in.
export const chats = table('chats', {
  chatId:   integer('chat_id').primaryKey(),
  title:    text('title'),
  type:     text('type'),
  isForum:  integer('is_forum').notNull().default(0),
  active:   integer('active').notNull().default(1),
});

// Forum topic names, learned from topic created/edited service messages.
export const topics = table('topics', {
  id:       integer('id').primaryKey({ autoIncrement: true }),
  chatId:   integer('chat_id').notNull(),
  threadId: integer('thread_id').notNull(),
  name:     text('name'),
}, (t) => ({
  chatThread: uniqueIndex('idx_topics_chat_thread').on(t.chatId, t.threadId),
}));

// A sync between a chat and a playlist. threadId: 0 = the whole chat, a topic id,
// or -1 = every forum topic gets its own playlist (the per-topic links are its
// children, parentId = this link's id). direction: in (chat → playlist),
// out (playlist → chat) or both.
export const links = table('links', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  ownerId:      integer('owner_id').notNull(),
  chatId:       integer('chat_id').notNull(),
  threadId:     integer('thread_id').notNull().default(0),
  parentId:     integer('parent_id'),
  provider:     text('provider').notNull(),
  playlistId:   text('playlist_id'),
  playlistName: text('playlist_name'),
  direction:    text('direction').notNull().default('both'),
  reaction:     integer('reaction').notNull().default(1),
  dedupe:       integer('dedupe').notNull().default(0),
  audio:        integer('audio').notNull().default(1),     // posts get their audio from @chethoberbot
  createdAt:    integer('created_at').notNull(),
}, (t) => ({
  byChat:  index('idx_links_chat').on(t.chatId),
  byOwner: index('idx_links_owner').on(t.ownerId),
}));

// Every track a link knows is on both sides, so nothing is added or posted twice.
// pending = 1: seen in the chat but adding it to the playlist failed (🔄 Sync now retries).
// posterId/posterName: who posted it in the chat (a channel post's signature), for /top.
export const linkTracks = table('link_tracks', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  linkId:    integer('link_id').notNull(),
  trackId:   text('track_id').notNull(),
  messageId: integer('message_id'),
  source:    text('source'),                         // chat | playlist | bot
  pending:   integer('pending').notNull().default(0),
  posterId:  integer('poster_id'),
  posterName: text('poster_name'),
  addedAt:   integer('added_at').notNull(),
}, (t) => ({
  linkTrack: uniqueIndex('idx_link_tracks_link_track').on(t.linkId, t.trackId),
}));

// A user's unfinished step: the ➕ New sync wizard, or text the bot is waiting for. JSON.
export const drafts = table('drafts', {
  userId: integer('user_id').primaryKey(),
  data:   json('data'),
});

// 🔎 Find music results, so their buttons can stay short.
export const finds = table('finds', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull(),
  title:     text('title'),
  artist:    text('artist'),
  album:     text('album'),
  url:       text('url'),                            // a link song.link understands
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  byUser: index('idx_finds_user').on(t.userId),
}));

// Audio asked from @chethoberbot, waiting for its reply. It goes to chatId (a
// group or channel, as a reply to replyTo) or, when that's null, to userId.
export const relays = table('relays', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  userId:        integer('user_id').notNull(),
  query:         text('query'),
  sentMessageId: integer('sent_message_id'),
  done:          integer('done').notNull().default(0),
  createdAt:     integer('created_at').notNull(),
  chatId:        integer('chat_id'),
  threadId:      integer('thread_id'),
  replyTo:       integer('reply_to'),
  songId:        integer('song_id'),
});

// Songs the bot posted in chats, so the ❤️ ➕ 🎵 buttons under them stay short.
export const songs = table('songs', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  title:     text('title'),
  artist:    text('artist'),
  url:       text('url'),                            // a link song.link understands
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  byUrl: index('idx_songs_url').on(t.url),
}));

// A group's player: the host's Spotify, shared with the group.
export const players = table('players', {
  chatId:     integer('chat_id').primaryKey(),
  threadId:   integer('thread_id'),
  hostId:     integer('host_id').notNull(),
  messageId:  integer('message_id'),
  queuePosts: integer('queue_posts').notNull().default(1),
  createdAt:  integer('created_at').notNull(),
});

// ⏮ Old posts queued for a sync's playlist (forwarded to the bot, or read from
// a chat export). status: wait | added | known | missed | retry.
export const backfillItems = table('backfill_items', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  userId:     integer('user_id').notNull(),
  linkId:     integer('link_id').notNull(),
  refs:       json('refs'),
  messageId:  integer('message_id'),
  posterId:   integer('poster_id'),
  posterName: text('poster_name'),
  status:     text('status').notNull().default('wait'),
  createdAt:  integer('created_at').notNull(),
}, (t) => ({
  byUser: index('idx_backfill_items_user').on(t.userId, t.status),
}));
