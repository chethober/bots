// Russian roulette: one bullet, six chambers, players pull in turn. Whoever gets the
// bullet loses their stake; the survivors split the pot.

import { potGame, settle } from './pot.js';
import { randInt } from '../rng.js';
import { GameError, btn, kb, esc, chips, idle } from '../ui.js';
import { tr } from '../i18n.js';

const KEY = 'rr';

function renderGame(st) {
  const L = (text, vars) => tr(st.lang, text, vars);
  const lines = [`<b>${L('🔫 Russian Roulette')}</b>`,
    L('{n} players · {chips} each · {left} chambers left', { n: st.players.length, chips: chips(st.bet), left: st.chambers }), ''];
  lines.push(...st.log);
  if (st.phase === 'playing') {
    const p = st.players[st.turn];
    lines.push('', L('👉 <b>{name}</b>, your turn.', { name: esc(p.name) }));
    return {
      text: lines.join('\n'),
      markup: kb([btn(L('🔫 Pull the trigger'), `${KEY}:p:${st.version}`)], [btn(L('⏰ Skip AFK player (10 min)'), `${KEY}:t:${st.version}`)]),
    };
  }
  const share = Object.values(st.payouts)[0];
  lines.push('', L('Survivors split the pot: <b>{chips}</b> each.', { chips: chips(share) }));
  return { text: lines.join('\n'), markup: null };
}

export default potGame({
  key: KEY, cmd: 'roulette6', title: '🔫 Russian Roulette',
  about: 'One bullet, six chambers — the survivors split the pot',
  maxPlayers: 6,
  startLabel: '🔄 Spin & start',
  intro: (st) => [
    `<b>${tr(st.lang, '🔫 Russian Roulette')}</b>`,
    tr(st.lang, 'One bullet, six chambers, 2–6 players at {chips} each.', { chips: chips(st.bet) }),
    tr(st.lang, 'Take turns pulling the trigger. Whoever hits the bullet loses; survivors split the pot.'),
    '',
    tr(st.lang, 'Host: {name}', { name: esc(st.creator.name) }),
    ...st.players.map((p) => `• ${esc(p.name)}`),
  ].join('\n'),
  start(st) {
    st.phase = 'playing';
    st.chambers = 6;
    st.bullet = randInt(6); // chambers fired before the bullet comes up
    st.turn = 0;
    st.version = 0;
    st.log = [];
    st.touched = Date.now();
    return st;
  },
  renderGame,

  async act(ctx, [a, v]) {
    if (a !== 'p' && a !== 't') throw new GameError('Unknown action.');
    const { state: st, prev } = await ctx.mutate((s) => {
      if (s.phase !== 'playing') throw new GameError('Game over.');
      if (String(s.version) !== v) throw new GameError('Too slow — refresh.');
      const p = s.players[s.turn];
      // An AFK shooter forfeits as if the gun went off.
      const afk = a === 't';
      if (afk) {
        if (!s.players.some((x) => x.id === ctx.user.id)) throw new GameError("You're not in this game.");
        if (!idle(s)) throw new GameError('{name} still has time — wait 10 min.', { name: p.name });
      } else if (p.id !== ctx.user.id) {
        throw new GameError("It's {name}'s turn.", { name: p.name });
      }
      s.version++;
      s.touched = Date.now();
      if (afk || s.bullet === 0) {
        s.log.push(tr(s.lang, afk ? '⏰ <b>{name}</b> walked away — forfeits.' : '💥 <b>{name}</b> — BANG!', { name: esc(p.name) }));
        s.phase = 'done';
        const survivors = s.players.filter((x) => x.id !== p.id);
        const share = Math.floor((s.bet * s.players.length) / survivors.length);
        s.payouts = Object.fromEntries(survivors.map((x) => [x.id, share]));
      } else {
        s.log.push(tr(s.lang, '😮‍💨 {name} — click.', { name: esc(p.name) }));
        s.bullet--;
        s.chambers--;
        s.turn = (s.turn + 1) % s.players.length;
      }
      return s;
    });
    if (st.phase === 'done' && prev.phase === 'playing') await settle(ctx, st);
    await ctx.answer(st.phase === 'done' && st.payouts[ctx.user.id] == null ? '💥' : ctx.t('click…'));
    const view = renderGame(st);
    await ctx.edit(view.text, view.markup);
  },
});
