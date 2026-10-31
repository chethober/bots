// Copy to tgcloud/lib/hub.secrets.js (git-ignored) to report this bot's events to the CHTH hub. CI writes
// hub.secrets.js from the repository secrets CHTH_HUB_URL and <BOT>_HUB_SECRET. Leave the
// values empty to switch reporting off.
export const HUB_URL = '';     // e.g. https://hub.example.com
export const HUB_SECRET = '';  // this bot's own secret, also set in the hub's SOURCE_SECRETS
export const HUB_SOURCE = 'chthgamesbot';
