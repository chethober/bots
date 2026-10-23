// Factory for single-player games against the house. The lobby is signed for its
// creator; the session state remembers the owner, stake and `phase` ('play' | 'done').
// A game that ends sets `st.payout` (total returned, 0 on a loss); it's paid exactly once.

import { GameError, btn, kb, esc, chips, lobbySig, lobbyBtn, parseLobby } from '../ui.js';

export function soloGame({ key, cmd, title, about, intro, variants = [['', 'Deal']], deal, render, act, extraStake, view: viewFor }) {
  async function lobby({ creator, bet }) {
    const s = await lobbySig(key, creator.id, bet);
    return {
      text: `<b>${title}</b>\n${intro}\n\n${esc(creator.name)} · stake <b>${chips(bet)}</b>`,
      markup: kb(variants.map(([v, label]) => lobbyBtn(label, key, `d${v}`, creator.id, bet, s))),
    };
  }

  const again = (st) => kb([btn(`🔁 Again (${st.bet})`, `${key}:g`)]);

  function view(st) {
    const v = render(st);
    if (st.phase !== 'done') return v;
    const net = st.payout - st.stake;
    const tail = net > 0 ? `✅ Won <b>${chips(net)}</b>` : net === 0 ? '↩️ Stake returned' : `❌ Lost ${chips(-net)}`;
    const rows = v.markup?.inline_keyboard ?? [];
    return { text: `${v.text}\n\n${tail}`, markup: kb(...rows, ...again(st).inline_keyboard) };
  }

  async function settle(ctx, st, prev) {
    if (st.phase === 'done' && prev?.phase !== 'done' && st.payout > 0) {
      await ctx.credit(st.owner.id, st.payout, st.stake);
    }
  }

  async function show(ctx, st, note) {
    const after = st.phase === 'done' ? await ctx.getPlayer(st.owner.id) : null;
    await ctx.answer(note ?? (after ? `Balance: ${chips(after.chips)}` : ''));
    const v = view(st);
    await ctx.edit(v.text, v.markup);
  }

  return {
    key, cmd, title, about, group: 'solo', defaultBet: 100, lobby,
    variants,
    view: (st) => {
      const { deck: _d, ...rest } = st;
      return viewFor ? viewFor(rest) : rest;
    },

    async handle(ctx, args) {
      const [a] = args;
      if (a === 'n') return ctx.answer();

      if (a.startsWith('d')) {
        const lob = await parseLobby(key, args);
        if (!lob || lob.bet < 1) throw new GameError('Invalid game.');
        if (ctx.user.id !== lob.creatorId) throw new GameError("This table is someone else's — start your own!");
        const variant = a.slice(1);
        if (!variants.some(([v]) => v === variant)) throw new GameError('Unknown option.');
        if (!(await ctx.debit(ctx.user.id, lob.bet))) throw new GameError(`You need ${lob.bet} chips. Try /daily.`);
        let st = deal({ owner: ctx.user, bet: lob.bet, variant });
        if (!(await ctx.create(key, st))) {
          // Same table, new stake (the Mini App reuses one table per player).
          try {
            ({ state: st } = await ctx.mutate((s) => {
              if (s.owner.id !== ctx.user.id || s.phase !== 'done') throw new GameError('Already dealt — use the buttons on the game.');
              return deal({ owner: ctx.user, bet: lob.bet, variant });
            }));
          } catch (e) {
            await ctx.refund(ctx.user.id, lob.bet);
            throw e;
          }
        }
        await settle(ctx, st, null);
        return show(ctx, st);
      }

      if (a === 'g') {
        const cur = await ctx.session();
        if (!cur) throw new GameError('This game has expired.');
        if (cur.state.owner.id !== ctx.user.id) throw new GameError("Not your game — start your own!");
        const bet = cur.state.bet;
        if (!(await ctx.debit(ctx.user.id, bet))) throw new GameError(`You need ${bet} chips. Try /daily.`);
        let st;
        try {
          ({ state: st } = await ctx.mutate((s) => {
            if (s.phase !== 'done') throw new GameError('Finish this hand first.');
            return deal({ owner: s.owner, bet: s.bet, variant: s.variant });
          }));
        } catch (e) {
          await ctx.refund(ctx.user.id, bet);
          throw e;
        }
        await settle(ctx, st, null);
        return show(ctx, st);
      }

      // In-game action.
      const cur = await ctx.session();
      if (!cur) throw new GameError('This game has expired.');
      if (cur.state.owner.id !== ctx.user.id) throw new GameError("Not your game — start your own!");
      const extra = extraStake?.(cur.state, args) ?? 0;
      if (extra && !(await ctx.debit(ctx.user.id, extra))) throw new GameError(`You need ${extra} more chips.`);
      let res;
      try {
        res = await ctx.mutate((s) => {
          if (s.phase !== 'play') throw new GameError('This hand is over.');
          if (extra) s.stake += extra;
          return act(s, args);
        });
      } catch (e) {
        if (extra) await ctx.refund(ctx.user.id, extra);
        throw e;
      }
      await settle(ctx, res.state, res.prev);
      return show(ctx, res.state);
    },
  };
}
