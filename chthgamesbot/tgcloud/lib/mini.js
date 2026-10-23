// Helpers shared by Mini App endpoints.

import { EndpointError } from 'sdk';
import { ensurePlayer } from './engine.js';
import { BETS, MAX_BET } from './config.js';

export async function caller(ctx) {
  const me = await ensurePlayer(ctx.initData.user);
  if (me.banned) throw new EndpointError('You are banned from playing.', { code: 'BANNED' });
  return me;
}

export function stake(input) {
  const bet = Number(input.bet);
  if (!Number.isInteger(bet) || bet < 1 || bet > MAX_BET) throw new EndpointError(`Stake must be 1–${MAX_BET}`, { code: 'BAD_BET' });
  return bet;
}

export { BETS };
