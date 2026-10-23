// Loads every deployed module, so a wrong import name fails here instead of
// on the platform.
import { readdirSync } from 'node:fs';
const root = new URL('../tgcloud/', import.meta.url);
const files = ['schema.js', ...['lib', 'handlers', 'endpoints'].flatMap((dir) => {
  try { return readdirSync(new URL(dir, root)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`); } catch { return []; }
})];
for (const f of files) await import(new URL(f, root));
console.log(`ok: ${files.length} modules load`);
