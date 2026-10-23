// Edit these to configure the bot.

// Your bot's username, without the "@". Used to build invite links.
// If left as the placeholder, the bot asks Telegram for its own username instead.
export const BOT_USERNAME = 'YOUR_BOT_USERNAME';

// Telegram user ids (numbers) of the bot's admins. Reports reach them with
// Unlist / Delete / Ban owner / Dismiss buttons, and they get /admin and /reports.
// An admin must have pressed Start in the bot for anything to reach them.
export const ADMIN_IDS = [6330862227];

export const CODE_LENGTH = 8;
// No look-alike characters (0/O, 1/l/I).
export const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LABEL_LENGTH = 8;

export const MAX_VPNS_PER_OWNER = 10;
export const NAME_MAX = 40;
export const DESC_MAX = 300;
export const PASSWORD_MAX = 64;

// 5 wrong passwords within LOCK_SEC lock a person out of that VPN until the hour is up.
export const LOCK_TRIES = 5;
export const LOCK_SEC = 60 * 60;

// The tick (endpoints/tick, every 30 minutes from GitHub Actions) checks VPNs not
// checked for this long; after FAILS_DOWN failures in a row a VPN is hidden.
export const CHECK_EVERY_SEC = 25 * 60;
export const FAILS_DOWN = 3;
export const CHECKS_PER_TICK = 40;

export const DIR_PAGE = 8;
export const MEMBERS_PAGE = 10;
export const ANNOUNCE_EVERY_SEC = 10 * 60;

// A pending add / edit / password is dropped after this long without a message.
export const STATE_TTL_SEC = 30 * 60;

// Public source code for this bot (🔗 Source code), and xtune, which it works best with.
export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chthvpnbot';
export const XTUNE_URL = 'https://github.com/chethober/xtune';
