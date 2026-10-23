// Factory for "table" games: a shared message anyone can play. Every press is an
// independent bet settled on the spot; the message just keeps a log of recent plays.

import { GameError, btn, kb, esc, chips, BETS } from '../ui.js';
import { tr } from '../i18n.js';

const LOG = 6;

export function tableGame({ key, cmd, title, about, rules, rows, play }) {
  // rows: [[betType, label], ...] — one keyboard row per bet type, one button per stake.
  const types = new Map(rows.map(([t, label]) => [t, label]));

  // `lang`: the message's language (whoever posted it).
  function render(log = [], lang = 'en') {
    const lines = [`<b>${tr(lang, title)}</b>`, tr(lang, rules), ''];
    if (log.length) lines.push(...log.map(esc));
    else lines.push(`<i>${tr(lang, 'No plays yet — pick a bet below.')}</i>`);
    const keyboard = rows.map(([t, label]) => BETS.map((b) => btn(`${tr(lang, label)} ${b}`, `${key}:p:${t}:${b}`)));
    return { text: lines.join('\n'), markup: kb(...keyboard) };
  }

  return {
    key, cmd, title, about, group: 'casino', defaultBet: 0,
    async lobby({ locale } = {}) { return render([], locale); },
    render,
    view: (st) => ({ log: st.log }),

    async handle(ctx, [act, type, amount]) {
      const bet = Number(amount);
      if (act !== 'p' || !types.has(type) || !BETS.includes(bet)) throw new GameError('Unknown bet.');

      const me = await ctx.debit(ctx.user.id, bet);
      if (!me) throw new GameError('Not enough chips for {n} — claim 🎁 Daily chips in my chat.', { n: bet });

      const { mult, show, detail } = play(type);   // mult = total return per chip staked
      const payout = Math.floor(bet * mult);
      const after = payout > 0 ? await ctx.credit(ctx.user.id, payout, bet) : me;
      const net = payout - bet;
      const delta = net > 0 ? `+${net}` : net === 0 ? '±0' : `−${-net}`;

      ctx.emit?.({ type, bet, mult, payout, net, show, detail, chips: after.chips });
      await ctx.answer(`${ctx.t(show)}  ${delta} · ${ctx.t('balance {chips}', { chips: chips(after.chips) })}`);

      let log, lang;
      try {
        const existing = await ctx.session();
        if (!existing) await ctx.create(key, { log: [] });
        ({ state: { log, lang } } = await ctx.mutate((s) => ({ ...s, log: [`${ctx.user.name}: ${tr(s.lang, show)} ${delta}`, ...s.log].slice(0, LOG) })));
      } catch {
        return; // the bet is settled; a missed log line isn't worth an error
      }
      const view = render(log, lang);
      await ctx.edit(view.text, view.markup);
    },
  };
}
