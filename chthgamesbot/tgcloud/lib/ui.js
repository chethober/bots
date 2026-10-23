// Shared formatting and keyboard helpers. Pure — no SDK imports.

import { BUTTON_SECRET, BETS, MAX_BET } from './config.js';

// A refusal shown to the user as an alert. `message` is English with {placeholders}
// (filled from `vars`); it's translated into the presser's language when shown.
export class GameError extends Error {
  constructor(message, vars) {
    super(message);
    this.vars = vars;
  }
}

// After this long without a move, any participant may call a chip game off so an AFK
// player can't lock everyone's stake forever. There are no timers: it's checked on press.
export const IDLE_MS = 10 * 60 * 1000;
export const idle = (s) => Date.now() - (s.touched ?? 0) > IDLE_MS;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function nameOf(user) {
  const n = user.first_name || (user.username ? `@${user.username}` : 'Player');
  return n.length > 24 ? n.slice(0, 23) + '…' : n;
}

export const chips = (n) => `${Number(n).toLocaleString('en-US')} 🪙`;

export const btn = (text, data) => ({ text, callback_data: data });
export const kb = (...rows) => ({ inline_keyboard: rows.filter((r) => r && r.length) });

export function parseBet(s, fallback = 100) {
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, MAX_BET);
}

export function validBet(n) {
  return Number.isInteger(n) && n > 0 && n <= MAX_BET;
}

export { BETS };

// ---- signed lobby buttons ----------------------------------------------------
// Lobby data carries the creator and stake before any server state exists (inline
// messages are posted by the client), so it's HMAC-signed: `<payload>:<sig>`.

let keyPromise;
function key() {
  keyPromise ??= crypto.subtle.importKey(
    'raw', new TextEncoder().encode(BUTTON_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return keyPromise;
}

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
async function sig(payload) {
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await key(), new TextEncoder().encode(payload)));
  let out = '';
  for (let i = 0; i < 7; i++) out += B32[mac[i] & 31];
  return out;
}

export async function signed(payload) {
  return `${payload}:${await sig(payload)}`;
}

// Returns the payload parts (without the signature) if valid, else null.
export async function verify(data) {
  const i = data.lastIndexOf(':');
  if (i < 0) return null;
  const payload = data.slice(0, i);
  return (await sig(payload)) === data.slice(i + 1) ? payload.split(':') : null;
}

// Lobby buttons: `<game>:<act>:<creatorId>:<bet>:<sig>`; the signature covers game,
// creator and bet (not the action, so one lobby's buttons share a signature).
export async function lobbySig(game, creatorId, bet) {
  return sig(`${game}:${creatorId}:${bet}`);
}

export function lobbyBtn(text, game, act, creatorId, bet, s) {
  return btn(text, `${game}:${act}:${creatorId}:${bet}:${s}`);
}

// args = [act, creatorId, bet, sig] → { creatorId, bet } or null if forged.
export async function parseLobby(game, args) {
  const [, c, b, s] = args;
  const creatorId = Number(c);
  const bet = Number(b);
  if (!Number.isSafeInteger(creatorId) || !Number.isInteger(bet) || bet < 0 || bet > MAX_BET) return null;
  return (await lobbySig(game, creatorId, bet)) === s ? { creatorId, bet } : null;
}
