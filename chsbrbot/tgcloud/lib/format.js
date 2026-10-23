// HTML for CVE cards (a screen in the private chat) and alerts (posted to every
// subscribed chat). Pure — no SDK imports.

import { t } from './strings.js';
import { nvdUrl, pocSearchUrl, deepLink } from './config.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function severityEmoji(severity) {
  return { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }[(severity ?? '').toUpperCase()] ?? '⚪';
}

// "CRITICAL 9.8", or "no score yet".
export function badge(cve, locale) {
  if (cve.score == null) return t(locale, 'no_score');
  return `${cve.severity ?? 'CVSS'} ${cve.score}`;
}

// "2024-03-29 17:15 UTC" from NVD's ISO time.
const when = (iso) => (iso ? `${iso.replace('T', ' ').slice(0, 16)} UTC` : '—');

// Bulleted list: the first `max` items (escaped, in <code>), then "+ n more".
function bullets(items, max, locale, empty = 'lbl_unspecified') {
  if (!items?.length) return `• <i>${t(locale, empty)}</i>`;
  const lines = items.slice(0, max).map((s) => `• <code>${esc(s)}</code>`);
  if (items.length > max) lines.push(`• <i>${t(locale, 'lbl_more', { n: items.length - max })}</i>`);
  return lines.join('\n');
}

function links(urls, max, locale) {
  if (!urls.length) return `• <i>${t(locale, 'lbl_none')}</i>`;
  const lines = urls.slice(0, max).map(({ url, label }) => `• <a href="${esc(url)}">${esc(cut(label ?? url, 70))}</a>`);
  if (urls.length > max) lines.push(`• <i>${t(locale, 'lbl_more', { n: urls.length - max })}</i>`);
  return lines.join('\n');
}

const section = (icon, label, body) => `${icon} <b>${label}</b>\n${body}`;

function shareUrl(cve) {
  const text = `🛡️ ${cve.id} (${cve.severity ?? 'CVE'})${cve.description ? `: ${cut(cve.description, 120)}` : ''}`;
  return `https://t.me/share/url?url=${encodeURIComponent(deepLink(cve.id))}&text=${encodeURIComponent(text)}`;
}

// CISA's required action for a KEV entry, as lines to splice in (none without one).
function kevAction(kev, locale) {
  if (!kev?.requiredAction) return [];
  const due = kev.dueDate ? ` (${t(locale, 'lbl_due', { date: kev.dueDate })})` : '';
  return ['', section('🛡️', t(locale, 'lbl_action'), `${esc(kev.requiredAction)}${due}`)];
}

// The full card for one CVE. `kev` is its KEV entry if any; `back` is the
// callback data of the list it was opened from.
export function cveCard(cve, locale, { kev = null, back = null } = {}) {
  const text = [
    `${severityEmoji(cve.severity)} <b><a href="${nvdUrl(cve.id)}">${cve.id}</a></b> · ${esc(badge(cve, locale))}`,
    `🕒 ${t(locale, 'lbl_published')}: <code>${when(cve.published)}</code>`,
    '',
    section('🐛', t(locale, 'lbl_type'), bullets(cve.bugTypes, 4, locale)),
    '',
    section('📝', t(locale, 'lbl_description'), esc(cut(cve.description || '—', 1500))),
    '',
    section('📦', t(locale, 'lbl_affected'), bullets(cve.software, 6, locale)),
    ...(cve.vector ? ['', section('📊', t(locale, 'lbl_vector'), `<code>${esc(cve.vector)}</code>`)] : []),
    ...(kev ? ['', t(locale, 'sig_kev', { date: kev.dateAdded ?? '—' })] : []),
    ...kevAction(kev, locale),
    '',
    section('⚡', t(locale, 'lbl_exploits'), links((cve.pocRefs ?? []).map((url) => ({ url })), 3, locale)),
  ].join('\n');
  const rows = [
    [{ text: t(locale, 'btn_nvd'), url: nvdUrl(cve.id) }, { text: t(locale, 'btn_pocs'), url: pocSearchUrl(cve.id) }],
    [{ text: t(locale, 'btn_share'), url: shareUrl(cve) }],
  ];
  if (back) rows.push([{ text: t(locale, 'btn_back'), callback_data: back }]);
  return { text, reply_markup: { inline_keyboard: rows } };
}

// An alert. `kind` is 'new' or 'trending'; `signals` (trending only) holds
// { kev, epss: { score, percentile }, pocs: [{ repo, url, stars }] }.
// Its buttons are all links, so they work the same in channels and groups.
export function alertMessage(cve, kind, signals, locale) {
  const s = signals ?? {};
  const head = `${t(locale, kind === 'trending' ? 'alert_trending' : 'alert_new')} ${severityEmoji(cve.severity)}`
    + ` <b><a href="${nvdUrl(cve.id)}">${cve.id}</a></b> · ${esc(badge(cve, locale))}`;

  const why = [];
  if (s.kev) why.push(t(locale, 'sig_kev', { date: s.kev.dateAdded ?? '—' }));
  if (s.epss?.score != null) why.push(t(locale, 'sig_epss', { pct: (s.epss.score * 100).toFixed(1) }));
  for (const p of (s.pocs ?? []).slice(0, 2)) {
    why.push(t(locale, 'sig_poc', { repo: `<a href="${esc(p.url)}">${esc(p.repo)}</a>${p.stars ? ` ⭐${p.stars}` : ''}` }));
  }

  const exploits = [
    ...(s.pocs ?? []).map((p) => ({ url: p.url, label: p.repo })),
    ...(cve.pocRefs ?? []).map((url) => ({ url })),
  ].filter((x, i, all) => all.findIndex((y) => y.url === x.url) === i);

  const text = [
    head,
    ...(why.length ? ['', section('⚡', t(locale, 'lbl_signals'), why.map((l) => `• ${l}`).join('\n'))] : []),
    '',
    section('🐛', t(locale, 'lbl_type'), bullets(cve.bugTypes, 3, locale)),
    '',
    section('📝', t(locale, 'lbl_description'), esc(cut(cve.description || '—', 900))),
    '',
    section('📦', t(locale, 'lbl_affected'), bullets(cve.software, 5, locale)),
    ...kevAction(s.kev, locale),
    '',
    section('💣', t(locale, 'lbl_exploits'), links(exploits, 4, locale)),
  ].join('\n');

  const rows = [
    [{ text: t(locale, 'btn_nvd'), url: nvdUrl(cve.id) }, { text: t(locale, 'btn_pocs'), url: pocSearchUrl(cve.id) }],
    [{ text: t(locale, 'btn_details'), url: deepLink(cve.id) }, { text: t(locale, 'btn_share'), url: shareUrl(cve) }],
  ];
  if (s.kev) rows[0].push({ text: t(locale, 'btn_kev'), url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' });
  return { text, reply_markup: { inline_keyboard: rows } };
}
