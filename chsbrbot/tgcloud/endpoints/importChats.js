// endpoints/importChats.js — one-off, for the switch-over from the Cloudflare
// Worker: takes rows of the Worker's D1 `subscribers` table and stores them as
// chats, keeping each one's alerts on/off and language. Run it through
// scripts/import-from-d1.mjs, which reads D1 and calls this in batches.
//
// Only for `tgcloud run`: calls from a Mini App carry initData and are refused.

import { db, EndpointError } from 'sdk';
import { sql } from 'sdk/db';
import { chats } from '../schema.js';
import { LOCALES } from '../lib/i18n.js';

export default async function (input, ctx) {
  if (ctx?.initData) throw new EndpointError('Not available', { code: 'FORBIDDEN' });
  const rows = (input?.subscribers ?? [])
    .filter((s) => /^-?\d+$/.test(String(s.chat_id)))
    .map((s) => ({
      id: Number(s.chat_id),
      type: s.chat_type || 'private',
      title: [s.first_name, s.last_name].filter(Boolean).join(' ') || null,
      username: s.username || null,
      active: Number(s.is_active) === 1,
      locale: LOCALES.includes(s.locale) ? s.locale : null,
      createdAt: Math.floor((Number(s.created_at) || Date.now()) / 1000),
      updatedAt: Math.floor((Number(s.updated_at) || Date.now()) / 1000),
    }));
  if (!rows.length) return { imported: 0 };
  await db.insert(chats).values(rows).onConflictDoUpdate({
    target: chats.id,
    set: {
      type: sql.raw('excluded.type'),
      title: sql.raw('excluded.title'),
      username: sql.raw('excluded.username'),
      active: sql.raw('excluded.active'),
      locale: sql.raw('coalesce(excluded.locale, chats.locale)'),
      updatedAt: sql.raw('excluded.updated_at'),
    },
  }).run();
  return { imported: rows.length, active: rows.filter((r) => r.active).length };
}
