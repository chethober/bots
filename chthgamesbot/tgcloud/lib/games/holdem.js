// No-limit Texas Hold'em cash table for 2–8 players. Players buy in for the lobby
// stake, play hands until they leave (their stack is paid back) or the table ends.
// Hole cards stay private: "👀 My cards" answers with an alert only the presser sees.
//
// Money: buy-ins are debited on join. Each mutation collects what it owes in `s.payq`
// (reset at the start of every mutation), and the caller pays exactly that list after
// the save succeeds — so a retried or duplicated press can never pay twice.

import { GameError, btn, kb, esc, chips, lobbySig, lobbyBtn, parseLobby, idle } from '../ui.js';
import { deck, cardStr } from './cards.js';
import { best, compare, handName } from '../poker.js';
import { tr } from '../i18n.js';

const KEY = 'ph';
const TITLE = '♠️ Texas Hold\'em';
const MAX_SEATS = 8;

// ---- pure table logic ---------------------------------------------------------

// `lang`: the host's language — the table's text, log included, is written in it.
export function newTable({ creator, buyin, data, lang = 'en' }) {
  const sb = Math.max(1, Math.floor(buyin / 100));
  return {
    phase: 'lobby', host: creator, buyin, sb, bb: sb * 2, data, lang,
    seats: [], hand: 0, dealer: -1, seq: 0, log: [], result: null, payq: [], touched: Date.now(),
  };
}

const seated = (s) => s.seats.filter((p) => !p.left);
const live = (s) => s.seats.filter((p) => p.inHand && !p.folded);
const canAct = (p) => p.inHand && !p.folded && p.stack > 0;
const potOf = (s) => s.seats.reduce((t, p) => t + (p.committed ?? 0), 0);

function nextIdx(s, from, pred) {
  const n = s.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (pred(s.seats[i])) return i;
  }
  return -1;
}

function put(s, p, amount) {
  const x = Math.min(amount, p.stack);
  p.stack -= x;
  p.bet += x;
  p.committed += x;
  return x;
}

export function startHand(s) {
  const players = s.seats.filter((p) => !p.left && p.stack > 0);
  if (players.length < 2) throw new GameError('Need at least 2 players with chips.');
  s.hand++;
  s.seq++;
  s.result = null;
  s.log = [];
  s.board = [];
  s.shown = {};
  s.deck = deck();
  for (const p of s.seats) {
    Object.assign(p, { inHand: !p.left && p.stack > 0, folded: false, bet: 0, committed: 0, acted: false, hole: null });
  }
  s.dealer = nextIdx(s, s.dealer, (p) => p.inHand);
  const headsUp = players.length === 2;
  const sbI = headsUp ? s.dealer : nextIdx(s, s.dealer, (p) => p.inHand);
  const bbI = nextIdx(s, sbI, (p) => p.inHand);
  put(s, s.seats[sbI], s.sb);
  put(s, s.seats[bbI], s.bb);
  for (const p of s.seats) if (p.inHand) p.hole = [s.deck.pop(), s.deck.pop()];
  s.street = 0;
  s.currentBet = s.bb;
  s.minRaise = s.bb;
  s.phase = 'hand';
  s.log.push(tr(s.lang, 'Hand #{n} · blinds {sb}/{bb}', { n: s.hand, sb: s.sb, bb: s.bb }));
  // Pre-flop: first to act is left of the big blind (heads-up: the dealer/small blind).
  s.toAct = nextIdx(s, bbI, canAct);
  if (s.toAct < 0 || !needsAction(s)) return endStreet(s);
  return s;
}

function needsAction(s) {
  const actors = live(s).filter((p) => p.stack > 0);
  if (actors.length === 0) return false;
  if (actors.length === 1 && actors[0].bet >= s.currentBet) return false;
  return actors.some((p) => !p.acted || p.bet < s.currentBet);
}

// The raise target ("raise to") for each preset, for the player to act.
export function raiseTargets(s) {
  const p = s.seats[s.toAct];
  const max = p.bet + p.stack;
  const toCall = s.currentBet - p.bet;
  const pot = potOf(s);
  const t = {
    m: s.currentBet + s.minRaise,
    h: s.currentBet + Math.max(s.minRaise, Math.floor((pot + toCall) / 2)),
    p: s.currentBet + Math.max(s.minRaise, pot + toCall),
    a: max,
  };
  for (const k of Object.keys(t)) t[k] = Math.min(t[k], max);
  return { ...t, toCall: Math.min(toCall, p.stack), max };
}

