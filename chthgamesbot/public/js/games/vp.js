// Video poker (Jacks or Better): tap cards to hold, then draw.
import { h, cardEl } from '../kit.js';
import { soloShell } from './solo.js';

const PAYS = [['Royal flush', 800], ['Straight flush', 50], ['Four of a kind', 25], ['Full house', 8], ['Flush', 5], ['Straight', 4], ['Three of a kind', 3], ['Two pair', 2], ['Jacks or better', 1]];

export function mount(root, ctx) {
  let lastHand = '';
  const table = h('div.panel', { style: { marginTop: 0, marginBottom: '12px' } });
  const paint = (hit) => table.replaceChildren(...PAYS.map(([n, m]) =>
    h('div.row', { style: { justifyContent: 'space-between', fontWeight: n === hit ? 800 : 500, color: n === hit ? 'var(--good)' : '' } }, h('span', n), h('span', `${m}×`))));
  paint(null);
  root.append(table);
  return soloShell(root, ctx, {
    renderPlay({ stage, controls, view, act }) {
      paint(view?.phase === 'done' ? view.result : null);
      if (!view) {
        stage.replaceChildren(h('div.felt', h('div.hand', { style: { justifyContent: 'center' } }, [0, 1, 2, 3, 4].map(() => cardEl(null)))));
        controls.replaceChildren();
        return;
      }
      const playing = view.phase === 'play';
      const prev = lastHand ? JSON.parse(lastHand) : [];
      lastHand = JSON.stringify(view.hand);
      stage.replaceChildren(h('div.felt',
        h('div.hand', { style: { justifyContent: 'center', gap: '5px', flexWrap: 'nowrap' } }, view.hand.map((c, i) => {
          const el = cardEl(c, view.held[i] ? 'held' : '');
          el.style.setProperty('--w', 'min(15.5vw, 62px)');
          if (prev[i] === c) el.style.animation = 'none';
          else el.style.animationDelay = `${i * 70}ms`;
          if (playing) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => act(`vp:h:${i}`));
          }
          return el;
        })),
        h('div', { style: { textAlign: 'center', marginTop: '10px', fontWeight: 700, minHeight: '22px' } },
          playing ? 'Tap cards to hold' : view.result),
      ));
      if (!playing) { controls.replaceChildren(); return; }
      const draw = h('button.big', { onclick: () => act('vp:x', draw) }, '🃏 Draw');
      controls.replaceChildren(draw);
    },
  });
}
