// Shared scaffolding for solo games: stake + deal when idle, game controls while playing.
import { h, busy, haptic, stakePicker, resultLine, fmt } from '../kit.js';

export function soloShell(root, ctx, { dealLabel = 'Deal', variants = null, renderPlay }) {
  const stage = h('div');
  const out = h('div.result');
  const stake = stakePicker({ value: 100 });
  let variant = variants ? variants[1][0] : '';
  const varSeg = variants ? h('div.seg', variants.map(([v, label]) => {
    const b = h('button', { onclick: () => { variant = v; [...varSeg.children].forEach((x) => x.classList.toggle('on', x === b)); haptic('select'); } }, label);
    if (v === variant) b.classList.add('on');
    return b;
  })) : null;
  const deal = h('button.big', { onclick: () => busy(deal, async () => { const res = await ctx.deal(stake.get(), variant); haptic('medium'); api.update(res.view, res); }) }, dealLabel);
  const setup = h('div.panel', stake.el, varSeg ? h('div.row', h('span.l', 'Mines'), varSeg) : '', deal);
  const controls = h('div');
  root.append(stage, out, controls, setup);

  const api = {
    update(view, res) {
      const playing = view?.phase === 'play';
      setup.classList.toggle('hidden', playing);
      deal.textContent = view ? `${dealLabel} again` : dealLabel;
      renderPlay({ stage, controls, view, res, act: (data, btn) => busy(btn, async () => { const r = await ctx.act(data); api.update(r.view, r); return r; }) });
      if (view?.phase === 'done') {
        const net = view.payout - view.stake;
        resultLine(out, net, net > 0 ? `Won ${fmt(net)}` : net === 0 ? 'Stake back' : `Lost ${fmt(-net)}`);
        if (res) haptic(net > 0 ? 'success' : net < 0 ? 'error' : 'warning');
      } else {
        out.className = 'result';
        out.textContent = '';
      }
    },
  };
  return api;
}
