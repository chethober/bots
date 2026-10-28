// endpoints/getState — what the Mini App's login page shows: which services
// the caller has connected and whether the bot has its own Spotify app.

import { SPOTIFY_CLIENT_ID, BOT_USERNAME } from '../lib/config.js';
import { listAccounts } from '../lib/accounts.js';
import { PROVIDERS } from '../lib/providers/index.js';
import { caller } from '../lib/miniapp.js';

export default async function (input, ctx) {
  const user = caller(ctx);
  const accts = Object.fromEntries((await listAccounts(user.id)).map((a) => [a.provider, a]));
  const services = {};
  for (const [id, p] of Object.entries(PROVIDERS)) {
    services[id] = { available: p.available(), connected: Boolean(accts[id]), name: accts[id]?.name ?? null };
  }
  return { bot: BOT_USERNAME, services, spotifyDefaultApp: Boolean(SPOTIFY_CLIENT_ID), language: user.language_code ?? 'en' };
}
