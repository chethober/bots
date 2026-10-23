// Trivia: fastest correct answer scores; a wrong answer locks you out of that question.
import { h, haptic, busy } from '../kit.js';
import { lobby, htmlLines } from './mp.js';

const L = ['A', 'B', 'C', 'D'];

function board(scores) {
  const rows = Object.values(scores ?? {}).sort((a, b) => b.pts - a.pts);
  const medals = ['🥇', '🥈', '🥉'];
  if (!rows.length) return h('p.muted', 'Nobody scored this round.');
  return h('div.players', rows.map((r, i) => h('div.prow', h('div', medals[i] ?? '•'), h('div.nm', r.name), h('div.val', r.pts))));
}

export function mount(root, ctx) {
  let lastI = -1;
  return {
    update(view, res, info) {
      if (!view) {
        return lobby(root, info, ctx, { ico: '🧠', text: () => 'Five questions. First correct answer scores — wrong answers lock you out of that question.', filter: (a) => a === 's' });
      }
      if (view.over) {
        const b = h('button.big', { onclick: () => busy(b, () => ctx.act('tv:s')) }, '🔁 New round');
        root.replaceChildren(h('h3', 'Final scores'), board(view.scores), b, htmlLines(view.log.slice(-3)));
        return;
      }
      if (view.i !== lastI && lastI !== -1) haptic('medium');
      lastI = view.i;
      const q = view.q;
      root.replaceChildren(
        h('div.muted', `Question ${view.i + 1} of ${view.total}${view.wrong ? ` · ${view.wrong} wrong` : ''}`),
        h('div.qcard', q.q),
        h('div.answers', q.opts.map((o, k) => {
          const b = h('button', { disabled: view.lockedOut }, h('b', L[k]), h('span', o));
          b.addEventListener('click', () => busy(b, async () => {
            const r = await ctx.act(`tv:a:${view.i}:${k}`);
            haptic(/Correct/.test(r.toast) ? 'success' : 'error');
          }));
          return b;
        })),
        view.lockedOut ? h('p.muted', '❌ Locked out of this question — wait for the next one.') : '',
        h('button.big.ghost', { onclick: (e) => busy(e.currentTarget, () => ctx.act(`tv:k:${view.i}`)) }, '⏭ Skip question'),
        htmlLines(view.log.slice(-2)),
        Object.keys(view.scores).length ? board(view.scores) : '',
      );
    },
  };
}
