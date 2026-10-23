// Factory for free two-player board games: creator posts, first taker joins, play on
// the message itself, rematch swaps sides.

import { GameError, btn, kb, esc, lobbySig, lobbyBtn, parseLobby } from '../ui.js';

export function boardGame({ key, cmd, title, about, intro, init, render, move }) {
  function withRematch(view, st) {
    if (!st.over) return view;
    const rows = view.markup?.inline_keyboard ?? [];
    return { text: view.text, markup: kb(...rows, [btn('🔁 Rematch', `${key}:r`)]) };
  }

  return {
    key, cmd, title, about, group: 'party', defaultBet: 0,
    view: (st) => st,

    async lobby({ creator }) {
      const s = await lobbySig(key, creator.id, 0);
      return {
        text: `<b>${title}</b>\n${intro}\n\n<b>${esc(creator.name)}</b> is looking for an opponent.`,
        markup: kb([lobbyBtn('🎮 Join game', key, 'j', creator.id, 0, s)]),
      };
    },

    async handle(ctx, args) {
      let st;
      if (args[0] === 'noop') return ctx.answer('Game over — tap Rematch to play again.');
      if (args[0] === 'j') {
        const lob = await parseLobby(key, args);
        if (!lob) throw new GameError('Invalid game.');
        if (ctx.user.id === lob.creatorId) throw new GameError('You need an opponent — share this message!');
        const creator = await ctx.getPlayer(lob.creatorId);
        st = init([{ id: lob.creatorId, name: creator?.name ?? 'Player' }, ctx.user]);
        if (!(await ctx.create(key, st))) throw new GameError('Someone already joined.');
        await ctx.answer('Game on!');
      } else if (args[0] === 'm') {
        ({ state: st } = await ctx.mutate((s) => {
          if (s.over) throw new GameError('Game over.');
          const idx = s.players.findIndex((p) => p.id === ctx.user.id);
          if (idx < 0) throw new GameError("You're not in this game.");
          if (idx !== s.turn) throw new GameError('Not your turn.');
          return move(s, args.slice(1));
        }));
        await ctx.answer();
      } else if (args[0] === 'r') {
        ({ state: st } = await ctx.mutate((s) => {
          if (!s.over) throw new GameError('Finish this one first.');
          if (!s.players.some((p) => p.id === ctx.user.id)) throw new GameError("You're not in this game.");
          return init([s.players[1], s.players[0]]);
        }));
        await ctx.answer('Rematch!');
      } else {
        throw new GameError('Unknown action.');
      }
      const view = withRematch(render(st), st);
      await ctx.edit(view.text, view.markup);
    },
  };
}

export function statusLine(st, marks) {
  const [a, b] = st.players;
  const head = `${marks[0]} ${esc(a.name)}  vs  ${marks[1]} ${esc(b.name)}`;
  if (st.winner != null) return `${head}\n\n🏆 <b>${esc(st.players[st.winner].name)}</b> wins!`;
  if (st.over) return `${head}\n\n🤝 Draw!`;
  return `${head}\n\n👉 ${marks[st.turn]} <b>${esc(st.players[st.turn].name)}</b> to move`;
}
