// Slots: three reels spin and land on the server's symbols.
import { h, busy, haptic, stakePicker, TABLE_BETS, resultLine, reduced, sleep } from '../kit.js';

const SYMS = ['🍒', '🍋', '🔔', '🍇', '💎', '7️⃣'];
const PAY = [['7️⃣7️⃣7️⃣', '150×'], ['💎💎💎', '60×'], ['🍇🍇🍇', '30×'], ['🔔🔔🔔', '20×'], ['🍋🍋🍋', '10×'], ['🍒🍒🍒', '8×'], ['7️⃣ pair', '3×'], ['💎 pair', '2×'], ['🔔/🍇 pair', '1×'], ['🍒/🍋 pair', '0.5×']];
const H = 96;

export function mount(root, ctx) {
  const reels = [0, 1, 2].map(() => {
    const strip = h('div.strip', h('div.sym', SYMS[Math.floor(Math.random() * 6)]));
    return { el: h('div.reel', strip), strip };
  });
  const out = h('div.result');
  const stake = stakePicker({ value: 50, options: TABLE_BETS });
  const spin = h('button.big', { onclick: () => busy(spin, go) }, 'Spin');
  const log = h('div.log');
  root.append(
    h('div.machine', h('div.reels', reels.map((r) => r.el)),
      h('div.paytable', PAY.map(([a, b]) => h('div', a, ' ', h('b', b))))),
    out, h('div.panel', stake.el, spin), log,
  );

  async function go() {
    const bet = stake.get();
    const res = await ctx.act(`sl:p:s:${bet}`);
    const { reels: final } = res.result.detail;
    haptic('medium');
    out.textContent = '';
    await Promise.all(reels.map((r, i) => spinTo(r, final[i], 900 + i * 350)));
    resultLine(out, res.result.net, res.result.net > 0 ? `+${res.result.net} (${res.result.mult}×)` : undefined);
    haptic(res.result.net > 0 ? 'success' : res.result.net === 0 ? 'warning' : 'light');
    update(res.view);
  }

  async function spinTo(r, sym, ms) {
    const n = reduced ? 1 : 18 + Math.floor(Math.random() * 4);
    const syms = [r.strip.lastChild.textContent];
    for (let i = 0; i < n - 1; i++) syms.push(SYMS[Math.floor(Math.random() * 6)]);
    syms.push(sym);
    r.strip.style.transition = 'none';
    r.strip.style.transform = 'translateY(0)';
    r.strip.replaceChildren(...syms.map((s) => h('div.sym', s)));
    void r.strip.offsetHeight;
    r.strip.style.transition = `transform ${reduced ? 1 : ms}ms cubic-bezier(.15,.6,.25,1.04)`;
    r.strip.style.transform = `translateY(${-(syms.length - 1) * H}px)`;
    await sleep(reduced ? 10 : ms);
    r.strip.style.transition = 'none';
    r.strip.style.transform = 'translateY(0)';
    r.strip.replaceChildren(h('div.sym', sym));
  }

  function update(view) {
    log.replaceChildren(...(view?.log ?? []).map((l) => h('div', l)));
  }
  return { update };
}
