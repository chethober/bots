import { table, integer, text, real, json, index, uniqueIndex, primaryKey, sql } from 'sdk/db';

// Per-chat preferences: time zone, location, quiet hours, muted categories, /daily sections.
export const prefs = table('prefs', {
  chatId:     integer('chat_id').primaryKey(),
  locale:     text('locale'),                          // chosen UI language (/language); null = auto from Telegram
  tz:         text('tz').default('UTC'),               // IANA name
  lat:        real('lat'),
  lon:        real('lon'),
  quietStart: text('quiet_start'),                     // 'HH:MM' local, null = no quiet hours
  quietEnd:   text('quiet_end'),
  muted:      json('muted'),                           // ['crypto', ...]
  daily:      json('daily'),                           // { weather: true, crypto: true, ... }
  homeMsg:    integer('home_msg'),                     // private chat: message carrying the reply keyboard
  screenMsg:  integer('screen_msg'),                   // private chat: the menu/notice shown last (clean chat)
  updatedAt:  integer('updated_at').default(sql`(unixepoch())`),
});

// Things a chat follows: coins, teams, leagues. Drives notifications and /daily.
export const follows = table('follows', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  chatId:    integer('chat_id').notNull(),
  category:  text('category').notNull(),               // 'crypto' | 'sports'
  kind:      text('kind').notNull(),                   // 'coin' | 'team' | 'league'
  ref:       text('ref').notNull(),                    // coin id, 'soccer/eng.1:359', ...
  label:     text('label').notNull(),
  meta:      json('meta'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  uniq:   uniqueIndex('uidx_follows_chat_kind_ref').on(t.chatId, t.kind, t.ref),
  refIdx: index('idx_follows_kind_ref').on(t.kind, t.ref),
}));

// ♥ Saved items. `data` holds what is needed to re-render the card without refetching.
export const savedItems = table('saved_items', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  chatId:    integer('chat_id').notNull(),
  category:  text('category').notNull(),               // 'food' | 'random' | ...
  kind:      text('kind').notNull(),                   // 'recipe' | 'cocktail' | 'book' | ...
  ref:       text('ref').notNull(),
  title:     text('title').notNull(),
  data:      json('data'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  uniq:   uniqueIndex('uidx_saved_chat_kind_ref').on(t.chatId, t.kind, t.ref),
  catIdx: index('idx_saved_chat_cat').on(t.chatId, t.category, t.id),
}));

// Every alert, scheduled push and reminder. `params` shape depends on `kind`
// (see lib/notify.js). Time-driven kinds set `next_at`; condition-driven ones leave it null.
export const notifications = table('notifications', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  chatId:      integer('chat_id').notNull(),
  category:    text('category').notNull(),             // 'crypto' | 'sports' | 'food' | 'random' | 'general'
  kind:        text('kind').notNull(),
  params:      json('params').notNull(),
  active:      integer('active').default(1),
  nextAt:      integer('next_at'),                     // unix seconds
  lastFiredAt: integer('last_fired_at'),
  createdAt:   integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  activeIdx: index('idx_notifications_active').on(t.active, t.kind),
  chatIdx:   index('idx_notifications_chat').on(t.chatId, t.category),
}));

// "Waiting for the user to type X" after they tapped a button like 🔎 Search.
export const pendingInput = table('pending_input', {
  chatId:    integer('chat_id').notNull(),
  userId:    integer('user_id').notNull(),
  action:    text('action').notNull(),                 // 'crypto.search', ...
  data:      json('data'),
  expiresAt: integer('expires_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.chatId, t.userId] }),
}));

// Bot-wide settings written only through the CLI (endpoints/setConfig).
export const config = table('config', {
  key:   text('key').primaryKey(),
  value: text('value'),
});

// Short-lived copies of upstream responses, to stay under free-tier rate limits.
export const cache = table('cache', {
  key:       text('key').primaryKey(),
  value:     json('value'),
  expiresAt: integer('expires_at').notNull(),
});

// 💼 One position per coin per chat.
export const portfolio = table('portfolio', {
  chatId:   integer('chat_id').notNull(),
  coin:     text('coin').notNull(),                    // CoinGecko id
  symbol:   text('symbol'),
  amount:   real('amount').notNull(),
  avgPrice: real('avg_price'),                         // USD, null = unknown
}, (t) => ({
  pk: primaryKey({ columns: [t.chatId, t.coin] }),
}));

// 🛒 Shopping list, one per chat. `source` is the recipe an item came from (or null).
export const shoppingList = table('shopping_list', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  chatId:    integer('chat_id').notNull(),
  item:      text('item').notNull(),
  source:    text('source'),
  done:      integer('done').default(0),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  chatIdx: index('idx_shopping_chat').on(t.chatId, t.id),
}));

// ☕️ Brew log entries.
export const brewLog = table('brew_log', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  chatId:    integer('chat_id').notNull(),
  bean:      text('bean').notNull(),
  method:    text('method').notNull(),
  dose:      real('dose'),                              // g coffee
  water:     real('water'),                             // g water
  rating:    integer('rating'),                         // 1–5
  note:      text('note'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  chatIdx: index('idx_brewlog_chat').on(t.chatId, t.id),
}));

// 🧠 Trivia scores per chat member. Streak = consecutive local days with a correct answer.
export const triviaScores = table('trivia_scores', {
  chatId:     integer('chat_id').notNull(),
  userId:     integer('user_id').notNull(),
  name:       text('name'),
  answered:   integer('answered').default(0),
  correct:    integer('correct').default(0),
  streak:     integer('streak').default(0),
  bestStreak: integer('best_streak').default(0),
  lastDay:    text('last_day'),                         // 'YYYY-MM-DD' of the last correct answer
}, (t) => ({
  pk:       primaryKey({ columns: [t.chatId, t.userId] }),
  boardIdx: index('idx_trivia_board').on(t.chatId, t.correct),
}));
