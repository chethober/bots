// Per-chat alert filters (lib/filters.js) against real NVD records.
//   node --import ./test/register.mjs test/filters.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCve } from '../tgcloud/lib/nvd.js';
import { wantsAlert, watchMatches, parseWatch, addWatch, MAX_WATCH } from '../tgcloud/lib/filters.js';

const fixture = (id) => JSON.parse(readFileSync(new URL(`./fixtures/nvd-${id}.json`, import.meta.url))).vulnerabilities[0];
const xz = parseCve(fixture('CVE-2024-3094'));
const log4j = parseCve(fixture('CVE-2021-44228'));
const high = { id: 'CVE-2026-0002', score: 8.1, description: 'An SSRF in Acme Gateway lets attackers reach internal hosts.', software: [] };

// Parsing what people type.
assert.deepEqual(parseWatch(' Nginx,  Linux   Kernel\nFortinet ,x,'), ['nginx', 'linux kernel', 'fortinet']);
assert.deepEqual(parseWatch('آپاچی، ویندوز'), ['آپاچی', 'ویندوز']);
assert.equal(parseWatch('a'.repeat(100))[0].length, 40);
assert.deepEqual(addWatch(['nginx'], ['nginx', 'xz']), ['nginx', 'xz']);
assert.equal(addWatch([], Array.from({ length: 30 }, (_, i) => `w${i}`)).length, MAX_WATCH);

// Matching: products (CPE underscores became spaces) and the description, whole words only.
assert.ok(watchMatches(log4j, 'log4j'));
assert.ok(watchMatches(log4j, 'apache'));
assert.ok(watchMatches(xz, 'xz'));
assert.ok(watchMatches(high, 'acme gateway'), 'description match for CVEs NVD has not analysed');
assert.ok(watchMatches(high, 'ACME'.toLowerCase()));
assert.ok(!watchMatches(high, 'acm'), 'no partial words');
assert.ok(!watchMatches(log4j, 'nginx'));
assert.ok(watchMatches({ software: ['linux/linux kernel (<6.1)'], description: '' }, 'linux kernel'));
assert.ok(watchMatches({ software: [], description: 'Fixed in node.js 20.1' }, 'node.js'), 'regex characters are literal');
assert.ok(!watchMatches({ software: [], description: 'Fixed in nodeXjs' }, 'node.js'));

// Levels and the watchlist together.
const chat = (level, watch) => ({ level, watch });
assert.ok(wantsAlert({}, 'new', high), 'no filters: everything');
assert.ok(wantsAlert(chat(null, null), 'new', high));
assert.ok(wantsAlert(chat('bogus', []), 'new', high), 'unknown level counts as all');
assert.ok(!wantsAlert(chat('critical', []), 'new', high));
assert.ok(wantsAlert(chat('critical', []), 'new', xz));
assert.ok(wantsAlert(chat('critical', []), 'trending', { ...high, score: null }), 'trending passes the critical level');
assert.ok(!wantsAlert(chat('exploited', []), 'new', xz));
assert.ok(wantsAlert(chat('exploited', []), 'trending', log4j));
assert.ok(!wantsAlert(chat('all', ['nginx']), 'new', xz));
assert.ok(wantsAlert(chat('all', ['nginx', 'xz']), 'new', xz));
assert.ok(!wantsAlert(chat('critical', ['acme']), 'new', high), 'both filters apply');
assert.ok(wantsAlert(chat('exploited', ['nginx']), 'broadcast', null), 'broadcasts ignore filters');

console.log('ok: alert filters');
