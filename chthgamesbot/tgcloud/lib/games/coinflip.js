import { tableGame } from './table.js';
import { randInt } from '../rng.js';

export const PAYS = 1.95;

export default tableGame({
  key: 'cf', cmd: 'coinflip', title: '🪙 Coinflip',
  about: 'Heads or tails, pays 1.95×',
  rules: 'Call it — a right call pays 1.95×.',
  rows: [['h', '👑 Heads'], ['t', '🦅 Tails']],
  play(call) {
    const side = randInt(2) ? 'h' : 't';
    return { mult: side === call ? PAYS : 0, show: side === 'h' ? '👑 Heads' : '🦅 Tails', detail: { side } };
  },
});
