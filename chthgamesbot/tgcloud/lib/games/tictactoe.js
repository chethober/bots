import { boardGame, statusLine } from './board.js';
import { GameError, btn, kb } from '../ui.js';
import { winLine } from '../game.js';
import { tr } from '../i18n.js';

const MARKS = ['❌', '⭕'];

export default boardGame({
  key: 'tt', cmd: 'tictactoe', title: '❌⭕ Tic-tac-toe', about: 'Classic 3×3, right in the chat',
  intro: 'Three in a row wins.',
  init: (players) => ({ players, board: '.........', turn: 0, winner: null, over: false }),
  move(s, [cell]) {
    const i = Number(cell);
    if (!Number.isInteger(i) || i < 0 || i > 8 || s.board[i] !== '.') throw new GameError('Taken.');
    const sym = s.turn === 0 ? 'X' : 'O';
    s.board = s.board.slice(0, i) + sym + s.board.slice(i + 1);
    if (winLine(s.board)) { s.winner = s.turn; s.over = true; }
    else if (!s.board.includes('.')) s.over = true;
    else s.turn = 1 - s.turn;
    return s;
  },
  render(s) {
    const win = new Set(winLine(s.board) ?? []);
    const cell = (i) => {
      const v = s.board[i];
      const face = v === 'X' ? (win.has(i) ? '❎' : '❌') : v === 'O' ? (win.has(i) ? '🟢' : '⭕') : '⬜';
      return btn(face, s.over ? 'tt:noop' : `tt:m:${i}`);
    };
    const rows = [0, 3, 6].map((r) => [cell(r), cell(r + 1), cell(r + 2)]);
    return { text: `<b>${tr(s.lang, '❌⭕ Tic-tac-toe')}</b>\n${statusLine(s, MARKS)}`, markup: kb(...rows) };
  },
});
