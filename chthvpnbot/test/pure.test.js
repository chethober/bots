// The modules without `sdk` imports: password hashing and recognising sources.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { sha256, pbkdf2, hex, utf8, hashPassword, checkPassword } from '../tgcloud/lib/hash.js';
import { detectSource, protocolsOf, parseSubscription, fromBase64, flag, blockedPort } from '../tgcloud/lib/sources.js';

test('sha256 and pbkdf2 match node:crypto', () => {
  for (const s of ['', 'abc', 'x'.repeat(200), 'رمز عبور 🔑']) {
    assert.equal(hex(sha256(utf8(s))), createHash('sha256').update(s).digest('hex'));
  }
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(hex(pbkdf2('pässword', salt, 1000)), pbkdf2Sync('pässword', salt, 1000, 32, 'sha256').toString('hex'));
});

test('passwords', () => {
  const stored = hashPassword('open sesame', new Uint8Array(16).fill(7));
  assert.ok(checkPassword('open sesame', stored));
  assert.ok(!checkPassword('open sesam', stored));
  assert.ok(!checkPassword('x', null));
});

test('detectSource', () => {
  const tok = 'a'.repeat(32);
  assert.deepEqual(detectSource(`https://cdn.example.com/subs/pub/${tok}`).kind, 'xtune');
  assert.equal(detectSource('https://panel.example.com/sub/abc').kind, 'sub');
  const links = 'vless://u@h:443?security=reality#a\n  hysteria2://p@h:443#b';
  assert.deepEqual(detectSource(links), { kind: 'links', source: 'vless://u@h:443?security=reality#a\nhysteria2://p@h:443#b' });
  assert.equal(detectSource('hello').error, 'unknown');
  assert.equal(detectSource(Array(21).fill('ss://x@h:1').join('\n')).error, 'tooMany');
  assert.deepEqual(protocolsOf(links), ['VLESS REALITY', 'Hysteria2']);
});

test('subscriptions', () => {
  const body = Buffer.from('vless://a@h:1#x\nss://b@h:2#y\n').toString('base64');
  assert.deepEqual(parseSubscription(body), ['vless://a@h:1#x', 'ss://b@h:2#y']);
  assert.deepEqual(parseSubscription('trojan://p@h:443'), ['trojan://p@h:443']);
  assert.deepEqual(parseSubscription('<html>nope</html>'), []);
  assert.equal(fromBase64(Buffer.from('سلام').toString('base64')), 'سلام');
  assert.equal(flag('DE'), '🇩🇪');
  assert.equal(flag(null), '🌐');
});

test('ports tgcloud cannot reach', () => {
  const tok = 'b'.repeat(32);
  assert.deepEqual(detectSource(`https://cdn.lebasee.ir:2096/subs/pub/${tok}`), { error: 'port', port: 2096, xtune: true });
  assert.equal(detectSource(`https://cdn.lebasee.ir/subs/pub/${tok}`).kind, 'xtune');
  assert.equal(detectSource(`https://cdn.lebasee.ir:443/subs/pub/${tok}`).kind, 'xtune');
  assert.equal(blockedPort('https://panel.example.com:8443/sub/x'), 8443);
  assert.equal(blockedPort('https://[2001:db8::1]:2053/x'), 2053);
  assert.equal(blockedPort('https://panel.example.com/sub/x'), null);
});
