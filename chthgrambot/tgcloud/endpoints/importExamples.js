// Imports conversation pairs [[theirMessage, myReply, unixTime], ...] parsed from a Telegram chat export.
import { EndpointError } from 'sdk';
import { requireUser } from '../lib/auth.js';
import { addExamples, clearExamples, countExamples } from '../lib/store.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  if (!Array.isArray(input.pairs)) throw new EndpointError('pairs must be an array', { code: 'BAD_INPUT' });
  if (input.pairs.length > 2000) throw new EndpointError('Send at most 2000 pairs per call', { code: 'TOO_MANY' });
  if (input.replace) await clearExamples(user.id);
  const added = await addExamples(user.id, input.pairs, String(input.source ?? 'export').slice(0, 80));
  return { added, total: await countExamples(user.id) };
}
