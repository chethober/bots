// Russian roulette: one bullet, six chambers, players pull in turn. Whoever gets the
// bullet loses their stake; the survivors split the pot.

import { potGame, settle } from './pot.js';
import { randInt } from '../rng.js';
import { GameError, btn, kb, esc, chips, idle } from '../ui.js';

const KEY = 'rr';

function renderGame(st) {
  const lines = ['<b>🔫 Russian Roulette</b>', `${st.players.length} players · ${chips(st.bet)} each · ${st.chambers} chambers left`, ''];
  lines.push(...st.log);
  if (st.phase === 'playing') {
    const p = st.players[st.turn];
    lines.push('', `👉 <b>${esc(p.name)}</b>, your turn.`);
    return {
      text: lines.join('\n'),
      markup: kb([btn('🔫 Pull the trigger', `${KEY}:p:${st.version}`)], [btn('⏰ Skip AFK player (10 min)', `${KEY}:t:${st.version}`)]),
    };
  }
  const share = Object.values(st.payouts)[0];
  lines.push('', `Survivors split the pot: <b>${chips(share)}</b> each.`);
  return { text: lines.join('\n'), markup: null };
}

export default potGame({
  key: KEY, cmd: 'roulette6', title: '🔫 Russian Roulette',
  about: 'One bullet, six chambers — the survivors split the pot',
  maxPlayers: 6,
  startLabel: '🔄 Spin & start',
  intro: (st) => [
    '<b>🔫 Russian Roulette</b>',
    `One bullet, six chambers, 2–6 players at ${chips(st.bet)} each.`,
    'Take turns pulling the trigger. Whoever hits the bullet loses; survivors split the pot.',
    '',
    `Host: ${esc(st.creator.name)}`,
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
        if (!idle(s)) throw new GameError(`${p.name} still has time — wait 10 min.`);
      } else if (p.id !== ctx.user.id) {
        throw new GameError(`It's ${p.name}'s turn.`);
      }
      s.version++;
      s.touched = Date.now();
      if (afk || s.bullet === 0) {
        s.log.push(afk ? `⏰ <b>${esc(p.name)}</b> walked away — forfeits.` : `💥 <b>${esc(p.name)}</b> — BANG!`);
        s.phase = 'done';
        const survivors = s.players.filter((x) => x.id !== p.id);
        const share = Math.floor((s.bet * s.players.length) / survivors.length);
        s.payouts = Object.fromEntries(survivors.map((x) => [x.id, share]));
      } else {
        s.log.push(`😮‍💨 ${esc(p.name)} — click.`);
        s.bullet--;
        s.chambers--;
        s.turn = (s.turn + 1) % s.players.length;
      }
      return s;
    });
    if (st.phase === 'done' && prev.phase === 'playing') await settle(ctx, st);
    await ctx.answer(st.phase === 'done' && st.payouts[ctx.user.id] == null ? '💥' : 'click…');
    const view = renderGame(st);
    await ctx.edit(view.text, view.markup);
  },
});