export function act(s, kind) {
  const p = s.seats[s.toAct];
  const { toCall, ...targets } = raiseTargets(s);
  const L = (text, vars) => tr(s.lang, text, { name: esc(p.name), ...vars });
  s.seq++;
  s.touched = Date.now();
  if (kind === 'f') {
    p.folded = true;
    s.log.push(L('{name} folds'));
  } else if (kind === 'c') {
    put(s, p, toCall);
    s.log.push(!toCall ? L('{name} checks') : L(p.stack === 0 ? '{name} calls all-in {n}' : '{name} calls {n}', { n: toCall }));
  } else if (['m', 'h', 'p', 'a'].includes(kind)) {
    const target = targets[kind];
    if (target <= s.currentBet) {
      // Can't raise (not enough chips) — it's a call.
      put(s, p, toCall);
      s.log.push(L('{name} calls all-in {n}', { n: toCall }));
    } else {
      const raise = target - s.currentBet;
      put(s, p, target - p.bet);
      if (raise >= s.minRaise) s.minRaise = raise;
      s.currentBet = target;
      for (const o of s.seats) if (o !== p) o.acted = false; // action reopens
      s.log.push(L(p.stack === 0 ? '{name} all-in to {n}' : '{name} raises to {n}', { n: target }));
    }
  } else {
    throw new GameError('Unknown action.');
  }
  p.acted = true;
  s.log = s.log.slice(-8);

  if (live(s).length === 1) return finishHand(s);
  if (needsAction(s)) {
    s.toAct = nextIdx(s, s.toAct, (o) => canAct(o) && (!o.acted || o.bet < s.currentBet));
    return s;
  }
  return endStreet(s);
}

function endStreet(s) {
  for (const p of s.seats) { p.bet = 0; p.acted = false; }
  s.currentBet = 0;
  s.minRaise = s.bb;
  // Everyone left is all-in (or one player has chips): run out the board.
  const actors = live(s).filter((p) => p.stack > 0);
  if (actors.length <= 1) {
    while (s.board.length < 5) s.board.push(s.deck.pop());
    return finishHand(s);
  }
  s.street++;
  if (s.street > 3) return finishHand(s);
  const deal = s.street === 1 ? 3 : 1;
  for (let i = 0; i < deal; i++) s.board.push(s.deck.pop());
  s.log.push(`— ${tr(s.lang, ['', 'Flop', 'Turn', 'River'][s.street])}: ${s.board.map(cardStr).join(' ')}`);
  s.toAct = nextIdx(s, s.dealer, canAct);
  return s;
}

// Splits the pot into side pots by commitment level and awards each one.
export function settlePots(s) {
  const inHand = s.seats.filter((p) => p.inHand);
  const contenders = live(s);
  const scores = new Map(contenders.map((p) => [p, best([...p.hole, ...s.board]).score]));
  const won = new Map();
  const levels = [...new Set(inHand.map((p) => p.committed))].filter((x) => x > 0).sort((a, b) => a - b);
  let prev = 0;
  for (const L of levels) {
    const slice = inHand.reduce((t, p) => t + Math.min(p.committed, L) - Math.min(p.committed, prev), 0);
    prev = L;
    let eligible = contenders.filter((p) => p.committed >= L);
    if (!eligible.length) eligible = contenders;
    let top = null;
    let winners = [];
    for (const p of eligible) {
      const sc = scores.get(p);
      const c = top ? compare(sc, top) : 1;
      if (c > 0) { top = sc; winners = [p]; } else if (c === 0) winners.push(p);
    }
    // Odd chips go to the first winner left of the dealer.
    winners.sort((a, b) => seatOrder(s, a) - seatOrder(s, b));
    const share = Math.floor(slice / winners.length);
    let odd = slice - share * winners.length;
    for (const w of winners) {
      const amt = share + (odd-- > 0 ? 1 : 0);
      w.stack += amt;
      won.set(w, (won.get(w) ?? 0) + amt);
    }
  }
  return { won, scores };
}

