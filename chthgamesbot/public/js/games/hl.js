// Hi-Lo: guess if the next card is higher or lower; the multiplier compounds.
import { h, fmt, cardEl } from '../kit.js';
import { soloShell } from './solo.js';

export function mount(root, ctx) {
  return soloShell(root, ctx, {
    renderPlay({ stage, controls, view, act }) {
      if (!view) {
        stage.replaceChildren(h('div.felt', h('div.waiting', { style: { color: '#fff' } }, h('span.big-ico', '📈'), 'Higher or lower? Riskier calls pay more.')));
        controls.replaceChildren();
        return;
      }
      const trail = h('div.log', view.trail.slice(-5).map((t) => h('div', { style: { color: '#fff', opacity: .85 } }, t)));
      stage.replaceChildren(h('div.felt', { style: { textAlign: 'center' } },
        h('div.lbl', `Stake ${fmt(view.stake)} · `, h('b', `${view.mult}×`)),
        h('div', { style: { display: 'flex', justifyContent: 'center', margin: '8px 0' } }, cardForStr(view.card)),
        trail));
      if (view.phase !== 'play') { controls.replaceChildren(); return; }
      const hi = h('button.big', { onclick: () => act('hl:h', hi) }, `⬆️ Higher/same`, h('div', { style: { fontSize: '12px', opacity: .85 } }, `→ ${view.hi}×`));
      const lo = h('button.big', { onclick: () => act('hl:l', lo) }, `⬇️ Lower/same`, h('div', { style: { fontSize: '12px', opacity: .85 } }, `→ ${view.lo}×`));
      const rows = [h('div.btns', hi, lo)];
      if (view.trail.length) {
        const cash = h('button.big.good', { onclick: () => act('hl:o', cash) }, `💰 Cash out ${fmt(Math.floor(view.stake * view.mult))}`);
        rows.push(cash);
      }
      controls.replaceChildren(...rows);
    },
  });
}

const cardForStr = (c) => cardEl(c, 'big');
