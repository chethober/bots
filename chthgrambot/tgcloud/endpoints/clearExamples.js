import { requireUser } from '../lib/auth.js';
import { clearExamples } from '../lib/store.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  await clearExamples(user.id);
  return { total: 0 };
}
