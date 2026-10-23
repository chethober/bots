// CLI-only: probes every upstream API from the platform (see lib/health.js).
//   npx tgcloud run endpoints/healthcheck '{}'               → report only
//   npx tgcloud run endpoints/healthcheck '{ notify: true }' → also message the admin chat on failures
import { fetch, EndpointError } from 'sdk';
import { PROBES } from '../lib/health.js';
import { mealIndex, drinkIndex } from '../lib/apis/food.js';
import { teamIndex } from '../lib/apis/espn.js';
import { getConfig } from '../lib/store.js';
import { sendText } from '../lib/telegram.js';
import { esc } from '../lib/format.js';

const dig = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);

async function probe([name, url, path, headers]) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
    const body = await res.text();
    let ok = res.ok;
    if (ok) {
      try { ok = dig(JSON.parse(body), path) != null; } catch { ok = false; }
    }
    return { name, ok, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { name, ok: false, status: 0, ms: Date.now() - t0, error: String(e.message).slice(0, 80) };
  }
}

export default async function (input, ctx) {
  if (ctx?.initData?.user) throw new EndpointError('Not available', { code: 'FORBIDDEN' });
  // All at once (the platform aborts each fetch after ~5 s and limits total run time), then
  // retry failures once: a burst of parallel requests occasionally drops a few.
  const results = await Promise.all(PROBES.map(probe));
  const retry = results.map((r, i) => (r.ok ? null : i)).filter((i) => i != null);
  const again = await Promise.all(retry.map((i) => probe(PROBES[i])));
  retry.forEach((i, j) => { results[i] = again[j]; });
  // Keep the weekly search indexes warm so users never wait for a rebuild.
  const [meals, drinks, teams] = await Promise.all([mealIndex(), drinkIndex(), teamIndex()]);
  results.push({ name: 'Meal index', ok: !!meals?.length, status: meals?.length ?? 0, ms: 0 },
    { name: 'Drink index', ok: !!drinks?.length, status: drinks?.length ?? 0, ms: 0 },
    { name: 'Team index', ok: !!teams?.length, status: teams?.length ?? 0, ms: 0 });
  const failed = results.filter((r) => !r.ok);
  if (input?.notify && failed.length) {
    const admin = await getConfig('admin_chat_id');
    if (admin) {
      await sendText(Number(admin), [`🩺 <b>API healthcheck: ${failed.length}/${results.length} failing</b>`, '',
        ...failed.map((r) => `❌ ${esc(r.name)} — ${r.status || esc(r.error ?? 'error')}`)].join('\n'));
    }
  }
  return { ok: results.length - failed.length, failed: failed.map((r) => `${r.name} (${r.status || r.error})`), results: results.map((r) => `${r.ok ? '✓' : '✗'} ${r.name} ${r.status} ${r.ms}ms`) };
}
