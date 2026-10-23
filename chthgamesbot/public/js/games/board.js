// Shared header for the free two-player board games.
import { h, playerRow, haptic, busy } from '../kit.js';
import { lobby } from './mp.js';

export function boardScreen(root, ctx, { ico, marks, renderBoard }) {
  let lastMoves = -1;
  return {
    update(view, res, info) {
      if (!view) {
        return lobby(root, info, ctx, {
          ico,
          text: (host) => (host ? 'Waiting for an opponent — send the invite!' : `${info.creator.name} wants to play.`),
          filter: (act, host) => !host && act === 'j',
        });
      }
      const myIdx = view.players.findIndex((p) => p.id === info.me);
      const myTurn = !view.over && myIdx === view.turn;
      const status = view.winner != null
        ? (view.winner === myIdx ? 'You won! 🎉' : `${view.players[view.winner].name} wins`)
        : view.over ? "It's a draw" : myTurn ? 'Your move' : `${view.players[view.turn].name}'s move…`;
      const moves = JSON.stringify(view.board);
      if (lastMoves !== -1 && moves !== lastMoves) haptic(view.over ? (view.winner === myIdx ? 'success' : 'warning') : 'light');
      const prevBoard = lastMoves === -1 ? null : JSON.parse(lastMoves);
      lastMoves = moves;
      const kids = [
        h('div.players', view.players.map((p, i) => playerRow(p, { right: marks[i], turn: !view.over && i === view.turn, me: i === myIdx }))),
        h('div.result', status),
        renderBoard(view, { myTurn, act: (data, el) => busy(el, () => ctx.act(data)), prevBoard }),
      ];
      if (view.over && myIdx >= 0) {
        const b = h('button.big', { onclick: () => busy(b, () => ctx.act(`${ctx.info.game}:r`)) }, '🔁 Rematch');
        kids.push(b);
      }
      root.replaceChildren(...kids);
    },
  };
}
