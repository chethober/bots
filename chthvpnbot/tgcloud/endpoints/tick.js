// Health checks (the platform has no cron). GitHub Actions runs
//   npx tgcloud run endpoints/tick '{}'
// every 30 minutes (.github/workflows/chthvpnbot-tick.yml at the repo root).
// Mini App calls always carry verified init data, so refusing those keeps the
// endpoint reachable only through the CLI.
import { EndpointError } from 'sdk';
import { runChecks } from '../lib/check.js';
import { syncDirectory } from '../lib/directory.js';

export default async function (input, ctx) {
  if (ctx?.initData) throw new EndpointError('Not available', { code: 'FORBIDDEN' });
  const checks = await runChecks();
  // the xtune community directory: this bot's public VPNs out, the app's in
  const directory = await syncDirectory().catch((e) => ({ error: String(e?.message ?? e) }));
  return { ...checks, directory };
}
