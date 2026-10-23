// Shared plumbing for group "pot" games: a signed lobby people pay into, run by its creator.

import { GameError, kb, lobbySig, lobbyBtn, parseLobby, idle } from '../ui.js';

export function potGame({ key, cmd, title, about, maxPlayers, minPlayers = 2, startLabel, intro, renderGame, start, act }) {
  async function buttons(creatorId, bet, extra = []) {
    const s = await lobbySig(key, creatorId, bet);
    return kb(
      [lobbyBtn(`🎟 Join (${bet})`, key, 'j', creatorId, bet, s)],
      [lobbyBtn(startLabel, key, 's', creatorId, bet, s), lobbyBtn('✖ Cancel', key, 'x', creatorId, bet, s)],
      ...extra,
    );
  }

  async function view(st) {
    if (st.phase === 'lobby') return { text: intro(st), markup: await buttons(st.creator.id, st.bet) };
    return renderGame(st);
  }

  return {
    key, cmd, title, about, group: 'duel', defaultBet: 100,
    view: (st) => { const { bullet: _b, ...rest } = st; return rest; },

    async lobby({ creator, bet }) {
      return view({ phase: 'lobby', creator, bet, players: [] });
    },

    async handle(ctx, args) {
      // In-game actions (after start) are plain `<key>:<act>…`; lobby actions are signed.
      if (!['j', 's', 'x'].includes(args[0])) return act(ctx, args, view);

      const lob = await parseLobby(key, args);
      if (!lob || lob.bet < 1) throw new GameError('Invalid game.');
      const { creatorId, bet } = lob;

      if (!(await ctx.session())) {
        const creator = await ctx.getPlayer(creatorId);
        await ctx.create(key, { phase: 'lobby', creator: { id: creatorId, name: creator?.name ?? 'Host' }, bet, players: [], touched: Date.now() });
      }

      if (args[0] === 'j') {
        if (!(await ctx.debit(ctx.user.id, bet))) throw new GameError(`You need ${bet} chips. Try /daily.`);
        let st;
        try {
          ({ state: st } = await ctx.mutate((s) => {
            if (s.phase !== 'lobby') throw new GameError('Already started.');
            if (s.players.some((p) => p.id === ctx.user.id)) throw new GameError("You're already in.");
            if (s.players.length >= maxPlayers) throw new GameError('Table is full.');
            s.players.push(ctx.user);
            s.touched = Date.now();
            return s;
          }));
        } catch (e) {
          await ctx.refund(ctx.user.id, bet);
          throw e;
        }
        await ctx.answer(`You're in! Pot: ${bet * st.players.length}`);
        const v = await view(st);
        return ctx.edit(v.text, v.markup);
      }

      if (args[0] === 'x') {
        const { state: st, prev } = await ctx.mutate((s) => {
          if (s.phase !== 'lobby') throw new GameError('Already started.');
          const host = ctx.user.id === creatorId;
          const stuck = s.players.some((p) => p.id === ctx.user.id) && idle(s);
          if (!host && !stuck) throw new GameError('Only the host can cancel (players can after 10 min of no action).');
          s.phase = 'cancelled';
          return s;
        });
        if (prev.phase === 'lobby') for (const p of st.players) await ctx.refund(p.id, bet);
        await ctx.answer('Cancelled, stakes refunded');
        return ctx.edit(`<b>${title}</b>\n<i>Cancelled — all stakes refunded.</i>`);
      }

      if (ctx.user.id !== creatorId) throw new GameError('Only the host can do that.');

      // 's' — start
      const { state: st, prev } = await ctx.mutate((s) => {
        if (s.phase !== 'lobby') throw new GameError('Already started.');
        if (s.players.length < minPlayers) throw new GameError(`Need at least ${minPlayers} players.`);
        return start(s);
      });
      if (prev.phase === 'lobby') await settle(ctx, st);
      await ctx.answer();
      const v = await view(st);
      await ctx.edit(v.text, v.markup);
    },
  };
}

// Pays `st.payouts` ({ userId: amount }) — called once, by the press that ended the game.
export async function settle(ctx, st) {
  for (const [id, amount] of Object.entries(st.payouts ?? {})) {
    await ctx.credit(Number(id), amount, st.bet);
  }
}
