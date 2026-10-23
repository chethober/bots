// The `cves` table: saving parsed CVEs, lookups that fall back to NVD, and the
// lists the chat shows (search, categories, latest, trending).

import { db } from 'sdk';
import { eq, desc, inArray, or, sql } from 'sdk/db';
import { cves, kev, alerts } from '../schema.js';
import { lookup, keywordSearch, normalizeId, bugType } from './nvd.js';

export async function saveCves(list) {
  const now = Math.floor(Date.now() / 1000);
  const rows = list.filter((c) => c?.id).map((c) => ({ ...c, updatedAt: now }));
  const set = {
    description: sql.raw('excluded.description'),
    score: sql.raw('excluded.score'),
    severity: sql.raw('excluded.severity'),
    vector: sql.raw('excluded.vector'),
    pocRefs: sql.raw('excluded.poc_refs'),
    categories: sql.raw('excluded.categories'),
    bugTypes: sql.raw('excluded.bug_types'),
    software: sql.raw('excluded.software'),
    published: sql.raw('excluded.published'),
    updatedAt: sql.raw('excluded.updated_at'),
  };
  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(cves).values(rows.slice(i, i + 50)).onConflictDoUpdate({ target: cves.id, set }).run();
  }
}

// A CVE from the database, else from NVD (and saved), else null. A CVE NVD
// doesn't have yet but CISA lists comes back built from its KEV entry.
export async function getCve(input) {
  const id = normalizeId(input);
  if (!id) return null;
  const row = await db.select().from(cves).where(eq(cves.id, id)).get();
  if (row) return row;
  const found = await lookup(id).catch((e) => {
    console.warn('NVD lookup failed', id, e.message);
    return null;
  });
  if (found) {
    await saveCves([found]);
    return found;
  }
  const k = await db.select().from(kev).where(eq(kev.cveId, id)).get();
  return k ? fromKev(k) : null;
}

export function fromKev(k) {
  return {
    id: k.cveId,
    description: k.description ?? '',
    score: null,
    severity: null,
    vector: '',
    pocRefs: [],
    categories: k.cwes ?? [],
    bugTypes: (k.cwes ?? []).map(bugType),
    software: [[k.vendor, k.product].filter(Boolean).join(' ')].filter(Boolean),
    published: k.dateAdded ? `${k.dateAdded}T00:00:00.000` : null,
  };
}

// Quick categories: LIKE patterns matched against the description and bug types.
export const CATEGORIES = {
  rce: ['%remote code execution%', '%code injection%', '%command injection%', '%deserialization%'],
  auth: ['%authentication bypass%', '%auth bypass%', '%improper authentication%', '%missing authentication%', '%missing authorization%'],
  web: ['%server-side request forgery%', '%SSRF%', '%cross-site scripting%', '%path traversal%', '%XXE%'],
  sqli: ['%SQL injection%'],
  upload: ['%file upload%', '%arbitrary file write%'],
  memory: ['%buffer overflow%', '%out-of-bounds write%', '%use after free%', '%memory corruption%'],
};

const anyLike = (patterns) => or(...patterns.flatMap((p) => [
  sql`${cves.description} LIKE ${p}`,
  sql`${cves.bugTypes} LIKE ${p}`,
]));

const newestFirst = [desc(cves.published), desc(cves.id)];

// A page of CVEs matching free text (id, description, products, weakness), or a
// category. Page 0 of a text search with no local hits asks NVD's keyword
// search and saves what it finds.
export async function search({ q = '', category = null, limit = 5, offset = 0 }) {
  let where;
  if (category) where = anyLike(CATEGORIES[category] ?? []);
  else {
    const p = `%${q.trim()}%`;
    where = or(
      sql`${cves.id} LIKE ${p}`,
      sql`${cves.description} LIKE ${p}`,
      sql`${cves.software} LIKE ${p}`,
      sql`${cves.bugTypes} LIKE ${p}`,
      sql`${cves.categories} LIKE ${p}`,
    );
  }
  const rows = await db.select().from(cves).where(where).orderBy(...newestFirst).limit(limit).offset(offset).all();
  if (rows.length || category || offset || q.trim().length < 3) return rows;
  const found = await keywordSearch(q.trim()).catch((e) => {
    console.warn('NVD keyword search failed', e.message);
    return [];
  });
  if (!found.length) return [];
  await saveCves(found);
  return db.select().from(cves).where(inArray(cves.id, found.map((c) => c.id)))
    .orderBy(...newestFirst).limit(limit).all();
}

export function latest({ limit = 5, offset = 0 }) {
  return db.select().from(cves).orderBy(...newestFirst).limit(limit).offset(offset).all();
}

// Trending CVEs, most recently alerted first: details from `cves` where known,
// else from the KEV entry.
export async function trending({ limit = 5, offset = 0 }) {
  const ids = (await db.select({ id: alerts.cveId }).from(alerts)
    .where(eq(alerts.kind, 'trending'))
    .orderBy(desc(alerts.id)).limit(limit).offset(offset).all()).map((r) => r.id);
  if (!ids.length) return [];
  const [known, kevRows] = await Promise.all([
    db.select().from(cves).where(inArray(cves.id, ids)).all(),
    db.select().from(kev).where(inArray(kev.cveId, ids)).all(),
  ]);
  const byId = new Map([...kevRows.map((k) => [k.cveId, fromKev(k)]), ...known.map((c) => [c.id, c])]);
  return ids.map((id) => byId.get(id) ?? { id, description: '', bugTypes: [], software: [], pocRefs: [] });
}

export function kevEntry(id) {
  return db.select().from(kev).where(eq(kev.cveId, id)).get();
}
