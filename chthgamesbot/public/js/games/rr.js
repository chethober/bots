// Russian roulette: a six-chamber cylinder; players pull in turn.
import { h, haptic, fmt, playerRow, lobbyButtons } from '../kit.js';
import { actBtn, htmlLines } from './mp.js';

export function mount(root, ctx) {
  let lastLog = 0;
  return {
    update(view, res, info) {
      const players = view?.players ?? [];
      if (!view || view.phase === 'lobby') {
        const isHost = info.me === info.creator.id;
        const joined = players.some((p) => p.id === info.me);
        root.replaceChildren(
          h('div.waiting', h('span.big-ico', '🔫'), `${players.length}/6 players · ${fmt(info.bet)} each. One bullet — survivors split the pot.`),
          h('div.players', players.map((p) => playerRow(p, { me: p.id === info.me }))),
          lobbyButtons(info, ctx, (b) => { const a = b.data.split(':')[1]; return a === 'j' ? !joined : isHost; }),
        );
        return;
      }
      if (view.phase === 'cancelled') return root.replaceChildren(h('div.waiting', h('span.big-ico', '✖'), 'Cancelled — stakes refunded.'));
      const fired = 6 - view.chambers + (view.phase === 'done' ? 1 : 0);
      const cyl = h('div.cyl', { style: { transform: `rotate(${fired * 60}deg)` } });
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        cyl.append(h(`i${i < fired ? '.fired' : ''}`, { style: { transform: `translate(${Math.cos(a) * 58}px, ${Math.sin(a) * 58}px)` } }));
      }
      const bang = view.phase === 'done';
      if (view.log.length > lastLog) { haptic(bang ? 'heavy' : 'rigid'); if (bang) cyl.classList.add('shake'); }
      lastLog = view.log.length;
      const turnId = view.phase === 'playing' ? players[view.turn].id : null;
      const kids = [cyl, h('div.players', { style: { marginTop: '16px' } }, players.map((p) => {
        const out = view.payouts && view.payouts[p.id] == null;
        return playerRow(p, { turn: p.id === turnId, out, me: p.id === info.me, right: bang ? (out ? '💥' : `+${fmt(view.payouts[p.id] - view.bet)}`) : '' });
      }))];
      if (turnId === info.me) kids.push(actBtn('🔫 Pull the trigger', `rr:p:${view.version}`, ctx, 'bad'));
      else if (view.phase === 'playing') kids.push(h('p.muted', { style: { textAlign: 'center' } }, `${players[view.turn].name}'s turn…`), actBtn('⏰ Skip AFK player (10 min)', `rr:t:${view.version}`, ctx, 'ghost'));
      else {
        const b = h('button.big', { onclick: () => ctx.again() }, '🔁 New round');
        kids.push(b);
      }
      kids.push(htmlLines(view.log));
      root.replaceChildren(...kids);
    },
  };
}
