// Unbiased randomness from crypto.getRandomValues (available on the platform).

// Integer in [0, n).
export function int(n) {
  n = Math.floor(n);
  if (!(n > 0)) return 0;
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) return Math.floor(Math.random() * n);
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % n;
}

export const pick = (arr) => arr[int(arr.length)];

export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// "2d6", "d20", "3d6+2", "4d10-1" → { rolls, mod, total, expr } or null.
export function roll(expr) {
  const m = /^\s*(\d{0,2})\s*d\s*(\d{1,4})\s*(?:([+-])\s*(\d{1,4}))?\s*$/i.exec(String(expr ?? ''));
  if (!m) return null;
  const count = +(m[1] || 1);
  const sides = +m[2];
  if (count < 1 || count > 50 || sides < 2 || sides > 1000) return null;
  const mod = m[3] ? (m[3] === '-' ? -1 : 1) * +m[4] : 0;
  const rolls = Array.from({ length: count }, () => 1 + int(sides));
  return { rolls, mod, total: rolls.reduce((a, b) => a + b, 0) + mod, expr: `${count}d${sides}${mod ? (mod > 0 ? `+${mod}` : mod) : ''}` };
}

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export function drawCards(n) {
  const deck = SUITS.flatMap((s) => RANKS.map((r) => `${r}${s}`));
  return shuffled(deck).slice(0, Math.max(1, Math.min(10, n)));
}

export const EIGHT_BALL = [
  'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes — definitely.', 'You may rely on it.',
  'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.',
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
  'Don’t count on it.', 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.',
];

// Splits names into `n` balanced teams.
export function teams(names, n) {
  const out = Array.from({ length: n }, () => []);
  shuffled(names).forEach((name, i) => out[i % n].push(name));
  return out;
}
