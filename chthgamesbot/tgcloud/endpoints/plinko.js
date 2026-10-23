// endpoints/plinko.js — one ball. Input { bet, risk: 'low' | 'medium' | 'high' }.

import { EndpointError } from 'sdk';
import { debit, credit } from '../lib/engine.js';
import { caller, stake } from '../lib/mini.js';
import { drop, TABLES } from '../lib/plinko.js';

export default async function (input, ctx) {
  const me = await caller(ctx);
  const bet = stake(input);
  if (!TABLES[input.risk]) throw new EndpointError('Unknown risk level', { code: 'BAD_RISK' });

  let after = await debit(me.id, bet);
  if (!after) throw new EndpointError(`Not enough chips for ${bet}`, { code: 'NO_CHIPS' });
  const { path, slot, mult } = drop(input.risk);
  const payout = Math.floor(bet * mult);
  if (payout > 0) after = await credit(me.id, payout, bet);
  return { path, slot, mult, payout, chips: after.chips };
}
