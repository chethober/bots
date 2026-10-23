// Poker hand evaluation, pure. Cards are 0..51: rank = c % 13 (0 = ace), suit = c / 13.

export const CATS = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

const val = (c) => (c % 13 === 0 ? 14 : (c % 13) + 1); // 2..14
const suit = (c) => Math.floor(c / 13);

// Score of exactly five cards: [category, ...tiebreak values], compared lexicographically.
export function score5(cards) {
  const vals = cards.map(val).sort((a, b) => b - a);
  const flush = cards.every((c) => suit(c) === suit(cards[0]));
  const uniq = [...new Set(vals)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq.join() === '14,5,4,3,2') straightHigh = 5; // the wheel
  }
  if (straightHigh && flush) return [8, straightHigh];
  // Group by count, then by value: e.g. full house → [3-value, 2-value].
  const counts = new Map();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map((g) => g[1]).join('');
  const order = groups.map((g) => g[0]);
  if (shape === '41') return [7, ...order];
  if (shape === '32') return [6, ...order];
  if (flush) return [5, ...vals];
  if (straightHigh) return [4, straightHigh];
  if (shape === '311') return [3, ...order];
  if (shape === '221') return [2, ...order];
  if (shape === '2111') return [1, ...order];
  return [0, ...vals];
}

export function compare(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

// Best five of any 5–7 cards → { score, cards }.
export function best(cards) {
  let top = null;
  const n = cards.length;
  const pick = [];
  (function walk(from) {
    if (pick.length === 5) {
      const hand = pick.map((i) => cards[i]);
      const s = score5(hand);
      if (!top || compare(s, top.score) > 0) top = { score: s, cards: hand };
      return;
    }
    for (let i = from; i <= n - (5 - pick.length); i++) {
      pick.push(i);
      walk(i + 1);
      pick.pop();
    }
  })(0);
  return top;
}

export function handName(score) {
  if (score[0] === 8 && score[1] === 14) return 'Royal flush';
  return CATS[score[0]];
}

// ---- video poker (Jacks or Better, 8/5) --------------------------------------
// "For 1" pays: the number is the total returned per chip staked (stake included).
export const VP_PAYS = [
  ['Royal flush', 800], ['Straight flush', 50], ['Four of a kind', 25], ['Full house', 8],
  ['Flush', 5], ['Straight', 4], ['Three of a kind', 3], ['Two pair', 2], ['Jacks or better', 1],
];

export function videoPokerHand(cards) {
  const s = score5(cards);
  if (s[0] === 8) return s[1] === 14 ? 'Royal flush' : 'Straight flush';
  if (s[0] >= 2) return CATS[s[0]];
  if (s[0] === 1 && s[1] >= 11) return 'Jacks or better';
  return null;
}

export function videoPokerPays(cards) {
  const name = videoPokerHand(cards);
  return { name, mult: name ? VP_PAYS.find(([n]) => n === name)[1] : 0 };
}
