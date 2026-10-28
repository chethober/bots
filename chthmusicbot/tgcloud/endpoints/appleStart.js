// endpoints/appleStart — the developer token MusicKit JS needs, and a login
// state for the send-it-to-the-bot fallback.

import { appleStart } from '../lib/login.js';
import { caller, guarded } from '../lib/miniapp.js';

export default async function (input, ctx) {
  const user = caller(ctx);
  return guarded(() => appleStart(user.id));
}
