import { tableGame } from './table.js';
import { weighted } from '../rng.js';

// Reel strip weights and three-of-a-kind payouts (total return per chip).
export const SYMBOLS = [['🍒', 7], ['🍋', 6], ['🔔', 4], ['🍇', 3], ['💎', 2], ['7️⃣', 1]];
export const TRIPLE = { '🍒': 8, '🍋': 10, '🔔': 20, '🍇': 30, '💎': 60, '7️⃣': 150 };
export const PAIR = { '🍒': 0.5, '🍋': 0.5, '🔔': 1, '🍇': 1, '💎': 2, '7️⃣': 3 }; // any two matching

// Return to player is 97.6% (checked exactly in test/validate.js).
export function payout(reels) {
  const [a, b, c] = reels;
  if (a === b && b === c) return TRIPLE[a];
  if (a === b || a === c) return PAIR[a];
  if (b === c) return PAIR[b];
  return 0;
}

export default tableGame({
  key: 'sl', cmd: 'slots', title: '🎰 Slots',
  about: 'Spin three reels — 7️⃣7️⃣7️⃣ pays 150×',
  rules: 'Three of a kind: 🍒8× 🍋10× 🔔20× 🍇30× 💎60× 7️⃣150×\nPairs: 🍒🍋 0.5× · 🔔🍇 1× · 💎 2× · 7️⃣ 3×',
  rows: [['s', '🎰']],
  play() {
    const reels = [weighted(SYMBOLS), weighted(SYMBOLS), weighted(SYMBOLS)];
    return { mult: payout(reels), show: reels.join(''), detail: { reels } };
  },
});
