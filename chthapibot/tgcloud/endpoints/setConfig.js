// CLI-only bot configuration (the platform has no environment variables):
//   npx tgcloud run endpoints/setConfig '{ tmdb_key: "…", admin_chat_id: "123" }'
//   npx tgcloud run endpoints/setConfig '{ tmdb_key: null }'     (delete)
//   npx tgcloud run endpoints/setConfig '{}'                      (show, secrets masked)
import { db, EndpointError } from 'sdk';
import { config } from '../schema.js';
import { setConfig } from '../lib/store.js';

const KEYS = ['tmdb_key', 'admin_chat_id'];
const mask = (k, v) => (k.endsWith('_key') && v ? `${v.slice(0, 4)}…${v.slice(-2)}` : v);

export default async function (input, ctx) {
  if (ctx?.initData?.user) throw new EndpointError('Not available', { code: 'FORBIDDEN' });
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!KEYS.includes(k)) throw new EndpointError(`Unknown key ${k}. Known: ${KEYS.join(', ')}`, { code: 'BAD_KEY' });
    await setConfig(k, v);
  }
  const rows = await db.select().from(config).all();
  return Object.fromEntries(rows.map((r) => [r.key, mask(r.key, r.value)]));
}
