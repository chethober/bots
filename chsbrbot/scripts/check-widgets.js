// Checks every widget template against sendWidget's limits:
// html 1–32768 bytes, and at most 4096 bytes zlib-compressed at the maximum level.
//   node scripts/check-widgets.js
import { deflateSync } from 'node:zlib';
import { TEMPLATES } from '../tgcloud/lib/widgets/html.js';

let failed = false;
for (const [kind, html] of Object.entries(TEMPLATES)) {
  const raw = Buffer.byteLength(html);
  const packed = deflateSync(html, { level: 9 }).length;
  const ok = raw <= 32768 && packed <= 4096;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${kind.padEnd(8)} ${String(raw).padStart(6)} B raw  ${String(packed).padStart(5)} / 4096 B compressed`);
}
process.exit(failed ? 1 : 0);
