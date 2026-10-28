// Small helpers shared by every module.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A random token of `len` URL-safe characters (login states). */
export function randomId(len = 24) {
  let bytes;
  try {
    bytes = crypto.getRandomValues(new Uint8Array(len));
  } catch {
    bytes = Array.from({ length: len }, () => Math.floor(Math.random() * 256));
  }
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const now = () => Math.floor(Date.now() / 1000);

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function formEncode(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/** "Title — Artist", either part optional. */
export const trackLabel = ({ title, artist }) => [title, artist].filter(Boolean).join(' — ');

export const unique = (xs) => [...new Set(xs)];
