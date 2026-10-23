import { boardGame, statusLine } from './board.js';
import { GameError, btn, kb } from '../ui.js';
import { tr } from '../i18n.js';

const W = 7, H = 6;
const MARKS = ['🔴', '🟡'];

function wins(b, r, c, p) {
  const at = (rr, cc) => rr >= 0 && rr < H && cc >= 0 && cc < W && b[rr][cc] === p;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let n = 1;
    for (let k = 1; at(r + dr * k, c + dc * k); k++) n++;
    for (let k = 1; at(r - dr * k, c - dc * k); k++) n++;
    if (n >= 4) return true;
  }
  return false;
}

export default boardGame({
  key: 'c4', cmd: 'connect4', title: '🔴🟡 Connect Four', about: 'Drop discs, connect four to win',
  intro: 'Drop discs into columns — four in a row (any direction) wins.',
  init: (players) => ({ players, board: Array.from({ length: H }, () => Array(W).fill(-1)), turn: 0, winner: null, over: false, moves: 0 }),
  move(s, [col]) {
    const c = Number(col);
    if (!Number.isInteger(c) || c < 0 || c >= W) throw new GameError('Bad column.');
    let r = H - 1;
    while (r >= 0 && s.board[r][c] !== -1) r--;
    if (r < 0) throw new GameError('Column full.');
    s.board[r][c] = s.turn;
    s.moves++;
    if (wins(s.board, r, c, s.turn)) { s.winner = s.turn; s.over = true; }
    else if (s.moves === W * H) s.over = true;
    else s.turn = 1 - s.turn;
    return s;
  },
  render(s) {
    const grid = s.board.map((row) => row.map((v) => (v === -1 ? '⚪' : MARKS[v])).join('')).join('\n');
    const nums = '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
    const keys = s.over ? [] : [Array.from({ length: W }, (_, c) => btn(`${c + 1}`, `c4:m:${c}`))];
    return { text: `<b>${tr(s.lang, '🔴🟡 Connect Four')}</b>\n${statusLine(s, MARKS)}\n\n${grid}\n${nums}`, markup: kb(...keys) };
  },
});
