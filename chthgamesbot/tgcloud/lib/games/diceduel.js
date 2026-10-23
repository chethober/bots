import { duelGame } from './duel.js';
import { randInt } from '../rng.js';
import { esc } from '../ui.js';
import { tr } from '../i18n.js';

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const roll = () => [randInt(6) + 1, randInt(6) + 1];
const show = (r) => `${FACES[r[0] - 1]}${FACES[r[1] - 1]} = <b>${r[0] + r[1]}</b>`;

export default duelGame({
  key: 'dd', cmd: 'diceduel', title: '🎲 Dice Duel',
  about: 'Both roll two dice — higher total wins',
  rules: 'Both roll two dice, higher total wins. Ties re-roll.',
  resolve(a, b, lang) {
    const lines = [];
    const rolls = [];
    for (;;) {
      const ra = roll();
      const rb = roll();
      lines.push(`${esc(a.name)}: ${show(ra)}\n${esc(b.name)}: ${show(rb)}`);
      rolls.push([ra, rb]);
      const sa = ra[0] + ra[1];
      const sb = rb[0] + rb[1];
      if (sa !== sb) return { winner: sa > sb ? 'a' : 'b', story: lines.join(`\n<i>${tr(lang, 'Tie — again!')}</i>\n`), detail: { rolls } };
    }
  },
});
