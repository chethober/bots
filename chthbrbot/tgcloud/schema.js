import { table, integer, text, boolean, json, index, uniqueIndex, primaryKey } from 'sdk/db';

// Privacy note: no message text, captions or media are ever stored — only Telegram
// IDs, statuses, timestamps, the owner's first name, own invitation text and own
// hidden words.
// Reported messages are copied to the admin's chat by Telegram, not stored here.
// Keep the privacy text (lib/texts.js) in sync with this file.
// Timestamps are plain unix seconds so range queries stay simple.

// One row per person who created a link (the "owner").
export const users = table('users', {
  id:        integer('id').primaryKey(),                 // Telegram user id
  code:      text('code').notNull(),                     // 8-char deep-link code
  name:      text('name'),                               // Telegram first name, refreshed on use
  prompt:    text('prompt'),                             // owner's own invitation text (/text); null = default
  accepts:   json('accepts'),                            // message kinds accepted (/types); null = DEFAULT_KINDS
  locale:    text('locale'),                             // legacy language choice; new choices go to chats.locale
  mode:      text('mode').deprecated('link modes removed; replaced by prompt'),
  paused:    boolean('paused').notNull().default(false),
  words:     json('words'),                              // owner's own hidden words (⚙️ → 🔤); null = none
  blurMedia: boolean('blur_media').notNull().default(false),           // photos/videos/GIFs arrive under a spoiler
  protectReplies: boolean('protect_replies').notNull().default(false), // replies can't be forwarded or saved
  seenReceipts:   boolean('seen_receipts').notNull().default(false),   // senders get 👀 once the owner has seen
  typingIndicator: boolean('typing_indicator').notNull().default(false), // senders see "typing…" on ↩️ Reply
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  codeIdx: uniqueIndex('uidx_users_code').on(t.code),
}));

// Every anonymous message attempt, including dropped ones. Rows older than
// RETENTION_DAYS are deleted unless a report still points at them (lib/retention.js).
// status: 'delivered' | 'blocked' | 'banned' | 'filtered' | 'muted' (the owner's
// hidden words) | 'failed' | 'unsent'
export const messages = table('messages', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  ownerId:      integer('owner_id').notNull(),           // → users.id (not enforced)
  senderId:     integer('sender_id').notNull(),          // never shown to the owner
  senderChatId: integer('sender_chat_id').notNull(),
  senderMsgId:  integer('sender_msg_id').notNull(),
  ownerMsgId:   integer('owner_msg_id'),                 // the copy in the owner's chat
  ownerHeaderId: integer('owner_header_id'),             // the "new message" header above it (deleted on unsend)
  mediaGroupId: text('media_group_id'),                  // Telegram album id, so later album items follow the first
  mode:         text('mode').deprecated('link modes removed'),
  status:       text('status').notNull(),
  seenAt:       integer('seen_at'),                      // when the owner was first active after it (seen receipts)
  createdAt:    integer('created_at').notNull(),
}, (t) => ({
  createdIdx: index('idx_messages_created').on(t.createdAt),
  rateIdx:   index('idx_messages_rate').on(t.senderId, t.ownerId, t.createdAt),
  ownerIdx:  index('idx_messages_owner_status').on(t.ownerId, t.status),
  copyIdx:   index('idx_messages_owner_copy').on(t.ownerId, t.ownerMsgId),
  origIdx:   index('idx_messages_sender_orig').on(t.senderChatId, t.senderMsgId),
  albumIdx:  index('idx_messages_album').on(t.senderId, t.mediaGroupId),
}));

// Replies the owner sent back through the bot. The message ids let reactions and
// native (swipe) replies on either side be mirrored to the other chat.
export const replies = table('replies', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  messageId:    integer('message_id').notNull(),         // → messages.id
  ownerId:      integer('owner_id').notNull(),
  ownerMsgId:   integer('owner_msg_id'),                 // the owner's own reply, in the owner's chat
  senderChatId: integer('sender_chat_id'),
  senderMsgId:  integer('sender_msg_id'),                // the copy in the sender's chat
  createdAt:    integer('created_at').notNull(),
}, (t) => ({
  ownerIdx: index('idx_replies_owner').on(t.ownerId),
  copyIdx:  index('idx_replies_sender_copy').on(t.senderChatId, t.senderMsgId),
}));

// Unblocking (/blocked) addresses rows by SQLite rowid, so a sender's id never
// reaches the owner's client in callback data.
export const blocks = table('blocks', {
  ownerId:   integer('owner_id').notNull(),
  senderId:  integer('sender_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.ownerId, t.senderId] }),
}));

// status: 'open' | 'banned' | 'dismissed' (set by an admin, see ADMIN_IDS).
export const reports = table('reports', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  messageId: integer('message_id').notNull(),            // → messages.id
  ownerId:   integer('owner_id').notNull(),
  senderId:  integer('sender_id').notNull(),
  status:    text('status').notNull().default('open'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  msgIdx:    uniqueIndex('uidx_reports_message').on(t.messageId),
  senderIdx: index('idx_reports_sender').on(t.senderId),
}));

// Senders banned bot-wide by an admin: their anonymous messages are silently dropped.
export const bans = table('bans', {
  senderId:  integer('sender_id').primaryKey(),
  reportId:  integer('report_id'),                       // → reports.id that led to it
  createdAt: integer('created_at').notNull(),
});

// Admin broadcasts (/broadcast): an admin's own message is copied to everyone, in
// user-id order. cursor = last user id reached, so an interrupted run resumes
// there; locked_until keeps two runs of the same broadcast from overlapping.
// status: 'sending' | 'done'
export const broadcasts = table('broadcasts', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  adminId:     integer('admin_id').notNull(),            // the admin who sent it (their chat)
  sourceMsgId: integer('source_msg_id').notNull(),       // the message in that chat
  cursor:      integer('cursor').notNull().default(0),
  sent:        integer('sent').notNull().default(0),
  failed:      integer('failed').notNull().default(0),
  status:      text('status').notNull().default('sending'),
  lockedUntil: integer('locked_until').notNull().default(0),
  createdAt:   integer('created_at').notNull(),
}, (t) => ({
  srcIdx: uniqueIndex('uidx_broadcasts_source').on(t.adminId, t.sourceMsgId),
}));

// Per chat (the bot only works in private chats, so per person): their language
// and the bot's two live menu messages, so stale ones can be deleted (clean chat).
export const chats = table('chats', {
  id:        integer('id').primaryKey(),               // Telegram user id = chat id
  locale:    text('locale'),                           // chosen with 🌐 Language; null = auto
  lang:      text('lang'),                             // from Telegram's language_code, refreshed on use
  homeMsg:   integer('home_msg'),                      // the welcome message carrying the reply keyboard
  screenMsg: integer('screen_msg'),                    // the screen a button opened last
});

// Conversation state per Telegram user.
// mode: 'idle' | 'sending_to:<ownerId>' | 'replying_to:<messageId>' | 'setting_prompt'
//     | 'setting_words' | 'broadcasting'  (parsed by lib/state.js)
export const states = table('states', {
  userId:    integer('user_id').primaryKey(),
  mode:      text('mode').notNull().default('idle'),
  updatedAt: integer('updated_at').notNull(),
});
