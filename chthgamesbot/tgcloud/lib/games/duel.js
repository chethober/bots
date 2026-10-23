// Factory for instant 1-v-1 duels: the creator posts a stake, the first taker matches
// it, one roll decides, the winner takes both stakes.

import { GameError, kb, esc, chips, lobbySig, lobbyBtn, parseLobby } from '../ui.js';
import { tr } from '../i18n.js';

// The message stays in the creator's language; `resolve(a, b, lang)` writes the story in it.
export function duelGame({ key, cmd, title, about, rules, resolve }) {
  async function lobby({ creator, bet, locale }) {
    const s = await lobbySig(key, creator.id, bet);
    return {
      text: `<b>${tr(locale, title)}</b>\n${tr(locale, rules)}\n\n`
        + tr(locale, "<b>{name}</b> puts up <b>{chips}</b>. Who's in?", { name: esc(creator.name), chips: chips(bet) }),
      markup: kb(
        [lobbyBtn(tr(locale, '⚔️ Accept {n}', { n: bet }), key, 'a', creator.id, bet, s)],
        [lobbyBtn(tr(locale, '✖ Cancel'), key, 'x', creator.id, bet, s)],
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
      const lang = await ctx.localeOf(creatorId);

      if (args[0] === 'x') {
        if (ctx.user.id !== creatorId) throw new GameError('Only the creator can cancel.');
        if (!(await ctx.create(key, { done: true, cancelled: true, lang }))) throw new GameError('Too late — already played.');
        await ctx.answer(ctx.t('Cancelled'));
        return ctx.edit(`<b>${tr(lang, title)}</b>\n<i>${tr(lang, 'Cancelled.')}</i>`);
      }
      if (args[0] !== 'a') throw new GameError('Unknown action.');
      if (ctx.user.id === creatorId) throw new GameError('You need an opponent — share this message!');

      // Stake → claim the message → stake the creator. Each failure undoes the steps before it.
      if (!(await ctx.debit(ctx.user.id, bet))) throw new GameError('You need {n} chips — claim 🎁 Daily chips in my chat.', { n: bet });
      if (!(await ctx.create(key, { done: true, lang }))) {
        await ctx.refund(ctx.user.id, bet);
        throw new GameError('Someone beat you to it.');
      }
      const creator = await ctx.getPlayer(creatorId);
      if (!(await ctx.debit(creatorId, bet))) {
        await ctx.refund(ctx.user.id, bet);
        await ctx.answer(ctx.t('The creator is out of chips'), true);
        return ctx.edit(`<b>${tr(lang, title)}</b>\n<i>${tr(lang, "Called off — {name} can't cover {chips}.", { name: esc(creator?.name ?? tr(lang, 'the creator')), chips: chips(bet) })}</i>`);
      }

      const a = { id: creatorId, name: creator.name };
      const b = ctx.user;
      const { winner, story, detail } = resolve(a, b, lang); // winner: 'a' | 'b'
      const w = winner === 'a' ? a : b;
      await ctx.credit(w.id, bet * 2, bet);
      try {
        await ctx.mutate(() => ({ done: true, bet, a, b, winner: w.id, detail, lang }));
      } catch (e) {
        console.warn('duel result not stored', e.message); // chips already settled; display only
      }

      await ctx.answer(w.id === ctx.user.id ? ctx.t('You won {n}!', { n: bet * 2 }) : ctx.t('You lost.'));
      await ctx.edit(
        `<b>${tr(lang, title)}</b> · ${tr(lang, '{chips} each', { chips: chips(bet) })}\n\n${story}\n\n`
          + tr(lang, '🏆 <b>{name}</b> wins {chips}', { name: esc(w.name), chips: chips(bet * 2) }),
      );
    },
  };
}
