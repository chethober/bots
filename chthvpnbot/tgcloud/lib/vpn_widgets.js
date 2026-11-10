// The widgets on three screens (lib/widgets, templates usage / server / members),
// built from what the xtune client already returned for the screen's text. Every
// word comes from texts.js in the viewer's language. No secrets in a payload: the
// subscription link stays in the details message and the buttons.

import { flag } from './sources.js';
import { fit } from './widgets/index.js';

const GiB = 2 ** 30;
const MEMBER_ROWS = 8;
const CONFIG_ROWS = 10;

const rtl = (L) => L.locale === 'fa' || L.locale === 'ar';
// Numbers with units and dates keep their left-to-right order inside right-to-left text:
// an LTR isolate, and left-to-right marks around the separators, without which
// Arabic-Indic digits (bidi class AN) still run right to left ("٥٠ / ٤١").
const ltr = (L, s) => (rtl(L) ? `⁦${s.replace(/[^\d٠-٩۰-۹.]+/g, (m) => `‎${m}‎`)}⁩` : s);
const gb = (L, bytes) => L.num((bytes / GiB).toFixed(bytes < GiB * 10 ? 1 : 0));
const amount = (L, used, quota) => ltr(L, quota > 0 ? `${gb(L, used)} / ${gb(L, quota)} GB` : `${gb(L, used)} GB`);
const traffic = (L, bytes) => ltr(L, bytes >= 1000 * GiB ? `${L.num((bytes / 2 ** 40).toFixed(bytes < 10 * 2 ** 40 ? 1 : 0))} TB` : `${gb(L, bytes)} GB`);
const title = (v) => `${flag(v.country)} ${v.name}`.trim().slice(0, 64);
const percent = (used, quota) => (quota > 0 ? Math.round((used / quota) * 100) : null);

// Writing direction and native digits, when the language has them.
function lang(L) {
  const out = {};
  if (rtl(L)) out.d = 'rtl';
  const g = L.num('0123456789');
  if (g !== '0123456789') out.g = g;
  return out;
}

const date = (L, ts) => ltr(L, L.num(new Date(ts * 1000).toISOString().slice(0, 10)));

// 📂 My VPNs → a VPN. `me`: the member's row from poolInfo ({ status, used, quota, expires });
// `pool`: poolInfo's data (devices = allowed per member).
export function usageWidget(vpn, me, pool, L) {
  const p = percent(me.used, me.quota);
  const data = {
    ...lang(L),
    t: title(vpn),
    s: me.status,
    sl: L.srv.statuses[me.status] ?? me.status,
    u: amount(L, me.used, me.quota),
    ul: L.wg.used,
    p,
    pl: p == null ? L.wg.noLimit : L.wg.pct(L.num(p)),
    x: me.expires > 0 ? me.expires : 0,
    xl: me.expires > 0 ? L.wg.until(date(L, me.expires)) : L.srv.never,
    dl: L.wg.daysLeft,
    tl: L.wg.timeLeft,
    el: L.srv.expired,
    dv: L.wg.devices(pool?.devices > 0 ? L.num(pool.devices) : 0),
  };
  return { kind: 'usage', data: fit(() => data), height: 192 };
}

// 🛠 My servers → a server. `s`: xtune's { op: 'status' } answer.
const STATE = { active: 'a', quiet: 'q', idle: 'i', follower: 'f' };
const ORDER = { q: 0, a: 1, i: 2, f: 3 }; // probably-blocked configs are the last to be cut

export function serverWidget(srv, s, L) {
  const reseller = s.role === 'reseller';
  // "active (26.1.1)" for Xray, "nginx, active" for the subscription server; "?" when unknown
  const up = (str, re) => (!str || str.includes('?') ? null : re.test(str) ? 1 : 0);
  const configs = (s.configs ?? []).map((c) => {
    const st = STATE[c.state] ?? 'i';
    const when = st === 'f' ? c.server ?? '' : (st === 'a' || st === 'q') && c.since ? L.ago(c.since) : '';
    return [String(c.id).slice(0, 32), st, when];
  });
  const kept = (n) => configs.map((c, i) => [c, i]).sort((a, b) => ORDER[a[0][1]] - ORDER[b[0][1]] || a[1] - b[1])
    .slice(0, n).sort((a, b) => a[1] - b[1]).map(([c]) => c);
  const base = {
    ...lang(L),
    t: String((reseller ? `${s.reseller} (${L.srv.reseller})` : s.addr) || srv.name).slice(0, 64),
    v: String(s.version ?? '').slice(0, 16),
    ...(s.ipBlocked && { ib: L.wg.ipBlocked }),
    ...(!reseller && {
      st: [['Xray', up(s.xray, /^active\b/), s.xray ?? ''], [L.srv.subWord, up(s.sub, /\bactive$/), s.sub ?? '']],
      sl: [L.wg.running, L.wg.down, L.unknown],
    }),
    k: [
      [L.wg.users, L.num(s.users ?? 0) + (s.maxUsers ? ` / ${L.num(s.maxUsers)}` : '')],
      [L.wg.active, L.num(s.active ?? 0)],
      [L.wg.online, L.num(s.online ?? 0)],
      [L.wg.traffic, traffic(L, s.traffic ?? 0)],
    ],
    o: s.online ?? 0,
  };
  const data = fit((level) => {
    const n = Math.min(configs.length, CONFIG_ROWS) - level;
    if (n < 0) return null;
    const shown = kept(n);
    const more = configs.length - shown.length;
    return {
      ...base,
      ...(shown.length && { ch: L.wg.configs, c: shown, cl: { a: L.wg.inUse, q: L.wg.blocked, i: L.wg.idle } }),
      ...(more > 0 && { m: L.wg.more(L.num(more)) }),
    };
  });
  if (!data) return null;
  const rows = data.c?.length ?? 0;
  const height = 10 + 24 + (data.ib ? 39 : 0) + (data.st ? 78 : 0) + 56 + (rows ? 30 + rows * 30 : 0) + (data.m ? 20 : 0) + 5;
  return { kind: 'server', data, height: Math.min(600, height) };
}

// 👥 Members of an xtune VPN. `list`: the active members (rows of the members table);
// `usage`: label → poolInfo's member row.
export function membersWidget(vpn, list, usage, L) {
  const rows = list.map((m) => {
    const u = usage.get(m.label);
    if (!u) return { used: -1, row: [m.label, null, '—', '', 0] };
    const exp = !u.expires ? L.srv.never
      : u.expires * 1000 <= Date.now() ? L.srv.expired
        : L.srv.daysLeft(L.num(Math.ceil((u.expires - Date.now() / 1000) / 86400)));
    return {
      used: u.used,
      row: [
        m.label,
        u.quota > 0 ? percent(u.used, u.quota) : -1,
        amount(L, u.used, u.quota),
        exp,
        u.status !== 'active' ? 1 : 0,
      ],
    };
  }).sort((a, b) => b.used - a.used).map((x) => x.row);
  const data = fit((level) => {
    const n = Math.min(rows.length, MEMBER_ROWS) - level;
    if (n < 1) return null;
    const more = rows.length - n;
    return {
      ...lang(L),
      t: L.membersHeader(title(vpn), L.num(list.length)),
      r: rows.slice(0, n),
      il: L.memberInactive,
      ...(more > 0 && { m: L.wg.more(L.num(more)) }),
    };
  });
  if (!data) return null;
  const height = 10 + 24 + data.r.length * 44 + (data.m ? 23 : 0) + 14;
  return { kind: 'members', data, height: Math.min(600, height) };
}
