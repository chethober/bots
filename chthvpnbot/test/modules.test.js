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
  for (const f of files) {
    for (const m of readFileSync(join(root, f), 'utf8').matchAll(/\b(?:L|ML|OL|NL)\.([a-zA-Z]+)/g)) used.add(m[1]);
  }
  for (const loc of LOCALES) {
    const L = texts(loc);
    for (const k of used) assert.ok(L[k] !== undefined, `${loc}: missing ${k}`);
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
