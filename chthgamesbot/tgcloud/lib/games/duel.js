// Factory for instant 1-v-1 duels: the creator posts a stake, the first taker matches
// it, one roll decides, the winner takes both stakes.

import { GameError, kb, esc, chips, lobbySig, lobbyBtn, parseLobby } from '../ui.js';

export function duelGame({ key, cmd, title, about, rules, resolve }) {
  async function lobby({ creator, bet }) {
    const s = await lobbySig(key, creator.id, bet);
    return {
      text: `<b>${title}</b>\n${rules}\n\n<b>${esc(creator.name)}</b> puts up <b>${chips(bet)}</b>. Who's in?`,
      markup: kb(
        [lobbyBtn(`⚔️ Accept ${bet}`, key, 'a', creator.id, bet, s)],
        [lobbyBtn('✖ Cancel', key, 'x', creator.id, bet, s)],
      ),
    };
  }

  return {
    key, cmd, title, about, group: 'duel', defaultBet: 100, lobby,
    view: (st) => st,

    async handle(ctx, args) {
      const lob = await parseLobby(key, args);
      if (!lob || lob.bet < 1) throw new GameError('Invalid game.');
      const { creatorId, bet } = lob;

      if (args[0] === 'x') {
        if (ctx.user.id !== creatorId) throw new GameError('Only the creator can cancel.');
        if (!(await ctx.create(key, { done: true, cancelled: true }))) throw new GameError('Too late — already played.');
        await ctx.answer('Cancelled');
        return ctx.edit(`<b>${title}</b>\n<i>Cancelled.</i>`);
      }
      if (args[0] !== 'a') throw new GameError('Unknown action.');
      if (ctx.user.id === creatorId) throw new GameError('You need an opponent — share this message!');

      // Stake → claim the message → stake the creator. Each failure undoes the steps before it.
      if (!(await ctx.debit(ctx.user.id, bet))) throw new GameError(`You need ${bet} chips. Try /daily.`);
      if (!(await ctx.create(key, { done: true }))) {
        await ctx.refund(ctx.user.id, bet);
        throw new GameError('Someone beat you to it.');
      }
      const creator = await ctx.getPlayer(creatorId);
      if (!(await ctx.debit(creatorId, bet))) {
        await ctx.refund(ctx.user.id, bet);
        await ctx.answer('The creator is out of chips', true);
        return ctx.edit(`<b>${title}</b>\n<i>Called off — ${esc(creator?.name ?? 'the creator')} can't cover ${chips(bet)}.</i>`);
      }

      const a = { id: creatorId, name: creator.name };
      const b = ctx.user;
      const { winner, story, detail } = resolve(a, b); // winner: 'a' | 'b'
      const w = winner === 'a' ? a : b;
      await ctx.credit(w.id, bet * 2, bet);
      try {
        await ctx.mutate(() => ({ done: true, bet, a, b, winner: w.id, detail }));
      } catch (e) {
        console.warn('duel result not stored', e.message); // chips already settled; display only
      }

      await ctx.answer(w.id === ctx.user.id ? `You won ${bet * 2}!` : 'You lost.');
      await ctx.edit(
        `<b>${title}</b> · ${chips(bet)} each\n\n${story}\n\n🏆 <b>${esc(w.name)}</b> wins ${chips(bet * 2)}`,
      );
    },
  };
}
