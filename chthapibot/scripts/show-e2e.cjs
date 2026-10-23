// Pretty-prints the output of `npx tgcloud run endpoints/zz_e2e …` (see scripts/e2e.js).
// Usage: node scripts/show-e2e.cjs <output.txt> [full]
const JSON5 = require('json5');
const raw = require('fs').readFileSync(process.argv[2], 'utf8');
const line = raw.split('\n').find((l) => l.startsWith('< '));
if (!line) { console.log(raw.slice(-3000)); process.exit(); }
const data = JSON5.parse(line.slice(2).replace(/\s+\d+ms\s*$/, ''));
const full = process.argv[3] === 'full';
for (const r of data) {
  if (!r.label) { console.log(JSON.stringify(r, null, 1)); continue; }
  console.log(`\n### ${r.label}${r.ERROR ? '  ‼️ ERROR ' + r.ERROR : ''}`);
  for (const c of r.calls) {
    const t = full ? c.text : c.text.replace(/\n/g, ' ⏎ ').slice(0, 160);
    console.log(`  ${c.method}${c.toast ? ' toast=' + c.toast : ''}${c.HTML ? ' ‼️HTML ' + c.HTML : ''}${c.KEYBOARD ? ' ‼️KEYBOARD ' + c.KEYBOARD : ''}${c.EMPTYTEXT ? ' ‼️EMPTYTEXT' : ''}${c.LONGCB ? ' ‼️LONGCB' : ''}${c.img ? ' [img]' : ''}: ${t}`);
    if (c.kb.length) console.log(`     kb: ${c.kb.join(' ')}`.slice(0, 200));
  }
}
