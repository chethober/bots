import { soloGame } from './solo.js';
import { GameError, btn, kb, chips } from '../ui.js';
import { randomCard, rankOf, cardStr } from './cards.js';

export const EDGE = 0.97;
const MAX_MULT = 1000;

// Chance the next card is >= / <= the current one (rank 0..12, infinite deck).
export const pHigh = (r) => (13 - r) / 13;
export const pLow = (r) => (r + 1) / 13;
const step = (p) => EDGE / p;

export default soloGame({
  key: 'hl', cmd: 'hilo', title: '📈 Hi-Lo', about: 'Higher or lower? Build a streak, cash out',
  intro: 'Guess if the next card is higher-or-same or lower-or-same. Riskier calls pay more. Cash out any time.',
  deal: ({ owner, bet }) => ({ owner, bet, stake: bet, card: randomCard(), mult: 1, trail: [], phase: 'play', payout: 0 }),
  view: (s) => {
    const r = rankOf(s.card);
    return { ...s, hi: Math.floor(s.mult * step(pHigh(r)) * 100) / 100, lo: Math.floor(s.mult * step(pLow(r)) * 100) / 100 };
  },
  act(s, [a]) {
    if (a === 'o') {
      if (!s.trail.length) throw new GameError('Make at least one call first.');
      s.phase = 'done';
      s.payout = Math.floor(s.stake * s.mult);
      return s;
    }
    if (a !== 'h' && a !== 'l') throw new GameError('Unknown action.');
    const r = rankOf(s.card);
    const p = a === 'h' ? pHigh(r) : pLow(r);
    const next = randomCard();
    const nr = rankOf(next);
    const ok = a === 'h' ? nr >= r : nr <= r;
    s.trail.push(`${cardStr(s.card)} ${a === 'h' ? '⬆️' : '⬇️'} ${cardStr(next)} ${ok ? '✅' : '❌'}`);
    s.card = next;
    if (!ok) { s.phase = 'done'; s.payout = 0; return s; }
    s.mult = Math.min(Math.floor(s.mult * step(p) * 100) / 100, MAX_MULT);
    if (s.mult >= MAX_MULT) { s.phase = 'done'; s.payout = Math.floor(s.stake * s.mult); }
    return s;
  },
  render(s) {
    const r = rankOf(s.card);
    const text = [
      `<b>📈 Hi-Lo</b> · stake ${chips(s.stake)} · <b>${s.mult}×</b>`,
      '',
      ...s.trail.slice(-6),
      '',
      `Current card: <b>${cardStr(s.card)}</b>`,
    ].join('\n');
    if (s.phase !== 'play') return { text, markup: null };
    const hi = Math.floor(s.mult * step(pHigh(r)) * 100) / 100;
    const lo = Math.floor(s.mult * step(pLow(r)) * 100) / 100;
    const rows = [[btn(`⬆️ Higher/same → ${hi}×`, 'hl:h'), btn(`⬇️ Lower/same → ${lo}×`, 'hl:l')]];
    if (s.trail.length) rows.push([btn(`💰 Cash out ${Math.floor(s.stake * s.mult)}`, 'hl:o')]);
    return { text, markup: kb(...rows) };
  },
});
