import { table, integer, text, boolean, json, index, uniqueIndex, sql } from 'sdk/db';

// One row per Telegram Business connection (a user linking the bot as their chatbot).
export const connections = table('connections', {
  id:         text('id').primaryKey(),               // business_connection_id
  userId:     integer('user_id').notNull(),          // the business account owner
  userChatId: integer('user_chat_id').notNull(),     // private chat between owner and bot
  firstName:  text('first_name'),
  isEnabled:  boolean('is_enabled').default(true),
  canReply:   boolean('can_reply').default(false),
  canRead:    boolean('can_read').default(false),
  updatedAt:  integer('updated_at').default(sql`(unixepoch())`),
}, (t) => ({
  userIdx: index('idx_connections_user').on(t.userId),
}));

// Per-owner AI and behavior settings, edited from the Mini App panel.
export const settings = table('settings', {
  userId:        integer('user_id').primaryKey(),
  data:          json('data'),
  cfAccountId:   text('cf_account_id'),
  cfApiToken:    text('cf_api_token'),
  lastErrorAt:   integer('last_error_at').default(0),  // throttles "AI failed" notices
  wizardStep:    text('wizard_step'),                   // in-chat credentials setup: 'account' | 'token'
  wizardAccount: text('wizard_account'),                // account ID entered during setup
  updatedAt:     integer('updated_at').default(sql`(unixepoch())`),
});

// Per owner, about their chat with the bot: the language Telegram reports (used
// while the UI language is 'auto') and the bot's two live menu messages, so stale
// ones can be deleted (clean chat).
export const ui = table('ui', {
  userId:    integer('user_id').primaryKey(),
  lang:      text('lang'),
  homeMsg:   integer('home_msg'),                      // the help message carrying the reply keyboard
  screenMsg: integer('screen_msg'),                    // the screen a button opened last
});

// Chats the secretary has seen, per owner. Lets the owner mute single chats.
export const chats = table('chats', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  ownerId:     integer('owner_id').notNull(),
  chatId:      integer('chat_id').notNull(),
  title:       text('title'),
  username:    text('username'),
  muted:       boolean('muted').default(false),
  pausedUntil: integer('paused_until').default(0),   // set when the owner replies manually
  note:        text('note'),                          // owner's note about this contact, given to the AI
  lastAt:      integer('last_at').default(0),
}, (t) => ({
  ownerChatIdx: uniqueIndex('uidx_chats_owner_chat').on(t.ownerId, t.chatId),
}));

// Short rolling conversation history used as context for replies.
export const messages = table('messages', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  ownerId:   integer('owner_id').notNull(),
  chatId:    integer('chat_id').notNull(),
  messageId: integer('message_id'),
  role:      text('role').notNull(),                 // 'contact' | 'owner' | 'bot'
  text:      text('text').notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  chatIdx: index('idx_messages_owner_chat').on(t.ownerId, t.chatId, t.id),
}));

// Examples of how the owner writes, used to imitate their style in "speak as me" mode.
export const styleSamples = table('style_samples', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  ownerId:   integer('owner_id').notNull(),
  text:      text('text').notNull(),
  source:    text('source').notNull(),               // 'chat' | 'forward' | 'manual'
  createdAt: integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  ownerIdx: index('idx_style_samples_owner').on(t.ownerId, t.id),
}));

// Non-text messages from contacts relayed to the owner, awaiting the owner's answer.
export const relays = table('relays', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  ownerId:      integer('owner_id').notNull(),
  connectionId: text('connection_id').notNull(),
  chatId:       integer('chat_id').notNull(),         // contact's chat in the business account
  contactMsgId: integer('contact_msg_id').notNull(),
  contactName:  text('contact_name'),
  kind:         text('kind'),                         // 'photo', 'voice message', ...
  headerMsgId:  integer('header_msg_id'),             // messages in the owner's chat with the bot
  mediaMsgId:   integer('media_msg_id'),
  promptMsgId:  integer('prompt_msg_id'),
  status:       text('status').default('pending'),    // 'pending' | 'answered' | 'ai' | 'ignored'
  createdAt:    integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  ownerIdx: index('idx_relays_owner').on(t.ownerId, t.id),
}));

// Past conversations imported from a Telegram chat export: what they said → how the owner replied.
export const examples = table('examples', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  ownerId:   integer('owner_id').notNull(),
  prompt:    text('prompt').notNull(),
  reply:     text('reply').notNull(),
  source:    text('source'),                         // e.g. export chat name
  sentAt:    integer('sent_at'),
}, (t) => ({
  ownerIdx: index('idx_examples_owner').on(t.ownerId, t.id),
}));
