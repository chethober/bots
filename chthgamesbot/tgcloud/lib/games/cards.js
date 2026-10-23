import { shuffle, randInt } from '../rng.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠️', '♥️', '♦️', '♣️'];

export const deck = () => shuffle(Array.from({ length: 52 }, (_, i) => i));
export const rankOf = (c) => c % 13;               // 0 = ace … 12 = king
export const cardStr = (c) => `${RANKS[c % 13]}${SUITS[Math.floor(c / 13)]}`;
export const randomCard = () => randInt(52);
