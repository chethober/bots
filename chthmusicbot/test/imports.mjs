// Loads every deployed module, so a wrong import name fails here instead of
// on the platform.
import { readdirSync, statSync } from 'node:fs';
const root = new URL('../tgcloud/', import.meta.url);
const walk = (dir) => readdirSync(new URL(dir, root)).flatMap((f) => {
  const rel = `${dir}/${f}`;
  return statSync(new URL(rel, root)).isDirectory() ? walk(rel) : f.endsWith('.js') ? [rel] : [];
});
const files = ['schema.js', ...['lib', 'handlers', 'endpoints'].flatMap(walk)];
for (const f of files) await import(new URL(f, root));
console.log(`ok: ${files.length} modules load`);
