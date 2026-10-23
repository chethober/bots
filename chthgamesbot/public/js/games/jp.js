// Jackpot: everyone chips in; the draw spins through the names and stops on the winner.
import { h, haptic, fmt, sleep, reduced, playerRow, lobbyButtons } from '../kit.js';

export function mount(root, ctx) {
  let animated = false;
  return {
    async update(view, res, info) {
      const players = view?.players ?? [];
      const pot = info.bet * players.length;
      if (!view || view.phase === 'lobby') {
        const isHost = info.me === info.creator.id;
        const joined = players.some((p) => p.id === info.me);
        root.replaceChildren(
          h('div.felt', { style: { textAlign: 'center' } }, h('div.lbl', 'Pot'), h('div', { style: { fontSize: '34px', fontWeight: 800 } }, `${fmt(pot)} 🪙`), h('div.lbl', `${players.length} in · ${fmt(info.bet)} each`)),
          h('div.players', { style: { marginTop: '12px' } }, players.map((p) => playerRow(p, { right: `${Math.round(100 / players.length)}%`, me: p.id === info.me }))),
          lobbyButtons(info, ctx, (b) => {
            const act = b.data.split(':')[1];
            return act === 'j' ? !joined : isHost;
          }),
          h('p.muted', isHost ? 'Draw when everyone is in (2+ players). Anyone in can cancel after 10 min idle.' : 'The host draws the winner.'),
        );
        return;
      }
      if (view.phase === 'cancelled') return root.replaceChildren(h('div.waiting', h('span.big-ico', '✖'), 'Cancelled — stakes refunded.'));
      if (animated) return;
      animated = true;
      const rows = players.map((p) => playerRow(p, { me: p.id === info.me }));
      const out = h('div.result');
      root.replaceChildren(h('div.felt', { style: { textAlign: 'center' } }, h('div.lbl', 'Pot'), h('div', { style: { fontSize: '34px', fontWeight: 800 } }, `${fmt(pot)} 🪙`)), h('div.players', { style: { marginTop: '12px' } }, rows), out);
      const wi = players.findIndex((p) => p.id === view.winner.id);
      const spins = reduced ? 0 : players.length * 3 + wi;
      for (let i = 0; i <= spins; i++) {
        rows.forEach((r, k) => r.classList.toggle('turn', k === i % players.length));
        haptic('select');
        await sleep(60 + (i / spins) ** 3 * 260);
      }
      rows.forEach((r, k) => r.classList.toggle('turn', k === wi));
      out.className = 'result ' + (view.winner.id === info.me ? 'win' : '');
      out.textContent = `🎉 ${view.winner.name} takes ${fmt(pot)}!`;
      haptic(view.winner.id === info.me ? 'success' : 'warning');
      const b = h('button.big', { onclick: () => ctx.again() }, '🔁 New jackpot');
      root.append(b);
    },
  };
}
