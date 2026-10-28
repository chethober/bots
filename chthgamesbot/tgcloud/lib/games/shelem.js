// Shelem (شلم): the Persian bidding game. 12 cards each and 4 face down (the kitty).
// Players bid from 100 in steps of 5 for the right to call trump; a pass is final. The
// highest bidder takes the kitty, puts down any 4 cards, calls trump and leads.
// Points: every trick is 5, and each ace and ten 10, each five 5 — 165 in all, the
// put-down cards counting as one more trick for the bidder. Making the bid scores what
// the team took (a 165 "shelem" bid scores 330); falling short scores minus the bid. The
// other team always keeps what it took. First team to TARGET wins; a team that sinks to
// −TARGET loses.

import { trickGame, SUITS, MARKS, sortHand, teamOf } from './tricks.js';
import { deck, cardStr } from './cards.js';
import { GameError, btn, esc } from '../ui.js';
import { randInt } from '../rng.js';
import { tr } from '../i18n.js';

export const TARGET = 500;
export const MIN_BID = 100;
export const MAX_BID = 165;

// Card points: A and 10 → 10, 5 → 5. Ranks are 0 = ace … 12 = king.
export const cardPoints = (c) => ({ 0: 10, 9: 10, 4: 5 }[c % 13] ?? 0);
const sum = (cards) => cards.reduce((t, c) => t + cardPoints(c), 0);

// The bid buttons offered: the minimum, a few jumps, and shelem.
export function bidOptions(s) {
  const min = s.bid ? s.bid + 5 : MIN_BID;
  return [...new Set([min, min + 5, min + 15, MAX_BID])].filter((n) => n <= MAX_BID).sort((a, b) => a - b);
}

const nameOf = (s, seat) => esc(s.seats[seat].name);

