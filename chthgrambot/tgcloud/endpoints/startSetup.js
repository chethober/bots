// Panel button: start the in-chat credentials wizard in the user's chat with the bot.
import { EndpointError } from 'sdk';
import { requireUser } from '../lib/auth.js';
import { startSetup as start } from '../lib/setup.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  try {
    await start(user.id, user.id);
  } catch (e) {
    throw new EndpointError('Send /start to the bot first, then try again', { code: 'CHAT_UNAVAILABLE' });
  }
  return { ok: true };
}
