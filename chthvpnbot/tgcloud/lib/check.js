// Health checks: when a VPN is added, when its owner taps 🔍 Check now, and from
// the tick (endpoints/tick). tgcloud's network is not the members' network, so a
// pass means "the server answers", not "it gets through where you are".

import { db, fetch } from 'sdk';
import { and, lt, ne, asc } from 'sdk/db';
import { vpns } from '../schema.js';
import { CHECK_EVERY_SEC, CHECKS_PER_TICK, FAILS_DOWN } from './config.js';
import { textsOf } from './chats.js';
import { parseSubscription, protocolsOf } from './sources.js';
import { countActive, updateVpn } from './store.js';
import { now, safeApi } from './util.js';
import { poolInfo } from './xtune.js';

// Apps' user agent: panels answer browsers with a web page instead of the list.
const SUB_HEADERS = { 'User-Agent': 'v2rayNG/1.10.0', Accept: '*/*' };

// → { ok: true, fields } with what the check learnt (protocols, slots, limits),
//   or { ok: false, error: 'gone' | 'unreachable' | 'empty' | … }.
export async function probe(kind, source) {
  if (kind === 'xtune') {
    const res = await poolInfo(source);
    if (!res.ok) return res;
    const p = res.data;
    if (!Array.isArray(p.members)) return { ok: false, error: 'unreachable' };
    return {
      ok: true,
      name: p.name,
      fields: {
        protocols: p.protocols ?? [], active: p.active ?? 0, max: p.max ?? 0,
        quotaGb: Math.round(p.quotaGB ?? 0), days: p.days ?? 0,
      },
      pool: p,
    };
  }
  if (kind === 'sub') {
    let res;
    try {
      res = await fetch(source, { headers: SUB_HEADERS }).catch(() => fetch(source, { headers: SUB_HEADERS }));
    } catch {
      return { ok: false, error: 'unreachable' };
    }
    if (!res.ok) return { ok: false, error: res.status === 404 ? 'gone' : 'unreachable' };
    const links = parseSubscription((await res.text()).slice(0, 1 << 20));
    if (!links.length) return { ok: false, error: 'empty' };
    return { ok: true, fields: { protocols: protocolsOf(links.join('\n')) } };
  }
  // Share links can't be checked from here; they are what the owner sent.
  return { ok: true, fields: { protocols: protocolsOf(source) } };
}

// Checks one VPN and records the result; tells the owner when it goes down or comes back.
export async function checkVpn(vpn) {
  const res = await probe(vpn.kind, vpn.source);
  const t = now();
  if (res.ok) {
    const fields = { ...res.fields, fails: 0, status: 'ok', checkedAt: t };
    if (vpn.kind !== 'xtune') fields.active = await countActive(vpn.id);
    await updateVpn(vpn.id, fields);
    if (vpn.status === 'down') await notifyOwner(vpn, (L) => L.vpnBack(vpn));
    return { ...vpn, ...fields };
  }
  const fails = vpn.fails + 1;
  const status = fails >= FAILS_DOWN ? 'down' : vpn.status;
  await updateVpn(vpn.id, { fails, status, checkedAt: t });
  if (status === 'down' && vpn.status !== 'down') await notifyOwner(vpn, (L) => L.vpnDown(vpn, res.error));
  return { ...vpn, fails, status, checkedAt: t, error: res.error };
}

async function notifyOwner(vpn, text) {
  const L = await textsOf(vpn.ownerId);
  await safeApi('sendMessage', {
    chat_id: vpn.ownerId,
    text: text(L),
    reply_markup: { inline_keyboard: [[{ text: L.btnManage, callback_data: `m:${vpn.id}` }]] },
  });
}

// One tick: the VPNs checked longest ago, up to CHECKS_PER_TICK. Share-link VPNs
// only get their member count refreshed.
export async function runChecks() {
  const due = await db.select().from(vpns)
    .where(and(lt(vpns.checkedAt, now() - CHECK_EVERY_SEC), ne(vpns.unlisted, true)))
    .orderBy(asc(vpns.checkedAt)).limit(CHECKS_PER_TICK).all();
  const out = { checked: 0, down: 0 };
  for (const v of due) {
    try {
      const r = await checkVpn(v);
      out.checked++;
      if (r.status === 'down') out.down++;
    } catch (e) {
      console.error(`check ${v.id} failed`, e);
    }
  }
  return out;
}
