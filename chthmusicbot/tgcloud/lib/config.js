// The bot's username (no @), for deep links and the 🤖 More bots list.
export const BOT_USERNAME = 'chthmusicbot';

// Telegram user ids that get the ⭐ tip notices. Prefer the shared CHTH list from
// hub_secrets.js (CI writes CHTH_ADMIN_IDS); fall back to the merged defaults.
import { ADMIN_IDS as HUB_ADMINS } from './hub_secrets.js';
export const ADMIN_IDS = Array.isArray(HUB_ADMINS) && HUB_ADMINS.length
  ? HUB_ADMINS
  : [6330862227, 8028710032];

// The Mini App's address, printed by the first `npx tgcloud push`
// (https://app<app_id>.tgcloud.ai, no trailing slash). Spotify and Apple Music
// logins open there; until it's set only YouTube Music can be connected.
export const MINIAPP_URL = 'https://app9094733003.tgcloud.ai';

// The music bot asked for audio by name over bot-to-bot messages. Turn on
// bot-to-bot communication for this bot in @BotFather. CHETHOBERBOT_ID is
// optional: the id is learned from its first reply or looked up by username.
export const CHETHOBERBOT_USERNAME = 'chethoberbot';
export const CHETHOBERBOT_ID = 0;

// App credentials, from the git-ignored tgcloud/lib/secrets.js (see
// secrets.example.js in the project root). Each one is optional: a service
// without credentials is shown as unavailable.
export {
  SPOTIFY_CLIENT_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APPLE_MUSIC_DEVELOPER_TOKEN, SONGLINK_API_KEY,
} from './secrets.js';

// Reaction on a chat post whose tracks were added to a playlist, and on one
// whose tracks were queued on the group player.
export const ADDED_REACTION = '👌';
export const QUEUED_REACTION = '⚡';

// Most tracks one 🔄 Sync now posts. Telegram lets a bot send about 20
// messages a minute to one group; the rest wait for the next tap.
export const SYNC_BATCH = 20;

// Playlist → chat runs on its own (sync.js autoSync): after any update, at
// most every AUTO_TICK seconds, it checks each synced playlist every
// AUTO_EVERY seconds (YouTube less often: a check costs API quota) and posts
// up to AUTO_BATCH new tracks per playlist, each with its audio, spending at
// most AUTO_TIME seconds (tgcloud stops a handler after about 30).
export const AUTO_TICK = 30;
export const AUTO_EVERY = { default: 120, youtube: 900 };
export const AUTO_BATCH = 5;
export const AUTO_TIME = 12;

// Playlists per page in the playlist picker.
export const PAGE_SIZE = 8;

// Public source code for this bot (ℹ️ About).
export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chthmusicbot';