function seatOrder(s, p) {
  const n = s.seats.length;
  return (s.seats.indexOf(p) - s.dealer - 1 + n) % n;
}

function finishHand(s) {
  const contenders = live(s);
  const lines = [];
  if (contenders.length === 1) {
    const w = contenders[0];
    const pot = potOf(s);
    w.stack += pot;
    lines.push(tr(s.lang, '🏆 <b>{name}</b> wins {chips} — everyone else folded', { name: esc(w.name), chips: chips(pot) }));
  } else {
    while (s.board.length < 5) s.board.push(s.deck.pop());
    const { won, scores } = settlePots(s);
    for (const p of contenders) {
      s.shown[p.id] = p.hole;
      lines.push(`${esc(p.name)}: ${p.hole.map(cardStr).join(' ')} — ${tr(s.lang, handName(scores.get(p)))}`);
    }
    for (const [p, amt] of won) lines.push(tr(s.lang, '🏆 <b>{name}</b> wins {chips}', { name: esc(p.name), chips: chips(amt) }));
  }
  for (const p of s.seats) { p.committed = 0; p.bet = 0; p.inHand = false; }
  s.result = lines;
  s.phase = 'between';
  s.toAct = -1;
  return s;
}

// Pays every remaining stack (plus anything committed to an unfinished hand) and closes.
export function endTable(s) {
  for (const p of s.seats) {
    if (p.left) continue;
    const amt = p.stack + (s.phase === 'hand' ? p.committed : 0);
    if (amt > 0) s.payq.push([p.id, amt]);
    p.stack = 0;
    p.committed = 0;
    p.left = true;
  }
  s.phase = 'ended';
  return s;
}

// ---- rendering ----------------------------------------------------------------

function seatLine(s, p, i) {
  const L = (text) => tr(s.lang, text);
  const marks = [];
  if (i === s.dealer && s.phase !== 'lobby') marks.push('Ⓓ');
  if (s.phase === 'hand' && i === s.toAct) marks.push('👉');
  const status = p.left ? ` ${L('(left)')}` : p.folded && p.inHand ? ` · ${L('folded')}` : p.inHand && p.stack === 0 ? ` · ${L('ALL-IN')}` : '';
  const bet = p.bet ? ` · ${L('bet')} ${p.bet}` : '';
  return `${marks.join('') || '▫️'} ${esc(p.name)} — ${chips(p.stack)}${bet}${status}`;
}

export function render(s) {
  const L = (text, vars) => tr(s.lang, text, vars);
  const lines = [`<b>${L(TITLE)}</b> · ${L('buy-in {chips} · blinds {sb}/{bb}', { chips: chips(s.buyin), sb: s.sb, bb: s.bb })}`];
  const [jd, sd, xd] = s.data;
  if (s.phase === 'lobby') {
    lines.push('', L('Host: {name} · {n}/{max} seated', { name: esc(s.host.name), n: seated(s).length, max: MAX_SEATS }), ...seated(s).map((p) => `• ${esc(p.name)}`));
    lines.push('', L('Join, then the host deals. Your cards are private: tap 👀 during a hand.'));
    return { text: lines.join('\n'), markup: kb([btn(L('🎟 Join ({n})', { n: s.buyin }), jd)], [btn(L('🃏 Deal'), sd), btn(L('✖ Cancel'), xd)]) };
  }
  if (s.phase === 'ended') {
    lines.push('', `<i>${L('Table closed — stacks paid out.')}</i>`);
    return { text: lines.join('\n'), markup: null };
  }
  if (s.board?.length) lines.push('', `${L('Board:')} ${s.board.map(cardStr).join(' ')}`);
  if (s.phase === 'hand') lines.push(L('Pot: <b>{chips}</b>', { chips: chips(potOf(s)) }));
  lines.push('', ...s.seats.filter((p) => !p.left || p.inHand).map((p) => seatLine(s, p, s.seats.indexOf(p))));
  if (s.log.length) lines.push('', ...s.log.slice(-4).map((l) => `<i>${l}</i>`));
  if (s.result) lines.push('', ...s.result);

  if (s.phase === 'hand') {
    const p = s.seats[s.toAct];
    const t = raiseTargets(s);
    const v = s.seq;
    const callLabel = t.toCall ? L('📞 Call {n}', { n: t.toCall }) : L('✅ Check');
    const raises = [];
    if (t.max > s.currentBet) {
      if (t.m < t.max) raises.push(btn(`⬆️ ${t.m}`, `${KEY}:a:${v}:m`));
      if (t.h < t.max && t.h > t.m) raises.push(btn(L('½ pot {n}', { n: t.h }), `${KEY}:a:${v}:h`));
      if (t.p < t.max && t.p > t.h) raises.push(btn(L('Pot {n}', { n: t.p }), `${KEY}:a:${v}:p`));
      raises.push(btn(L('🔥 All-in {n}', { n: t.max }), `${KEY}:a:${v}:a`));
    }
    lines.push('', L('👉 <b>{name}</b> to act', { name: esc(p.name) }) + (t.toCall ? ` · ${L('{n} to call', { n: t.toCall })}` : ''));
    return {
      text: lines.join('\n'),
      markup: kb(
        [btn(L('👀 My cards'), `${KEY}:v`)],
        [btn(L('🏳️ Fold'), `${KEY}:a:${v}:f`), btn(callLabel, `${KEY}:a:${v}:c`)],
        raises,
        [btn(L('⏰ Fold AFK (10 min)'), `${KEY}:t:${v}`)],
      ),
    };
  }
  // between hands
  return {
    text: lines.join('\n'),
    markup: kb(
      [btn(L('🃏 Next hand'), `${KEY}:n:${s.hand}`), btn(L('👀 Last cards'), `${KEY}:v`)],
      [btn(L('🎟 Join ({n})', { n: s.buyin }), jd), btn(L('🚪 Leave'), `${KEY}:l`), btn(L('🏁 End'), `${KEY}:e`)],
    ),
  };
}

