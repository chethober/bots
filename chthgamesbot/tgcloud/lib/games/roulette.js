import { tableGame } from './table.js';
import { randInt } from '../rng.js';

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const BETS_TABLE = {
  r: { label: '🔴 Red',   pays: 2,  hit: (n) => REDS.has(n) },
  b: { label: '⚫ Black', pays: 2,  hit: (n) => n > 0 && !REDS.has(n) },
  e: { label: 'Even',     pays: 2,  hit: (n) => n > 0 && n % 2 === 0 },
  d: { label: 'Odd',      pays: 2,  hit: (n) => n % 2 === 1 },
  l: { label: '1–18',     pays: 2,  hit: (n) => n >= 1 && n <= 18 },
  h: { label: '19–36',    pays: 2,  hit: (n) => n >= 19 },
  z: { label: '🟢 Zero',  pays: 36, hit: (n) => n === 0 },
};

const color = (n) => (n === 0 ? '🟢' : REDS.has(n) ? '🔴' : '⚫');

export default tableGame({
  key: 'rl', cmd: 'roulette', title: '🎡 Roulette',
  about: 'European wheel — red/black, odd/even, or zero for 36×',
  rules: 'European wheel (0–36). Even-money bets pay 2×, 🟢 zero pays 36×.',
  rows: Object.entries(BETS_TABLE).map(([k, v]) => [k, v.label]),
  play(type) {
    const n = randInt(37);
    return { mult: BETS_TABLE[type].hit(n) ? BETS_TABLE[type].pays : 0, show: `${color(n)} ${n}`, detail: { n, red: REDS.has(n) } };
  },
});
