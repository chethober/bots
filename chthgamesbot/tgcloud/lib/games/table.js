// Factory for "table" games: a shared message anyone can play. Every press is an
// independent bet settled on the spot; the message just keeps a log of recent plays.

import { GameError, btn, kb, esc, chips, BETS } from '../ui.js';

const LOG = 6;

export function tableGame({ key, cmd, title, about, rules, rows, play }) {
  // rows: [[betType, label], ...] — one keyboard row per bet type, one button per stake.
  const types = new Map(rows.map(([t, label]) => [t, label]));

  function render(log = []) {
    const lines = [`<b>${title}</b>`, rules, ''];
    if (log.length) lines.push(...log.map(esc));
    else lines.push('<i>No plays yet — pick a bet below.</i>');
    const keyboard = rows.map(([t, label]) => BETS.map((b) => btn(`${label} ${b}`, `${key}:p:${t}:${b}`)));
    return { text: lines.join('\n'), markup: kb(...keyboard) };
  }

  return {
    key, cmd, title, about, group: 'casino', defaultBet: 0,
    async lobby() { return render(); },
    render,
    view: (st) => ({ log: st.log }),

    async handle(ctx, [act, type, amount]) {
      const bet = Number(amount);
      if (act !== 'p' || !types.has(type) || !BETS.includes(bet)) throw new GameError('Unknown bet.');

      const me = await ctx.debit(ctx.user.id, bet);
      if (!me) throw new GameError(`Not enough chips for ${bet}. Try /daily.`);

      const { mult, show, detail } = play(type);   // mult = total return per chip staked
      const payout = Math.floor(bet * mult);
      const after = payout > 0 ? await ctx.credit(ctx.user.id, payout, bet) : me;
      const net = payout - bet;
      const delta = net > 0 ? `+${net}` : net === 0 ? '±0' : `−${-net}`;

      ctx.emit?.({ type, bet, mult, payout, net, show, detail, chips: after.chips });
      await ctx.answer(`${show}  ${delta} · balance ${chips(after.chips)}`);

      const line = `${ctx.user.name}: ${show} ${delta}`;
      let log;
      try {
        const existing = await ctx.session();
        if (!existing) await ctx.create(key, { log: [] });
        ({ state: { log } } = await ctx.mutate((s) => ({ log: [line, ...s.log].slice(0, LOG) })));
      } catch {
        return; // the bet is settled; a missed log line isn't worth an error
      }
      const view = render(log);
      await ctx.edit(view.text, view.markup);
    },
  };
}
