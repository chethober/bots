// HTML helpers for Telegram's parse_mode: 'HTML'. Everything coming from an
// external API must pass through esc() before it goes into a message.

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function link(url, label) {
  return `<a href="${esc(url).replace(/"/g, '&quot;')}">${esc(label)}</a>`;
}

export function truncate(s, max) {
  s = String(s ?? '');
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

export function usd(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n !== 0 && Math.abs(n) < 1) return '$' + Number(n).toLocaleString('en-US', { maximumSignificantDigits: 4 });
  const digits = n >= 100 ? 0 : 2;
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '🟢 +' : '🔴 '}${n.toFixed(2)}%`;
}

// "3d 4h 12m" until a future Date.
export function countdown(to, from = new Date()) {
  let s = Math.max(0, Math.floor((to - from) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

// "$1.23T", "$845B"
export function usdCompact(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

// "▲ 1.23%" / "▼ 0.50%" — compact change for lists.
export function chg(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '▲' : '▼'} ${Math.abs(n).toFixed(2)}%`;
}

export function num(n, digits = 4) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
}