export default trickGame({
  key: 'sh', cmd: 'shelem', title: '🎴 Shelem', target: TARGET, hidden: ['widow', 'discards'],
  about: 'Persian bidding card game for 4 in two teams: bid, take the kitty, call trump',
  intro: 'Two teams of two. Bid from 100 for the kitty and the right to call trump. Tricks are worth 5, aces and tens 10, fives 5 (165 in all). Make your bid to score your points; miss and lose the bid. First team to 500 wins (or to −500 loses).',

  begin(s) {
    s.dealer = randInt(4);
  },

  deal(s) {
    const d = deck();
    s.hands = [0, 1, 2, 3].map((k) => sortHand(d.slice(k * 12, k * 12 + 12)));
    s.widow = d.slice(48);
    s.discards = [];
    s.points = [0, 0];
    s.bid = 0;
    s.bidder = -1;
    s.passed = [false, false, false, false];
    s.phase = 'bid';
    s.toAct = (s.dealer + 1) % 4;
  },

  actions: {
    b(s, seat, [amount]) {
      if (s.phase !== 'bid') throw new GameError('Unknown action.');
      const n = Number(amount);
      if (n === 0) {
        s.passed[seat] = true;
        s.log.push(tr(s.lang, '{name} passes', { name: nameOf(s, seat) }));
      } else {
        if (!bidOptions(s).includes(n)) throw new GameError('Bid at least {n}.', { n: s.bid ? s.bid + 5 : MIN_BID });
        s.bid = n;
        s.bidder = seat;
        s.log.push(tr(s.lang, n === MAX_BID ? '{name} bids SHELEM!' : '{name} bids {n}', { name: nameOf(s, seat), n }));
      }
      const open = [0, 1, 2, 3].filter((i) => !s.passed[i]);
      if (s.bid === MAX_BID || open.length === 1) {
        if (s.bidder < 0) {
          // Everyone else passed without a bid: the last player takes it at the minimum.
          s.bidder = open[0];
          s.bid = MIN_BID;
          s.log.push(tr(s.lang, '{name} takes it at {n}', { name: nameOf(s, s.bidder), n: MIN_BID }));
        }
        s.hands[s.bidder] = sortHand([...s.hands[s.bidder], ...s.widow]);
        s.widow = [];
        s.phase = 'discard';
        s.toAct = s.bidder;
        return;
      }
      let next = seat;
      do next = (next + 1) % 4; while (s.passed[next]);
      s.toAct = next;
    },

    d(s, seat, [slot]) {
      const i = Number(slot);
      const hand = s.hands[seat];
      if (s.phase !== 'discard' || !Number.isInteger(i) || hand[i] == null) throw new GameError('Bad card.');
      s.discards.push(hand[i]);
      hand[i] = null;
      if (s.discards.length === 4) {
        s.hands[seat] = hand.filter((c) => c != null);
        s.phase = 'trump';
      }
    },

    h(s, seat, [suit]) {
      const n = Number(suit);
      if (s.phase !== 'trump' || !(n >= 0 && n <= 3)) throw new GameError('Unknown action.');
      s.trump = n;
      s.phase = 'play';
      s.toAct = s.bidder;
      s.log.push(tr(s.lang, '{name} calls {suit} trump', { name: nameOf(s, seat), suit: SUITS[n] }));
    },
  },

  onTrick(s, w) {
    s.points[teamOf(w)] += 5 + sum(s.trick.map((t) => t.card));
  },

  handOver: (s) => s.hands.every((h) => h.every((c) => c == null)),

  score(s) {
    const bt = teamOf(s.bidder);
    const got = s.points[bt] + 5 + sum(s.discards);
    const other = s.points[1 - bt];
    const made = got >= s.bid;
    const delta = s.bid === MAX_BID ? (made ? 2 * MAX_BID : -MAX_BID) : made ? got : -s.bid;
    s.score[bt] += delta;
    s.score[1 - bt] += other;
    const L = (text, vars) => tr(s.lang, text, vars);
    return [
      L(made ? '🏁 {name} bid {bid} and took {got} — made it! {mark} +{delta}' : '🏁 {name} bid {bid} but took {got} — set! {mark} {delta}', {
        name: nameOf(s, s.bidder), bid: s.bid, got, mark: MARKS[bt], delta: delta > 0 ? delta : `−${-delta}`,
      }),
      `${MARKS[1 - bt]} +${other}`,
      `${L('Kitty:')} ${s.discards.map(cardStr).join(' ')}`,
    ];
  },

  next(s) {
    s.dealer = (s.dealer + 1) % 4;
  },

  status(s, L) {
    if (s.phase === 'bid') {
      return [
        `🃏 ${L('Dealer:')} ${nameOf(s, s.dealer)}`,
        s.bidder >= 0 ? L('Bidding · top bid {n} by {name}', { n: s.bid, name: nameOf(s, s.bidder) }) : L('Bidding · no bids yet (min {n})', { n: MIN_BID }),
      ];
    }
    const bid = `${L('Bid {n} by {name}', { n: s.bid, name: nameOf(s, s.bidder) })}${s.trump != null ? ` · ${L('Trump')} ${SUITS[s.trump]}` : ''}`;
    return [bid, `${L('Points:')} ${MARKS[0]} ${s.points[0]} · ${MARKS[1]} ${s.points[1]}`];
  },

  prompt(s, L, { slotRows }) {
    const name = nameOf(s, s.toAct);
    if (s.phase === 'bid') {
      return {
        line: L('👉 {mark} <b>{name}</b> to bid', { mark: MARKS[teamOf(s.toAct)], name }),
        rows: [bidOptions(s).map((n) => btn(n === MAX_BID ? L('🔥 Shelem') : String(n), `sh:b:${s.seq}:${n}`)), [btn(L('Pass'), `sh:b:${s.seq}:0`)]],
      };
    }
    if (s.phase === 'discard') {
      return {
        line: L('👉 <b>{name}</b> took the kitty and puts down 4 cards ({n}/4) — tap 👀, then the card numbers.', { name, n: s.discards.length }),
        rows: slotRows(s, s.toAct, 'd'),
      };
    }
    return {
      line: L('👉 <b>{name}</b> is calling trump.', { name }),
      rows: [SUITS.map((x, i) => btn(x, `sh:h:${s.seq}:${i}`))],
    };
  },

  // The bidder sees the cards they put down; nobody else does until the hand ends.
  privateView: (s, seat) => (seat >= 0 && seat === s.bidder && s.discards?.length ? { discards: s.discards } : {}),
});
