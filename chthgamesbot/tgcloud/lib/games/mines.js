import { soloGame } from './solo.js';
import { GameError, btn, kb, chips } from '../ui.js';
import { shuffle } from '../rng.js';
import { tr } from '../i18n.js';

const N = 25;
export const EDGE = 0.97;

// Fair multiplier for k safe picks with m mines, times the house edge.
export function multiplier(m, k) {
  let x = 1;
  for (let i = 0; i < k; i++) x *= (N - i) / (N - m - i);
  return k === 0 ? 1 : Math.floor(x * EDGE * 100) / 100;
}

function cashout(s) {
  s.phase = 'done';
  s.payout = Math.floor(s.stake * multiplier(s.m, s.open.length));
  return s;
}

export default soloGame({
  key: 'mn', cmd: 'mines', title: '💣 Mines', about: 'Dodge the mines, cash out whenever you like',
  intro: 'A 5×5 field hides mines. Every safe tile raises your multiplier — cash out before you hit one.',
  variants: [['1', '💣 1 mine'], ['3', '💣 3 mines'], ['5', '💣 5 mines'], ['10', '💣 10']],
  deal: ({ owner, bet, variant }) => {
    const m = Number(variant);
    return { owner, bet, stake: bet, variant, m, mines: shuffle([...Array(N).keys()]).slice(0, m), open: [], phase: 'play', payout: 0 };
  },
  view: (s) => (s.phase === 'play' ? { ...s, mines: null, mult: multiplier(s.m, s.open.length), next: multiplier(s.m, s.open.length + 1) } : { ...s, mult: multiplier(s.m, s.open.length) }),
  act(s, [a, cell]) {
    if (a === 'o') {
      if (!s.open.length) throw new GameError('Open at least one tile first.');
      return cashout(s);
    }
    if (a !== 'c') throw new GameError('Unknown action.');
    const i = Number(cell);
    if (!Number.isInteger(i) || i < 0 || i >= N || s.open.includes(i)) throw new GameError('Pick another tile.');
    if (s.mines.includes(i)) {
      s.boom = i;
      s.phase = 'done';
      s.payout = 0;
      return s;
    }
    s.open.push(i);
    if (s.open.length === N - s.m) return cashout(s);
    return s;
  },
  render(s) {
    const done = s.phase === 'done';
    const cur = multiplier(s.m, s.open.length);
    const next = multiplier(s.m, s.open.length + 1);
    const face = (i) => {
      if (i === s.boom) return '💥';
      if (s.open.includes(i)) return '💎';
      if (done && s.mines.includes(i)) return '💣';
      return done ? '▫️' : '🟦';
    };
    const rows = [];
    for (let r = 0; r < 5; r++) {
      rows.push(Array.from({ length: 5 }, (_, c) => {
        const i = r * 5 + c;
        return btn(face(i), done || s.open.includes(i) ? 'mn:n' : `mn:c:${i}`);
      }));
    }
    if (!done && s.open.length) rows.push([btn(tr(s.lang, '💰 Cash out {mult}× ({n})', { mult: cur, n: Math.floor(s.stake * cur) }), 'mn:o')]);
    const text = [
      `<b>${tr(s.lang, '💣 Mines')}</b> · ${tr(s.lang, s.m > 1 ? '{n} mines' : '{n} mine', { n: s.m })} · ${tr(s.lang, 'stake')} ${chips(s.stake)}`,
      done ? '' : tr(s.lang, 'Now: <b>{mult}×</b> · next tile: {next}×', { mult: cur, next }),
    ].join('\n');
    return { text, markup: kb(...rows) };
  },
});
