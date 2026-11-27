// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Shared helpers for hub admin handlers (lib/hub_admin.js). Synced from the CHTH kit —
// edit hub/kit/templates/bots/hub_admin_kit.js, not this copy.
//
// Bots import { makeClaim, numericOnly, standard } and pass their own metrics/health/extra.

import { lt } from 'sdk/db';

const CLAIM_KEEP_SEC = 600;

/** Returns a claim(id) that is true the first time that command id is seen. */
export function makeClaim(db, hubCommands) {
  return async function claim(id) {
    const at = Math.floor(Date.now() / 1000);
    await db.delete(hubCommands).where(lt(hubCommands.at, at - CLAIM_KEEP_SEC));
    const [row] = await db.insert(hubCommands).values({ id, at }).onConflictDoNothing().returning();
    return Boolean(row);
  };
}

/** Keeps only finite numbers (and one level of nested numeric maps). Privacy guard for metrics. */
export function numericOnly(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > 1) return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v) && depth === 0) {
      const nested = numericOnly(v, 1);
      if (Object.keys(nested).length) out[k] = nested;
    }
  }
  return out;
}

/**
 * Standard hub commands every bot answers.
 * `extra` handlers override standards of the same name (e.g. a richer `stats`).
 * @param {{ name: string, version: string, kitVersion?: string, metrics: () => Promise<object>, health?: () => Promise<object|string>, extra?: object, actions?: {cmd:string,label:string,ask?:string,confirm?:boolean,readOnly?:boolean}[] }} cfg
 */
export function standard(cfg) {
  const actions = [
    { cmd: 'ping', label: '🏓 Ping', readOnly: true },
    { cmd: 'version', label: '🏷 Version', readOnly: true },
    { cmd: 'health', label: '🩺 Health', readOnly: true },
    { cmd: 'stats', label: '📊 Stats', readOnly: true },
    { cmd: 'metrics', label: '📈 Metrics', readOnly: true },
    { cmd: 'manifest', label: '📋 Manifest', readOnly: true },
    ...(cfg.actions ?? []),
  ];
  const base = {
    async version() {
      return {
        text: [
          `<b>${cfg.name}</b>`,
          `Version <code>${cfg.version}</code>`,
          cfg.kitVersion ? `Kit <code>${cfg.kitVersion}</code>` : null,
        ].filter(Boolean).join('\n'),
        html: true,
      };
    },
    async health() {
      const h = cfg.health ? await cfg.health() : { ok: 1 };
      if (typeof h === 'string') return { text: h, html: true };
      const lines = Object.entries(numericOnly(h)).map(([k, v]) =>
        typeof v === 'object' ? `${k}: ${Object.entries(v).map(([a, b]) => `${a}=${b}`).join(' · ')}` : `${k}: <b>${v}</b>`);
      return { text: ['<b>🩺 Health</b>', ...lines].join('\n') || 'ok', html: true };
    },
    async metrics() {
      const m = numericOnly(await cfg.metrics());
      return { text: JSON.stringify(m), metrics: m };
    },
    async manifest() {
      return { text: `${actions.length} actions`, actions };
    },
    async stats() {
      const m = numericOnly(await cfg.metrics());
      const lines = Object.entries(m).map(([k, v]) =>
        typeof v === 'object' ? `${k}: ${Object.entries(v).map(([a, b]) => `${a} ${b}`).join(' · ')}` : `${k}: <b>${v}</b>`);
      return { text: ['<b>📊 Stats</b>', ...lines].join('\n') || 'No numbers yet.', html: true };
    },
  };
  return { ...base, ...(cfg.extra ?? {}) };
}
