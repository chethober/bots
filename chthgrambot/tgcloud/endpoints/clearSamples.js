import { requireUser } from '../lib/auth.js';
import { clearSamples } from '../lib/store.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  await clearSamples(user.id);
  return { total: 0 };
}
