// NVD CVE API 2.0: fetching and parsing. Without an API key NVD allows 5
// requests per 30 s, so the scheduler spends them through a budget (see
// scheduler.js); lookups a user asks for go straight through.

import { fetch } from 'sdk';
import { NVD_API_KEY } from './config.js';

const API = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const UA = 'chsbrbot/2.0 (Telegram CVE alerts; +https://github.com/chethober/bots)';

// Common CWE ids → a readable bug type.
export const CWE_NAMES = {
  'CWE-20': 'Improper Input Validation',
  'CWE-22': 'Path Traversal',
  'CWE-74': 'Injection',
  'CWE-77': 'Command Injection',
  'CWE-78': 'OS Command Injection',
  'CWE-79': 'Cross-Site Scripting (XSS)',
  'CWE-89': 'SQL Injection (SQLi)',
  'CWE-94': 'Code Injection / RCE',
  'CWE-119': 'Buffer Overflow / Memory Corruption',
  'CWE-120': 'Classic Buffer Overflow',
  'CWE-125': 'Out-of-bounds Read',
  'CWE-190': 'Integer Overflow / Underflow',
  'CWE-200': 'Exposure of Sensitive Information',
  'CWE-269': 'Improper Privilege Management',
  'CWE-287': 'Improper Authentication / Auth Bypass',
  'CWE-295': 'Improper Certificate Validation',
  'CWE-306': 'Missing Authentication for Critical Function',
  'CWE-352': 'Cross-Site Request Forgery (CSRF)',
  'CWE-400': 'Uncontrolled Resource Consumption (DoS)',
  'CWE-416': 'Use After Free (UAF)',
  'CWE-434': 'Unrestricted File Upload',
  'CWE-476': 'NULL Pointer Dereference',
  'CWE-502': 'Deserialization of Untrusted Data',
  'CWE-601': 'Open Redirect',
  'CWE-611': 'XML External Entity (XXE)',
  'CWE-639': 'Insecure Direct Object Reference (IDOR)',
  'CWE-770': 'Allocation of Resources Without Limits (DoS)',
  'CWE-787': 'Out-of-bounds Write',
  'CWE-862': 'Missing Authorization',
  'CWE-863': 'Incorrect Authorization',
  'CWE-918': 'Server-Side Request Forgery (SSRF)',
  'CWE-1236': 'CSV / Formula Injection',
};

export const bugType = (cwe) => CWE_NAMES[cwe] ?? cwe;

export function normalizeId(s) {
  const m = /(?:CVE-)?(\d{4}-\d{4,7})/i.exec(String(s ?? ''));
  return m ? `CVE-${m[1]}` : null;
}

// CWE ids of a CVE's weaknesses (NVD's "noinfo"/"Other" placeholders dropped).
function cwesOf(cve) {
  const out = [];
  for (const w of cve.weaknesses ?? []) {
    for (const d of w.description ?? []) {
      const v = d.lang === 'en' ? d.value?.trim() : null;
      if (v && v.startsWith('CWE-') && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

// "vendor/product v1.2" or "vendor/product (>=1.0, <1.4)" from the CPE matches.
// Hardware entries (part "h") are left out: they are the platforms vulnerable
// firmware runs on, not affected products themselves.
function softwareOf(cve) {
  const out = new Set();
  for (const config of cve.configurations ?? []) {
    for (const node of config.nodes ?? []) {
      for (const m of node.cpeMatch ?? []) {
        const p = (m.criteria ?? '').split(':'); // cpe:2.3:part:vendor:product:version:…
        if (p[2] === 'h') continue;
        const real = (v) => (v && v !== '*' && v !== '-' ? v : '');
        const [vendor, product, version] = [real(p[3]), real(p[4]), real(p[5])];
        if (!product) continue;
        let s = vendor ? `${vendor}/${product}` : product;
        if (version) s += ` v${version}`;
        else {
          const bounds = [
            m.versionStartIncluding && `>=${m.versionStartIncluding}`,
            m.versionStartExcluding && `>${m.versionStartExcluding}`,
            m.versionEndIncluding && `<=${m.versionEndIncluding}`,
            m.versionEndExcluding && `<${m.versionEndExcluding}`,
          ].filter(Boolean).join(', ');
          if (bounds) s += ` (${bounds})`;
        }
        out.add(s.replace(/_/g, ' '));
      }
    }
  }
  return [...out];
}

// One NVD `vulnerabilities[]` item → the shape stored in the `cves` table.
export function parseCve(item) {
  const cve = item.cve ?? {};
  const desc = cve.descriptions?.find((d) => d.lang === 'en') ?? cve.descriptions?.[0];
  let score = null;
  let severity = null;
  let vector = '';
  for (const key of ['cvssMetricV40', 'cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2']) {
    const list = cve.metrics?.[key];
    if (!list?.length) continue;
    const metric = list.find((m) => m.type === 'Primary') ?? list[0];
    const data = metric.cvssData ?? {};
    score = typeof data.baseScore === 'number' ? data.baseScore : null;
    severity = (data.baseSeverity ?? metric.baseSeverity ?? '').toUpperCase() || null;
    vector = data.vectorString ?? '';
    break;
  }
  const categories = cwesOf(cve);
  return {
    id: cve.id,
    description: desc?.value ?? '',
    score,
    severity,
    vector,
    pocRefs: (cve.references ?? [])
      .filter((r) => r.tags?.some((t) => t.toLowerCase() === 'exploit'))
      .map((r) => r.url),
    categories,
    bugTypes: categories.map(bugType),
    software: softwareOf(cve),
    published: cve.published ?? null,
  };
}

export class NvdError extends Error {
  constructor(status, body) {
    super(`NVD API ${status}: ${String(body).slice(0, 200)}`);
    this.status = status;
  }
}

// GET the CVE API with `params`; resolves to the parsed JSON body. (The
// runtime has no URLSearchParams.)
export async function nvdGet(params) {
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const headers = { 'User-Agent': UA };
  if (NVD_API_KEY) headers.apiKey = NVD_API_KEY;
  // From tgcloud, a connection to NVD now and then fails after 5 s; a second try
  // goes through. HTTP errors aren't retried.
  const res = await fetch(`${API}?${qs}`, { headers }).catch(() => fetch(`${API}?${qs}`, { headers }));
  if (!res.ok) throw new NvdError(res.status, await res.text());
  return res.json();
}

// NVD timestamps: ISO 8601 without the trailing Z (UTC is implied).
export const nvdTime = (ms) => new Date(ms).toISOString().replace('Z', '');

// CVEs published between two times (ms), one page. Resolves to
// { items, total, startIndex }.
export async function publishedBetween(fromMs, toMs, startIndex = 0, perPage = 200) {
  const data = await nvdGet({
    pubStartDate: nvdTime(fromMs),
    pubEndDate: nvdTime(toMs),
    startIndex,
    resultsPerPage: perPage,
  });
  return { items: (data.vulnerabilities ?? []).map(parseCve), total: data.totalResults ?? 0, startIndex };
}

// One CVE by id, or null when NVD doesn't have it (yet).
export async function lookup(id) {
  const data = await nvdGet({ cveId: id });
  const item = data.vulnerabilities?.[0];
  return item ? parseCve(item) : null;
}

// NVD's keyword search, newest first as NVD returns them.
export async function keywordSearch(q, perPage = 20) {
  const data = await nvdGet({ keywordSearch: q, resultsPerPage: perPage });
  return (data.vulnerabilities ?? []).map(parseCve);
}
