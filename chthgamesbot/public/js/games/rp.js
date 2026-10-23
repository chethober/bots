// Rock-paper-scissors: picks stay hidden until both are in.
import { h, haptic, fmt, busy } from '../kit.js';
import { lobby, actBtn, htmlLines } from './mp.js';

const M = { r: ['🪨', 'Rock'], p: ['📄', 'Paper'], s: ['✂️', 'Scissors'] };

export function mount(root, ctx) {
  let lastRounds = 0;
  return {
    update(view, res, info) {
      if (!view) {
        return lobby(root, info, ctx, {
          ico: '✂️',
          text: (host) => (host ? `Waiting for an opponent to accept ${fmt(info.bet)} chips.` : `${info.creator.name} challenges you for ${fmt(info.bet)} chips.`),
          filter: (act, host) => (host ? act === 'x' : act === 'a'),
        });
      }
      if (view.cancelled) {
        const b = h('button.big', { onclick: () => busy(b, () => ctx.again()) }, '🔁 New game');
        return root.replaceChildren(h('div.waiting', h('span.big-ico', '✖'), 'Called off — stakes refunded.'), b);
      }
      const [a, b] = view.players;
      const me = view.players.find((p) => p.id === info.me);
      const rounds = view.rounds ?? [];
      const lastR = rounds.at(-1);
      const kids = [];
      if (lastR) {
        kids.push(h('div.vs', h('div', M[lastR[0]][0], h('small', a.name)), h('div', { style: { fontSize: '22px', fontWeight: 800 } }, 'VS'), h('div', M[lastR[1]][0], h('small', b.name))));
        if (rounds.length > lastRounds) haptic('medium');
      }
      lastRounds = rounds.length;
      if (view.winner != null) {
        const w = view.players.find((p) => p.id === view.winner);
        kids.push(h(`div.result.${w.id === info.me ? 'win' : 'lose'}`, `🏆 ${w.name} wins ${fmt(view.bet * 2)}`));
        const again = h('button.big', { onclick: () => busy(again, () => ctx.again()) }, '🔁 Rematch room');
        kids.push(again);
      } else {
        kids.push(h('div.players', view.players.map((p) => h(`div.prow`, h('div.nm', p.name + (p.id === info.me ? ' (you)' : '')), h('div.val', view.picks[p.id] ? '✅ picked' : '🤔')))));
        if (me && !view.picks[me.id]) {
          const grid = h('div.rps', { style: { marginTop: '12px' } }, Object.entries(M).map(([k, [e, t]]) => {
            const btn = h('button', { onclick: () => busy(btn, () => ctx.act(`rp:m:${k}`)) }, e, h('small', t));
            return btn;
          }));
          kids.push(grid);
        } else if (me) {
          kids.push(h('p.muted', { style: { textAlign: 'center' } }, `You picked ${M[view.picks[me.id]][0]} — waiting for your opponent…`));
        }
        if (me) kids.push(actBtn('⏰ Call off (after 10 min idle)', 'rp:t', ctx, 'ghost'));
      }
      kids.push(htmlLines(view.history));
      root.replaceChildren(...kids);
    },
  };
}
