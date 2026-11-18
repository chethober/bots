// Copy to tgcloud/lib/hub_secrets.js (git-ignored) to report this bot's events to the CHTH hub. CI writes
// hub_secrets.js from the repository secrets CHTH_HUB_URL and <BOT>_HUB_SECRET. Leave the
// values empty to switch reporting off.
export const HUB_URL = '';     // e.g. https://hub.example.com
export const HUB_SECRET = '';  // this bot's own secret, also set in the hub's SOURCE_SECRETS
export const HUB_SOURCE = 'chthvpnbot';
// The xtune community directory (github.com/chethober/xtune, community/): its address and the
// Worker's BOT_KEY. CI writes them from XTUNE_DIRECTORY_URL and CHTHVPNBOT_DIRECTORY_KEY. Empty
// switches the sync off.
export const DIRECTORY_URL = '';
export const DIRECTORY_KEY = '';
