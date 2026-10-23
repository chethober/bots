// Time-zone math on top of Intl (the runtime has full IANA support, no Temporal).

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const PATTERNS = ['daily', 'weekdays', 'weekends', ...WEEKDAYS];

const fmtCache = new Map();
function partsFormatter(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short',
    }));
  }
  return fmtCache.get(tz);
}

// Canonical IANA name ("europe/berlin" → "Europe/Berlin"), or null if unknown.
export function canonicalTz(tz) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export const isValidTz = (tz) => canonicalTz(tz) != null;

// Wall-clock parts of `date` in `tz`: { y, m, d, h, mi, wd (0=Sun), hhmm, ymd }.
export function localParts(date, tz) {
  const p = Object.fromEntries(partsFormatter(tz).formatToParts(date).map((x) => [x.type, x.value]));
  const out = { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, wd: WEEKDAYS.indexOf(p.weekday.toLowerCase()) };
  out.hhmm = `${p.hour}:${p.minute}`;
  out.ymd = `${p.year}-${p.month}-${p.day}`;
  return out;
}

// Minutes `tz` is ahead of UTC at `date`.
function offsetMinutes(date, tz) {
  const p = localParts(date, tz);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(date / 60000) * 60000) / 60000);
}

// Epoch ms for a wall-clock time in `tz` (DST gaps resolve forward).
export function zonedToUtc(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offsetMinutes(new Date(guess), tz) * 60000;
  const off2 = offsetMinutes(new Date(t), tz);
  if (guess - off2 * 60000 !== t) t = guess - off2 * 60000;
  return t;
}

export function matchesPattern(pattern, wd) {
  if (pattern === 'daily') return true;
  if (pattern === 'weekdays') return wd >= 1 && wd <= 5;
  if (pattern === 'weekends') return wd === 0 || wd === 6;
  return WEEKDAYS[wd] === pattern;
}

// Next instant strictly after `from` when local time is `hhmm` on a day matching `pattern`.
export function nextOccurrence(hhmm, pattern, tz, from = new Date()) {
  const [h, mi] = hhmm.split(':').map(Number);
  const today = localParts(from, tz);
  for (let i = 0; i <= 8; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    if (!matchesPattern(pattern, day.getUTCDay())) continue;
    const t = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, mi, tz);
    if (t > +from) return Math.floor(t / 1000);
  }
  return null;
}

// "08:00", "8:00 weekdays", "18:30 sat", "07:15 daily" → { time, pattern } or null.
export function parseSchedule(s) {
  const m = /^\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*([a-z]+)?\s*$/i.exec(String(s ?? ''));
  if (!m) return null;
  let pattern = (m[3] ?? 'daily').toLowerCase();
  const alias = { everyday: 'daily', weekday: 'weekdays', weekend: 'weekends', monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri', saturday: 'sat', sunday: 'sun' };
  pattern = alias[pattern] ?? pattern;
  if (!PATTERNS.includes(pattern)) return null;
  return { time: `${m[1].padStart(2, '0')}:${m[2]}`, pattern };
}

export function describePattern(pattern) {
  const names = { daily: 'every day', weekdays: 'weekdays', weekends: 'weekends', mon: 'Mondays', tue: 'Tuesdays', wed: 'Wednesdays', thu: 'Thursdays', fri: 'Fridays', sat: 'Saturdays', sun: 'Sundays' };
  return names[pattern] ?? pattern;
}

// "30m", "2h", "1d", "1h30m" → seconds from now; "HH:MM" → next occurrence in `tz`.
export function parseWhen(s, tz, now = new Date()) {
  s = String(s ?? '').trim().toLowerCase();
  if (/^([01]?\d|2[0-3])[:.][0-5]\d$/.test(s)) return nextOccurrence(s.replace('.', ':').padStart(5, '0'), 'daily', tz, now);
  const parts = [...s.matchAll(/(\d+)\s*([dhm])/g)];
  if (!parts.length || parts.map((p) => p[0]).join('') !== s.replace(/\s+/g, '')) return null;
  const secs = parts.reduce((acc, [, n, u]) => acc + +n * { d: 86400, h: 3600, m: 60 }[u], 0);
  if (secs < 60 || secs > 365 * 86400) return null;
  return Math.floor(now / 1000) + secs;
}

// Is local time inside [start, end)? Handles windows that wrap midnight.
export function inWindow(hhmm, start, end) {
  if (!start || !end || start === end) return false;
  return start < end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end;
}

// "Sat 25 Oct, 14:00" in the chat's zone.
export function whenLocal(date, tz) {
  const d = new Date(date);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
  return `${day}, ${localParts(d, tz).hhmm}`;
}

export function tzLabel(tz, date = new Date()) {
  const off = offsetMinutes(date, tz);
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${tz} (UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')})`;
}
