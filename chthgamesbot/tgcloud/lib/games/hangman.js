// Co-op hangman: anyone in the chat guesses letters, six lives, personal points per hit.

import { GameError, btn, kb, esc } from '../ui.js';
import { pick } from '../rng.js';
import WORDS from '../data/words.js';
import { tr } from '../i18n.js';

const KEY = 'hm';
const LIVES = 6;
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GALLOWS = ['😀', '🙂', '😐', '😟', '😨', '😱', '💀'];

function newWord() {
  const [cat, word] = pick(WORDS);
  return { cat, word, guessed: '', lives: LIVES, scores: {}, over: false, won: false };
}

// Writes in `st.lang`; the words themselves are English.
function render(st) {
  const L = (text, vars) => tr(st.lang, text, vars);
  const shown = [...st.word].map((ch) => (st.guessed.includes(ch) || st.over ? ch : '_')).join(' ');
  const lines = [
    `<b>${L('🔤 Hangman')}</b>`,
    L('Category: <b>{cat}</b>', { cat: esc(L(st.cat)) }),
    '',
    `<code>${shown}</code>`,
    '',
    `${GALLOWS[LIVES - st.lives]} ${L('Lives:')} ${'❤️'.repeat(st.lives)}${'🖤'.repeat(LIVES - st.lives)}`,
  ];
  const wrong = [...st.guessed].filter((c) => !st.word.includes(c));
  if (wrong.length) lines.push(`${L('Misses:')} ${wrong.join(' ')}`);
  const top = Object.values(st.scores).sort((a, b) => b.pts - a.pts).slice(0, 5);
  if (top.length) lines.push('', top.map((s) => `${esc(s.name)} ${s.pts}`).join(' · '));

  if (st.over) {
    lines.push('', st.won ? L('🎉 Solved!') : L('💀 Out of lives — it was <b>{word}</b>', { word: st.word }));
    return { text: lines.join('\n'), markup: kb([btn(L('🔁 New word'), `${KEY}:s`)]) };
  }
  const keys = [...ABC].map((c) => (st.guessed.includes(c) ? btn('·', `${KEY}:n`) : btn(c, `${KEY}:g:${c}`)));
  const rows = [];
  for (let i = 0; i < keys.length; i += 7) rows.push(keys.slice(i, i + 7));
  return { text: lines.join('\n'), markup: kb(...rows) };
}

export default {
  key: KEY, cmd: 'hangman', title: '🔤 Hangman', about: 'Guess the word together, letter by letter', group: 'party', defaultBet: 0,
  view: (st) => ({
    cat: st.cat, guessed: st.guessed, lives: st.lives, maxLives: LIVES, scores: st.scores, over: st.over, won: st.won,
    mask: [...st.word].map((c) => (st.over || st.guessed.includes(c) ? c : null)),
  }),

  async lobby({ locale } = {}) {
    return {
      text: `<b>${tr(locale, '🔤 Hangman')}</b>\n${tr(locale, 'Everyone guesses together — six lives. Points for every letter you find.')}`,
      markup: kb([btn(tr(locale, '▶️ Start'), `${KEY}:s`)]),
    };
  },

  async handle(ctx, [act, letter]) {
    if (act === 'n') return ctx.answer(ctx.t('Already guessed.'));
    let st;
    if (act === 's') {
      if (await ctx.create(KEY, newWord())) {
        st = (await ctx.session()).state;
      } else {
        ({ state: st } = await ctx.mutate((s) => {
          if (!s.over) throw new GameError('A word is already in play.');
          return newWord();
        }));
      }
      await ctx.answer();
    } else if (act === 'g') {
      if (!/^[A-Z]$/.test(letter ?? '')) throw new GameError('Bad letter.');
      let msg = '';
      ({ state: st } = await ctx.mutate((s) => {
        if (s.over) throw new GameError('This word is done.');
        if (s.guessed.includes(letter)) throw new GameError('Already guessed.');
        s.guessed += letter;
        const hits = [...s.word].filter((c) => c === letter).length;
        if (hits) {
          (s.scores[ctx.user.id] ??= { name: ctx.user.name, pts: 0 }).pts += hits;
          msg = `✅ ${letter} ×${hits}`;
          if ([...s.word].every((c) => s.guessed.includes(c))) { s.over = true; s.won = true; }
        } else {
          s.lives--;
          msg = ctx.t('❌ No {letter}', { letter });
          if (s.lives <= 0) s.over = true;
        }
        return s;
      }));
      await ctx.answer(msg);
    } else {
      throw new GameError('Unknown action.');
    }
    const view = render(st);
    await ctx.edit(view.text, view.markup);
  },
};

export { render, newWord };
