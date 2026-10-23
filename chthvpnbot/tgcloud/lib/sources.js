// What an owner can add, recognised from what they send: an xtune connect link,
// a subscription URL, or share links. No `sdk` imports, so it can be tested with
// plain node.

// xtune's connect link: https://HOST[:PORT]/<sub path>/pub/<32 hex token>
const XTUNE_RE = /^https:\/\/[^\s/]+\/[^\s/]+\/pub\/[0-9a-f]{32}$/;
const URL_RE = /^https?:\/\/[^\s]+$/;
const SCHEMES = ['vless', 'vmess', 'trojan', 'ss', 'ssr', 'hysteria2', 'hy2', 'hysteria', 'tuic', 'wireguard', 'wg', 'ssh', 'socks', 'http', 'https'];
const LINK_RE = new RegExp(`^(${SCHEMES.filter((s) => !s.startsWith('http')).join('|')})://\\S+$`, 'i');

export const MAX_LINKS = 20;
export const MAX_LINKS_CHARS = 3500; // leaves room for the header in one Telegram message

// tgcloud's fetch only reaches ports 80 and 443 ("fetch: port is not allowed").
export function blockedPort(url) {
  const m = /^(https?):\/\/(?:\[[^\]]+\]|[^/:\s]+):(\d+)(?:\/|$)/.exec(url);
  if (!m) return null;
  return m[2] === '443' || m[2] === '80' ? null : Number(m[2]);
}

// → { kind: 'xtune' | 'sub' | 'links', source } | { error: 'empty' | 'tooMany' | 'tooLong' | 'unknown' | 'port', port }
export function detectSource(text) {
  const t = String(text ?? '').trim();
  if (!t) return { error: 'empty' };
  if (/^https?:\/\/\S+$/.test(t) && blockedPort(t)) return { error: 'port', port: blockedPort(t), xtune: /\/pub\/[0-9a-f]{32}$/.test(t) };
  if (XTUNE_RE.test(t)) return { kind: 'xtune', source: t };
  if (URL_RE.test(t) && !t.includes('\n')) return { kind: 'sub', source: t };
  const lines = t.split(/\s*\n\s*/).filter(Boolean);
  if (!lines.every((l) => LINK_RE.test(l))) return { error: 'unknown' };
  if (lines.length > MAX_LINKS) return { error: 'tooMany' };
  const joined = lines.join('\n');
  if (joined.length > MAX_LINKS_CHARS) return { error: 'tooLong' };
  return { kind: 'links', source: joined };
}

const PROTO_NAMES = {
  vless: 'VLESS', vmess: 'VMess', trojan: 'Trojan', ss: 'Shadowsocks', ssr: 'ShadowsocksR',
  hysteria2: 'Hysteria2', hy2: 'Hysteria2', hysteria: 'Hysteria', tuic: 'TUIC', wireguard: 'WireGuard',
  wg: 'WireGuard', ssh: 'SSH', socks: 'SOCKS', http: 'HTTP', https: 'HTTP',
};

// Protocol names in the order they first appear. VLESS links say whether they are REALITY.
export function protocolsOf(links) {
  const out = [];
  for (const l of String(links).split('\n')) {
    const m = /^([a-z0-9]+):\/\//i.exec(l.trim());
    if (!m) continue;
    let name = PROTO_NAMES[m[1].toLowerCase()];
    if (!name) continue;
    if (name === 'VLESS' && /[?&]security=reality/i.test(l)) name = 'VLESS REALITY';
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// base64 (or base64url) → string; null when it isn't base64. The runtime has no atob.
export function fromBase64(s) {
  const clean = String(s).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (!clean || /[^A-Za-z0-9+/]/.test(clean)) return null;
  const bytes = [];
  let buf = 0, bits = 0;
  for (const ch of clean) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  try {
    return decodeURIComponent(bytes.map((b) => '%' + b.toString(16).padStart(2, '0')).join(''));
  } catch {
    return null;
  }
}

// The share links in a fetched subscription body: base64 (the usual) or plain lines.
export function parseSubscription(body) {
  const text = String(body ?? '').trim();
  const decoded = /:\/\//.test(text) ? text : fromBase64(text);
  if (!decoded) return [];
  return decoded.split(/\r?\n/).map((l) => l.trim()).filter((l) => LINK_RE.test(l));
}

// Country choices when adding a VPN: where community servers usually are. Flags
// are built from the code, so only the codes are kept.
export const COUNTRIES = ['DE', 'NL', 'FI', 'FR', 'GB', 'SE', 'TR', 'AE', 'US', 'CA', 'JP', 'SG', 'AM', 'RU', 'IR', 'PL'];

export function flag(code) {
  if (!/^[A-Z]{2}$/.test(code ?? '')) return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// A member label: the part of the xtune user name the bot picks (NAME-LABEL).
// Random, so it says nothing about who the member is.
export const LABEL_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
