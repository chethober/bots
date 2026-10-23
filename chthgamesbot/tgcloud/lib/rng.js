// Unbiased randomness from the platform's CSPRNG. Pure — no SDK imports, so tests can use it.

export function randInt(n) {
  // Rejection sampling over 32-bit values avoids modulo bias.
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

export function random() {
  return randInt(0x40000000) / 0x40000000;
}

export function pick(arr) {
  return arr[randInt(arr.length)];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Weighted pick: items = [[value, weight], ...]
export function weighted(items) {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = randInt(total);
  for (const [v, w] of items) {
    if (r < w) return v;
    r -= w;
  }
  return items[items.length - 1][0];
}
