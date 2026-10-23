// One-off switch-over: copy the Worker's subscribers (with their alerts on/off
// and language) from Cloudflare D1 into the tgcloud database.
//
//   node scripts/import-from-d1.mjs              # reads D1 with wrangler (needs `wrangler login`)
//   node scripts/import-from-d1.mjs export.json  # or a saved `wrangler d1 execute --json` output
//
// Run from chsbrbot/ after `npx tgcloud login`, `push` and `migrate`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const QUERY = 'SELECT chat_id, username, first_name, last_name, chat_type, is_active, locale, created_at, updated_at FROM subscribers';

function readD1() {
  const env = { ...process.env };
  for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k];
  return execFileSync('npx', ['wrangler', 'd1', 'execute', 'cve-db', '--remote', '--json', '--command', QUERY], {
    cwd: new URL('../worker/', import.meta.url), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  });
}

const raw = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readD1();
const parsed = JSON.parse(raw);
if (parsed.error) throw new Error(`wrangler: ${parsed.error.text} ${parsed.error.notes?.map((n) => n.text).join(' ') ?? ''}`);
const rows = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((r) => r.results ?? []);
console.log(`${rows.length} subscribers in D1 (${rows.filter((r) => Number(r.is_active) === 1).length} active)`);

for (let i = 0; i < rows.length; i += 100) {
  const batch = JSON.stringify({ subscribers: rows.slice(i, i + 100) });
  const out = execFileSync('npx', ['tgcloud', 'run', 'endpoints/importChats', batch], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  });
  console.log(out.trim());
}
