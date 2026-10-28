// Every chat game, keyed by its callback-data prefix. Order = order in menus and inline results.

import slots from './slots.js';
import coinflip from './coinflip.js';
import dice from './dice.js';
import roulette from './roulette.js';
import blackjack from './blackjack.js';
import mines from './mines.js';
import hilo from './hilo.js';
import videopoker from './videopoker.js';
import holdem from './holdem.js';
import coinduel from './coinduel.js';
import diceduel from './diceduel.js';
import rps from './rps.js';
import jackpot from './jackpot.js';
import russian from './russian.js';
import tictactoe from './tictactoe.js';
import connect4 from './connect4.js';
import trivia from './trivia.js';
import hangman from './hangman.js';
import hokm from './hokm.js';
import shelem from './shelem.js';

export const GAMES = [
  slots, coinflip, dice, roulette,
  blackjack, videopoker, mines, hilo,
  holdem, coinduel, diceduel, rps, jackpot, russian,
  hokm, shelem,
  tictactoe, connect4, trivia, hangman,
];

export const BY_KEY = Object.fromEntries(GAMES.map((g) => [g.key, g]));
export const BY_CMD = Object.fromEntries(GAMES.map((g) => [g.cmd, g]));

export const GROUPS = [
  ['casino', '🎰 Casino tables'],
  ['solo', '🃏 Solo vs house'],
  ['duel', '⚔️ Bet with friends'],
  ['persian', '🇮🇷 Persian card games'],
  ['party', '🎉 Party games (free)'],
];
