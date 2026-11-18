// The xtune community directory's sync: what goes out and what comes in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exported, fromApp, imported } from '../tgcloud/lib/directory.js';

test('a bot VPN as the directory lists it', () => {
  const v = { id: 7, kind: 'xtune', source: 'https://h/p/pub/' + 'a'.repeat(32), name: 'Pool', description: null, country: 'DE',
    protocols: ['VLESS REALITY'], active: 3, max: 50, quotaGb: 20, days: 30, status: 'ok', paused: true, unlisted: false };
  const e = exported(v);
  assert.equal(e.botId, 7);
  assert.equal(e.listed, false, 'paused: in the directory, not listed');
  assert.equal(e.description, '');
});

test('a VPN from the app as the bot keeps it', () => {
  const f = imported({ id: 'k3x9', kind: 'sub', source: 'https://s/x', name: 'x'.repeat(60), quotaGB: 19.6, status: 'down', unlisted: true });
  assert.equal(f.name.length, 40);
  assert.equal(f.quotaGb, 20);
  assert.equal(f.status, 'down');
  assert.equal(f.unlisted, true);
  assert.equal(f.country, null);
  assert.ok(fromApp({ dirId: 'k3x9' }));
  assert.ok(!fromApp({ dirId: null }));
});
