// Shelem: bid for the kitty, put down 4 cards, call trump, then 12 tricks for points.
import { h, fmt } from '../kit.js';
import { mountTrick, suitButtons, SUITS } from './trick.js';

const MIN = 100, MAX = 165;
const bidOptions = (v) => {
  const min = v.bid ? v.bid + 5 : MIN;
  return [...new Set([min, min + 5, min + 15, MAX])].filter((n) => n <= MAX).sort((a, b) => a - b);
};

export function mount(root, ctx) {
  return mountTrick(root, ctx, {
    key: 'sh', ico: '🎴', target: 500,
    about: 'Bid from 100 for the kitty and trump. Tricks 5, aces and tens 10, fives 5 — 165 a hand. First team to 500.',
    badge: (v, seat) => (seat === v.bidder && v.phase !== 'bid' ? `🎯 ${v.bid}` : seat === v.dealer && v.phase === 'bid' ? 'Dealer' : ''),
    info(v) {
      if (v.phase === 'bid') return [v.bidder >= 0 ? `Top bid ${v.bid} · ${v.seats[v.bidder].name}` : `No bids yet · min ${MIN}`];
      return [
        `🎯 ${v.seats[v.bidder].name} bid ${v.bid}`,
        v.trump != null ? `Trump ${SUITS[v.trump]}` : 'Trump not called yet',
        `Points 🔵 ${v.points[0]} · 🔴 ${v.points[1]}`,
      ];
    },
    pick: (v, myTurn) => (v.phase === 'discard' && myTurn ? { can: () => true, data: (i) => `sh:d:${v.seq}:${i}` } : null),
    panel(v, { actBtn, myTurn }) {
      const who = v.seats[v.toAct].name;
      if (v.phase === 'bid') {
        if (!myTurn) return [h('p.muted.tprompt', `${who} is bidding…`)];
        return [h('p.tprompt', 'Your bid:'), h('div.btns',
          ...bidOptions(v).map((n) => actBtn(n === MAX ? '🔥 Shelem 165' : fmt(n), `sh:b:${v.seq}:${n}`, n === MAX ? 'bad' : '')),
          actBtn('Pass', `sh:b:${v.seq}:0`, 'ghost'))];
      }
      if (v.phase === 'discard') {
        if (!myTurn) return [h('p.muted.tprompt', `${who} took the kitty and is putting down 4 cards…`)];
        return [h('p.tprompt', `You took the kitty — tap 4 cards to put down (${v.discards?.length ?? 0}/4). They count for your team.`)];
      }
      if (!myTurn) return [h('p.muted.tprompt', `${who} is calling trump…`)];
      return [h('p.tprompt', 'Call trump:'), suitButtons('sh', v, actBtn)];
    },
  });
}
