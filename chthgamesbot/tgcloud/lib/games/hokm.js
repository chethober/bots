// Hokm (حکم): the classic Persian team game. Cards are dealt face up until someone gets
// an ace: they are the first Hakem. Each hand the Hakem sees their first five cards and
// calls trump, then everyone gets the rest (13 each) and the Hakem leads. The first team
// to 7 tricks takes the hand: 1 point, 2 for a 7–0 sweep (kot), 3 if the sweep is against
// the Hakem's team. The Hakem keeps the role while their team wins; otherwise it passes
// to the next player. First team to 7 points wins the game.

import { trickGame, SUITS, MARKS, sortHand, teamOf } from './tricks.js';
import { deck, rankOf } from './cards.js';
import { GameError, btn, esc } from '../ui.js';
import { tr } from '../i18n.js';

export const HAND_TRICKS = 7;

export default trickGame({
  key: 'hk', cmd: 'hokm', title: '👑 Hokm', target: 7,
  about: 'Persian team card game for 4: the Hakem calls trump, first to 7 tricks',
  intro: 'Two teams of two. The Hakem calls trump from their first five cards; the first team to 7 tricks takes the hand (a 7–0 kot scores 2, or 3 against the Hakem). First team to 7 points wins.',

  begin(s) {
    const d = deck();
    const first = d.findIndex((c) => rankOf(c) === 0);
    s.hakem = first % 4;
    s.log.push(tr(s.lang, '🂡 {name} drew the first ace — Hakem!', { name: esc(s.seats[s.hakem].name) }));
  },

  deal(s) {
    const d = deck();
    // Kept in deal order until trump is called: the first five are what the Hakem sees.
    s.hands = [0, 1, 2, 3].map((k) => d.slice(k * 13, k * 13 + 13));
    s.phase = 'trump';
    s.toAct = s.hakem;
  },

  visibleHand: (s, seat) => (s.phase === 'trump' ? sortHand(s.hands[seat].slice(0, 5)) : s.hands[seat]),

  actions: {
    h(s, seat, [suit]) {
      const n = Number(suit);
      if (s.phase !== 'trump' || !(n >= 0 && n <= 3)) throw new GameError('Unknown action.');
      s.trump = n;
      s.hands = s.hands.map(sortHand);
      s.phase = 'play';
      s.toAct = s.hakem;
      s.log.push(tr(s.lang, '👑 {name} calls {suit} trump', { name: esc(s.seats[seat].name), suit: SUITS[n] }));
    },
  },

  handOver: (s) => s.tricks.some((t) => t >= HAND_TRICKS),

  score(s) {
    const won = s.tricks[0] >= HAND_TRICKS ? 0 : 1;
    const hakemTeam = teamOf(s.hakem);
    let pts = 1;
    let why = '';
    if (s.tricks[1 - won] === 0) {
      pts = won === hakemTeam ? 2 : 3;
      why = tr(s.lang, won === hakemTeam ? 'Kot!' : 'Hakem kot!');
    }
    s.score[won] += pts;
    s.handWinner = won;
    const names = s.seats.filter((_, i) => teamOf(i) === won).map((p) => esc(p.name)).join(' & ');
    return [tr(s.lang, '🏁 {mark} <b>{names}</b> take the hand {a}–{b}: +{n} {why}', {
      mark: MARKS[won], names, a: s.tricks[won], b: s.tricks[1 - won], n: pts, why,
    }).trim()];
  },

  next(s) {
    if (s.handWinner !== teamOf(s.hakem)) s.hakem = (s.hakem + 1) % 4;
  },

  status(s, L) {
    const hk = `👑 ${L('Hakem:')} ${esc(s.seats[s.hakem].name)}`;
    return [
      s.trump != null ? `${hk} · ${L('Trump')} ${SUITS[s.trump]}` : hk,
      `${L('Tricks:')} ${MARKS[0]} ${s.tricks[0]} · ${MARKS[1]} ${s.tricks[1]}`,
    ];
  },

  prompt(s, L) {
    return {
      line: L('👑 <b>{name}</b> is calling trump — Hakem, tap 👀 to see your five cards.', { name: esc(s.seats[s.hakem].name) }),
      rows: [SUITS.map((x, i) => btn(x, `hk:h:${s.seq}:${i}`))],
    };
  },
});
