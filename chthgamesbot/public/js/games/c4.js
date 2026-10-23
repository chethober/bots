import { h } from '../kit.js';
import { boardScreen } from './board.js';

export function mount(root, ctx) {
  return boardScreen(root, ctx, {
    ico: '🔴🟡',
    marks: ['🔴', '🟡'],
    renderBoard(view, { myTurn, act, prevBoard }) {
      const cols = h('div.c4cols', Array.from({ length: 7 }, (_, c) => {
        const full = view.board[0][c] !== -1;
        const b = h('button', { disabled: !myTurn || full, style: { visibility: myTurn ? 'visible' : 'hidden' } }, '▼');
        b.addEventListener('click', () => act(`c4:m:${c}`, b));
        return b;
      }));
      const grid = h('div.c4');
      view.board.forEach((row, r) => row.forEach((v, c) => {
        const slot = h('div.slot');
        if (v !== -1) {
          const d = h(`div.disc.p${v}`);
          if (prevBoard && prevBoard[r][c] === -1) d.classList.add('drop');
          slot.append(d);
        }
        grid.append(slot);
      }));
      return h('div', cols, grid);
    },
  });
}
