// Every module loads (imports between them line up) and every text key the code
// uses exists in all five languages. Run with the sdk stub: see package.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { texts } from '../tgcloud/lib/texts.js';
import { LOCALES } from '../tgcloud/lib/i18n.js';

const root = new URL('../tgcloud/', import.meta.url).pathname;
const files = ['schema.js', ...['lib', 'handlers', 'endpoints'].flatMap((d) => readdirSync(join(root, d)).map((f) => `${d}/${f}`))];

test('every module loads', async () => {
  for (const f of files) await import(join(root, f));
});

test('every text key exists in every language', () => {
  const used = new Set();
  const usedSrv = new Set();
  for (const f of files) {
    for (const m of readFileSync(join(root, f), 'utf8').matchAll(/\b(?:L|ML|OL|NL)\.([a-zA-Z]+)/g)) used.add(m[1]);
    for (const m of readFileSync(join(root, f), 'utf8').matchAll(/\bL\.srv\.([a-zA-Z]+)/g)) usedSrv.add(m[1]);
  }
  for (const loc of LOCALES) {
    const L = texts(loc);
    for (const k of used) assert.ok(L[k] !== undefined, `${loc}: missing ${k}`);
    for (const k of usedSrv) assert.ok(L.srv[k] !== undefined, `${loc}: missing srv.${k}`);
    for (const k of Object.keys(L.kb)) assert.ok(L.kb[k], `${loc}: kb.${k}`);
  }
});

test('reply keyboard labels are unique across languages per key', () => {
  const seen = new Map();
  for (const loc of LOCALES) {
    for (const [k, label] of Object.entries(texts(loc).kb)) {
      assert.ok(!seen.has(label) || seen.get(label) === k, `${label} means two things`);
      seen.set(label, k);
    }
  }
});

test('composed screens render', () => {
  const v = { id: 1, name: 'Berlin', kind: 'xtune', country: 'DE', active: 3, max: 10, quotaGb: 20, days: 30,
    protocols: ['VLESS REALITY'], status: 'ok', checkedAt: Math.floor(Date.now() / 1000) - 120, public: true, password: 'x' };
  for (const loc of LOCALES) {
    const L = texts(loc);
    for (const s of [L.card(v), L.manage(v, 'https://t.me/x?start=abc'), L.detailsXtune(v, 'https://s', { quota: 2 ** 31, expires: 0 }),
      L.membersList(v, [{ label: 'abcd2345', joinedAt: 0, usage: { used: 2 ** 30, quota: 2 ** 31, expires: 0, status: 'active' } }], 1, 'xtune'),
      L.card({ ...v, kind: 'links', country: null, protocols: [] }), L.joinError('full'), L.sourceFailed('sub', 'empty'),
      L.vpnDown(v, 'gone'), L.dirTitle(12, 1, 2)]) {
      assert.equal(typeof s, 'string');
      assert.ok(!s.includes('undefined'), `${loc}: ${s}`);
    }
  }
});

test('server management texts exist in every language and render', () => {
  const keys = Object.keys(texts('en').srv).sort();
  const s = { role: 'admin', addr: '1.2.3.4', xray: 'active (v26)', sub: 'cdn, active', users: 3, active: 2, online: 1,
    traffic: 2 ** 33, version: 'v0.7.0', plans: ['basic'],
    configs: [{ id: 'r-tcp', state: 'active', since: 1 }, { id: 'hy2', state: 'quiet', since: 1 }, { id: 'ss', state: 'idle' }],
    ipBlocked: 'every direct config is quiet while the CDN carries traffic.', backup: { every: 86400, last: 1, error: 'S3: HTTP 403' },
    workers: [{ host: 'a.workers.dev', requests: 90000 }, { host: 'b.workers.dev', requests: 12 }], workerMax: 100000 };
  const u = { name: 'carol', status: 'active', used: 2 ** 30, quota: 50 * 2 ** 30, expires: Math.floor(Date.now() / 1000) + 86400 * 3,
    devices: 2, online: 1, plan: 'basic', reset: 'monthly', daily: [1, 2], sub: 'https://x/subs/abc' };
  for (const loc of LOCALES) {
    const S = texts(loc).srv;
    assert.deepEqual(Object.keys(S).sort(), keys, `${loc}: srv keys differ`);
    for (const out of [S.status({ name: 'x' }, s), S.status({ name: 'x' }, { ...s, backup: { every: 7 * 86400 }, workerMax: 0 }), S.status({ name: 'x' }, { role: 'reseller', reseller: 'rex', users: 1, maxUsers: 5, assigned: 2 ** 31, quotaGB: 10, traffic: 0 }),
      S.userCard(u), S.usersList({ name: 'x' }, [u], 1, 1, 1), S.plansList([{ name: 'basic', quotaGB: 50, days: 30 }]), S.subCaption(u)]) {
      assert.ok(!out.includes('undefined'), `${loc}: ${out}`);
    }
  }
});

test('the connection guide has every page in every language', async () => {
  const { GUIDE_PAGES, ownApps } = await import('../tgcloud/lib/guide.js');
  const en = texts('en').guide;
  for (const loc of LOCALES) {
    const G = texts(loc).guide;
    assert.deepEqual(Object.keys(G.btns).sort(), Object.keys(en.btns).sort(), `${loc}: guide buttons differ`);
    for (const p of GUIDE_PAGES) {
      assert.equal(G.steps[p]?.length ?? en.pick.length, en.steps[p]?.length ?? en.pick.length, `${loc}: ${p} has another number of steps`);
      assert.ok(G.pages[p] && !G.pages[p].includes('undefined'), `${loc}: page ${p}`);
    }
    assert.equal(G.pick.length, en.pick.length, `${loc}: pick`);
  }
  assert.deepEqual(ownApps({ kind: 'xtune', protocols: ['VLESS REALITY', 'AmneziaWG', 'WireGuard', 'DNS tunnel'] }), ['wg', 'awg', 'dns']);
  assert.deepEqual(ownApps({ kind: 'links', protocols: ['WireGuard'] }), []);
  assert.equal(ownApps(null).length, 6);
});
