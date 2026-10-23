import { table, integer, text, json, index, sql } from 'sdk/db';

// One row per game. Players are Telegram user ids; since every player has a private
// chat with the bot, the user id doubles as the chat id for notifications.
export const games = table('games', {
  id:      text('id').primaryKey(),                       // short random code, used in links
  xId:     integer('x_id').notNull(),
  xName:   text('x_name').notNull(),
  oId:     integer('o_id'),                               // null until someone joins
  oName:   text('o_name'),
  board:   text('board').notNull().default('.........'),  // 9 cells: '.', 'X' or 'O'
  turn:    text('turn').notNull().default('X'),
  status:  text('status').notNull().default('waiting'),   // waiting | playing | x_won | o_won | draw
  version: integer('version').notNull().default(0),       // bumped on every move; guards races
  xMsgId:  integer('x_msg_id'),                           // last "your turn" ping, deleted on the next one
  oMsgId:  integer('o_msg_id'),
  rematchId: text('rematch_id'),                          // set once a rematch is created, so it's created once
  created: integer('created_at').notNull().default(sql`(unixepoch())`),
  updated: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  xIdx: index('idx_games_x').on(t.xId),
  oIdx: index('idx_games_o').on(t.oId),
}));

// Play-money wallet + lifetime stats, one row per Telegram user.
export const players = table('players', {
  id:        integer('id').primaryKey(),                  // Telegram user id
  name:      text('name').notNull(),
  locale:    text('locale'),                              // chosen with 🌐 Language; null = lang
  lang:      text('lang'),                                // from Telegram's language_code, refreshed on use
  homeMsg:   integer('home_msg'),                         // private chat: the message carrying the reply keyboard
  screenMsg: integer('screen_msg'),                       // private chat: the screen a button opened last
  chips:     integer('chips').notNull().default(1000),
  lastDaily: integer('last_daily').notNull().default(0),
  played:    integer('played').notNull().default(0),
  wins:      integer('wins').notNull().default(0),
  wagered:   integer('wagered').notNull().default(0),
  bestWin:   integer('best_win').notNull().default(0),
  banned:    integer('banned', { mode: 'boolean' }).notNull().default(false),
  created:   integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  chipsIdx: index('idx_players_chips').on(t.chips),
}));

// State for every chat/inline game, keyed by the message it lives in
// (`inline_message_id`, or `<chat_id>:<message_id>`), or by a Mini App key like `crash:<user>`.
export const sessions = table('sessions', {
  id:      integer('id').primaryKey({ autoIncrement: true }),
  key:     text('key').notNull().unique(),
  kind:    text('kind').notNull(),
  state:   json('state').notNull(),
  version: integer('version').notNull().default(0),
  created: integer('created_at').notNull().default(sql`(unixepoch())`),
  updated: integer('updated_at').notNull().default(sql`(unixepoch())`),
});
