// Your deployment: the Mini App URL (printed by `npx tgcloud push`) and the bot's username.
export const WEBAPP_URL = 'https://app8798028785.tgcloud.ai/';
export const BOT_USERNAME = 'chthgamesbot';

// BUTTON_SECRET signs lobby buttons so a modified client can't forge who created a game or
// its stake; ADMIN_IDS may use /admin. Both live in the git-ignored secrets.js.
export { BUTTON_SECRET, ADMIN_IDS } from './secrets.js';

// Play-money economy. Chips are earned (start + daily bonus) or bought with Telegram Stars,
// but never transferred, sold or cashed out — so the bot never owes anyone money.
export const START_CHIPS = 1000;
export const DAILY_CHIPS = 500;
export const DAILY_COOLDOWN = 20 * 3600; // seconds
export const BETS = [10, 50, 100, 500];
export const MAX_BET = 5000;

// 💎 Buy chips: Telegram Stars packs. A pack's index is part of the invoice payload, and the
// payment is checked against this table, so change a pack by appending, not editing in place.
export const PACKS = [
  { stars: 25, chips: 2_500 },
  { stars: 100, chips: 11_000 },
  { stars: 250, chips: 30_000 },
  { stars: 500, chips: 65_000 },
];

// Public source code for this bot (shown on /start and /games).
export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chthgamesbot';
