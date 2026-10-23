import { soloGame } from './solo.js';
import { GameError, btn, kb, chips } from '../ui.js';
import { deck, cardStr } from './cards.js';
import { videoPokerPays, VP_PAYS } from '../poker.js';

export default soloGame({
  key: 'vp', cmd: 'videopoker', title: '🂡 Video Poker', about: 'Jacks or Better — hold, draw, royal flush pays 800×',
  intro: 'Five cards. Tap the ones to keep, then draw once. Pair of jacks or better pays.\n'
    + VP_PAYS.map(([n, m]) => `${n} ${m}×`).join(' · '),
  deal: ({ owner, bet }) => {
    const d = deck();
    return { owner, bet, stake: bet, deck: d, hand: d.splice(0, 5), held: [false, false, false, false, false], phase: 'play', payout: 0 };
  },
  act(s, [a, i]) {
    if (a === 'h') {
      const k = Number(i);
      if (!Number.isInteger(k) || k < 0 || k > 4) throw new GameError('Bad card.');
      s.held[k] = !s.held[k];
      return s;
    }
    if (a !== 'x') throw new GameError('Unknown action.');
    s.hand = s.hand.map((c, k) => (s.held[k] ? c : s.deck.pop()));
    const { name, mult } = videoPokerPays(s.hand);
    s.result = name ?? 'No win';
    s.phase = 'done';
    s.payout = Math.floor(s.stake * mult);
    return s;
  },
  render(s) {
    const text = [
      `<b>🂡 Video Poker</b> · stake ${chips(s.stake)}`,
      '',
      s.hand.map(cardStr).join('  '),
      s.result ? `\n<b>${s.result}</b>` : '\nTap cards to hold, then draw.',
    ].join('\n');
    if (s.phase !== 'play') return { text, markup: null };
    return {
      text,
      markup: kb(
        s.hand.map((c, k) => btn(s.held[k] ? `🔒${cardStr(c)}` : cardStr(c), `vp:h:${k}`)),
        [btn('🃏 Draw', 'vp:x')],
      ),
    };
  },
});
