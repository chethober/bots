import { h } from '../kit.js';
import { boardScreen } from './board.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const winLine = (b) => LINES.find(([a, c, d]) => b[a] !== '.' && b[a] === b[c] && b[a] === b[d]) ?? [];

export function mount(root, ctx) {
  return boardScreen(root, ctx, {
    ico: '❌⭕',
    marks: ['✕', '◯'],
    renderBoard(view, { myTurn, act, prevBoard }) {
      const win = new Set(winLine(view.board));
      return h('div.ttt', [...view.board].map((v, i) => {
        const b = h(`button${v !== '.' ? '.' + v : ''}${win.has(i) ? '.win' : ''}`);
        if (v !== '.') {
          const s = h('span', v === 'X' ? '✕' : '◯');
          if (prevBoard && prevBoard[i] === v) s.style.animation = 'none';
          b.append(s);
        } else if (myTurn) b.addEventListener('click', () => act(`tt:m:${i}`, b));
        return b;
      }));
    },
  });
}
