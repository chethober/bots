// The xtune connect link's API (see xtune's public.go): GET <link> for the pool,
// POST <link>/join and <link>/leave with { label }. Fetches that fail on a cold
// connection are tried once more.

import { fetch } from 'sdk';

async function call(url, body) {
  const init = body ? { method: 'POST', body: fetch.body.json(body) } : {};
  let res;
  try {
    res = await fetch(url, init).catch(() => fetch(url, init));
  } catch {
    return { ok: false, error: 'unreachable' };
  }
  let data = null;
  try {
    data = await res.json();
  } catch { /* not JSON: not an xtune server */ }
  if (res.ok && data) return { ok: true, data };
  // 404: no such pool (the link was rotated or the pool deleted); 409: full / paused
  const error = res.status === 404 ? 'gone' : res.status === 409 ? (data?.error ?? 'full')
    : res.status === 429 ? 'busy' : 'unreachable';
  return { ok: false, error };
}

// → { ok, data: { name, paused, active, max, protocols, quotaGB, days, devices, members: [{ label, status, used, quota, expires }] } }
export const poolInfo = (link) => call(link);

// → { ok, data: { label, sub, json, status, quota, expires } } | { ok: false, error: 'full' | 'paused' | 'gone' | 'busy' | 'unreachable' }
export const joinPool = (link, label) => call(`${link}/join`, { label });

export const leavePool = (link, label) => call(`${link}/leave`, { label });
