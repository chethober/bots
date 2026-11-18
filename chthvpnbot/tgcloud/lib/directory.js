// Two-way sync with the xtune community directory (github.com/chethober/xtune, community/): the
// VPNs shared from the xtune app show up in 🌍 Directory, and this bot's public VPNs show up in
// the app. Runs on the tick. The directory checks the app's VPNs itself, so the bot does not
// (they have no owner here: ownerId 0), and it joins members of either kind its own way; the
// xtune server enforces the member cap and limits whoever asks.
//
// DIRECTORY_URL and DIRECTORY_KEY (the Worker's BOT_KEY) come from hub_secrets.js, which CI
// writes from the repository secrets XTUNE_DIRECTORY_URL and CHTHVPNBOT_DIRECTORY_KEY. Empty
// switches the sync off.

import { db, fetch } from 'sdk';
import { vpns } from '../schema.js';
// a namespace import: a hub_secrets.js written before the directory existed has no such exports
import * as secrets from './hub_secrets.js';
import { blockedPort } from './sources.js';
import { createVpn, deleteVpn, updateVpn } from './store.js';

const DIRECTORY_URL = secrets.DIRECTORY_URL ?? '';
const DIRECTORY_KEY = secrets.DIRECTORY_KEY ?? '';

export const fromApp = (v) => !!v?.dirId;
export const directoryOn = () => !!(DIRECTORY_URL && DIRECTORY_KEY);

async function call(method, path, body) {
  const init = { method, headers: { authorization: `Bot ${DIRECTORY_KEY}` } };
  if (body) {
    init.headers['content-type'] = 'application/json';
    init.body = fetch.body.json(body);
  }
  const res = await fetch(DIRECTORY_URL.replace(/\/+$/, '') + path, init);
  if (!res.ok) throw new Error(`directory ${method} ${path}: HTTP ${res.status}`);
  return res.json();
}

// What the directory lists of one of this bot's VPNs.
export function exported(v) {
  return {
    botId: v.id, kind: v.kind, source: v.source, name: v.name, description: v.description ?? '', country: v.country ?? '',
    protocols: v.protocols ?? [], active: v.active, max: v.max, quotaGb: v.quotaGb, days: v.days,
    status: v.status, listed: !v.paused && !v.unlisted,
  };
}

// The fields of a VPN from the app, as this bot keeps them.
export function imported(d) {
  return {
    kind: d.kind, source: d.source, name: String(d.name ?? 'VPN').slice(0, 40), description: d.description || null,
    country: d.country || null, protocols: Array.isArray(d.protocols) ? d.protocols : [], active: d.active ?? 0, max: d.max ?? 0,
    quotaGb: Math.round(d.quotaGB ?? 0), days: d.days ?? 0, status: d.status === 'ok' ? 'ok' : 'down',
    paused: !!d.paused, unlisted: !!d.unlisted, checkedAt: Math.floor(Date.now() / 1000),
  };
}

export async function syncDirectory() {
  if (!directoryOn()) return { off: true };
  const all = await db.select().from(vpns).all();
  // out: this bot's own public VPNs without a password (a private one stays invite-only)
  const mine = all.filter((v) => !fromApp(v) && v.public && !v.password);
  const out = await call('POST', '/v1/bot/import', { all: true, vpns: mine.map(exported) });
  // in: every VPN shared from the app; the ones no longer there go
  const r = await call('GET', '/v1/bot/export?since=0');
  const have = new Map(all.filter(fromApp).map((v) => [v.dirId, v]));
  const seen = new Set();
  let added = 0, updated = 0, removed = 0;
  for (const d of r.vpns ?? []) {
    // tgcloud reaches ports 80 and 443 only: a pool on another port cannot be joined from here
    if (!d?.id || blockedPort(d.source ?? '')) continue;
    seen.add(d.id);
    const old = have.get(d.id);
    if (old) {
      await updateVpn(old.id, imported(d));
      updated++;
    } else {
      await createVpn({ ownerId: 0, public: true, dirId: d.id, ...imported(d) });
      added++;
    }
  }
  for (const [id, v] of have) {
    if (!seen.has(id)) {
      await deleteVpn(v.id);
      removed++;
    }
  }
  return { sent: mine.length, directory: out, added, updated, removed };
}

// A bot admin acted on a report about a VPN shared from the app: the directory follows.
export async function unlistInDirectory(vpn, remove) {
  if (!fromApp(vpn) || !directoryOn()) return;
  try {
    await call('POST', '/v1/bot/unlist', { id: vpn.dirId, delete: !!remove });
  } catch (e) {
    console.error('directory unlist failed', e);
  }
}
