// Crash rules, pure. The multiplier grows exponentially from the round's start time;
// the round busts at a hidden crash point. The server clock is the only clock that counts.

import { random } from './rng.js';

export const GROWTH = 0.00007;  // per ms → 2× at ~9.9s, 10× at ~33s
export const EDGE = 0.97;
export const MAX_POINT = 100;

export const multAt = (ms) => Math.floor(Math.exp(GROWTH * Math.max(0, ms)) * 100) / 100;
export const msFor = (mult) => Math.log(mult) / GROWTH;

// P(point >= m) = EDGE / m, so cashing out at any target returns EDGE on average.
export function crashPoint() {
  const p = Math.floor((EDGE / (1 - random())) * 100) / 100;
  return Math.min(Math.max(p, 1), MAX_POINT);
}

// Settles a running round as of `now` (auto cash-out or bust). Returns true if it changed.
export function evaluate(st, now) {
  if (st.phase !== 'play') return false;
  const m = multAt(now - st.start);
  if (st.auto && st.auto < st.point && m >= st.auto) {
    st.phase = 'done';
    st.cashed = st.auto;
    st.payout = Math.floor(st.bet * st.auto);
    return true;
  }
  if (m >= st.point) {
    st.phase = 'done';
    st.cashed = null;
    st.payout = 0;
    return true;
  }
  return false;
}

// What the client may see: the crash point only once the round is over.
export function publicView(st, now) {
  return {
    phase: st.phase,
    bet: st.bet,
    auto: st.auto ?? null,
    elapsed: now - st.start,
    mult: st.phase === 'play' ? multAt(now - st.start) : (st.cashed ?? st.point),
    cashed: st.cashed ?? null,
    point: st.phase === 'done' ? st.point : null,
    payout: st.payout ?? 0,
  };
}
