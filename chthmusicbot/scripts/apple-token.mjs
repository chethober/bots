#!/usr/bin/env node
// Makes the Apple Music developer token (an ES256 JWT) for secrets.js.
//
//   node scripts/apple-token.mjs <AuthKey_XXXX.p8> <KEY_ID> <TEAM_ID> [days ≤ 180]
//
// The key comes from developer.apple.com → Certificates, IDs & Profiles → Keys,
// with MusicKit enabled. Paste the printed token into APPLE_MUSIC_DEVELOPER_TOKEN
// and make a new one before it expires.
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';

const [file, kid, iss, days = '180'] = process.argv.slice(2);
if (!file || !kid || !iss) {
  console.error('usage: node scripts/apple-token.mjs <AuthKey.p8> <KEY_ID> <TEAM_ID> [days]');
  process.exit(1);
}
const b64url = (x) => Buffer.from(x).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: 'ES256', kid }));
const payload = b64url(JSON.stringify({ iss, iat: now, exp: now + Math.min(180, Number(days)) * 86400 }));
const key = createPrivateKey(readFileSync(file));
const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
console.log(`${header}.${payload}.${signature}`);
