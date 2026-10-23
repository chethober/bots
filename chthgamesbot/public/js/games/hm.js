// Hangman: everyone guesses together; the gallows draws itself as lives run out.
import { h, haptic, busy } from '../kit.js';
import { lobby } from './mp.js';

const PARTS = [
  '<circle cx="140" cy="62" r="16"/>', '<line x1="140" y1="78" x2="140" y2="128"/>',
  '<line x1="140" y1="92" x2="118" y2="112"/>', '<line x1="140" y1="92" x2="162" y2="112"/>',
  '<line x1="140" y1="128" x2="122" y2="156"/>', '<line x1="140" y1="128" x2="158" y2="156"/>',
];

function gallows(misses) {
  const svg = `<svg viewBox="0 0 200 180" width="100%" style="max-height:170px" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
    <line x1="30" y1="170" x2="110" y2="170"/><line x1="60" y1="170" x2="60" y2="20"/><line x1="60" y1="20" x2="140" y2="20"/><line x1="140" y1="20" x2="140" y2="46"/>
    ${PARTS.slice(0, misses).join('')}</svg>`;
  return h('div', { html: svg, style: { color: 'var(--text)', textAlign: 'center' } });
}

export function mount(root, ctx) {
  let lastGuessed = null;
  return {
    update(view, res, info) {
      if (!view) return lobby(root, info, ctx, { ico: '🔤', text: () => 'Guess the word together — six lives.', filter: (a) => a === 's' });
      if (lastGuessed != null && view.guessed !== lastGuessed) haptic(view.over ? (view.won ? 'success' : 'error') : 'light');
      lastGuessed = view.guessed;
      const misses = view.maxLives - view.lives;
      const word = h('div.word', view.mask.map((c) => h('span', c ?? '')));
      const keys = h('div.keys', [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((L) => {
        const used = view.guessed.includes(L);
        const hit = used && view.mask.includes(L);
        const b = h(`button${used ? (hit ? '.hit' : '.miss') : ''}`, { disabled: used || view.over }, L);
        if (!used && !view.over) b.addEventListener('click', () => busy(b, () => ctx.act(`hm:g:${L}`)));
        return b;
      }));
      const top = Object.values(view.scores).sort((a, b) => b.pts - a.pts).slice(0, 5);
      const kids = [
        h('div.muted', { style: { textAlign: 'center' } }, `Category: ${view.cat} · ${'❤️'.repeat(view.lives)}${'🖤'.repeat(misses)}`),
        gallows(misses), word,
      ];
      if (view.over) {
        kids.push(h(`div.result.${view.won ? 'win' : 'lose'}`, view.won ? 'Solved! 🎉' : 'Out of lives'));
        const b = h('button.big', { onclick: () => busy(b, () => ctx.act('hm:s')) }, '🔁 New word');
        kids.push(b);
      } else kids.push(keys);
      if (top.length) kids.push(h('p.muted', { style: { textAlign: 'center' } }, top.map((s) => `${s.name} ${s.pts}`).join(' · ')));
      root.replaceChildren(...kids);
    },
  };
}
