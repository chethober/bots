// Coinflip: a 3D coin spins and lands on the server's side.
import { h, busy, haptic, stakePicker, TABLE_BETS, resultLine, reduced, sleep } from '../kit.js';

export function mount(root, ctx) {
  const coin = h('div.coin3d', h('div.face.h', '👑'), h('div.face.t', '🦅'));
  let turns = 0; // cumulative half-turns, so the coin keeps spinning forward
  const out = h('div.result');
  const stake = stakePicker({ value: 50, options: TABLE_BETS });
  const heads = h('button.big', { onclick: () => busy(heads, () => go('h')) }, '👑 Heads');
  const tails = h('button.big', { onclick: () => busy(tails, () => go('t')) }, '🦅 Tails');
  const log = h('div.log');
  root.append(h('div.coin-stage', coin), out, h('div.panel', stake.el, h('div.btns', heads, tails)), h('p.muted', 'A right call pays 1.95×.'), log);

  async function go(call) {
    const res = await ctx.act(`cf:p:${call}:${stake.get()}`);
    const side = res.result.detail.side;
    out.textContent = '';
    haptic('medium');
    const showing = turns % 2 === 0 ? 'h' : 't';
    turns += 8 + (side === showing ? 0 : 1);
    coin.style.transition = reduced ? 'none' : 'transform 1.4s cubic-bezier(.2,.7,.2,1)';
    coin.style.transform = `rotateY(${turns * 180}deg)`;
    await sleep(reduced ? 0 : 1400);
    resultLine(out, res.result.net, `${side === 'h' ? '👑 Heads' : '🦅 Tails'} · ${res.result.net > 0 ? '+' + res.result.net : '−' + -res.result.net}`);
    haptic(res.result.net > 0 ? 'success' : 'light');
    log.replaceChildren(...res.view.log.map((l) => h('div', l)));
  }
  return { update(view) { log.replaceChildren(...(view?.log ?? []).map((l) => h('div', l))); } };
}
