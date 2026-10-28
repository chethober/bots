// Every string has all five languages and every key the code asks for exists.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { STRINGS } from '../tgcloud/lib/strings.js';
import { LOCALES } from '../tgcloud/lib/i18n.js';

for (const [key, entry] of Object.entries(STRINGS)) {
  for (const l of LOCALES) assert.ok(entry[l], `strings.${key} is missing ${l}`);
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  for (const l of LOCALES) assert.equal(vars(entry[l]), vars(entry.en), `strings.${key}.${l} has different {placeholders}`);
}

const root = new URL('../tgcloud/', import.meta.url);
const walk = (dir) => readdirSync(new URL(dir, root)).flatMap((f) => {
  const rel = `${dir}/${f}`;
  return statSync(new URL(rel, root)).isDirectory() ? walk(rel) : f.endsWith('.js') ? [rel] : [];
});
const used = new Set();
for (const f of ['lib', 'handlers', 'endpoints'].flatMap(walk)) {
  const src = readFileSync(new URL(f, root), 'utf8');
  for (const m of src.matchAll(/\bt\([^,()]+(?:\([^)]*\))?, '([a-z_]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bt\(locale, [^?,()]*\? '([a-z_]+)' : '([a-z_]+)'/g)) { used.add(m[1]); used.add(m[2]); }
}
for (const d of ['in', 'out', 'both']) used.add(`dir_${d}`);
for (const key of used) assert.ok(STRINGS[key], `t(…, '${key}') has no string`);
console.log(`ok: ${Object.keys(STRINGS).length} strings, ${used.size} used keys exist`);
