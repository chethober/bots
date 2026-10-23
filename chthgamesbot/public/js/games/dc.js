// Over / Under 7: two dice tumble and land on the server's roll.
import { h, busy, haptic, stakePicker, TABLE_BETS, resultLine, dieEl, rollDice } from '../kit.js';

export function mount(root, ctx) {
  const dice = [dieEl(3), dieEl(4)];
  const sum = h('div.result', '');
  const stake = stakePicker({ value: 50, options: TABLE_BETS });
  const mk = (type, label, pays) => {
    const b = h('button.big', { onclick: () => busy(b, () => go(type)) }, label, h('div', { style: { fontSize: '12px', opacity: .8 } }, pays));
    return b;
  };
  const log = h('div.log');
  root.append(
    h('div.felt', h('div.dice', dice)), sum,
    h('div.panel', stake.el, h('div.btns', mk('u', '⬇️ Under 7', '2.3×'), mk('s', '7️⃣ Seven', '5.5×'), mk('o', '⬆️ Over 7', '2.3×'))),
    log,
  );

  async function go(type) {
    const res = await ctx.act(`dc:p:${type}:${stake.get()}`);
    const [a, b] = res.result.detail.dice;
    sum.textContent = '';
    haptic('medium');
    await rollDice(dice, [a, b]);
    resultLine(sum, res.result.net, `${a + b} · ${res.result.net > 0 ? '+' + res.result.net : '−' + -res.result.net}`);
    haptic(res.result.net > 0 ? 'success' : 'light');
    log.replaceChildren(...res.view.log.map((l) => h('div', l)));
  }
  return { update(view) { log.replaceChildren(...(view?.log ?? []).map((l) => h('div', l))); } };
}
