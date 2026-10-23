import { potGame } from './pot.js';
import { randInt } from '../rng.js';
import { esc, chips } from '../ui.js';

export default potGame({
  key: 'jp', cmd: 'jackpot', title: '🎟 Jackpot',
  about: 'Everyone chips in, one random winner takes the pot',
  maxPlayers: 30,
  startLabel: '🎲 Draw',
  intro: (st) => [
    '<b>🎟 Jackpot</b>',
    `Everyone pays ${chips(st.bet)} in; the host draws one winner who takes it all.`,
    '',
    `Host: ${esc(st.creator.name)}`,
    `Pot: <b>${chips(st.bet * st.players.length)}</b> · ${st.players.length} in`,
    ...st.players.map((p) => `• ${esc(p.name)}`),
  ].join('\n'),
  start(st) {
    const w = st.players[randInt(st.players.length)];
    st.phase = 'done';
    st.winner = w;
    st.payouts = { [w.id]: st.bet * st.players.length };
    return st;
  },
  renderGame: (st) => ({
    text: [
      '<b>🎟 Jackpot</b>',
      `${st.players.length} players · ${chips(st.bet)} each`,
      '',
      ...st.players.map((p) => `${p.id === st.winner.id ? '🏆' : '•'} ${esc(p.name)}`),
      '',
      `🎉 <b>${esc(st.winner.name)}</b> takes ${chips(st.bet * st.players.length)}!`,
    ].join('\n'),
    markup: null,
  }),
  act() { throw new Error('jackpot has no in-game actions'); },
});
