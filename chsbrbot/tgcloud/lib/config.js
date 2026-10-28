// Bot configuration. API keys live in the git-ignored tgcloud/lib/secrets.js
// (see secrets.example.js in the project root).
export { NVD_API_KEY, GITHUB_TOKEN } from './secrets.js';

export const BOT_USERNAME = 'chsbrbot';

// Telegram user ids that get the admin commands and dashboard.
export const ADMIN_IDS = [8028710032, 6330862227];

// A new CVE is alerted when its CVSS base score is above this.
export const MIN_CVSS = 7.6;

// EPSS probability at or above which a trending CVE lists EPSS as a signal.
export const MIN_EPSS = 0.15;

// CISA KEV entries added within this many days count as trending.
export const KEV_DAYS = 30;

// Public source code for this bot (ℹ️ About).
export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chsbrbot';

export const nvdUrl = (id) => `https://nvd.nist.gov/vuln/detail/${id}`;
export const pocSearchUrl = (id) => `https://github.com/search?q=${encodeURIComponent(id)}+poc&type=repositories`;
export const deepLink = (id) => `https://t.me/${BOT_USERNAME}?start=${id}`;
