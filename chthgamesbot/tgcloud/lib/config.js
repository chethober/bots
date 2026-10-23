// Your deployment: the Mini App URL (printed by `npx tgcloud push`) and the bot's username.
export const WEBAPP_URL = 'https://app8798028785.tgcloud.ai/';
export const BOT_USERNAME = 'chthgamesbot';

// BUTTON_SECRET signs lobby buttons so a modified client can't forge who created a game or
// its stake; ADMIN_IDS may use /admin. Both live in the git-ignored secrets.js.
export { BUTTON_SECRET, ADMIN_IDS } from './secrets.js';

// Play-money economy. Chips can be earned (start + daily bonus) but never transferred.
export const START_CHIPS = 1000;
export const DAILY_CHIPS = 500;
export const DAILY_COOLDOWN = 20 * 3600; // seconds
export const BETS = [10, 50, 100, 500];
export const MAX_BET = 5000;

// Public source code for this bot (shown on /start and /games).
export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chthgamesbot';
