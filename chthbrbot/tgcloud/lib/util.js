import { api, BotApiError } from 'sdk';
import { BOT_USERNAME, CODE_ALPHABET, CODE_LENGTH } from './config.js';

export const now = () => Math.floor(Date.now() / 1000);

export function randomCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

// getMe, cached for the life of the isolate.
let me = null;
export async function botInfo() {
  if (!me) me = await api.getMe();
  return me;
}

export async function botUsername() {
  if (BOT_USERNAME && BOT_USERNAME !== 'YOUR_BOT_USERNAME') return BOT_USERNAME;
  return (await botInfo()).username;
}

// Inline mode is switched on in BotFather (/setinline); until then a
// switch_inline_query button would make the whole message fail.
export async function supportsInline() {
  return (await botInfo()).supports_inline_queries === true;
}

export async function personalLink(code) {
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
