import { duelGame } from './duel.js';
import { randInt } from '../rng.js';
import { esc } from '../ui.js';

export default duelGame({
  key: 'cd', cmd: 'flipduel', title: '🪙 Coinflip Duel',
  about: 'Bet a friend on one coin flip',
  rules: 'Creator is 👑 heads, challenger is 🦅 tails. One flip, winner takes all.',
  resolve(a, b) {
    const heads = randInt(2) === 1;
    return {
      winner: heads ? 'a' : 'b',
      detail: { heads },
      story: `👑 ${esc(a.name)} vs 🦅 ${esc(b.name)}\nThe coin lands… <b>${heads ? '👑 Heads' : '🦅 Tails'}</b>`,
    };
  },
});
