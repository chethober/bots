import { table, integer, text, real, boolean, json, index, uniqueIndex } from 'sdk/db';

// Key/value state: scheduler cursors, the run lock, when KEV was last loaded.
export const settings = table('settings', {
  key:   text('key').primaryKey(),
  value: text('value'),
});

// Every chat the bot knows: private chats, groups and channels. Active ones
// receive alerts. In a private chat the chat id is the user's id, and the
// clean-chat message ids (home / screen) are kept here. `level` and `watch`
// are the chat's alert filters (lib/filters.js); null means none. `mode` is
// instant (null), daily or weekly, and `digestAt` when the last digest was due.
export const chats = table('chats', {
  id:        integer('id').primaryKey(),
  type:      text('type').notNull().default('private'),
  title:     text('title'),
  username:  text('username'),
  active:    boolean('active').notNull().default(true),
  locale:    text('locale'),
  homeMsg:   integer('home_msg'),
  screenMsg: integer('screen_msg'),
  level:     text('level'),
  watch:     json('watch'),
  mode:      text('mode'),
  digestAt:  integer('digest_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  active: index('idx_chats_active').on(t.active, t.id),
}));

// CVEs parsed from NVD: everything the scheduler fetched, plus lookups and
// search results. The list columns are JSON arrays of strings.
export const cves = table('cves', {
  id:          text('id').primaryKey(),
  description: text('description'),
  score:       real('score'),
  severity:    text('severity'),
  vector:      text('vector'),
  pocRefs:     json('poc_refs'),
  categories:  json('categories'),
  bugTypes:    json('bug_types'),
  software:    json('software'),
  published:   text('published'),
  updatedAt:   integer('updated_at').notNull(),
}, (t) => ({
  published: index('idx_cves_published').on(t.published),
}));

// The CISA Known Exploited Vulnerabilities catalog, reloaded twice a day.
export const kev = table('kev', {
  cveId:          text('cve_id').primaryKey(),
  vendor:         text('vendor'),
  product:        text('product'),
  description:    text('description'),
  requiredAction: text('required_action'),
  dueDate:        text('due_date'),
  dateAdded:      text('date_added'),
  cwes:           json('cwes'),
}, (t) => ({
  added: index('idx_kev_added').on(t.dateAdded),
}));

// One row per alert: kind 'new' (a CVE above MIN_CVSS) or 'trending' (in KEV
// or with a public GitHub PoC). An alert goes through
//   pending  → waits for CVE details (trending alerts only)
//   sending  → delivered chat by chat; `cursor` is the last chat id done
//   sent / seeded (recorded on the first run without being sent)
export const alerts = table('alerts', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  cveId:     text('cve_id').notNull(),
  kind:      text('kind').notNull(),
  status:    text('status').notNull(),
  signals:   json('signals'),
  tries:     integer('tries').notNull().default(0),
  cursor:    integer('cursor'),
  createdAt: integer('created_at').notNull(),
  sentAt:    integer('sent_at'),
}, (t) => ({
  cveKind: uniqueIndex('idx_alerts_cve_kind').on(t.cveId, t.kind),
  status:  index('idx_alerts_status').on(t.status, t.id),
}));

// CVEs a private chat follows (🔔 Follow on a CVE card). `state` is what the
// chat last heard about the CVE — { score, severity, kev, poc } — and an update
// goes out when that changes (lib/follows.js).
export const follows = table('follows', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  chatId:    integer('chat_id').notNull(),
  cveId:     text('cve_id').notNull(),
  state:     json('state'),
  checkedAt: integer('checked_at').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  chatCve: uniqueIndex('idx_follows_chat_cve').on(t.chatId, t.cveId),
  checked: index('idx_follows_checked').on(t.checkedAt),
}));

// Who may change a group's or channel's alert settings from their private
// chat: whoever added the bot, and admins who opened them with /settings or a
// forwarded post. Admin rights are checked again on every change.
export const managers = table('managers', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  chatId:    integer('chat_id').notNull(),
  userId:    integer('user_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  chatUser: uniqueIndex('idx_managers_chat_user').on(t.chatId, t.userId),
  user:     index('idx_managers_user').on(t.userId),
}));
