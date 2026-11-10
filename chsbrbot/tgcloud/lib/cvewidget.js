// Widget payloads (lib/widgets) for private chats: the CVE card (kind `cve`) and
// the 🔥 Trending / 🆕 Latest lists (kind `cvelist`). Each builder returns
// { kind, data, height } or null; the text card stays the fallback and keeps the
// description, links and CISA's required action. Every label comes from
// lib/strings.js, already translated, and `r` marks right-to-left languages.
//
// Signals are { kev: { dateAdded, dueDate } | null, epss: { score, percentile }
// | null, pocAt: unix seconds the bot first saw a public PoC | null }
// (lib/signals.js).

import { t } from './strings.js';
import { fit } from './widgets/index.js';

const RTL = ['fa', 'ar'];

// NVD's severity bands: 0 none, 1 low, 2 medium, 3 high, 4 critical; -1 no score.
const BANDS = ['none', 'low', 'medium', 'high', 'critical'];

export function band(cve) {
  const named = BANDS.indexOf(String(cve.severity ?? '').toLowerCase());
  if (named >= 0) return named;
  const s = cve.score;
  if (s == null) return -1;
  return s >= 9 ? 4 : s >= 7 ? 3 : s >= 4 ? 2 : s > 0 ? 1 : 0;
}

// Each metric's values from least to most dangerous: a value's index is how many
// segments its bar fills (out of the last index), so worse values look heavier.
const IMPACT = { N: 'none', L: 'low', H: 'high' };
const METRICS = {
  AV: ['av', { P: 'physical', L: 'local', A: 'adjacent', N: 'network' }],
  AC: ['ac', { H: 'high', L: 'low' }],
  AT: ['at', { P: 'present', N: 'none' }],
  PR: ['pr', { H: 'high', L: 'low', N: 'none' }],
  UI: ['ui', { R: 'required', N: 'none' }],
  S: ['s', { U: 'unchanged', C: 'changed' }],
  C: ['c', IMPACT],
  I: ['i', IMPACT],
  A: ['a', IMPACT],
};
const V3 = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'];
// CVSS 4.0's eight metrics of the vulnerable system (user interaction: none,
// passive or active).
const V4 = ['AV', 'AC', 'AT', 'PR', 'UI', 'VC', 'VI', 'VA'];
const V4_UI = { A: 'active', P: 'passive', N: 'none' };

// A CVSS 3.x or 4.0 vector → { ver: 'CVSS 3.1', m: [[name, value, filled, of]] },
// or null for other vectors (v2) and incomplete ones.
export function cvssMetrics(vector, locale) {
  const m = /^CVSS:(3\.[01]|4\.0)\/(.+)$/.exec(vector ?? '');
  if (!m) return null;
  const parts = Object.fromEntries(m[2].split('/').map((p) => p.split(':')));
  const v4 = m[1] === '4.0';
  const out = [];
  for (const key of v4 ? V4 : V3) {
    const [name, values] = METRICS[key.replace(/^V(?=[CIA]$)/, '')];
    const scale = v4 && key === 'UI' ? V4_UI : values;
    const order = Object.keys(scale);
    const at = order.indexOf(parts[key]);
    if (at < 0) return null;
    out.push([t(locale, `m_${name}`), t(locale, `v_${scale[parts[key]]}`), at, order.length - 1]);
  }
  return { ver: `CVSS ${m[1]}`, m: out };
}

// Distinct affected products without their versions ("apache/log4j"). Those the
// description names come first, then those NVD lists most versions of: for
// Log4Shell that's log4j itself, not the first of 140 products that bundle it.
export function products(software, description = '') {
  const count = new Map();
  for (const s of software ?? []) {
    const name = String(s).replace(/ \(.*\)$/, '').replace(/ v\S*$/, '').trim();
    if (name) count.set(name, (count.get(name) ?? 0) + 1);
  }
  const about = description.toLowerCase();
  const named = (p) => (about.includes(p.split('/').pop().toLowerCase()) ? 1000 : 0);
  return [...count.keys()].sort((a, b) => named(b) + count.get(b) - named(a) - count.get(a));
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// NVD has no titles: "Code Injection / RCE in log4j", else the bug type, the
// product or the start of the description.
export function cveTitle(cve, locale) {
  const types = cve.bugTypes ?? [];
  const type = types.find((x) => !/^CWE-/.test(x)) ?? types[0];
  const product = products(cve.software, cve.description)[0]?.split('/').pop();
  if (type && product) return t(locale, 'w_title', { type, product });
  return type ?? product ?? cut(cve.description || '—', 60);
}

// Telegram text from strings.js → plain text for a widget.
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();

const day = (iso) => (iso ? String(iso).slice(0, 10) : null);
const dayOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);

// ── the CVE card ────────────────────────────────────────────────────────────

// Payload: { r, g: tag line, i: id, t: title, s: score, b: band, bl: band label,
//   v: 'CVSS 3.1', d: one line of the description, m: [[name, value, filled, of]],
//   e: [probability, percentile] and el: [hint, percentile line],
//   k: [due (unix s, end of the due day UTC) or 0] and kl: [what, due line, '{t} left',
//   past due, day unit], tl: [[0 published | 1 KEV | 2 PoC, label, date]], p: products, pn: how many more, pl: label }
// Heights in px, matching the template's CSS (checked against Chromium).
const H = {
  pad: 24, tag: 24, head: 64, desc: 24, sec: 17, cell: 28, gap: 6, epss: 47, kev: 24, tl: 44, prod: 22,
};

