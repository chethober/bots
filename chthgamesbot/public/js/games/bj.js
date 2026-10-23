// Blackjack on felt: dealer's hole card stays face down until the hand ends.
import { h, cardEl } from '../kit.js';
import { soloShell } from './solo.js';

function value(cards) {
  let t = 0, aces = 0;
  for (const c of cards) {
    if (c == null) continue;
    const r = c % 13;
    if (r === 0) { aces++; t += 11; } else t += Math.min(r + 1, 10);
  }
  while (t > 21 && aces--) t -= 10;
  return t;
}

export function mount(root, ctx) {
  let shown = { p: 0, d: 0 };
  return soloShell(root, ctx, {
    renderPlay({ stage, controls, view, act }) {
      if (!view) {
        stage.replaceChildren(h('div.felt', h('div.waiting', { style: { color: '#fff' } }, h('span.big-ico', '🃏'), 'Place a stake and deal.')));
        controls.replaceChildren();
        return;
      }
      // Only animate cards that are new since the last render.
      const fresh = view.p.length < shown.p ? { p: 0, d: 0 } : shown;
      const hand = (cards, key) => h('div.hand', cards.map((c, i) => {
        const el = cardEl(c);
        if (i < fresh[key]) el.style.animation = 'none';
        else el.style.animationDelay = `${(i - fresh[key]) * 120}ms`;
        return el;
      }));
      const dv = view.d.includes(null) ? value([view.d[0]]) : value(view.d);
      stage.replaceChildren(h('div.felt',
        h('div.lbl', 'Dealer', h('span.total', view.d.includes(null) ? `${dv} + ?` : dv)), hand(view.d, 'd'),
        h('div.lbl', { style: { marginTop: '14px' } }, `You · stake ${view.stake}${view.doubled ? ' (doubled)' : ''}`, h('span.total', value(view.p))), hand(view.p, 'p'),
        view.result ? h('div', { style: { marginTop: '10px', fontWeight: 800, fontSize: '18px' } }, view.result) : '',
      ));
      shown = { p: view.p.length, d: view.d.length };
      if (view.phase !== 'play') { controls.replaceChildren(); return; }
      const hit = h('button.big', { onclick: () => act('bj:h', hit) }, '👆 Hit');
      const stand = h('button.big.ghost', { onclick: () => act('bj:s', stand) }, '✋ Stand');
      const dbl = view.p.length === 2 ? h('button.big.ghost', { onclick: () => act('bj:x', dbl) }, '⏫ Double') : null;
      controls.replaceChildren(h('div.btns', hit, stand, dbl));
    },
  });
}
