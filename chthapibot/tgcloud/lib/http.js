// Outbound JSON with a timeout. Every API fetcher goes through getJson so one
// slow upstream can't stall a command or a scheduler tick.
import { fetch } from 'sdk';

const DEFAULT_TIMEOUT_MS = 8000;
// No custom User-Agent: ESPN answers 403 to unknown bot UAs.
const HEADERS = { Accept: 'application/json' };
const RETRY_429_MS = 1200;

export async function getJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers } = {}) {
  const attempt = () => fetch(url, { headers: { ...HEADERS, ...headers } });
  const request = (async () => {
    // One retry for network errors (the platform aborts fetches after ~5 s), 429s and 5xx.
    // The platform has no setTimeout, so the retry is immediate there.
    let res = await attempt().catch(() => null);
    if (!res || res.status === 429 || res.status >= 500) {
      if (res?.status === 429 && typeof setTimeout === 'function') await new Promise((r) => setTimeout(r, RETRY_429_MS));
      res = await attempt();
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${hostOf(url)}`);
    return res.json();
  })();
  if (typeof setTimeout !== 'function') return request;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${hostOf(url)}`)), timeoutMs);
  });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Runs fn and returns its value, or `fallback` (logging the error) if it throws.
export async function safely(fn, fallback = null) {
  try {
    return await fn();
  } catch (e) {
    console.warn(e?.message ?? String(e));
    return fallback;
  }
}

function hostOf(url) {
  return String(url).replace(/^https?:\/\//, '').split('/')[0];
}
