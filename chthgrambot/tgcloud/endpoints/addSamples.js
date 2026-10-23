// Paste examples of your own messages; separate messages with a blank line.
import { EndpointError } from 'sdk';
import { requireUser } from '../lib/auth.js';
import { addSamples, countSamples } from '../lib/store.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  const raw = String(input.text ?? '').slice(0, 30000);
  const texts = raw.split(/\n\s*\n/).slice(0, 200);
  const added = await addSamples(user.id, texts, 'manual');
  if (!added) throw new EndpointError('Nothing usable. Separate messages with a blank line; each needs 4–600 characters.', { code: 'EMPTY' });
  return { added, total: await countSamples(user.id) };
}
