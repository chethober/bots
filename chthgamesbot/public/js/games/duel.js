// Shared duel screen (coinflip duel, dice duel): lobby → one animated reveal → result.
import { h, haptic, fmt, dieEl, rollDice, sleep, reduced, busy } from '../kit.js';
import { lobby, actBtn } from './mp.js';

export function duelScreen(root, ctx, { ico, reveal }) {
  let seen = false;
  return {
    async update(view, res, info) {
      if (!view) {
        return lobby(root, info, ctx, {
          ico,
          text: (host) => (host ? `Waiting for someone to accept your ${fmt(info.bet)}-chip duel. Send the invite!` : `${info.creator.name} bets ${fmt(info.bet)} chips. Accept?`),
          filter: (act, host) => (host ? act === 'x' : act === 'a'),
        });
      }
      if (view.cancelled) return root.replaceChildren(h('div.waiting', h('span.big-ico', '✖'), 'This duel was cancelled.'), again(ctx));
      if (!view.a) return root.replaceChildren(h('div.waiting', h('span.big-ico', ico), 'Resolving…'));
      if (seen) return;
      seen = true;
      const stage = h('div');
      const out = h('div.result');
      root.replaceChildren(stage, out);
      await reveal(stage, view);
      const w = view.winner === view.a.id ? view.a : view.b;
      const mine = w.id === info.me;
      out.className = 'result ' + (mine ? 'win' : info.me === view.a.id || info.me === view.b.id ? 'lose' : '');
      out.textContent = `🏆 ${w.name} wins ${fmt(view.bet * 2)}`;
      haptic(mine ? 'success' : 'light');
      root.append(again(ctx));
    },
  };
}

function again(ctx) {
  const b = h('button.big', { onclick: () => busy(b, () => ctx.again()) }, '🔁 New duel');
  return b;
}

export { dieEl, rollDice, sleep, reduced };
