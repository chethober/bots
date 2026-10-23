// Fastest-finger trivia for groups: first correct answer scores, a wrong answer locks
// you out of that question. Five questions per round.

import { GameError, btn, kb, esc } from '../ui.js';
import { shuffle } from '../rng.js';
import QUESTIONS from '../data/trivia.js';
import { tr } from '../i18n.js';

const KEY = 'tv';
const ROUND = 5;
const LETTERS = ['A', 'B', 'C', 'D'];

function newRound() {
  const picks = shuffle(QUESTIONS.map((_, i) => i)).slice(0, ROUND);
  return {
    i: 0, scores: {}, out: [], log: [], over: false,
    qs: picks.map((qi) => {
      const [q, right, ...wrong] = QUESTIONS[qi];
      const opts = shuffle([right, ...wrong]);
      return { q, opts, ans: opts.indexOf(right) };
    }),
  };
}

function scoreboard(st) {
  const rows = Object.values(st.scores).sort((a, b) => b.pts - a.pts);
  if (!rows.length) return `<i>${tr(st.lang, 'Nobody scored.')}</i>`;
  const medals = ['🥇', '🥈', '🥉'];
  return rows.map((r, i) => `${medals[i] ?? '•'} ${esc(r.name)} — ${r.pts}`).join('\n');
}

// Writes in `st.lang`; the questions themselves are English.
function render(st) {
  const L = (text, vars) => tr(st.lang, text, vars);
  const lines = [`<b>${L('🧠 Trivia')}</b>`];
  if (st.log.length) lines.push('', ...st.log.slice(-2));
  if (st.over) {
    lines.push('', `<b>${L('Final scores')}</b>`, scoreboard(st));
    return { text: lines.join('\n'), markup: kb([btn(L('🔁 New round'), `${KEY}:s`)]) };
  }
  const q = st.qs[st.i];
  lines.push('', `<b>${L('Q{n}/{total}.', { n: st.i + 1, total: ROUND })}</b> ${esc(q.q)}`, '');
  lines.push(...q.opts.map((o, k) => `${LETTERS[k]}. ${esc(o)}`));
  if (st.out.length) lines.push('', L('❌ {n} wrong so far', { n: st.out.length }));
  return {
    text: lines.join('\n'),
    markup: kb(
      q.opts.map((_, k) => btn(LETTERS[k], `${KEY}:a:${st.i}:${k}`)),
      [btn(L('⏭ Skip question'), `${KEY}:k:${st.i}`)],
    ),
  };
}

function advance(st) {
  st.i++;
  st.out = [];
  if (st.i >= ROUND) st.over = true;
}

export default {
  key: KEY, cmd: 'trivia', title: '🧠 Trivia', about: 'Fastest finger wins — 5 questions', group: 'party', defaultBet: 0,
  // Only the current question, without its answer.
  view: (st, uid) => ({
    i: st.i, total: ROUND, over: st.over, scores: st.scores, log: st.log,
    lockedOut: st.out.includes(uid), wrong: st.out.length,
    q: st.over ? null : { q: st.qs[st.i].q, opts: st.qs[st.i].opts },
  }),

  async lobby({ locale } = {}) {
    return {
      text: `<b>${tr(locale, '🧠 Trivia')}</b>\n${tr(locale, 'Five questions. First correct answer scores — a wrong answer locks you out of that question.')}`,
      markup: kb([btn(tr(locale, '▶️ Start'), `${KEY}:s`)]),
    };
  },

  async handle(ctx, [act, qi, opt]) {
    let st;
    if (act === 's') {
      if (!(await ctx.create(KEY, newRound()))) {
        ({ state: st } = await ctx.mutate((s) => {
          if (!s.over) throw new GameError('A round is already running.');
          return newRound();
        }));
      } else {
        st = (await ctx.session()).state;
      }
      await ctx.answer(ctx.t('Go!'));
    } else if (act === 'a' || act === 'k') {
      let verdict = '';
      ({ state: st } = await ctx.mutate((s) => {
        if (s.over || String(s.i) !== qi) throw new GameError('That question is done.');
        const q = s.qs[s.i];
        if (act === 'k') {
          s.log.push(tr(s.lang, '⏭ Skipped — answer: <b>{answer}</b>', { answer: esc(q.opts[q.ans]) }));
          advance(s);
          return s;
        }
        if (s.out.includes(ctx.user.id)) throw new GameError("You're locked out of this one.");
        if (Number(opt) === q.ans) {
          const me = (s.scores[ctx.user.id] ??= { name: ctx.user.name, pts: 0 });
          me.pts++;
          s.log.push(`✅ <b>${esc(ctx.user.name)}</b>: ${esc(q.opts[q.ans])}`);
          verdict = ctx.t('Correct! +1');
          advance(s);
        } else {
          s.out.push(ctx.user.id);
          verdict = ctx.t('Wrong — locked out of this question.');
        }
        return s;
      }));
      await ctx.answer(verdict);
    } else {
      throw new GameError('Unknown action.');
    }
    const view = render(st);
    await ctx.edit(view.text, view.markup);
  },
};

export { newRound, render };
