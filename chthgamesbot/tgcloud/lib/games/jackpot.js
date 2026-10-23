import { potGame } from './pot.js';
import { randInt } from '../rng.js';
import { esc, chips } from '../ui.js';
import { tr } from '../i18n.js';

export default potGame({
  key: 'jp', cmd: 'jackpot', title: '🎟 Jackpot',
  about: 'Everyone chips in, one random winner takes the pot',
  maxPlayers: 30,
  startLabel: '🎲 Draw',
  intro: (st) => [
    `<b>${tr(st.lang, '🎟 Jackpot')}</b>`,
    tr(st.lang, 'Everyone pays {chips} in; the host draws one winner who takes it all.', { chips: chips(st.bet) }),
    '',
    tr(st.lang, 'Host: {name}', { name: esc(st.creator.name) }),
    tr(st.lang, 'Pot: <b>{chips}</b> · {n} in', { chips: chips(st.bet * st.players.length), n: st.players.length }),
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
      `<b>${tr(st.lang, '🎟 Jackpot')}</b>`,
      tr(st.lang, '{n} players · {chips} each', { n: st.players.length, chips: chips(st.bet) }),
      '',
      ...st.players.map((p) => `${p.id === st.winner.id ? '🏆' : '•'} ${esc(p.name)}`),
      '',
      tr(st.lang, '🎉 <b>{name}</b> takes {chips}!', { name: esc(st.winner.name), chips: chips(st.bet * st.players.length) }),
    ].join('\n'),
    markup: null,
  }),
  act() { throw new Error('jackpot has no in-game actions'); },
});
