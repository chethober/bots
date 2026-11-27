// Copy to tgcloud/lib/hub_secrets.js (git-ignored) to report this bot's events to the CHTH hub. CI writes
// hub_secrets.js from the repository secrets CHTH_HUB_URL, <BOT>_HUB_SECRET and CHTH_ADMIN_IDS.
// Leave HUB_URL / HUB_SECRET empty to switch reporting off.
export const HUB_URL = '';     // e.g. https://hub.example.com
export const HUB_SECRET = '';  // this bot's own secret, also set in the hub's SOURCE_SECRETS
export const HUB_SOURCE = 'chthapibot';
// Shared CHTH admins (merged across every bot and the hub). Empty → fall back to config.js ADMIN_IDS.
export const ADMIN_IDS = [];
