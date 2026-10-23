// Shared plumbing for group "pot" games: a signed lobby people pay into, run by its creator.

import { GameError, kb, lobbySig, lobbyBtn, parseLobby, idle } from '../ui.js';
import { tr } from '../i18n.js';

// `intro(st)` and `renderGame(st)` write in `st.lang`, the host's language.
export function potGame({ key, cmd, title, about, maxPlayers, minPlayers = 2, startLabel, intro, renderGame, start, act }) {
  async function buttons(creatorId, bet, lang, extra = []) {
    const s = await lobbySig(key, creatorId, bet);
    return kb(
      [lobbyBtn(tr(lang, '🎟 Join ({n})', { n: bet }), key, 'j', creatorId, bet, s)],
      [lobbyBtn(tr(lang, startLabel), key, 's', creatorId, bet, s), lobbyBtn(tr(lang, '✖ Cancel'), key, 'x', creatorId, bet, s)],
      ...extra,
    );
  }

  async function view(st) {
    if (st.phase === 'lobby') return { text: intro(st), markup: await buttons(st.creator.id, st.bet, st.lang) };
    return renderGame(st);
  }

  return {
    key, cmd, title, about, group: 'duel', defaultBet: 100,
    view: (st) => { const { bullet: _b, ...rest } = st; return rest; },

    async lobby({ creator, bet, locale }) {
      return view({ phase: 'lobby', creator, bet, players: [], lang: locale });
    },

    async handle(ctx, args) {
      // In-game actions (after start) are plain `<key>:<act>…`; lobby actions are signed.
      if (!['j', 's', 'x'].includes(args[0])) return act(ctx, args, view);

      const lob = await parseLobby(key, args);
      if (!lob || lob.bet < 1) throw new GameError('Invalid game.');
      const { creatorId, bet } = lob;

      if (!(await ctx.session())) {
        const creator = await ctx.getPlayer(creatorId);
        const lang = await ctx.localeOf(creatorId);
        await ctx.create(key, { phase: 'lobby', creator: { id: creatorId, name: creator?.name ?? tr(lang, 'Host') }, bet, players: [], touched: Date.now(), lang });
      }

      if (args[0] === 'j') {
        if (!(await ctx.debit(ctx.user.id, bet))) throw new GameError('You need {n} chips — claim 🎁 Daily chips in my chat.', { n: bet });
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
        await ctx.answer(ctx.t("You're in! Pot: {n}", { n: bet * st.players.length }));
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
        await ctx.answer(ctx.t('Cancelled, stakes refunded'));
        return ctx.edit(`<b>${tr(st.lang, title)}</b>\n<i>${tr(st.lang, 'Cancelled — all stakes refunded.')}</i>`);
      }

      if (ctx.user.id !== creatorId) throw new GameError('Only the host can do that.');

      // 's' — start
      const { state: st, prev } = await ctx.mutate((s) => {
        if (s.phase !== 'lobby') throw new GameError('Already started.');
        if (s.players.length < minPlayers) throw new GameError('Need at least {n} players.', { n: minPlayers });
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
