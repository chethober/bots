// Edit these to configure the bot.

// Your bot's username, without the "@". Used to build personal links.
// If left as the placeholder, the bot asks Telegram for its own username instead.
export const BOT_USERNAME = 'chthbrbot';

export const CODE_LENGTH = 8;
// No look-alike characters (0/O, 1/l/I).
export const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Max length of an owner's custom invitation text.
export const PROMPT_MAX = 200;

// An owner's own hidden words (⚙️ Settings → 🔤 Hidden words): how many, how long each.
// A message containing one is dropped silently, like a blocked sender's.
export const WORDS_MAX = 50;
export const WORD_MAX_LEN = 40;

// Message types an owner can accept, in menu order. Labels live in lib/texts.js
// (kinds). Owners toggle these in ⚙️ Settings → 📨 Message types.
export const KINDS = ['text', 'photo', 'video', 'animation', 'video_note', 'voice', 'audio', 'sticker', 'document'];
// Accepted until the owner changes it.
export const DEFAULT_KINDS = ['text', 'photo', 'video', 'animation', 'video_note', 'voice', 'audio', 'sticker'];

// Telegram user ids (numbers) of the bot's admins. Reported messages are copied
// to each of them with Ban / Dismiss buttons, and they get the admin commands
// (/admin, /reports, /bans, /ban, /unban, /broadcast). [] = reports are only
// recorded. An admin must have pressed Start in the bot for anything to reach them.
export const ADMIN_IDS = [6330862227];

// A sender is banned bot-wide automatically once this many different link owners
// have reported them (dismissed reports don't count). Admins get the report with
// an Unban button. 0 = never automatically.
export const AUTO_BAN_REPORTERS = 3;

// A pending send / reply / invitation-text edit is dropped after this long without a message.
export const STATE_TTL_SEC = 30 * 60;

// How long a sender can still edit or unsend a delivered message.
// (Telegram lets bots delete their messages for 48 hours at most.)
export const EDIT_WINDOW_SEC = 60 * 60;
export const UNSEND_WINDOW_SEC = 60 * 60;

// Later items of an album are delivered with the first one only if they arrive
// within this many seconds of it, and at most ALBUM_MAX of them (Telegram's limit).
export const ALBUM_WINDOW_SEC = 120;
export const ALBUM_MAX = 10;

// Seen receipts mark messages up to this old; older ones stay unmarked.
export const SEEN_WINDOW_SEC = 2 * 24 * 60 * 60;

// Records of anonymous messages (and their replies) older than this are deleted,
// unless a report still points at them; so are dismissed reports this old.
// Owners' stats then cover this period. 0 = keep forever.
export const RETENTION_DAYS = 365;

// Public source code for this bot (🔗 Source code button).
export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chthbrbot';
