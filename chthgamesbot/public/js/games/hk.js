// Hokm: the Hakem calls trump from their first five cards, then 13 tricks to the first 7.
import { h } from '../kit.js';
import { mountTrick, suitButtons, SUITS } from './trick.js';

export function mount(root, ctx) {
  return mountTrick(root, ctx, {
    key: 'hk', ico: '👑', target: 7,
    about: 'The Hakem calls trump; first team to 7 tricks takes the hand, first to 7 points wins.',
    badge: (v, seat) => (seat === v.hakem ? '👑 Hakem' : ''),
    info: (v) => [
      `👑 Hakem: ${v.seats[v.hakem].name}`,
      v.trump != null ? `Trump ${SUITS[v.trump]}` : 'Trump not called yet',
      `Tricks 🔵 ${v.tricks[0]} · 🔴 ${v.tricks[1]}`,
    ],
    panel(v, { actBtn, myTurn }) {
      if (v.phase !== 'trump') return [];
      if (!myTurn) return [h('p.muted.tprompt', `${v.seats[v.hakem].name} is calling trump from their first five cards…`)];
      return [h('p.tprompt', 'You are the Hakem — call trump:'), suitButtons('hk', v, actBtn)];
    },
  });
}
