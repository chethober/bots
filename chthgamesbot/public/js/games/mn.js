// Mines: reveal gems on a 5×5 grid; cash out before you hit a mine.
import { h, fmt } from '../kit.js';
import { soloShell } from './solo.js';

export function mount(root, ctx) {
  return soloShell(root, ctx, {
    dealLabel: 'Start',
    variants: [['1', '1'], ['3', '3'], ['5', '5'], ['10', '10']],
    renderPlay({ stage, controls, view, act }) {
      const playing = view?.phase === 'play';
      const grid = h('div.tiles');
      for (let i = 0; i < 25; i++) {
        let cls = '', face = '';
        if (view) {
          if (view.boom === i) { cls = 'boom'; face = '💥'; }
          else if (view.open.includes(i)) { cls = 'gem'; face = '💎'; }
          else if (view.mines?.includes(i)) { cls = 'bomb'; face = '💣'; }
        }
        const b = h(`button${cls ? '.' + cls : ''}`, { disabled: !playing || !!cls }, face);
        if (playing && !cls) b.addEventListener('click', () => act(`mn:c:${i}`, b));
        grid.append(b);
      }
      const info = view
        ? h('div.row', { style: { justifyContent: 'space-between', margin: '0 2px 10px' } },
          h('b', `${view.mult}×`), h('span.muted', playing ? `next ${view.next}× · ${view.m} mine${view.m > 1 ? 's' : ''}` : `${view.m} mine${view.m > 1 ? 's' : ''}`))
        : h('p.muted', 'Pick how many mines, set a stake and start.');
      stage.replaceChildren(info, grid);
      if (playing && view.open.length) {
        const cash = h('button.big.good', { onclick: () => act('mn:o', cash) }, `💰 Cash out ${fmt(Math.floor(view.stake * view.mult))}`);
        controls.replaceChildren(cash);
      } else controls.replaceChildren();
    },
  });
}
