// endpoints/appleFinish — MusicKit JS authorized: save the Music User Token. Input: { token }.

import { appleFinish } from '../lib/login.js';
import { announce, caller, guarded } from '../lib/miniapp.js';

export default async function ({ token }, ctx) {
  const user = caller(ctx);
  const result = await guarded(() => appleFinish(user.id, token));
  await announce(user, result.provider, result.name);
  return result;
}
