// Per-chat alert filters, set in ⚙️ Settings (for a group or channel, by its
// admins from their private chat). Pure — no SDK imports.
//
//   level  'all' (the default: new CVEs above MIN_CVSS and trending ones),
//          'critical' (new CVEs only from CRITICAL_CVSS) or 'exploited'
//          (trending ones only: in KEV or with a public PoC)
//   watch  products, vendors or words; when set, an alert goes out only if
//          the CVE's affected products or description name one of them
//   mode   'instant' (the default: each alert as it happens), or 'daily' /
//          'weekly' for one digest of the alerts that pass (lib/digest.js)

export const LEVELS = ['all', 'critical', 'exploited'];
export const CRITICAL_CVSS = 9.0;
export const MAX_WATCH = 20;
export const MAX_WATCH_LEN = 40;

export const MODES = ['instant', 'daily', 'weekly'];
export const DIGEST_PERIOD_S = { daily: 86400, weekly: 7 * 86400 };

export const modeOf = (chat) => (MODES.includes(chat?.mode) ? chat.mode : 'instant');
export const levelOf = (chat) => (LEVELS.includes(chat?.level) ? chat.level : 'all');
export const watchOf = (chat) => (Array.isArray(chat?.watch) ? chat.watch : []);

// Words separated by commas or new lines → cleaned-up watchlist entries.
export function parseWatch(text) {
  return String(text ?? '').split(/[,،\n]/)
    .map((w) => w.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, MAX_WATCH_LEN))
    .filter((w) => w.length >= 2);
}

// The watchlist with `words` added: no duplicates, at most MAX_WATCH entries.
export function addWatch(list, words) {
  const out = [...list];
  for (const w of words) if (!out.includes(w) && out.length < MAX_WATCH) out.push(w);
  return out;
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Does a watchlist word name this CVE? Matched as a whole word (so "go" doesn't
// match "google") in its affected products — "vendor/product (versions)", with
// CPE underscores already turned into spaces — and its description, which is
// all a CVE has before NVD analyses it.
export function watchMatches(cve, word) {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escRe(word).replace(/[ _]/g, '[ _]')}($|[^\\p{L}\\p{N}])`, 'iu');
  return (cve.software ?? []).some((s) => re.test(s)) || re.test(cve.description ?? '');
}

// Should this chat get this alert? Broadcasts always go out.
export function wantsAlert(chat, kind, cve) {
  if (kind === 'broadcast') return true;
  const level = levelOf(chat);
  if (level === 'exploited' && kind !== 'trending') return false;
  if (level === 'critical' && kind === 'new' && !(cve.score >= CRITICAL_CVSS)) return false;
  const watch = watchOf(chat);
  return !watch.length || watch.some((w) => watchMatches(cve, w));
}
