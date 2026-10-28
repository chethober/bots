// Project configuration. Telegram Serverless has no environment variables, so
// non-secret settings live here. Cloudflare credentials are best entered per user
// in the panel (stored in the database); the GLOBAL_* fallback below is optional.

// Mini App URL printed by `npx tgcloud push`, e.g. 'https://app123456.tgcloud.ai/'.
export const PANEL_URL = 'https://app8841725280.tgcloud.ai/';

// Telegram user IDs allowed to use the secretary. Empty array = anyone can connect
// (each user must then enter their own Cloudflare credentials in the panel).
export const ALLOWED_USER_IDS = [];

// Optional shared Cloudflare Workers AI credentials, used only by users listed in
// ALLOWED_USER_IDS who have not entered their own. Leave empty to require
// per-user credentials. Token needs the "Workers AI: Read" permission.
export const GLOBAL_CF_ACCOUNT_ID = '';
export const GLOBAL_CF_API_TOKEN = '';

export function isAllowed(userId) {
  return ALLOWED_USER_IDS.length === 0 || ALLOWED_USER_IDS.includes(userId);
}

// Public source code for this bot (ℹ️ About).
export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chthgrambot';