export function cardHeight(d) {
  let h = H.pad + H.head;
  if (d.g) h += H.tag;
  if (d.d) h += H.desc;
  if (d.m) {
    const rows = Math.ceil(d.m.length / 2);
    h += H.sec + rows * H.cell + (rows - 1) * H.gap;
  }
  if (d.e) h += H.sec + H.epss;
  if (d.k) h += H.sec + H.kev;
  if (d.tl) h += H.sec + H.tl;
  if (d.p) h += H.sec + H.prod;
  return Math.min(600, h);
}

// `tag`: a line above the id (an alert's kind, a follow update's news).
export function cveWidget(cve, locale, { kev = null, epss = null, pocAt = null, tag = null } = {}) {
  if (!cve?.id) return null;
  const b = band(cve);
  const cvss = cvssMetrics(cve.vector, locale);
  const prods = products(cve.software, cve.description);
  const events = [
    [0, t(locale, 'lbl_published'), day(cve.published)],
    [1, t(locale, 'w_tl_kev'), day(kev?.dateAdded)],
    [2, t(locale, 'w_tl_poc'), pocAt ? dayOf(pocAt) : null],
  ].filter(([, , date]) => date);
  // Same day for PoC and KEV, or one before publication (a KEV-only record):
  // the timeline keeps them in date order.
  events.sort((x, y) => (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0));
  const due = kev?.dueDate ? Math.floor(Date.parse(`${kev.dueDate}T23:59:59Z`) / 1000) : 0;

  const data = fit((level) => {
    if (level > 7) return null;
    const desc = (cve.description ?? '').replace(/\s+/g, ' ').trim();
    const d = {
      ...(RTL.includes(locale) ? { r: 1 } : {}),
      ...(tag && level < 7 ? { g: cut(tag, 80) } : {}),
      i: cve.id,
      t: cut(cveTitle(cve, locale), level < 5 ? 70 : 40),
      s: cve.score ?? null,
      b,
      bl: b >= 0 ? t(locale, `sev_${BANDS[b]}`) : t(locale, 'no_score'),
      v: cvss?.ver ?? '',
    };
    // (Not when the title already is the start of the description.)
    if (desc && level < 2 && !desc.startsWith(d.t.replace(/…$/, ''))) d.d = cut(desc, level ? 50 : 90);
    if (cvss) d.m = cvss.m;
    if (epss?.score != null) {
      d.e = [Math.round(epss.score * 1e4) / 1e4, epss.percentile ?? null];
      d.el = [t(locale, 'w_epss'), epss.percentile != null ? t(locale, 'w_epss_pct', { n: (epss.percentile * 100).toFixed(epss.percentile >= 0.99 ? 2 : 1) }) : ''];
    }
    if (kev) {
      d.k = [due];
      d.kl = [t(locale, 'w_kev'), kev.dueDate ? cap(t(locale, 'lbl_due', { date: kev.dueDate })) : '', t(locale, 'w_left'), t(locale, 'w_overdue'), t(locale, 'w_day')];
    }
    if (events.length) d.tl = events;
    const max = level < 3 ? 4 : level < 4 ? 2 : 0;
    if (prods.length && max) {
      d.p = prods.slice(0, max).map((p) => cut(p, 32));
      if (prods.length > max) d.pn = prods.length - max;
      d.pl = t(locale, 'lbl_affected');
    }
    return d;
  });
  return data ? { kind: 'cve', data, height: cardHeight(data) } : null;
}

// ── the 🔥 / 🆕 lists ───────────────────────────────────────────────────────

// Payload: { r, t: title, pg: page label, r0: number of the first row,
//   c: [[id, product, score, band, epss (0..1) or null, in KEV 1/0]] }
const L = { pad: 24, title: 28, row: 47 };

export const listHeight = (d) => L.pad + L.title + d.c.length * L.row;

// A short label for a list row: the first product, else the bug type, else the description.
export function shortLabel(cve) {
  const p = products(cve.software, cve.description)[0];
  if (p) return p;
  const type = (cve.bugTypes ?? []).find((x) => !/^CWE-/.test(x)) ?? cve.bugTypes?.[0];
  return type ?? (cve.description || '');
}

// `items` are { cve, kev, epss } in list order; `title` is the list's HTML title.
export function cveListWidget(items, locale, { title, page = 0, first = 1 } = {}) {
  if (!items.length) return null;
  const data = fit((level) => {
    if (level > 3) return null;
    const n = [28, 22, 16, 0][level];
    return {
      ...(RTL.includes(locale) ? { r: 1 } : {}),
      t: cut(plain(title).split(':')[0], 48),
      pg: page > 0 ? t(locale, 'page', { n: page + 1 }) : '',
      r0: first,
      c: items.map(({ cve, kev, epss }) => [
        cve.id,
        n ? cut(shortLabel(cve).replace(/\s+/g, ' '), n) : '',
        cve.score ?? null,
        band(cve),
        epss?.score != null ? Math.round(epss.score * 1e4) / 1e4 : null,
        kev ? 1 : 0,
      ]),
    };
  });
  return data ? { kind: 'cvelist', data, height: listHeight(data) } : null;
}

// A tag line from Telegram HTML strings (an alert's kind, a follow update).
export const tagLine = (...html) => html.map(plain).filter(Boolean).join(' · ');
