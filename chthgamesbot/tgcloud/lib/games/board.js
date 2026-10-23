// Factory for free two-player board games: creator posts, first taker joins, play on
// the message itself, rematch swaps sides.

import { GameError, btn, kb, esc, lobbySig, lobbyBtn, parseLobby } from '../ui.js';
import { tr } from '../i18n.js';

// `render(st)` writes in `st.lang`, the creator's language.
export function boardGame({ key, cmd, title, about, intro, init, render, move }) {
  function withRematch(view, st) {
    if (!st.over) return view;
    const rows = view.markup?.inline_keyboard ?? [];
    return { text: view.text, markup: kb(...rows, [btn(tr(st.lang, '🔁 Rematch'), `${key}:r`)]) };
  }

  return {
    key, cmd, title, about, group: 'party', defaultBet: 0,
    view: (st) => st,

    async lobby({ creator, locale }) {
      const s = await lobbySig(key, creator.id, 0);
      return {
        text: `<b>${tr(locale, title)}</b>\n${tr(locale, intro)}\n\n`
          + tr(locale, '<b>{name}</b> is looking for an opponent.', { name: esc(creator.name) }),
        markup: kb([lobbyBtn(tr(locale, '🎮 Join game'), key, 'j', creator.id, 0, s)]),
      };
    },

    async handle(ctx, args) {
      let st;
      if (args[0] === 'noop') return ctx.answer(ctx.t('Game over — tap Rematch to play again.'));
      if (args[0] === 'j') {
        const lob = await parseLobby(key, args);
        if (!lob) throw new GameError('Invalid game.');
        if (ctx.user.id === lob.creatorId) throw new GameError('You need an opponent — share this message!');
        const creator = await ctx.getPlayer(lob.creatorId);
        const lang = await ctx.localeOf(lob.creatorId);
        st = { ...init([{ id: lob.creatorId, name: creator?.name ?? tr(lang, 'Player') }, ctx.user]), lang };
        if (!(await ctx.create(key, st))) throw new GameError('Someone already joined.');
        await ctx.answer(ctx.t('Game on!'));
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
        await ctx.answer(ctx.t('Rematch!'));
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
  const head = `${marks[0]} ${esc(a.name)}  ${tr(st.lang, 'vs')}  ${marks[1]} ${esc(b.name)}`;
  if (st.winner != null) return `${head}\n\n${tr(st.lang, '🏆 <b>{name}</b> wins!', { name: esc(st.players[st.winner].name) })}`;
  if (st.over) return `${head}\n\n${tr(st.lang, '🤝 Draw!')}`;
  return `${head}\n\n${tr(st.lang, '👉 {mark} <b>{name}</b> to move', { mark: marks[st.turn], name: esc(st.players[st.turn].name) })}`;
}
