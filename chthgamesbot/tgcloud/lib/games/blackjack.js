import { soloGame } from './solo.js';
import { btn, kb, chips } from '../ui.js';
import { GameError } from '../ui.js';
import { deck, rankOf, cardStr } from './cards.js';

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = rankOf(c);
    if (r === 0) { aces++; total += 11; }
    else total += Math.min(r + 1, 10);
  }
  while (total > 21 && aces--) total -= 10;
  return total;
}
const isBJ = (h) => h.length === 2 && handValue(h) === 21;

function finish(s) {
  // Dealer draws to 17, standing on all 17s.
  const p = handValue(s.p);
  if (p <= 21) while (handValue(s.d) < 17) s.d.push(s.deck.pop());
  const d = handValue(s.d);
  s.phase = 'done';
  if (p > 21) { s.result = 'Bust'; s.payout = 0; }
  else if (d > 21 || p > d) { s.result = d > 21 ? 'Dealer busts' : 'You win'; s.payout = s.stake * 2; }
  else if (p === d) { s.result = 'Push'; s.payout = s.stake; }
  else { s.result = 'Dealer wins'; s.payout = 0; }
  return s;
}

export function deal({ owner, bet }) {
  const d = deck();
  const s = { owner, bet, stake: bet, deck: d, p: [d.pop(), d.pop()], d: [d.pop(), d.pop()], phase: 'play', payout: 0 };
  if (isBJ(s.p) || isBJ(s.d)) {
    s.phase = 'done';
    if (isBJ(s.p) && isBJ(s.d)) { s.result = 'Both blackjack — push'; s.payout = bet; }
    else if (isBJ(s.p)) { s.result = 'Blackjack! 3:2'; s.payout = Math.floor(bet * 2.5); }
    else { s.result = 'Dealer blackjack'; s.payout = 0; }
  }
  return s;
}

export function act(s, [a]) {
  if (a === 'h') {
    s.p.push(s.deck.pop());
    if (handValue(s.p) > 21) return finish(s);
    if (handValue(s.p) === 21) return finish(s);
    return s;
  }
  if (a === 's') return finish(s);
  if (a === 'x') {
    if (s.p.length !== 2) throw new GameError('You can only double on your first two cards.');
    s.doubled = true;
    s.p.push(s.deck.pop());
    return finish(s);
  }
  throw new GameError('Unknown action.');
}

export default soloGame({
  key: 'bj', cmd: 'blackjack', title: '🃏 Blackjack', about: 'Beat the dealer to 21 — blackjack pays 3:2',
  intro: 'Get closer to 21 than the dealer. Dealer stands on 17. Blackjack pays 3:2.',
  deal,
  act,
  view: (s) => (s.phase === 'play' ? { ...s, d: [s.d[0], null] } : s),
  extraStake: (st, [a]) => (a === 'x' && st.phase === 'play' && st.p.length === 2 ? st.bet : 0),
  render(s) {
    const hidden = s.phase === 'play';
    const dealer = hidden ? `${cardStr(s.d[0])} 🂠` : `${s.d.map(cardStr).join(' ')} (${handValue(s.d)})`;
    const text = [
      `<b>🃏 Blackjack</b> · stake ${chips(s.stake)}${s.doubled ? ' (doubled)' : ''}`,
      '',
      `Dealer: ${dealer}`,
      `You:    ${s.p.map(cardStr).join(' ')} (<b>${handValue(s.p)}</b>)`,
      s.result ? `\n<b>${s.result}</b>` : '',
    ].join('\n');
    if (!hidden) return { text, markup: null };
    const row = [btn('👆 Hit', 'bj:h'), btn('✋ Stand', 'bj:s')];
    if (s.p.length === 2) row.push(btn(`⏫ Double`, 'bj:x'));
    return { text, markup: kb(row) };
  },
});
