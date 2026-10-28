// endpoints/spotifyFinish — callback.html hands over Spotify's code. Input: { state, code }.

import { spotifyFinish } from '../lib/login.js';
import { announce, caller, guarded } from '../lib/miniapp.js';

export default async function ({ state, code }, ctx) {
  const user = caller(ctx);
  const result = await guarded(() => spotifyFinish(user.id, state, code));
  await announce(user, result.provider, result.name);
  return result;
}
