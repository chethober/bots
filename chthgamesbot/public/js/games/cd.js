import { h, sleep, reduced } from '../kit.js';
import { duelScreen } from './duel.js';

export function mount(root, ctx) {
  return duelScreen(root, ctx, {
    ico: '🪙',
    async reveal(stage, view) {
      const coin = h('div.coin3d', h('div.face.h', '👑'), h('div.face.t', '🦅'));
      stage.append(
        h('div.row', { style: { justifyContent: 'space-between', fontWeight: 700 } }, h('span', `👑 ${view.a.name}`), h('span', `🦅 ${view.b.name}`)),
        h('div.coin-stage', coin),
      );
      await sleep(50);
      coin.style.transition = reduced ? 'none' : 'transform 1.6s cubic-bezier(.2,.7,.2,1)';
      coin.style.transform = `rotateY(${(10 + (view.detail?.heads ? 0 : 1)) * 180}deg)`;
      await sleep(reduced ? 0 : 1600);
    },
  });
}
