// Factory for the Persian partnership trick-taking games (Hokm, Shelem). Four seats in join
// order; partners sit opposite (seats 0+2 🔵 vs 1+3 🔴) and play goes round by seat number.
// You must follow the led suit if you can; the highest trump, else the highest card of the
// led suit, takes the trick. Each game adds its own deal, trump/bidding and scoring.
//
// Money: everyone pays the stake on joining; the winning team's two players get 2× back.
// As in holdem.js, a mutation collects what it owes in `s.payq` (reset at the start of
// every mutation) and the caller pays exactly that after the save.
//
// Hands are private. In chat a player taps "👀 My hand" (an alert only they see) and plays
// by slot number: the slot buttons are the same for everyone and say nothing about the
// cards. The Mini App gets only the viewer's own hand from `view`.

import { GameError, btn, kb, esc, chips, lobbySig, lobbyBtn, parseLobby, idle } from '../ui.js';
import { cardStr } from './cards.js';
import { tr } from '../i18n.js';

export const SUITS = ['♠️', '♥️', '♦️', '♣️'];
export const MARKS = ['🔵', '🔴'];
const NUM = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

export const suitOf = (c) => Math.floor(c / 13);
export const valOf = (c) => (c % 13 === 0 ? 14 : (c % 13) + 1); // ace high
export const teamOf = (seat) => seat % 2;

// Sorted for display: ♠ ♥ ♣ ♦ (colours alternate), high to low within a suit.
const SUIT_ORDER = [0, 1, 3, 2];
export function sortHand(cards) {
  return cards.slice().sort((a, b) => SUIT_ORDER.indexOf(suitOf(a)) - SUIT_ORDER.indexOf(suitOf(b)) || valOf(b) - valOf(a));
}

export function trickWinner(trick, trump) {
  let top = trick[0];
  for (const t of trick.slice(1)) {
    const same = suitOf(t.card) === suitOf(top.card);
    if (same ? valOf(t.card) > valOf(top.card) : suitOf(t.card) === trump) top = t;
  }
  return top.seat;
}

// Slots `seat` may play now: any card when leading, else the led suit if they have it.
export function legalSlots(s, seat) {
  const hand = s.hands[seat];
  const slots = hand.flatMap((c, i) => (c == null ? [] : [i]));
  if (!s.trick.length) return slots;
  const led = suitOf(s.trick[0].card);
  const follow = slots.filter((i) => suitOf(hand[i]) === led);
  return follow.length ? follow : slots;
}

