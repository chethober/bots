import { h, dieEl, rollDice, sleep } from '../kit.js';
import { duelScreen } from './duel.js';

export function mount(root, ctx) {
  return duelScreen(root, ctx, {
    ico: '🎲',
    async reveal(stage, view) {
      const side = (p) => {
        const dice = [dieEl(1), dieEl(1)];
        const total = h('div.result', '');
        stage.append(h('div.felt', { style: { marginBottom: '10px' } }, h('div.lbl', p.name), h('div.dice', dice), total));
        return { dice, total };
      };
      const A = side(view.a), B = side(view.b);
      for (const [ra, rb] of view.detail?.rolls ?? []) {
        await Promise.all([rollDice(A.dice, ra), rollDice(B.dice, rb, 900)]);
        A.total.textContent = ra[0] + ra[1];
        B.total.textContent = rb[0] + rb[1];
        A.total.style.color = B.total.style.color = '#fff';
        await sleep(600);
      }
    },
  });
}
