// Scheduler entry point (the platform has no cron). GitHub Actions runs
//   npx tgcloud run endpoints/tick '{}'
// every ~10 minutes. Mini App calls always carry verified init data, so
// refusing those keeps the endpoint reachable only through the CLI.
import { EndpointError } from 'sdk';
import { runTick } from '../lib/scheduler.js';

export default async function (input, ctx) {
  if (ctx?.initData) throw new EndpointError('Not available', { code: 'FORBIDDEN' });
  return runTick({ maxSends: Number(input?.maxSends) || 300 });
}
