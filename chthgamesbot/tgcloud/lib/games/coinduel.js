import { duelGame } from './duel.js';
import { randInt } from '../rng.js';
import { esc } from '../ui.js';
import { tr } from '../i18n.js';

export default duelGame({
  key: 'cd', cmd: 'flipduel', title: '🪙 Coinflip Duel',
  about: 'Bet a friend on one coin flip',
  rules: 'Creator is 👑 heads, challenger is 🦅 tails. One flip, winner takes all.',
  resolve(a, b, lang) {
    const heads = randInt(2) === 1;
    return {
      winner: heads ? 'a' : 'b',
      detail: { heads },
      story: `👑 ${esc(a.name)} ${tr(lang, 'vs')} 🦅 ${esc(b.name)}\n`
        + tr(lang, 'The coin lands… <b>{side}</b>', { side: tr(lang, heads ? '👑 Heads' : '🦅 Tails') }),
    };
  },
});
