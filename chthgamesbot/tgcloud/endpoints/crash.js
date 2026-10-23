// endpoints/crash.js — Crash rounds. Input { op: 'start', bet, auto? } | { op: 'status' } | { op: 'cashout' }.
// One round per player, stored as session `crash:<user id>`. All timing uses the server clock.

import { EndpointError } from 'sdk';
import { loadSession, createSession, mutate, debit, credit, refund, getPlayer } from '../lib/engine.js';
import { evaluate, publicView, multAt } from '../lib/crash.js';
import { caller, stake } from '../lib/mini.js';
import { GameError } from '../lib/ui.js';
import { crashPoint } from '../lib/crash.js';

export default async function (input, ctx) {
  const me = await caller(ctx);
  const key = `crash:${me.id}`;
  try {
    if (input.op === 'start') return await start(key, me, input);
    if (input.op === 'cashout') return await cashout(key, me);
    return await status(key, me);
  } catch (e) {
    if (e instanceof GameError) throw new EndpointError(e.message, { code: 'GAME' });
    throw e;
  }
}

// Applies a state change and pays out if (and only if) this call finished the round.
async function step(key, fn) {
  const { state, prev } = await mutate(key, fn);
  if (state.phase === 'done' && prev.phase === 'play' && state.payout > 0) {
    await credit(state.owner, state.payout, state.bet);
  }
  return state;
}

async function result(key, me) {
  const row = await loadSession(key);
  const now = Date.now();
  if (row?.state.phase === 'play' && evaluate(JSON.parse(JSON.stringify(row.state)), now)) {
    await step(key, (s) => (evaluate(s, Date.now()), s));
    return result(key, me);
  }
  const p = await getPlayer(me.id);
  return { round: row ? publicView(row.state, now) : null, chips: p.chips };
}

const status = (key, me) => result(key, me);

async function start(key, me, input) {
  const bet = stake(input);
  const auto = input.auto == null || input.auto === '' ? null : Math.floor(Number(input.auto) * 100) / 100;
  if (auto != null && !(auto >= 1.01 && auto <= 100)) throw new GameError('Auto cash-out must be 1.01–100×');

  // Settle any finished round first so it doesn't block this one.
  const cur = await result(key, me);
  if (cur.round?.phase === 'play') throw new GameError('A round is already running');

  if (!(await debit(me.id, bet))) throw new GameError(`Not enough chips for ${bet}`);
  const fresh = { owner: me.id, bet, auto, point: crashPoint(), start: Date.now(), phase: 'play', payout: 0, cashed: null };
  try {
    if (!(await createSession(key, 'crash', fresh))) {
      await mutate(key, (s) => {
        if (s.phase === 'play') throw new GameError('A round is already running');
        return { ...fresh, start: Date.now() };
      });
    }
  } catch (e) {
    await refund(me.id, bet);
    throw e;
  }
  return result(key, me);
}

async function cashout(key, me) {
  await step(key, (s) => {
    if (s.phase !== 'play') throw new GameError('No round running');
    const now = Date.now();
    if (evaluate(s, now)) return s; // busted (or auto-cashed) before this request arrived
    const m = multAt(now - s.start);
    s.phase = 'done';
    s.cashed = m;
    s.payout = Math.floor(s.bet * m);
    return s;
  });
  return result(key, me);
}
