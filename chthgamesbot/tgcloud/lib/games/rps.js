// Rock-paper-scissors for chips: both pick in secret, the message reveals when both are in.

import { GameError, btn, kb, esc, chips, lobbySig, lobbyBtn, parseLobby, idle } from '../ui.js';
import { tr } from '../i18n.js';

const KEY = 'rp';
const TITLE = '✂️ Rock Paper Scissors';
const MOVES = { r: '🪨 Rock', p: '📄 Paper', s: '✂️ Scissors' };
const BEATS = { r: 's', p: 'r', s: 'p' };

// Writes in `st.lang`, the challenger's language.
function render(st) {
  const L = (text, vars) => tr(st.lang, text, vars);
  const [a, b] = st.players;
  const lines = [`<b>${L(TITLE)}</b> · ${L('{chips} each', { chips: chips(st.bet) })}`, ''];
  if (st.history.length) lines.push(...st.history, '');
  if (st.winner == null) {
    for (const p of [a, b]) lines.push(`${st.picks[p.id] ? '✅' : '🤔'} ${esc(p.name)}`);
    return {
      text: `${lines.join('\n')}\n\n${L('Pick in secret:')}`,
      markup: kb(
        Object.entries(MOVES).map(([m, label]) => btn(L(label), `${KEY}:m:${m}`)),
        [btn(L('⏰ Call off & refund (10 min idle)'), `${KEY}:t`)],
      ),
    };
  }
  const w = st.players.find((p) => p.id === st.winner);
  lines.push(L('🏆 <b>{name}</b> wins {chips}', { name: esc(w.name), chips: chips(st.bet * 2) }));
  return { text: lines.join('\n'), markup: null };
}

export default {
  key: KEY, cmd: 'rps', title: TITLE, about: 'Secret picks, winner takes the pot', group: 'duel', defaultBet: 100,
  // Opponent's pick stays secret until the round resolves.
  view: (st, uid) => ({ ...st, picks: Object.fromEntries(Object.entries(st.picks ?? {}).map(([id, m]) => [id, Number(id) === uid ? m : true])) }),

  async lobby({ creator, bet, locale }) {
    const s = await lobbySig(KEY, creator.id, bet);
    return {
      text: `<b>${tr(locale, TITLE)}</b>\n\n${tr(locale, '<b>{name}</b> challenges you for <b>{chips}</b>.', { name: esc(creator.name), chips: chips(bet) })}`,
      markup: kb(
        [lobbyBtn(tr(locale, '⚔️ Accept {n}', { n: bet }), KEY, 'a', creator.id, bet, s)],
        [lobbyBtn(tr(locale, '✖ Cancel'), KEY, 'x', creator.id, bet, s)],
      ),
    };
  },

  async handle(ctx, args) {
    if (args[0] === 'm') return move(ctx, args[1]);
    if (args[0] === 't') return callOff(ctx);

    const lob = await parseLobby(KEY, args);
    if (!lob || lob.bet < 1) throw new GameError('Invalid game.');
    const { creatorId, bet } = lob;
    const lang = await ctx.localeOf(creatorId);

    if (args[0] === 'x') {
      if (ctx.user.id !== creatorId) throw new GameError('Only the creator can cancel.');
      if (!(await ctx.create(KEY, { cancelled: true, lang }))) throw new GameError('Already started.');
      await ctx.answer(ctx.t('Cancelled'));
      return ctx.edit(`<b>${tr(lang, TITLE)}</b>\n<i>${tr(lang, 'Cancelled.')}</i>`);
    }
    if (ctx.user.id === creatorId) throw new GameError('You need an opponent — share this message!');

    if (!(await ctx.debit(ctx.user.id, bet))) throw new GameError('You need {n} chips — claim 🎁 Daily chips in my chat.', { n: bet });
    const creator = await ctx.getPlayer(creatorId);
    const st = {
      bet,
      players: [{ id: creatorId, name: creator?.name ?? tr(lang, 'Player') }, ctx.user],
      picks: {}, history: [], winner: null, touched: Date.now(), lang,
    };
    if (!(await ctx.create(KEY, st))) {
      await ctx.refund(ctx.user.id, bet);
      throw new GameError('Someone beat you to it.');
    }
    if (!(await ctx.debit(creatorId, bet))) {
      await ctx.refund(ctx.user.id, bet);
      await ctx.mutate(() => ({ cancelled: true }));
      await ctx.answer(ctx.t('The creator is out of chips'), true);
      return ctx.edit(`<b>${tr(lang, TITLE)}</b>\n<i>${tr(lang, "Called off — {name} can't cover {chips}.", { name: tr(lang, 'the creator'), chips: chips(bet) })}</i>`);
    }
    await ctx.answer(ctx.t('Game on — pick your move!'));
    const view = render(st);
    await ctx.edit(view.text, view.markup);
  },
};

async function callOff(ctx) {
  const { state: st, prev } = await ctx.mutate((s) => {
    if (s.cancelled || s.winner != null) throw new GameError('This game is over.');
    if (!s.players.some((p) => p.id === ctx.user.id)) throw new GameError("You're not in this game.");
    if (!idle(s)) throw new GameError('Give them 10 minutes before calling it off.');
    s.cancelled = true;
    return s;
  });
  if (!prev.cancelled) for (const p of st.players) await ctx.refund(p.id, st.bet);
  await ctx.answer(ctx.t('Called off — stakes refunded'));
  return ctx.edit(`<b>${tr(st.lang, TITLE)}</b>\n<i>${tr(st.lang, 'Called off after 10 minutes of no moves — both stakes refunded.')}</i>`);
}

async function move(ctx, m) {
  if (!MOVES[m]) throw new GameError('Unknown move.');
  const { state: st, prev } = await ctx.mutate((s) => {
    if (s.cancelled || s.winner != null) throw new GameError('This game is over.');
    if (!s.players.some((p) => p.id === ctx.user.id)) throw new GameError("You're not in this game.");
    if (s.picks[ctx.user.id]) throw new GameError('You already picked.');
    s.picks[ctx.user.id] = m;
    s.touched = Date.now();
    const [a, b] = s.players;
    const pa = s.picks[a.id];
    const pb = s.picks[b.id];
    if (pa && pb) {
      s.history.push(`${esc(a.name)} ${tr(s.lang, MOVES[pa])} ${tr(s.lang, 'vs')} ${tr(s.lang, MOVES[pb])} ${esc(b.name)}`);
      (s.rounds ??= []).push([pa, pb]);
      if (pa === pb) {
        s.history.push(`<i>${tr(s.lang, 'Draw — go again!')}</i>`);
        s.picks = {};
      } else {
        s.winner = BEATS[pa] === pb ? a.id : b.id;
      }
    }
    return s;
  });
  // Pay exactly once: only the press whose save flipped `winner` from null pays.
  if (st.winner != null && prev.winner == null) await ctx.credit(st.winner, st.bet * 2, st.bet);
  await ctx.answer(ctx.t('You picked {move}', { move: ctx.t(MOVES[m]) }));
  const view = render(st);
  await ctx.edit(view.text, view.markup);
}
