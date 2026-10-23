import { tableGame } from './table.js';
import { randInt } from '../rng.js';

export const PAYS = { u: 2.3, s: 5.5, o: 2.3 };
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function outcome(sum) {
  return sum < 7 ? 'u' : sum === 7 ? 's' : 'o';
}

export default tableGame({
  key: 'dc', cmd: 'dice', title: '🎲 Over / Under 7',
  about: 'Two dice: under 7, exactly 7 or over 7',
  rules: 'Two dice. Under 7 pays 2.3× · exactly 7 pays 5.5× · over 7 pays 2.3×.',
  rows: [['u', '⬇️ <7'], ['s', '7️⃣ =7'], ['o', '⬆️ >7']],
  play(type) {
    const a = randInt(6) + 1;
    const b = randInt(6) + 1;
    const hit = outcome(a + b) === type;
    return { mult: hit ? PAYS[type] : 0, show: `${FACES[a - 1]}${FACES[b - 1]} ${a + b}`, detail: { dice: [a, b] } };
  },
});
