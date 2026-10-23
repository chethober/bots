// endpoints/wallet.js — balance and stats for the hub header. Input { claim: true } takes the daily bonus.

import { EndpointError } from 'sdk';
import { claimDaily } from '../lib/engine.js';
import { caller } from '../lib/mini.js';
import { DAILY_CHIPS, DAILY_COOLDOWN } from '../lib/config.js';

export default async function (input, ctx) {
  let me = await caller(ctx);
  if (input.claim) {
    const after = await claimDaily(me.id);
    if (!after) throw new EndpointError('Daily bonus not ready yet', { code: 'COOLDOWN' });
    me = after;
  }
  const next = me.lastDaily + DAILY_COOLDOWN;
  return {
    name: me.name,
    chips: me.chips,
    played: me.played,
    wins: me.wins,
    bestWin: me.bestWin,
    daily: DAILY_CHIPS,
    dailyIn: Math.max(0, next - Math.floor(Date.now() / 1000)),
  };
}
