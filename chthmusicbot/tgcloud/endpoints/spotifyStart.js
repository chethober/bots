// endpoints/spotifyStart — begins a Spotify login: stores the PKCE verifier
// and returns the authorize URL. Input: { clientId?, challenge, verifier, redirectUri }.

import { spotifyStart } from '../lib/login.js';
import { caller, guarded } from '../lib/miniapp.js';

export default async function (input, ctx) {
  const user = caller(ctx);
  return guarded(() => spotifyStart(user.id, input));
}
