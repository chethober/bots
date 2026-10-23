// Health checks (the platform has no cron). GitHub Actions runs
//   npx tgcloud run endpoints/tick '{}'
// every 30 minutes (.github/workflows/chthvpnbot-tick.yml at the repo root).
// Mini App calls always carry verified init data, so refusing those keeps the
// endpoint reachable only through the CLI.
import { EndpointError } from 'sdk';
import { runChecks } from '../lib/check.js';

export default async function (input, ctx) {
  if (ctx?.initData) throw new EndpointError('Not available', { code: 'FORBIDDEN' });
  return runChecks();
}