// What one viewer may see: no deck, only their own hole cards (others' only once shown).
export function view(s, uid) {
  const { deck: _deck, payq: _payq, ...rest } = s;
  return {
    ...rest,
    seats: s.seats.map(({ hole, ...p }) => ({ ...p, hole: p.id === uid || s.shown?.[p.id] ? hole : null })),
    targets: s.phase === 'hand' ? raiseTargets(s) : null,
    pot: potOf(s),
  };
}

// ---- game module --------------------------------------------------------------

async function pay(ctx, st) {
  for (const [id, amt] of st.payq) await ctx.credit(id, amt, st.buyin);
}

async function show(ctx, st, note) {
  await ctx.answer(note);
  const v = render(st);
  await ctx.edit(v.text, v.markup);
}

export default {
  key: KEY, cmd: 'poker', title: TITLE, about: 'No-limit hold\'em for 2–8 players, private hole cards', group: 'duel', defaultBet: 200,
  view,

  async lobby({ creator, bet, locale }) {
    const sig = await lobbySig(KEY, creator.id, bet);
    const data = ['j', 's', 'x'].map((a) => lobbyBtn('', KEY, a, creator.id, bet, sig).callback_data);
    return render(newTable({ creator, buyin: bet, data, lang: locale }));
  },

  async handle(ctx, args) {
    const [a] = args;
    const me = ctx.user;

    if (a === 'j' || a === 's' || a === 'x') {
      const lob = await parseLobby(KEY, args);
      if (!lob || lob.bet < 1) throw new GameError('Invalid table.');
      if (!(await ctx.session())) {
        const host = await ctx.getPlayer(lob.creatorId);
        const sig = args[3];
        const data = ['j', 's', 'x'].map((x) => `${KEY}:${x}:${lob.creatorId}:${lob.bet}:${sig}`);
        const lang = await ctx.localeOf(lob.creatorId);
        await ctx.create(KEY, newTable({ creator: { id: lob.creatorId, name: host?.name ?? tr(lang, 'Host') }, buyin: lob.bet, data, lang }));
      }

      if (a === 'j') {
        if (!(await ctx.debit(me.id, lob.bet))) throw new GameError('You need {n} chips to sit — claim 🎁 Daily chips in my chat.', { n: lob.bet });
        let st;
        try {
          ({ state: st } = await ctx.mutate((s) => {
            s.payq = [];
            if (s.phase === 'hand') throw new GameError('Wait for this hand to finish.');
            if (s.phase === 'ended') throw new GameError('This table is closed.');
            if (seated(s).some((p) => p.id === me.id)) throw new GameError("You're already seated.");
            if (seated(s).length >= MAX_SEATS) throw new GameError('Table is full.');
            s.seats = s.seats.filter((p) => !p.left);
            s.seats.push({ id: me.id, name: me.name, stack: s.buyin, inHand: false, folded: false, bet: 0, committed: 0 });
            s.touched = Date.now();
            return s;
          }));
        } catch (e) {
          await ctx.refund(me.id, lob.bet);
          throw e;
        }
        return show(ctx, st, ctx.t('Seated with {n} chips', { n: st.buyin }));
      }

      const { state: st } = await ctx.mutate((s) => {
        s.payq = [];
        if (s.phase !== 'lobby') throw new GameError('Already started.');
        const host = me.id === s.host.id;
        if (a === 's') {
          if (!host) throw new GameError('Only the host can deal.');
          return startHand(s);
        }
        const stuck = seated(s).some((p) => p.id === me.id) && idle(s);
        if (!host && !stuck) throw new GameError('Only the host can cancel (players can after 10 min idle).');
        return endTable(s);
      });
      await pay(ctx, st);
      return show(ctx, st, ctx.t(a === 's' ? 'Cards are out!' : 'Table cancelled, buy-ins refunded'));
    }

    if (a === 'v') {
      const cur = await ctx.session();
      const p = cur?.state.seats.find((x) => x.id === me.id && x.hole);
      if (!p) throw new GameError("You're not in this hand.");
      const board = cur.state.board ?? [];
      const made = board.length >= 3 ? ` · ${ctx.t(handName(best([...p.hole, ...board]).score))}` : '';
      return ctx.answer(`${ctx.t('Your cards:')} ${p.hole.map(cardStr).join(' ')}${made}`, true);
    }

    let note = '';
    const { state: st } = await ctx.mutate((s) => {
      s.payq = [];
      const seat = s.seats.find((p) => p.id === me.id && !p.left);
      if (a === 'a' || a === 't') {
        if (s.phase !== 'hand') throw new GameError('No hand in progress.');
        if (String(s.seq) !== args[1]) throw new GameError('Too slow — the action moved on.');
        const p = s.seats[s.toAct];
        if (a === 't') {
          if (!seat) throw new GameError("You're not at this table.");
          if (!idle(s)) throw new GameError('{name} still has time — wait 10 min.', { name: p.name });
          s.log.push(tr(s.lang, '⏰ {name} timed out', { name: esc(p.name) }));
          return act(s, 'f');
        }
        if (p.id !== me.id) throw new GameError("It's {name}'s turn.", { name: p.name });
        return act(s, args[2]);
      }
      if (a === 'n') {
        if (s.phase !== 'between' || String(s.hand) !== args[1]) throw new GameError('Already dealt.');
        if (!seat) throw new GameError("You're not at this table.");
        if (s.seats.filter((p) => !p.left && p.stack > 0).length < 2) {
          note = ctx.t('Not enough players with chips — table closed.');
          return endTable(s);
        }
        return startHand(s);
      }
      if (a === 'l') {
        if (!seat) throw new GameError("You're not at this table.");
        if (s.phase === 'hand') throw new GameError('Leave after this hand.');
        if (s.phase === 'ended') throw new GameError('Table is closed.');
        if (seat.stack > 0) s.payq.push([seat.id, seat.stack]);
        note = ctx.t('You left with {n} chips', { n: seat.stack });
        seat.stack = 0;
        seat.left = true;
        if (s.phase === 'lobby') s.seats = s.seats.filter((p) => !p.left);
        return s;
      }
      if (a === 'e') {
        if (s.phase === 'ended') throw new GameError('Already closed.');
        const host = me.id === s.host.id;
        if (!seat) throw new GameError("You're not at this table.");
        if (!(host && s.phase !== 'hand') && !idle(s)) {
          throw new GameError(host ? 'Finish the hand first.' : 'Only the host can end the table (anyone after 10 min idle).');
        }
        note = ctx.t('Table closed — stacks paid out');
        return endTable(s);
      }
      throw new GameError('Unknown action.');
    });
    await pay(ctx, st);
    return show(ctx, st, note);
  },
};
