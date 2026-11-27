// Edit these to configure the bot.

// Your bot's username, without the "@". Used to build invite links.
// If left as the placeholder, the bot asks Telegram for its own username instead.
export const BOT_USERNAME = 'chthvpnbot';

// Telegram user ids of the bot's admins. Prefer the shared CHTH list from
// hub_secrets.js (CI writes CHTH_ADMIN_IDS); fall back to the merged defaults.
import { ADMIN_IDS as HUB_ADMINS } from './hub_secrets.js';
export const ADMIN_IDS = Array.isArray(HUB_ADMINS) && HUB_ADMINS.length
  ? HUB_ADMINS
  : [6330862227, 8028710032];

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