const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// spec: { key, cmd, title, about, intro, target,
//   begin(s)              once, when the table fills (first Hakem, first dealer…)
//   deal(s)               a new hand: s.hands, s.phase, s.toAct
//   actions: { a(s, seat, args) }   the game's own pre-play steps (trump, bids, discards)
//   onTrick(s, winner)    before the trick is cleared (card points)
//   handOver(s) → bool
//   score(s) → lines      adds the hand to s.score, returns its summary
//   next(s)               rotate for the next hand
//   status(s, L) → lines  the game's header lines
//   prompt(s, L) → { line, rows }   for the pre-play phases
//   visibleHand(s, seat)  optional: what a player may see of their hand right now }
export function trickGame(spec) {
  const { key, title, target } = spec;
  const hand = (s, seat) => (spec.visibleHand ? spec.visibleHand(s, seat) : s.hands[seat]);

  function newGame({ creator, stake, data, lang = 'en' }) {
    return {
      phase: 'lobby', host: creator, stake, data, lang, seats: [], seq: 0, hand: 0,
      score: [0, 0], tricks: [0, 0], trick: [], last: null, trump: null, toAct: -1,
      log: [], result: null, winner: null, payq: [], touched: Date.now(),
    };
  }

  function deal(s) {
    s.hand++;
    s.seq++;
    s.trick = [];
    s.last = null;
    s.tricks = [0, 0];
    s.trump = null;
    spec.deal(s);
    return s;
  }

  function finish(s, team) {
    s.phase = 'ended';
    s.winner = team;
    s.toAct = -1;
    if (s.stake) s.seats.forEach((p, i) => { if (teamOf(i) === team) s.payq.push([p.id, s.stake * 2]); });
    return s;
  }

  function endHand(s) {
    s.result = spec.score(s);
    const [a, b] = s.score;
    // Reaching the target wins; sinking to minus the target (failed bids) loses.
    if ((a >= target || b >= target || a <= -target || b <= -target) && a !== b) return finish(s, a > b ? 0 : 1);
    spec.next(s);
    return deal(s);
  }

  function play(s, seat, slot) {
    if (s.phase !== 'play') throw new GameError('Not the time to play a card.');
    if (!legalSlots(s, seat).includes(slot)) {
      if (s.hands[seat][slot] == null) throw new GameError('Bad card.');
      throw new GameError('You must follow {suit}.', { suit: SUITS[suitOf(s.trick[0].card)] });
    }
    const card = s.hands[seat][slot];
    s.hands[seat][slot] = null;
    s.trick.push({ seat, card });
    s.result = null;
    s.seq++;
    if (s.trick.length < 4) {
      s.toAct = (seat + 1) % 4;
      return s;
    }
    const w = trickWinner(s.trick, s.trump);
    s.tricks[teamOf(w)]++;
    spec.onTrick?.(s, w);
    s.last = { cards: s.trick, winner: w };
    s.trick = [];
    s.toAct = w;
    return spec.handOver(s) ? endHand(s) : s;
  }

  // ---- rendering ------------------------------------------------------------------

  const teamLine = (s, t) => `${MARKS[t]} ${s.seats.filter((_, i) => teamOf(i) === t).map((p) => esc(p.name)).join(' & ')}`;
  const played = (s, cards) => cards.map((x) => `${esc(s.seats[x.seat].name)} ${cardStr(x.card)}`).join(' · ');

  // The slots still in `seat`'s hand, as buttons — the same for every viewer.
  function slotRows(s, seat, act) {
    const left = hand(s, seat).flatMap((c, i) => (c == null ? [] : [btn(NUM[i], `${key}:${act}:${s.seq}:${i}`)]));
    return chunk(left, left.length > 14 ? 8 : 7);
  }

  function render(s) {
    const L = (text, vars) => tr(s.lang, text, vars);
    const head = `<b>${L(title)}</b>${s.stake ? ` · ${L('stake {chips} each', { chips: chips(s.stake) })}` : ''}`;
    if (s.phase === 'lobby') {
      const [jd, xd] = s.data;
      const seats = s.seats.map((p, i) => `${MARKS[teamOf(i)]} ${esc(p.name)}`);
      return {
        text: [head, L(spec.intro), '', L('Host: {name} · {n}/4 seated', { name: esc(s.host.name), n: s.seats.length }), ...seats,
          '', L('Partners sit opposite: 1st & 3rd to join vs 2nd & 4th. The game starts when the 4th player joins.')].join('\n'),
        markup: kb([btn(s.stake ? L('🎟 Join ({n})', { n: s.stake }) : L('🎮 Join game'), jd)], [btn(L('🚪 Leave'), `${key}:l`), btn(L('✖ Cancel'), xd)]),
      };
    }
    const lines = [head, `${teamLine(s, 0)} — <b>${s.score[0]}</b>`, `${teamLine(s, 1)} — <b>${s.score[1]}</b>`];
    if (s.phase === 'ended') {
      lines.push('', ...(s.result ?? []), '', L('🏆 <b>{team}</b> win the game!', { team: teamLine(s, s.winner) }));
      if (s.stake) lines.push(L('Each winner gets {chips}.', { chips: chips(s.stake * 2) }));
      return { text: lines.join('\n'), markup: null };
    }
    lines.push(`<i>${L('Game to {n} · hand #{h}', { n: target, h: s.hand })}</i>`, '', ...spec.status(s, L));
    if (s.result) lines.push('', ...s.result);
    if (s.trick.length) lines.push('', `${L('On the table:')} ${played(s, s.trick)}`);
    else if (s.last) lines.push('', `${L('Last trick:')} ${played(s, s.last.cards)} → 🏆 ${esc(s.seats[s.last.winner].name)}`);
    if (s.log.length) lines.push('', ...s.log.slice(-3).map((l) => `<i>${l}</i>`));

    let rows;
    if (s.phase === 'play') {
      const p = s.seats[s.toAct];
      lines.push('', L('👉 {mark} <b>{name}</b> to play', { mark: MARKS[teamOf(s.toAct)], name: esc(p.name) }));
      rows = slotRows(s, s.toAct, 'p');
    } else {
      const pr = spec.prompt(s, L, { slotRows });
      lines.push('', pr.line);
      rows = pr.rows;
    }
    return {
      text: lines.join('\n'),
      markup: kb([btn(L('👀 My hand'), `${key}:v`)], ...rows, [btn(L('⏰ Claim win (10 min AFK)'), `${key}:t:${s.seq}`)]),
    };
  }

  // The private "👀 My hand" alert: slot numbers match the buttons.
  function handText(s, seat, t) {
    const numbered = s.phase === 'play' || s.phase === 'discard';
    const parts = [];
    let prev = -1;
    hand(s, seat).forEach((c, i) => {
      if (c == null) return;
      parts.push(`${prev >= 0 && suitOf(c) !== prev ? '┃ ' : ''}${numbered ? NUM[i] : ''}${cardStr(c)}`);
      prev = suitOf(c);
    });
    let text = `${t('Your hand:')} ${parts.join(' ')}`;
    if (s.trump != null) text += ` · ${t('Trump')} ${SUITS[s.trump]}`;
    if (s.phase === 'play' && s.toAct === seat && s.trick.length) {
      const led = suitOf(s.trick[0].card);
      if (s.hands[seat].some((c) => c != null && suitOf(c) === led)) text += ` · ${t('follow {suit}', { suit: SUITS[led] })}`;
    }
    return text;
  }

  // What one viewer may see: their own hand only, and no kitty/discards (see spec.hidden).
  function view(s, uid) {
    const seat = s.seats.findIndex((p) => p.id === uid);
    const out = { ...s };
    for (const k of ['hands', 'payq', ...(spec.hidden ?? [])]) delete out[k];
    return {
      ...out,
      me: seat,
      cards: seat >= 0 && s.hands ? hand(s, seat) : null,     // your own hand (slots; null = played)
      counts: s.hands ? s.seats.map((_, i) => hand(s, i).filter((c) => c != null).length) : null,
      legal: s.phase === 'play' && seat === s.toAct ? legalSlots(s, seat) : null,
      ...(spec.privateView?.(s, seat) ?? {}),
    };
  }

  // ---- game module ------------------------------------------------------------------

  async function pay(ctx, st) {
    for (const [id, amt] of st.payq) await ctx.credit(id, amt, st.stake);
  }

  async function show(ctx, st, note) {
    await ctx.answer(note);
    const v = render(st);
    await ctx.edit(v.text, v.markup);
  }

  return {
    key, cmd: spec.cmd, title, about: spec.about, group: 'persian', defaultBet: 100, players: 4,
    view, render, newGame, play, legalSlots, scoreHand: spec.score,

    async lobby({ creator, bet, locale }) {
      const sig = await lobbySig(key, creator.id, bet);
      const data = ['j', 'x'].map((a) => lobbyBtn('', key, a, creator.id, bet, sig).callback_data);
      return render(newGame({ creator, stake: bet, data, lang: locale }));
    },

    async handle(ctx, args) {
      const [a] = args;
      const me = ctx.user;

      if (a === 'j' || a === 'x') {
        const lob = await parseLobby(key, args);
        if (!lob) throw new GameError('Invalid game.');
        if (!(await ctx.session())) {
          const host = await ctx.getPlayer(lob.creatorId);
          const lang = await ctx.localeOf(lob.creatorId);
          const data = ['j', 'x'].map((x) => `${key}:${x}:${lob.creatorId}:${lob.bet}:${args[3]}`);
          await ctx.create(key, newGame({ creator: { id: lob.creatorId, name: host?.name ?? tr(lang, 'Host') }, stake: lob.bet, data, lang }));
        }
        if (a === 'j') {
          if (lob.bet && !(await ctx.debit(me.id, lob.bet))) throw new GameError('You need {n} chips to sit — claim 🎁 Daily chips in my chat.', { n: lob.bet });
          let st;
          try {
            ({ state: st } = await ctx.mutate((s) => {
              s.payq = [];
              if (s.phase !== 'lobby') throw new GameError('This game has already started.');
              if (s.seats.some((p) => p.id === me.id)) throw new GameError("You're already seated.");
              if (s.seats.length >= 4) throw new GameError('Table is full.');
              s.seats.push({ id: me.id, name: me.name });
              s.touched = Date.now();
              if (s.seats.length === 4) {
                spec.begin(s);
                deal(s);
              }
              return s;
            }));
          } catch (e) {
            if (lob.bet) await ctx.refund(me.id, lob.bet);
            throw e;
          }
          return show(ctx, st, st.phase === 'lobby' ? ctx.t('Seated — waiting for {n} more', { n: 4 - st.seats.length }) : ctx.t('Cards are out!'));
        }
        const { state: st } = await ctx.mutate((s) => {
          s.payq = [];
          if (s.phase !== 'lobby') throw new GameError('Already started.');
          const stuck = s.seats.some((p) => p.id === me.id) && idle(s);
          if (me.id !== s.host.id && !stuck) throw new GameError('Only the host can cancel (players can after 10 min idle).');
          for (const p of s.seats) if (s.stake) s.payq.push([p.id, s.stake]);
          s.phase = 'ended';
          s.cancelled = true;
          return s;
        });
        for (const [id, amt] of st.payq) await ctx.refund(id, amt);
        await ctx.answer(ctx.t('Cancelled, stakes refunded'));
        return ctx.edit(`<b>${tr(st.lang, title)}</b>\n<i>${tr(st.lang, 'Cancelled — all stakes refunded.')}</i>`, null);
      }

      if (a === 'v') {
        const cur = await ctx.session();
        const seat = cur?.state.seats.findIndex((p) => p.id === me.id) ?? -1;
        if (seat < 0 || !cur.state.hands || cur.state.phase === 'ended') throw new GameError("You're not in this game.");
        return ctx.answer(handText(cur.state, seat, ctx.t), true);
      }

      if (a === 'l') {
        if (!(await ctx.session())) throw new GameError("You're not in this game.");
        const { state: st } = await ctx.mutate((s) => {
          s.payq = [];
          if (s.phase !== 'lobby') throw new GameError("You can't leave a game in progress.");
          const seat = s.seats.findIndex((p) => p.id === me.id);
          if (seat < 0) throw new GameError("You're not in this game.");
          s.seats.splice(seat, 1);
          if (s.stake) s.payq.push([me.id, s.stake]);
          s.touched = Date.now();
          return s;
        });
        for (const [id, amt] of st.payq) await ctx.refund(id, amt);
        return show(ctx, st, ctx.t('You left — stake refunded'));
      }

      let note = '';
      const { state: st } = await ctx.mutate((s) => {
        s.payq = [];
        if (s.phase === 'lobby') throw new GameError('Wait for 4 players.');
        if (s.phase === 'ended') throw new GameError('This game is over.');
        if (String(s.seq) !== args[1]) throw new GameError('Too slow — the game moved on.');
        const seat = s.seats.findIndex((p) => p.id === me.id);
        if (seat < 0) throw new GameError("You're not in this game.");
        if (a === 't') {
          if (teamOf(seat) === teamOf(s.toAct)) throw new GameError('Only the other team can claim the win.');
          if (!idle(s)) throw new GameError('{name} still has time — wait 10 min.', { name: s.seats[s.toAct].name });
          s.log.push(tr(s.lang, '⏰ {name} timed out', { name: esc(s.seats[s.toAct].name) }));
          note = ctx.t('You win — the other team timed out.');
          return finish(s, teamOf(seat));
        }
        if (seat !== s.toAct) throw new GameError("It's {name}'s turn.", { name: s.seats[s.toAct].name });
        s.touched = Date.now();
        if (a === 'p') return play(s, seat, Number(args[2]));
        const fn = spec.actions[a];
        if (!fn) throw new GameError('Unknown action.');
        s.seq++;
        fn(s, seat, args.slice(2));
        s.log = s.log.slice(-4);
        return s;
      });
      await pay(ctx, st);
      return show(ctx, st, note);
    },
  };
}
