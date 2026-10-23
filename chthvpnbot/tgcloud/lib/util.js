import { api, BotApiError } from 'sdk';
import { BOT_USERNAME, CODE_ALPHABET, CODE_LENGTH } from './config.js';

export const now = () => Math.floor(Date.now() / 1000);

export function randomBytes(n) {
  const bytes = new Uint8Array(n);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

export function randomString(alphabet = CODE_ALPHABET, n = CODE_LENGTH) {
  let out = '';
  for (const b of randomBytes(n)) out += alphabet[b % alphabet.length];
  return out;
}

// getMe, cached for the life of the isolate.
let me = null;
export async function botUsername() {
  if (BOT_USERNAME && BOT_USERNAME !== 'YOUR_BOT_USERNAME') return BOT_USERNAME;
  if (!me) me = await api.getMe();
  return me.username;
}

export async function inviteLink(code) {
  return `https://t.me/${await botUsername()}?start=${code}`;
}

// Bot API errors that just mean "this person can't be reached right now"
// (403: blocked the bot / deactivated; 400: chat or message not found).
export function isUnreachable(e) {
  return e instanceof BotApiError && (e.code === 403 || e.code === 400);
}

// Calls api[method](params); returns null instead of throwing when the
// recipient is unreachable. Other errors propagate.
export async function safeApi(method, params) {
  try {
    return await api[method](params);
  } catch (e) {
    if (!isUnreachable(e)) throw e;
    console.warn(`${method} failed: ${e.code} ${e.description}`);
    return null;
  }
}
