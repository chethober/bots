import { requireUser } from '../lib/auth.js';
import { saveSettings } from '../lib/settings.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  return { settings: await saveSettings(user.id, input.settings) };
}
