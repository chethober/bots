import { table, integer, text, boolean, json, index, uniqueIndex, primaryKey } from 'sdk/db';

// Privacy note: owners and members never learn each other's Telegram identity.
// Owners see members only as random labels; on an xtune server the member's
// user is named after the label, so the server holds no Telegram identity either.
// Keep the privacy text (lib/texts.js) in sync with this file.
// Timestamps are plain unix seconds.

// One row per shared VPN.
// kind:   'xtune' (a public profile: per-member users) | 'sub' (a subscription URL) | 'links' (share links)
// status: 'ok' | 'down' (3 failed health checks in a row; hidden from the directory)
export const vpns = table('vpns', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  code:        text('code').notNull(),                  // deep-link code: t.me/<bot>?start=<code>
  ownerId:     integer('owner_id').notNull(),           // never shown to members
  kind:        text('kind').notNull(),
  source:      text('source').notNull(),                // xtune connect link / subscription URL / the links. Secret.
  name:        text('name').notNull(),
  description: text('description'),
  country:     text('country'),                         // ISO 3166 alpha-2, or null
  public:      boolean('public').notNull().default(false), // listed in the directory
  password:    text('password'),                        // lib/hash.js format; null = none
  paused:      boolean('paused').notNull().default(false), // by the owner: unlisted, no new members
  unlisted:    boolean('unlisted').notNull().default(false), // by an admin: out of the directory
  protocols:   json('protocols'),                       // ['VLESS REALITY', 'Hysteria2', …]
  active:      integer('active').notNull().default(0),  // members who can connect (xtune: from the server)
  max:         integer('max').notNull().default(0),     // member cap, 0 = unlimited (xtune pools only)
  quotaGb:     integer('quota_gb').notNull().default(0), // per member (xtune), 0 = unlimited
  days:        integer('days').notNull().default(0),    // per member (xtune), 0 = never expires
  status:      text('status').notNull().default('ok'),
  fails:       integer('fails').notNull().default(0),   // failed health checks in a row
  checkedAt:   integer('checked_at').notNull().default(0),
  announcedAt: integer('announced_at').notNull().default(0),
  createdAt:   integer('created_at').notNull(),
}, (t) => ({
  codeIdx:  uniqueIndex('uidx_vpns_code').on(t.code),
  ownerIdx: index('idx_vpns_owner').on(t.ownerId),
  dirIdx:   index('idx_vpns_dir').on(t.public, t.status),
}));

// Who joined what. label: random, unique per VPN; the only thing owners see.
// status: 'active' | 'left' | 'kicked' (kicked members cannot join that VPN again)
export const members = table('members', {
  id:       integer('id').primaryKey({ autoIncrement: true }),
  vpnId:    integer('vpn_id').notNull(),                // → vpns.id (not enforced)
  userId:   integer('user_id').notNull(),
  label:    text('label').notNull(),
  status:   text('status').notNull().default('active'),
  sub:      text('sub'),                                // xtune: this member's own subscription link
  joinedAt: integer('joined_at').notNull(),
}, (t) => ({
  memberIdx: uniqueIndex('uidx_members_vpn_user').on(t.vpnId, t.userId),
  labelIdx:  uniqueIndex('uidx_members_vpn_label').on(t.vpnId, t.label),
  userIdx:   index('idx_members_user').on(t.userId, t.status),
}));

// Wrong passwords per person and private VPN: 5 within an hour lock them out for the hour.
export const tries = table('tries', {
  vpnId:  integer('vpn_id').notNull(),
  userId: integer('user_id').notNull(),
  count:  integer('count').notNull().default(0),
  since:  integer('since').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.vpnId, t.userId] }),
}));

// reason: 'illegal' | 'scam' | 'dead'; status: 'open' | 'done'
export const reports = table('reports', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  vpnId:      integer('vpn_id').notNull(),
  reporterId: integer('reporter_id').notNull(),
  reason:     text('reason').notNull(),
  status:     text('status').notNull().default('open'),
  createdAt:  integer('created_at').notNull(),
}, (t) => ({
  oneIdx:  uniqueIndex('uidx_reports_vpn_reporter').on(t.vpnId, t.reporterId),
  openIdx: index('idx_reports_status').on(t.status),
}));

// People an admin banned from adding VPNs (their VPNs were deleted with the ban).
export const bans = table('bans', {
  userId:    integer('user_id').primaryKey(),
  createdAt: integer('created_at').notNull(),
});

// Per chat (private chats only, so per person): language and the two live menu
// messages, so stale ones can be deleted (clean chat). Same as the other bots.
export const chats = table('chats', {
  id:        integer('id').primaryKey(),
  locale:    text('locale'),                           // chosen with 🌐 Language; null = auto
  lang:      text('lang'),                             // from Telegram's language_code
  homeMsg:   integer('home_msg'),
  screenMsg: integer('screen_msg'),
});

// What the bot waits for next from a person, with its data (an add-VPN draft…).
// mode: 'idle' | 'add_source' | 'add_name' | 'add_password' | 'password' | 'edit_name'
//     | 'edit_desc' | 'edit_password' | 'edit_source' | 'announce'
export const states = table('states', {
  userId:    integer('user_id').primaryKey(),
  mode:      text('mode').notNull().default('idle'),
  data:      json('data'),
  updatedAt: integer('updated_at').notNull(),
});
