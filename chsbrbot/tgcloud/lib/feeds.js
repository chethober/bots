// The threat-intelligence feeds behind trending alerts: the CISA Known Exploited
// Vulnerabilities catalog, FIRST EPSS scores and recent GitHub PoC repositories.

import { db, fetch } from 'sdk';
import { sql } from 'sdk/db';
import { kev } from '../schema.js';
import { GITHUB_TOKEN } from './config.js';

const UA = 'chsbrbot/2.0 (Telegram CVE alerts; +https://github.com/chethober/bots)';
const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

// Reload the whole KEV catalog (about 1,500 entries) into the `kev` table.
// Resolves to the number of entries.
export async function loadKev() {
  const res = await fetch(KEV_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CISA KEV ${res.status}`);
  const rows = ((await res.json()).vulnerabilities ?? [])
    .filter((v) => v?.cveID)
    .map((v) => ({
      cveId: v.cveID,
      vendor: v.vendorProject ?? null,
      product: v.product ?? null,
      description: v.shortDescription ?? null,
      requiredAction: v.requiredAction ?? null,
      dueDate: v.dueDate ?? null,
      dateAdded: v.dateAdded ?? null,
      cwes: v.cwes ?? [],
    }));
  const set = {
    vendor: sql.raw('excluded.vendor'),
    product: sql.raw('excluded.product'),
    description: sql.raw('excluded.description'),
    requiredAction: sql.raw('excluded.required_action'),
    dueDate: sql.raw('excluded.due_date'),
    dateAdded: sql.raw('excluded.date_added'),
    cwes: sql.raw('excluded.cwes'),
  };
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(kev).values(rows.slice(i, i + 100)).onConflictDoUpdate({ target: kev.cveId, set }).run();
  }
  return rows.length;
}

// EPSS score and percentile for up to 100 CVE ids, in one request:
// { 'CVE-…': { score, percentile } }. Missing ids are left out.
export async function epssScores(ids) {
  if (!ids.length) return {};
  const res = await fetch(`https://api.first.org/data/v1/epss?cve=${ids.slice(0, 100).join(',')}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`EPSS ${res.status}`);
  const out = {};
  for (const row of (await res.json()).data ?? []) {
    const score = parseFloat(row.epss);
    const percentile = parseFloat(row.percentile);
    if (row.cve && !Number.isNaN(score)) out[row.cve] = { score, percentile: Number.isNaN(percentile) ? null : percentile };
  }
  return out;
}

// Recently updated GitHub repositories that name a CVE and "poc":
// { 'CVE-…': [{ repo, url, stars }] }.
export async function githubPocs(limit = 30) {
  const headers = { 'User-Agent': UA, Accept: 'application/vnd.github+json' };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(
    `https://api.github.com/search/repositories?q=CVE-+poc+in:name,description&sort=updated&order=desc&per_page=${limit}`,
    { headers },
  );
  if (!res.ok) throw new Error(`GitHub search ${res.status}`);
  const out = {};
  for (const repo of (await res.json()).items ?? []) {
    const ids = `${repo.name ?? ''} ${repo.description ?? ''}`.match(/CVE-\d{4}-\d{4,7}/gi) ?? [];
    for (const id of new Set(ids.map((s) => s.toUpperCase()))) {
      (out[id] ??= []).push({ repo: repo.full_name, url: repo.html_url, stars: repo.stargazers_count ?? 0 });
    }
  }
  return out;
}
