// Plinko rules, pure: 12 rows of pegs, each bounce is a fair coin, slot = number of rights.

import { randInt } from './rng.js';

export const ROWS = 12;
export const TABLES = {
  low:    [8.4, 3, 1.5, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.5, 3, 8.4],
  medium: [24, 9, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 9, 24],
  high:   [130, 24, 8, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8, 24, 130],
};

export function drop(risk) {
  const path = Array.from({ length: ROWS }, () => randInt(2));
  const slot = path.reduce((a, b) => a + b, 0);
  return { path, slot, mult: TABLES[risk][slot] };
}
