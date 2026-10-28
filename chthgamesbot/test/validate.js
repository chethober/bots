// Local checks for the pure game code: Telegram limits on every rendered view,
// house edge on every bet, and full simulated games against an in-memory wallet.
// Run: npm test

import assert from 'node:assert/strict';
import { GAMES, BY_KEY } from '../tgcloud/lib/games/index.js';
import { GameError } from '../tgcloud/lib/ui.js';
import { tr } from '../tgcloud/lib/i18n.js';
import * as slots from '../tgcloud/lib/games/slots.js';
import * as dice from '../tgcloud/lib/games/dice.js';
import { BETS_TABLE } from '../tgcloud/lib/games/roulette.js';
import { PAYS as CF_PAYS } from '../tgcloud/lib/games/coinflip.js';
import { multiplier } from '../tgcloud/lib/games/mines.js';
import { handValue } from '../tgcloud/lib/games/blackjack.js';
import { TABLES, ROWS } from '../tgcloud/lib/plinko.js';
import { crashPoint, multAt, evaluate } from '../tgcloud/lib/crash.js';
import QUESTIONS from '../tgcloud/lib/data/trivia.js';
import { score5, best, compare, handName, videoPokerPays, VP_PAYS } from '../tgcloud/lib/poker.js';
import * as holdem from '../tgcloud/lib/games/holdem.js';
import { deck as newDeck } from '../tgcloud/lib/games/cards.js';
import WORDS from '../tgcloud/lib/data/words.js';
import { trickWinner, legalSlots, suitOf } from '../tgcloud/lib/games/tricks.js';
import hokm from '../tgcloud/lib/games/hokm.js';
import shelem, { cardPoints, TARGET as SHELEM_TARGET } from '../tgcloud/lib/games/shelem.js';

let failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    () => console.log(`✓ ${name}`),
    (e) => { failures++; console.log(`✗ ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); },
  );
}

// ---- Telegram limits --------------------------------------------------------
const bytes = (s) => new TextEncoder().encode(s).length;
function checkView(view, where) {
  assert.ok(view.text.length <= 4096, `${where}: text too long`);
  assert.ok(!/<(?!\/?(b|i|code)>)/.test(view.text), `${where}: unexpected HTML tag in ${view.text}`);
  const rows = view.markup?.inline_keyboard ?? [];
  assert.ok(rows.flat().length <= 100, `${where}: >100 buttons`);
  for (const row of rows) {
    assert.ok(row.length <= 8, `${where}: row with ${row.length} buttons`);
    for (const b of row) {
      if (b.callback_data != null) {
        assert.ok(bytes(b.callback_data) <= 64, `${where}: callback_data ${b.callback_data} is ${bytes(b.callback_data)} bytes`);
        assert.ok(b.callback_data.split(':')[0] in BY_KEY || b.callback_data.startsWith('menu:'), `${where}: unroutable ${b.callback_data}`);
      }
      assert.ok(b.text.length > 0, `${where}: empty button`);
    }
  }
}

// ---- in-memory platform -----------------------------------------------------
function world() {
  const wallets = new Map();
  const sessions = new Map();
  const ledger = { in: 0, out: 0 };
  const w = {
    wallets, sessions, ledger,
    player(id, chips = 1_000_000) { wallets.set(id, { id, name: `P${id}`, chips }); return { id, name: `P${id}` }; },
    ctx(user, key = 'm:1:1') {
      const views = [];
      let answered = null;
      const ctx = {
        user, key, inline: false, chatType: 'group', views,
        locale: 'en', t: (s, v) => tr('en', s, v), localeOf: async () => 'en',
        session: async () => sessions.get(key) ?? null,
        create: async (kind, state) => {
          if (sessions.has(key)) return null;
          const row = { kind, state: JSON.parse(JSON.stringify(state)), version: 0 };
          sessions.set(key, row);
          return row;
        },
        mutate: async (fn) => {
          const row = sessions.get(key);
          if (!row) throw new GameError('This game has expired.');
          const prev = row.state;
          const next = fn(JSON.parse(JSON.stringify(prev)));
          row.state = JSON.parse(JSON.stringify(next));
          row.version++;
          return { state: next, prev };
        },
        debit: async (id, amt) => {
          const p = wallets.get(id);
          if (!p || p.chips < amt) return null;
          p.chips -= amt; ledger.in += amt;
          return { ...p };
        },
        credit: async (id, amt) => {
          const p = wallets.get(id); p.chips += amt; ledger.out += amt; return { ...p };
        },
        refund: async (id, amt) => { wallets.get(id).chips += amt; ledger.in -= amt; },
        getPlayer: async (id) => ({ ...wallets.get(id) }),
        edit: async (text, markup) => { const v = { text, markup }; checkView(v, `${key} edit`); views.push(v); },
        answer: async (text = '', alert = false) => {
          assert.ok(text.length <= 200, 'answer too long');
          answered = { text, alert };
        },
        get answered() { return answered; },
      };
      return ctx;
    },
  };
  return w;
}

// Presses a button by its callback data, as the callback handler would.
async function press(w, user, data, key) {
  const ctx = w.ctx(user, key);
  const [k, ...args] = data.split(':');
  try {
    await BY_KEY[k].handle(ctx, args);
    return { ok: true, view: ctx.views.at(-1), answer: ctx.answered };
  } catch (e) {
    if (e instanceof GameError) return { ok: false, error: e.message };
    throw e;
  }
}
const buttons = (view) => (view?.markup?.inline_keyboard ?? []).flat().filter((b) => b.callback_data);
const find = (view, re) => buttons(view).find((b) => re.test(b.callback_data))?.callback_data;

// ---- checks -----------------------------------------------------------------
await check('every lobby fits Telegram limits', async () => {
  for (const g of GAMES) {
    for (const bet of [0, 10, 5000]) {
      checkView(await g.lobby({ creator: { id: 8_000_000_000_123, name: 'A<b>&' }, bet: g.defaultBet ? bet || 100 : 0 }), `${g.key} lobby`);
    }
  }
});

await check('commands and keys are unique', () => {
  assert.equal(new Set(GAMES.map((g) => g.key)).size, GAMES.length);
  assert.equal(new Set(GAMES.map((g) => g.cmd)).size, GAMES.length);
});

await check('house edge: slots (exact)', () => {
  const total = slots.SYMBOLS.reduce((s, [, w]) => s + w, 0);
  let ev = 0;
  for (const [a, wa] of slots.SYMBOLS) for (const [b, wb] of slots.SYMBOLS) for (const [c, wc] of slots.SYMBOLS) {
    ev += (wa * wb * wc) / total ** 3 * slots.payout([a, b, c]);
  }
  console.log(`    slots RTP ${(ev * 100).toFixed(2)}%`);
  assert.ok(ev < 1 && ev > 0.85, `slots EV ${ev}`);
});

await check('house edge: dice, roulette, coinflip (exact)', () => {
  const p = { u: 15 / 36, s: 6 / 36, o: 15 / 36 };
  for (const t of ['u', 's', 'o']) assert.ok(p[t] * dice.PAYS[t] < 1, `dice ${t}`);
  for (const [k, b] of Object.entries(BETS_TABLE)) {
    let hits = 0;
    for (let n = 0; n <= 36; n++) if (b.hit(n)) hits++;
    assert.ok((hits / 37) * b.pays < 1, `roulette ${k}`);
  }
  assert.ok(0.5 * CF_PAYS < 1);
});

await check('house edge: mines, plinko, crash', () => {
  for (const m of [1, 3, 5, 10]) for (let k = 1; k <= 25 - m; k++) {
    let pSafe = 1;
    for (let i = 0; i < k; i++) pSafe *= (25 - m - i) / (25 - i);
    assert.ok(pSafe * multiplier(m, k) < 1, `mines m=${m} k=${k}`);
  }
  const binom = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return r; };
  for (const [risk, t] of Object.entries(TABLES)) {
    assert.equal(t.length, ROWS + 1);
    const ev = t.reduce((s, m, k) => s + (binom(ROWS, k) / 2 ** ROWS) * m, 0);
    console.log(`    plinko ${risk} RTP ${(ev * 100).toFixed(2)}%`);
    assert.ok(ev < 1 && ev > 0.9, `plinko ${risk} EV ${ev}`);
  }
  const N = 200_000;
  let won = 0;
  for (let i = 0; i < N; i++) if (crashPoint() > 2) won += 2;
  console.log(`    crash @2× RTP ≈ ${((won / N) * 100).toFixed(1)}%`);
  assert.ok(won / N < 1.0);
  assert.equal(multAt(0), 1);
});

await check('crash: auto cash-out and bust', () => {
  const s = { phase: 'play', start: 0, point: 3, auto: 2, bet: 100 };
  assert.equal(evaluate(s, 1000), false);
  assert.equal(evaluate(s, 20_000), true);
  assert.deepEqual([s.phase, s.cashed, s.payout], ['done', 2, 200]);
  const b = { phase: 'play', start: 0, point: 1.5, auto: null, bet: 100 };
  assert.equal(evaluate(b, 60_000), true);
  assert.equal(b.payout, 0);
});

await check('blackjack hand values', () => {
  assert.equal(handValue([0, 12]), 21);        // A K
  assert.equal(handValue([0, 0, 8]), 21);      // A A 9
  assert.equal(handValue([0, 0, 0, 0]), 14);
  assert.equal(handValue([9, 10, 1]), 22);     // 10 J 2
});

await check('data files are well-formed', () => {
  for (const q of QUESTIONS) assert.equal(q.length, 5, q[0]);
  for (const [, word] of WORDS) assert.match(word, /^[A-Z]+$/);
});

// Plays `rounds` of a game by pressing random enabled buttons; asserts chips are conserved.
async function fuzz(game, { players = 2, rounds = 300, bet } = {}) {
  const w = world();
  const users = Array.from({ length: players }, (_, i) => w.player(i + 1));
  const start = [...w.wallets.values()].reduce((s, p) => s + p.chips, 0);
  for (let r = 0; r < rounds; r++) {
    const key = `m:1:${r}`;
    let view = await game.lobby({ creator: users[0], bet: game.defaultBet ? (bet ?? 100) : 0 });
    for (let stepN = 0; stepN < 200; stepN++) {
      const opts = buttons(view);
      if (!opts.length) break;
      const b = opts[Math.floor(Math.random() * opts.length)].callback_data;
      if (/:r$|:g$|:s$/.test(b) && stepN > 0 && Math.random() < 0.7) break; // sometimes stop at rematch/again
      const u = users[Math.floor(Math.random() * users.length)];
      const res = await press(w, u, b, key);
      if (res.ok && res.view) view = res.view;
      if (!res.ok && /Busy|expired/.test(res.error)) throw new Error(res.error);
    }
  }
  const end = [...w.wallets.values()].reduce((s, p) => s + p.chips, 0);
  assert.equal(start - end, w.ledger.in - w.ledger.out, 'chips not conserved');
  for (const p of w.wallets.values()) assert.ok(p.chips >= 0, 'negative balance');
  return w;
}

for (const g of GAMES) {
  await check(`fuzz ${g.key} (${g.cmd})`, () => fuzz(g, { players: g.players ?? (g.group === 'solo' ? 1 : 3), rounds: g.group === 'casino' ? 50 : 150 }));
}

await check('duel pays winner both stakes exactly once', async () => {
  const w = world();
  const a = w.player(1, 1000), b = w.player(2, 1000);
  const lobby = await BY_KEY.cd.lobby({ creator: a, bet: 100 });
  const accept = find(lobby, /^cd:a:/);
  assert.equal((await press(w, a, accept)).ok, false, 'creator cannot accept own');
  assert.ok((await press(w, b, accept)).ok);
  assert.equal((await press(w, b, accept)).ok, false, 'second accept rejected');
  const chips = [w.wallets.get(1).chips, w.wallets.get(2).chips].sort((x, y) => x - y);
  assert.deepEqual(chips, [900, 1100]);
});

await check('forged lobby data is rejected', async () => {
  const w = world();
  const a = w.player(1), b = w.player(2);
  const lobby = await BY_KEY.cd.lobby({ creator: a, bet: 100 });
  const forged = find(lobby, /^cd:a:/).replace(':100:', ':5000:');
  assert.equal((await press(w, b, forged)).ok, false);
});

await check('jackpot: refunds on cancel, pays pot on draw', async () => {
  const w = world();
  const [a, b, c] = [w.player(1, 500), w.player(2, 500), w.player(3, 500)];
  const lobby = await BY_KEY.jp.lobby({ creator: a, bet: 100 });
  const join = find(lobby, /^jp:j:/), draw = find(lobby, /^jp:s:/), cancel = find(lobby, /^jp:x:/);
  for (const u of [a, b, c]) assert.ok((await press(w, u, join)).ok);
  assert.equal((await press(w, b, join)).ok, false, 'no double join');
  assert.equal((await press(w, b, draw)).ok, false, 'only host draws');
  assert.ok((await press(w, a, draw)).ok);
  assert.equal((await press(w, a, cancel)).ok, false, 'cannot cancel after draw');
  const total = [1, 2, 3].map((i) => w.wallets.get(i).chips).sort((x, y) => x - y);
  assert.deepEqual(total, [400, 400, 700]);

  const w2 = world();
  const [x, y] = [w2.player(1, 500), w2.player(2, 500)];
  for (const u of [x, y]) await press(w2, u, join);
  assert.ok((await press(w2, x, cancel)).ok);
  assert.deepEqual([w2.wallets.get(1).chips, w2.wallets.get(2).chips], [500, 500]);
});

await check('solo games refuse other players', async () => {
  const w = world();
  const a = w.player(1), b = w.player(2);
  const lobby = await BY_KEY.bj.lobby({ creator: a, bet: 100 });
  assert.equal((await press(w, b, find(lobby, /^bj:d/))).ok, false);
  const r = await press(w, a, find(lobby, /^bj:d/));
  assert.ok(r.ok);
  if (find(r.view, /^bj:h$/)) assert.equal((await press(w, b, 'bj:h')).ok, false);
});

await check('idle call-offs refund (rps) and forfeit (russian roulette)', async () => {
  const w = world();
  const a = w.player(1, 1000), b = w.player(2, 1000), c = w.player(3, 1000);
  const lobby = await BY_KEY.rp.lobby({ creator: a, bet: 100 });
  assert.ok((await press(w, b, find(lobby, /^rp:a:/))).ok);
  assert.ok((await press(w, a, 'rp:m:r')).ok);
  assert.equal((await press(w, a, 'rp:t')).ok, false, 'too early');
  w.sessions.get('m:1:1').state.touched -= 11 * 60 * 1000;
  assert.equal((await press(w, c, 'rp:t')).ok, false, 'outsider cannot call off');
  assert.ok((await press(w, a, 'rp:t')).ok);
  assert.deepEqual([w.wallets.get(1).chips, w.wallets.get(2).chips], [1000, 1000]);

  const w2 = world();
  const [x, y, z] = [w2.player(1, 1000), w2.player(2, 1000), w2.player(3, 1000)];
  const rr = await BY_KEY.rr.lobby({ creator: x, bet: 100 });
  for (const u of [x, y, z]) assert.ok((await press(w2, u, find(rr, /^rr:j:/))).ok);
  const started = await press(w2, x, find(rr, /^rr:s:/));
  assert.ok(started.ok);
  const skip = find(started.view, /^rr:t:/);
  assert.equal((await press(w2, y, skip)).ok, false, 'too early');
  w2.sessions.get('m:1:1').state.touched -= 11 * 60 * 1000;
  assert.ok((await press(w2, y, skip)).ok);
  const chips = [1, 2, 3].map((i) => w2.wallets.get(i).chips).sort((m, n) => m - n);
  assert.deepEqual(chips, [900, 1050, 1050]);

  const w3 = world();
  const [h, p] = [w3.player(1, 1000), w3.player(2, 1000)];
  const jp = await BY_KEY.jp.lobby({ creator: h, bet: 100 });
  for (const u of [h, p]) await press(w3, u, find(jp, /^jp:j:/));
  assert.equal((await press(w3, p, find(jp, /^jp:x:/))).ok, false, 'player cannot cancel early');
  w3.sessions.get('m:1:1').state.touched -= 11 * 60 * 1000;
  assert.ok((await press(w3, p, find(jp, /^jp:x:/))).ok);
  assert.deepEqual([w3.wallets.get(1).chips, w3.wallets.get(2).chips], [1000, 1000]);
});

// ---- poker -------------------------------------------------------------------
// Card helper: 'As' 'Td' '9h' → 0..51 (suits s h d c → 0 1 2 3, ranks A=0 … K=12)
const C = (str) => {
  const r = 'A23456789TJQK'.indexOf(str[0]);
  const su = 'shdc'.indexOf(str[1]);
  return su * 13 + r;
};
const H = (str) => str.split(' ').map(C);

await check('poker evaluator: categories, wheel, kickers, ties', () => {
  assert.equal(handName(score5(H('As Ks Qs Js Ts'))), 'Royal flush');
  assert.deepEqual(score5(H('Ah 2d 3c 4s 5h')), [4, 5], 'wheel is a 5-high straight');
  assert.ok(compare(score5(H('2h 3d 4c 5s 6h')), score5(H('Ah 2d 3c 4s 5h'))) > 0, '6-high straight beats wheel');
  assert.ok(compare(score5(H('2h 5h 9h Jh Kh')), score5(H('Ts Jd Qc Ks Ah'))) > 0, 'flush beats straight');
  assert.ok(compare(score5(H('Ah Ad Kc Ks 9h')), score5(H('Ah Ad Kc Ks 8h'))) > 0, 'two pair kicker');
  assert.equal(compare(score5(H('Ah Ad Kc Ks 9h')), score5(H('As Ac Kh Kd 9s'))), 0, 'exact tie');
  assert.ok(compare(score5(H('9h 9d 9c 4s 4h')), score5(H('8h 8d 8c As Ah'))) > 0, 'full house by trips');
  assert.ok(compare(score5(H('Kh Kd 7c 5s 2h')), score5(H('Kc Ks 7h 5d 3h'))) < 0, 'pair kickers');
  const b = best(H('2h 2d Ks Qs Js Ts 9s'));
  assert.equal(b.score[0], 8, 'finds the straight flush in 7 cards');
  assert.equal(handName(best(H('2h 3d 5c 9s Jh Qd Ac')).score), 'High card');
});

await check('video poker pays (Jacks or Better 8/5) and a basic-strategy lower bound < 100%', () => {
  assert.equal(videoPokerPays(H('Jh Jd 3c 5s 9h')).mult, 1);
  assert.equal(videoPokerPays(H('Th Td 3c 5s 9h')).mult, 0);
  assert.equal(videoPokerPays(H('As Ks Qs Js Ts')).mult, 800);
  // Simple strategy: keep any paying hand, else keep pairs/high cards. EV must stay < 1.
  let ret = 0;
  const N = 60_000;
  for (let i = 0; i < N; i++) {
    const d = newDeck();
    const hand = d.splice(0, 5);
    let held;
    if (videoPokerPays(hand).mult > 0) held = hand.map(() => true);
    else {
      const ranks = hand.map((c) => c % 13);
      held = hand.map((c, k) => ranks.filter((r) => r === ranks[k]).length > 1 || ranks[k] === 0 || ranks[k] >= 10);
    }
    const fin = hand.map((c, k) => (held[k] ? c : d.pop()));
    ret += videoPokerPays(fin).mult;
  }
  console.log(`    video poker simple-strategy RTP ≈ ${((ret / N) * 100).toFixed(1)}% (optimal 8/5 JoB is 97.3% published)`);
  assert.ok(ret / N < 1);
});

function table(stacks) {
  const s = holdem.newTable({ creator: { id: 1, name: 'P1' }, buyin: 1000, data: ['ph:j', 'ph:s', 'ph:x'] });
  s.seats = stacks.map((st, i) => ({ id: i + 1, name: `P${i + 1}`, stack: st, inHand: false, folded: false, bet: 0, committed: 0 }));
  return s;
}

await check('hold\'em: heads-up blinds and action order', () => {
  const s = holdem.startHand(table([1000, 1000]));
  const dealer = s.seats[s.dealer];
  assert.equal(dealer.bet, s.sb, 'dealer posts small blind heads-up');
  assert.equal(s.toAct, s.dealer, 'dealer acts first pre-flop');
  holdem.act(s, 'c');                       // dealer completes
  assert.notEqual(s.toAct, s.dealer, 'big blind gets the option');
  holdem.act(s, 'c');                       // BB checks
  assert.equal(s.street, 1);
  assert.equal(s.board.length, 3);
  assert.notEqual(s.toAct, s.dealer, 'non-dealer acts first after the flop');
});

await check('hold\'em: three-way all-in side pots and odd chips', () => {
  const s = table([100, 300, 600]);
  for (const p of s.seats) Object.assign(p, { inHand: true, folded: false });
  s.dealer = 0;
  [s.seats[0].committed, s.seats[1].committed, s.seats[2].committed] = [100, 300, 300];
  s.seats[2].stack = 300; s.seats[0].stack = 0; s.seats[1].stack = 0;
  s.board = H('2c 7d 9h Js 3s');
  s.seats[0].hole = H('Ah Ad');   // best: pair of aces → wins main pot only
  s.seats[1].hole = H('Kh Kd');   // second → wins side pot
  s.seats[2].hole = H('Qh 4d');   // worst
  const { won } = holdem.settlePots(s);
  assert.equal(won.get(s.seats[0]), 300, 'main pot 3×100');
  assert.equal(won.get(s.seats[1]), 400, 'side pot 2×200');
  assert.equal(s.seats[2].stack, 300, 'loser keeps unmatched chips? (none uncalled here)');

  const t = table([0, 0]);
  for (const p of t.seats) Object.assign(p, { inHand: true, folded: false, committed: 51 });
  t.seats.push({ id: 3, name: 'P3', stack: 0, inHand: true, folded: true, committed: 1 });
  t.dealer = 1;
  t.board = H('As Ks Qs Js 2d');  // both play the board's… no: board has 4 to a royal, holes decide
  t.seats[0].hole = H('3c 4c');
  t.seats[1].hole = H('3d 4d');
  const r = holdem.settlePots(t);
  assert.equal(r.won.get(t.seats[0]) + r.won.get(t.seats[1]), 103, 'whole pot paid');
  assert.equal(r.won.get(t.seats[0]), 52, 'odd chip to first seat left of dealer');
});

await check('hold\'em: uncalled bet returns to the bettor', () => {
  const s = table([0, 800]);
  for (const p of s.seats) Object.assign(p, { inHand: true, folded: false });
  s.seats[0].committed = 200; s.seats[1].committed = 200 + 0;
  s.seats[1].committed = 500; // bet 500 into an all-in of 200
  s.board = H('2c 7d 9h Js 3s');
  s.seats[0].hole = H('Ah Ad');
  s.seats[1].hole = H('Kh Kd');
  const { won } = holdem.settlePots(s);
  assert.equal(won.get(s.seats[0]), 400);
  assert.equal(won.get(s.seats[1]), 300, 'the 300 nobody called comes back');
});

await check('hold\'em: chips conserved through 300 random hands', async () => {
  const w = world();
  const users = [1, 2, 3, 4].map((i) => w.player(i, 50_000));
  const g = BY_KEY.ph;
  const tables = () => [...w.sessions.values()].filter((r) => r.kind === 'ph');
  const total = () => [...w.wallets.values()].reduce((t, p) => t + p.chips, 0)
    + tables().reduce((t, r) => t + r.state.seats.reduce((x, p) => x + p.stack + (p.committed ?? 0), 0), 0);
  const start = total();
  let hands = 0;
  // Tables close when only one player has chips left, so keep opening new ones.
  for (let t = 0; hands < 300 && t < 100; t++) {
    const key = `m:1:${t}`;
    const lobby = await g.lobby({ creator: users[0], bet: 500 });
    for (const u of users) assert.ok((await press(w, u, find(lobby, /^ph:j:/), key)).ok);
    let view = (await press(w, users[0], find(lobby, /^ph:s:/), key)).view;
    for (let step = 0; step < 3000 && hands < 300; step++) {
      const st = w.sessions.get(key).state;
      if (st.phase === 'ended') break;
      let data;
      let who;
      if (st.phase === 'hand') {
        who = st.seats[st.toAct];
        const opts = buttons(view).map((b) => b.callback_data).filter((d) => d.startsWith('ph:a:'));
        data = opts[Math.floor(Math.random() * opts.length)];
        // bias towards calling so hands reach showdown
        if (Math.random() < 0.6) data = opts.find((d) => d.endsWith(':c')) ?? data;
      } else {
        hands++;
        who = st.seats.find((p) => !p.left);
        data = `ph:n:${st.hand}`;
      }
      const r = await press(w, { id: who.id, name: who.name }, data, key);
      if (r.ok) view = r.view;
      assert.equal(total(), start, `chips changed at table ${t} step ${step}: ${r.error ?? ''}`);
    }
    // close the table (if still open) and check everything came back to wallets
    const st = w.sessions.get(key).state;
    if (st.phase !== 'ended') {
      st.touched = 0; // let anyone end it
      const host = st.seats.find((p) => !p.left);
      assert.ok((await press(w, { id: host.id, name: host.name }, 'ph:e', key)).ok);
    }
    assert.equal([...w.wallets.values()].reduce((x, p) => x + p.chips, 0), start, `table ${t}: stacks not fully paid out on close`);
  }
  assert.ok(hands >= 300, `only ${hands} hands played`);
});


// ---- Hokm & Shelem -----------------------------------------------------------------
await check('tricks: winner, trump and follow-suit', () => {
  const T = (str) => str.split(' ').map((c, seat) => ({ seat, card: C(c) }));
  assert.equal(trickWinner(T('Ks As 2s 3s'), 1), 1, 'ace high in the led suit');
  assert.equal(trickWinner(T('Ks Ad 2s 3s'), 1), 0, 'off-suit non-trump never wins');
  assert.equal(trickWinner(T('Ks Ad 2h 3s'), 1), 2, 'a low trump beats the led suit');
  assert.equal(trickWinner(T('Ks 3h 2h As'), 1), 1, 'the higher trump wins');
  const s = { hands: [H('Ah 2s 3d'), [], [], []], trick: [{ seat: 3, card: C('Ks') }] };
  assert.deepEqual(legalSlots(s, 0), [1], 'must follow spades');
  s.trick = [{ seat: 3, card: C('Kc') }];
  assert.deepEqual(legalSlots(s, 0), [0, 1, 2], 'void in clubs: anything goes');
  let pts = 0;
  for (let c = 0; c < 52; c++) pts += cardPoints(c);
  assert.equal(pts, 100, 'shelem card points add up to 100');
});

// Plays a 4-player trick game to the end with random legal moves; returns the world.
async function playOut(g, { stake = 100, maxSteps = 20_000 } = {}) {
  const w = world();
  const users = [1, 2, 3, 4].map((i) => w.player(i, 10_000));
  const key = 'm:1:1';
  const lobby = await g.lobby({ creator: users[0], bet: stake });
  for (const u of users) assert.ok((await press(w, u, find(lobby, new RegExp(`^${g.key}:j:`)), key)).ok);
  const hands = [];
  let lastHand = 1;
  for (let step = 0; step < maxSteps; step++) {
    const st = w.sessions.get(key).state;
    if (st.phase === 'ended') return { w, st, hands };
    if (st.hand !== lastHand) { hands.push(st.result); lastHand = st.hand; }
    const seat = st.toAct;
    const u = users.find((x) => x.id === st.seats[seat].id);
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    let data;
    if (st.phase === 'play') {
      const legal = legalSlots(st, seat);
      // Now and then try an illegal card: it must be refused without changing anything.
      const illegal = st.hands[seat].flatMap((c, i) => (c != null && !legal.includes(i) ? [i] : []));
      if (illegal.length && Math.random() < 0.1) {
        const before = JSON.stringify(st);
        const r = await press(w, u, `${g.key}:p:${st.seq}:${rnd(illegal)}`, key);
        assert.equal(r.ok, false, 'illegal card accepted');
        assert.match(r.error, /follow/);
        assert.equal(JSON.stringify(w.sessions.get(key).state), before);
      }
      data = `${g.key}:p:${st.seq}:${rnd(legal)}`;
    } else if (st.phase === 'trump') data = `${g.key}:h:${st.seq}:${Math.floor(Math.random() * 4)}`;
    else if (st.phase === 'discard') data = `sh:d:${st.seq}:${rnd(st.hands[seat].flatMap((c, i) => (c == null ? [] : [i])))}`;
    else if (st.phase === 'bid') {
      const opts = buttons({ markup: g.render(st).markup }).map((b) => b.callback_data).filter((d) => d.startsWith('sh:b:'));
      data = Math.random() < 0.7 ? opts.at(-1) /* pass */ : rnd(opts);
    }
    // Shelem: the last card of a hand — every point is accounted for (165 in all).
    if (g.key === 'sh' && st.phase === 'play' && st.trick.length === 3 && st.hands.flat().filter((c) => c != null).length === 1) {
      const card = st.hands[seat].find((c) => c != null);
      const tricksPts = st.points[0] + st.points[1] + 5 + [...st.trick.map((t) => t.card), card].reduce((t, c) => t + cardPoints(c), 0);
      assert.equal(tricksPts + 5 + st.discards.reduce((t, c) => t + cardPoints(c), 0), 165);
    }
    const other = users.find((x) => x.id !== u.id);
    assert.equal((await press(w, other, data, key)).ok, false, 'acted out of turn');
    const r = await press(w, u, data, key);
    assert.ok(r.ok, `${data}: ${r.error}`);
  }
  const end = w.sessions.get(key).state;
  throw new Error(`${g.key}: game did not finish (hand ${end.hand}, score ${end.score})`);
}

function settled(w, st, stake, base = 10_000) {
  st.seats.forEach((p, i) => {
    assert.equal(w.wallets.get(p.id).chips, base + (i % 2 === st.winner ? stake : -stake), `seat ${i} paid wrong`);
  });
}

await check('hokm: full games end at 7 points and pay the winning team once', async () => {
  for (let n = 0; n < 15; n++) {
    const { w, st } = await playOut(hokm);
    assert.ok(st.score[st.winner] >= 7 && st.score[1 - st.winner] < st.score[st.winner]);
    settled(w, st, 100);
  }
});

await check('hokm: scoring, kot and the Hakem passing on', () => {
  // Seat 3 plays the last card of a trick seat 2 takes with K♠, bringing team 0 (seats 0 + 2) to 7.
  const run = (tricks, hakem) => {
    const s = hokm.newGame({ creator: { id: 1, name: 'A' }, stake: 0, data: ['', ''] });
    s.seats = [1, 2, 3, 4].map((id) => ({ id, name: `P${id}` }));
    Object.assign(s, {
      phase: 'play', hakem, trump: 1, tricks: [tricks[0] - 1, tricks[1]], toAct: 3,
      hands: [[], [], [], [C('2s')]], trick: [{ seat: 0, card: C('3s') }, { seat: 1, card: C('5s') }, { seat: 2, card: C('Ks') }],
    });
    return hokm.play(s, 3, 0);
  };
  let st = run([7, 3], 0);
  assert.deepEqual([st.score[0], st.hakem, st.phase, st.hand], [1, 0, 'trump', 1], 'Hakem\'s team wins: +1, Hakem stays');
  st = run([7, 3], 1);
  assert.deepEqual([st.score[0], st.hakem], [1, 2], 'the Hakem passes to the next player');
  assert.equal(run([7, 0], 0).score[0], 2, 'kot');
  assert.equal(run([7, 0], 3).score[0], 3, 'hakem kot');
});

await check('shelem: full games, 165 points per hand, payouts', async () => {
  for (let n = 0; n < 6; n++) {
    const { w, st } = await playOut(shelem);
    assert.ok(Math.max(...st.score) >= SHELEM_TARGET || Math.min(...st.score) <= -SHELEM_TARGET);
    settled(w, st, 100);
  }
});

await check('shelem: bidding rules and scoring', async () => {
  const w = world();
  const users = [1, 2, 3, 4].map((i) => w.player(i, 10_000));
  const key = 'm:1:1';
  const lobby = await shelem.lobby({ creator: users[0], bet: 100 });
  for (const u of users) await press(w, u, find(lobby, /^sh:j:/), key);
  const st = () => w.sessions.get(key).state;
  const who = () => users[st().seats[st().toAct].id - 1];
  const bid = (n) => press(w, who(), `sh:b:${st().seq}:${n}`, key);
  assert.equal((await bid(95)).ok, false, 'below the minimum');
  assert.equal((await bid(103)).ok, false, 'not a step of 5');
  assert.ok((await bid(100)).ok);
  assert.equal((await bid(100)).ok, false, 'must raise');
  assert.ok((await bid(0)).ok);
  assert.ok((await bid(0)).ok);
  const bidder = st().bidder;
  assert.ok((await bid(0)).ok, 'last pass ends the bidding');
  assert.deepEqual([st().phase, st().bidder, st().bid, st().hands[bidder].length], ['discard', bidder, 100, 16]);
  const v = shelem.view(st(), st().seats[bidder].id);
  assert.equal(v.cards.length, 16, 'bidder holds the kitty');

  // Scoring: made, set and shelem.
  const score = (bid, pts, discards) => {
    const s = { ...st(), bid, bidder: 0, points: [...pts], discards, score: [0, 0], lang: 'en' };
    shelem.scoreHand(s);
    return s.score;
  };
  const five = [4, 17];           // two fives: 10 points
  assert.deepEqual(score(110, [100, 50], five), [115, 50], 'made: 100 + kitty 15');
  assert.deepEqual(score(120, [100, 50], five), [-120, 50], 'set by 5');
  assert.deepEqual(score(140, [100, 50], five), [-140, 50], 'set');
  assert.deepEqual(score(165, [150, 0], five), [330, 0], 'shelem made');
  assert.deepEqual(score(165, [140, 10], five), [-165, 10], 'shelem missed');
});

await check('hokm/shelem: lobby leave and cancel refund, AFK claim pays the other team', async () => {
  for (const g of [hokm, shelem]) {
    const w = world();
    const users = [1, 2, 3, 4, 5].map((i) => w.player(i, 1000));
    const key = 'm:1:1';
    const lobby = await g.lobby({ creator: users[0], bet: 100 });
    const join = find(lobby, new RegExp(`^${g.key}:j:`)), cancel = find(lobby, new RegExp(`^${g.key}:x:`));
    assert.ok((await press(w, users[1], join, key)).ok);
    assert.ok((await press(w, users[1], `${g.key}:l`, key)).ok);
    assert.equal(w.wallets.get(2).chips, 1000, 'leave refunds');
    assert.ok((await press(w, users[1], join, key)).ok);
    assert.equal((await press(w, users[1], cancel, key)).ok, false, 'only the host cancels');
    assert.ok((await press(w, users[0], cancel, key)).ok);
    assert.equal(w.wallets.get(2).chips, 1000, 'cancel refunds');

    const key2 = 'm:1:2';
    for (const u of users.slice(0, 4)) assert.ok((await press(w, u, join, key2)).ok);
    assert.equal((await press(w, users[4], join, key2)).ok, false, 'fifth player refused');
    const s = w.sessions.get(key2).state;
    const actor = s.toAct;
    const mate = users[s.seats[(actor + 2) % 4].id - 1], opp = users[s.seats[(actor + 1) % 4].id - 1];
    const claim = `${g.key}:t:${s.seq}`;
    assert.equal((await press(w, opp, claim, key2)).ok, false, 'too early');
    s.touched -= 11 * 60 * 1000;
    assert.equal((await press(w, mate, claim, key2)).ok, false, 'a teammate cannot claim');
    assert.ok((await press(w, opp, claim, key2)).ok);
    const end = w.sessions.get(key2).state;
    assert.equal(end.winner, (actor + 1) % 2);
    settled(w, end, 100, 1000);
  }
});

// ---- hidden information ------------------------------------------------------
function keysDeep(o, out = new Set()) {
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.add(k); keysDeep(v, out); }
  return out;
}

function assertNoLeak(g, st, uid) {
  const v = g.view(st, uid);
  const keys = keysDeep(v);
  for (const k of ['deck', 'payq', 'bullet', 'ans', 'qs', 'word']) assert.ok(!keys.has(k), `${g.key}: view exposes "${k}"`);
  if (g.key === 'mn' && st.phase === 'play') assert.equal(v.mines, null, 'mines visible');
  if (g.key === 'bj' && st.phase === 'play') assert.equal(v.d[1], null, 'dealer hole card visible');
  if (g.key === 'rp') for (const [id, m] of Object.entries(v.picks ?? {})) if (Number(id) !== uid) assert.equal(m, true, 'rps pick visible');
  if (g.key === 'ph') for (const p of v.seats) if (p.hole && p.id !== uid) assert.ok(st.shown?.[p.id], 'hole cards visible');
  if (g.key === 'hm' && !st.over) assert.ok(v.mask.some((c) => c === null) || st.over, 'hangman word visible');
  if (g.key === 'hk' || g.key === 'sh') {
    for (const k of ['hands', 'widow']) assert.ok(!(k in v), `${g.key}: view exposes "${k}"`);
    const seat = st.seats.findIndex((p) => p.id === uid);
    if (seat < 0) assert.equal(v.cards, null, 'outsider sees a hand');
    else if (v.cards) assert.ok(v.cards.every((c) => c == null || st.hands[seat].includes(c)), 'sees cards that are not theirs');
    if (v.discards) assert.equal(seat, st.bidder, 'kitty visible to a non-bidder');
  }
  JSON.stringify(v); // must be serialisable
}

for (const g of GAMES) {
  await check(`no hidden-state leaks: ${g.key}`, async () => {
    const w = world();
    const n = g.players ?? 3;
    const users = Array.from({ length: n }, (_, i) => w.player(i + 1));
    for (let r = 0; r < 40; r++) {
      const key = `m:1:${r}`;
      let view = await g.lobby({ creator: users[0], bet: g.defaultBet ? 100 : 0 });
      for (let i = 0; i < 80; i++) {
        const opts = buttons(view);
        if (!opts.length) break;
        const b = opts[Math.floor(Math.random() * opts.length)].callback_data;
        const res = await press(w, users[Math.floor(Math.random() * n)], b, key);
        if (res.ok && res.view) view = res.view;
        const row = w.sessions.get(key);
        if (row) for (const uid of [...users.map((u) => u.id), 99]) assertNoLeak(g, row.state, uid);
      }
    }
  });
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
