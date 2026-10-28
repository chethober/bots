// Browser test for the Mini App: serves public/, stubs telegram-web-app.js, and answers
// Serverless.call with an in-memory backend built from the real game modules (same
// `ctx` contract as the cloud). Two pages act as two players for the multiplayer games.
// Run: npm run test:ui [-- --shots]   (screenshots land in test/shots/)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { BY_KEY } from '../tgcloud/lib/games/index.js';
import { GameError, nameOf, BETS } from '../tgcloud/lib/ui.js';
import { tr } from '../tgcloud/lib/i18n.js';
import { drop, TABLES } from '../tgcloud/lib/plinko.js';
import { crashPoint, evaluate, publicView, multAt } from '../tgcloud/lib/crash.js';

const ROOT = path.resolve('public');
const SHOTS = process.argv.includes('--shots');
// UI_ONLY=<regex> runs only the matching scenarios.
const ONLY = process.env.UI_ONLY ? new RegExp(process.env.UI_ONLY) : null;
// CHROME_PATH overrides the browser; otherwise Playwright's own (npx playwright-core install chromium-headless-shell).
const EXE = process.env.CHROME_PATH;

// ---- in-memory backend --------------------------------------------------------------
const wallets = new Map();
const sessions = new Map();
const player = (u) => {
  if (!wallets.has(u.id)) wallets.set(u.id, { id: u.id, name: nameOf(u), chips: 100000, lastDaily: 0 });
  return wallets.get(u.id);
};
function gameCtx(user, key, kind, out) {
  return {
    user: { id: user.id, name: nameOf(user) }, key, inline: false, chatType: 'app',
    locale: 'en', t: (s, v) => tr('en', s, v), localeOf: async () => 'en',
    session: async () => { const r = sessions.get(key); return r && r.kind === kind ? r : null; },
    create: async (k, state) => { if (sessions.has(key)) return null; const r = { kind: k, state: structuredClone(state), version: 0 }; sessions.set(key, r); return r; },
    mutate: async (fn) => {
      const r = sessions.get(key);
      if (!r) throw new GameError('This game has expired.');
      if (r.kind !== kind) throw new GameError('This button belongs to another game.');
      const prev = r.state;
      const next = fn(structuredClone(prev));
      r.state = structuredClone(next);
      return { state: next, prev };
    },
    debit: async (id, a) => { const p = wallets.get(id); if (!p || p.chips < a) return null; p.chips -= a; return { ...p }; },
    credit: async (id, a) => { const p = wallets.get(id); p.chips += a; return { ...p }; },
    refund: async (id, a) => { wallets.get(id).chips += a; },
    getPlayer: async (id) => ({ ...wallets.get(id) }),
    edit: async () => {},
    answer: async (t = '', alert = false) => { if (!out.answered) { out.answered = true; out.toast = t; out.alert = alert; } },
    emit: (r) => { out.result = r; },
    get answered() { return out.answered; },
  };
}
const fail = (m) => { throw Object.assign(new Error(m), { endpoint: true }); };
const rooms = new Map();
let roomN = 0;

async function backend(user, name, input) {
  const me = player(user);
  if (name === 'wallet') return { name: me.name, chips: me.chips, played: 0, wins: 0, bestWin: 0, daily: 500, dailyIn: 0 };
  if (name === 'shop') return { chips: me.chips, packs: [{ stars: 25, chips: 2500, link: 'https://t.me/$x' }, { stars: 100, chips: 11000, link: 'https://t.me/$y' }] };
  if (name === 'plinko') {
    const bet = input.bet;
    if (!TABLES[input.risk]) fail('Unknown risk level');
    if (me.chips < bet) fail('Not enough chips');
    const { path: p, slot, mult } = drop(input.risk);
    me.chips += Math.floor(bet * mult) - bet;
    return { path: p, slot, mult, payout: Math.floor(bet * mult), chips: me.chips };
  }
  if (name === 'crash') {
    const key = `crash:${me.id}`;
    let st = sessions.get(key)?.state;
    if (st) { const was = st.phase; evaluate(st, Date.now()); if (was === 'play' && st.phase === 'done') me.chips += st.payout; }
    if (input.op === 'start') {
      if (st?.phase === 'play') fail('A round is already running');
      me.chips -= input.bet;
      st = { owner: me.id, bet: input.bet, auto: input.auto ?? null, point: Math.max(crashPoint(), 1.5), start: Date.now(), phase: 'play', payout: 0, cashed: null };
      sessions.set(key, { kind: 'crash', state: st });
    } else if (input.op === 'cashout') {
      if (st?.phase !== 'play') fail('No round running');
      const m = multAt(Date.now() - st.start);
      Object.assign(st, { phase: 'done', cashed: m, payout: Math.floor(st.bet * m) });
      me.chips += st.payout;
    }
    return { round: st ? publicView(st, Date.now()) : null, chips: me.chips };
  }
  if (name !== 'play') fail(`unknown endpoint ${name}`);

  const view = (g, key) => { const r = sessions.get(key); return r && r.kind === g.key ? g.view(r.state, me.id) : null; };
  const dispatch = async (g, key, data) => {
    assert.equal(data.split(':')[0], g.key, 'action for another game');
    const out = {};
    try { await g.handle(gameCtx(user, key, g.key, out), data.split(':').slice(1)); } catch (e) { if (e instanceof GameError) fail(e.message); throw e; }
    return { view: view(g, key), toast: out.toast, alert: out.alert, result: out.result, chips: me.chips };
  };
  const g = BY_KEY[input.game ?? rooms.get(input.room)?.game];
  switch (input.op) {
    case 'open': return { view: view(g, `app:${me.id}:${g.key}`), chips: me.chips, bets: BETS };
    case 'deal': {
      const lobby = await g.lobby({ creator: { id: me.id, name: me.name }, bet: input.bet });
      const b = lobby.markup.inline_keyboard.flat().find((x) => x.callback_data?.split(':')[1] === `d${input.variant ?? ''}`);
      return dispatch(g, `app:${me.id}:${g.key}`, b.callback_data);
    }
    case 'create': {
      const lobby = await g.lobby({ creator: { id: me.id, name: me.name }, bet: input.bet });
      const room = `room${String(++roomN).padStart(4, '0')}`;
      rooms.set(room, { game: g.key, bet: input.bet, creator: { id: me.id, name: me.name }, buttons: lobby.markup.inline_keyboard.flat().filter((b) => b.callback_data).map((b) => ({ text: b.text, data: b.callback_data })) });
      return { room, link: `https://t.me/x?start=room_${room}` };
    }
    case 'room': {
      const rec = rooms.get(input.room) ?? fail('Room not found');
      return { ...rec, link: 'x', view: view(g, `app:r:${input.room}`), chips: me.chips, me: me.id };
    }
    case 'act': return input.room ? dispatch(g, `app:r:${input.room}`, input.data) : dispatch(g, `app:${me.id}:${g.key}`, input.data);
  }
  fail('Unknown op');
}

// ---- static server + telegram stub ---------------------------------------------------
const STUB = `
window.Telegram = { WebApp: {
  ready() {}, expand() {}, disableVerticalSwipes() {}, openTelegramLink(u) { window.__shared = u; }, switchInlineQuery() {},
  initDataUnsafe: { user: window.__user, start_param: '' },
  BackButton: { show() { window.__back = true; }, hide() { window.__back = false; }, onClick(f) { window.__backFn = f; } },
  HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} },
  Serverless: { call(name, input, cb) {
    if (typeof input === 'function') { cb = input; input = {}; }
    window.__backend(name, input).then((r) => r.error ? cb({ message: r.error, type: 'ENDPOINT_ERROR' }) : cb(null, r.ok), (e) => cb({ message: String(e) }));
  } },
} };`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
// UI_BASE=https://app….tgcloud.ai/ tests the deployed files instead of public/.
const BASE = process.env.UI_BASE ?? `http://127.0.0.1:${server.address().port}/`;

const proxy = process.env.UI_BASE && process.env.https_proxy ? { server: process.env.https_proxy } : undefined;
const browser = await chromium.launch({ executablePath: EXE || undefined, proxy });
const errors = [];
async function newPlayer(id, name) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.addInitScript((u) => { window.__user = u; }, { id, first_name: name });
  await page.route('https://telegram.org/**', (r) => r.fulfill({ contentType: 'text/javascript', body: STUB }));
  await page.exposeFunction('__backend', async (n, input) => {
    try {
      const ok = await backend({ id, first_name: name }, n, input);
      if (n === 'play') return { ok: { json: JSON.stringify(ok) } };
      return { ok };
    } catch (e) {
      if (e.endpoint) return { error: e.message };
      errors.push(`[backend ${name}] ${e.stack}`);
      return { error: 'internal' };
    }
  });
  page.on('pageerror', (e) => errors.push(`[${name} pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name} console] ${m.text()}`); });
  return page;
}

// ---- scenarios ------------------------------------------------------------------------
let failures = 0;
async function step(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const before = errors.length;
  try {
    await fn();
    if (errors.length > before) throw new Error(errors.slice(before).join('\n'));
    console.log(`✓ ${name}`);
  } catch (e) {
    failures++;
    console.log(`✗ ${name}\n  ${String(e.message).split('\n').slice(0, 6).join('\n  ')}`);
  }
}
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync('test/shots', { recursive: true }); await page.screenshot({ path: `test/shots/${name}.png`, fullPage: true, animations: 'disabled' }); } };
const home = async (page) => { await page.goto(BASE); await page.waitForSelector('.tile'); };
const open = async (page, title) => { await home(page); await page.locator('.tile', { hasText: title }).first().click(); };
const click = (page, text, opts = {}) => page.getByRole('button', { name: text, exact: opts.exact ?? false }).first().click();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const A = await newPlayer(7001, 'Alice');
const B = await newPlayer(7002, 'Bob');

await step('home lists every game', async () => {
  await home(A);
  const n = await A.locator('.tile').count();
  assert.equal(n, 22, `expected 22 tiles, got ${n}`);
  await shot(A, '00-home');
});

await step('slots spins and logs', async () => {
  await open(A, 'Slots');
  await click(A, 'Spin');
  await A.waitForSelector('.result.win, .result.lose, .result:not(:empty)', { timeout: 4000 });
  await A.waitForFunction(() => document.querySelectorAll('.log div').length > 0);
  await shot(A, '01-slots');
});

await step('roulette spins to the number', async () => {
  await open(A, 'Roulette');
  await click(A, 'Red');
  await A.waitForFunction(() => /\d/.test(document.querySelector('.hub').textContent), null, { timeout: 6000 });
  await shot(A, '02-roulette');
});

await step('coinflip lands', async () => {
  await open(A, 'Coinflip');
  await click(A, 'Heads');
  await A.waitForFunction(() => /Heads|Tails/.test(document.querySelector('.result').textContent), null, { timeout: 4000 });
  await shot(A, '03-coinflip');
});

await step('over/under rolls dice', async () => {
  await open(A, 'Over / Under 7');
  await click(A, 'Seven');
  await A.waitForFunction(() => /\d/.test(document.querySelector('.result').textContent), null, { timeout: 4000 });
  await shot(A, '04-dice');
});

await step('blackjack: deal, play to the end, deal again', async () => {
  await open(A, 'Blackjack');
  await click(A, 'Deal');
  await A.waitForSelector('.pcard');
  for (let i = 0; i < 6 && await A.getByRole('button', { name: 'Stand' }).count(); i++) {
    await click(A, 'Stand');
    await wait(150);
  }
  await A.waitForFunction(() => /Won|Lost|Stake back/.test(document.querySelector('.result').textContent));
  await shot(A, '05-blackjack');
  await click(A, 'Deal again');
  await A.waitForSelector('.pcard');
});

await step('video poker: hold two, draw', async () => {
  await open(A, 'Video Poker');
  await click(A, 'Deal');
  await A.waitForSelector('.felt .pcard:not(.back)');
  await A.locator('.felt .pcard').nth(0).click();
  await A.waitForSelector('.pcard.held');
  await shot(A, '06-videopoker-hold');
  await click(A, 'Draw');
  await A.waitForFunction(() => /Won|Lost|Stake back/.test(document.querySelector('.result').textContent));
  await shot(A, '06-videopoker');
});

await step('mines: open a tile, cash out or bust', async () => {
  await open(A, 'Mines');
  await click(A, 'Start');
  await A.locator('.tiles button:not([disabled])').first().click();
  await wait(200);
  if (await A.getByRole('button', { name: /Cash out/ }).count()) await click(A, 'Cash out');
  await A.waitForFunction(() => /Won|Lost/.test(document.querySelector('.result').textContent));
  await shot(A, '07-mines');
});

await step('hi-lo: one call then settle', async () => {
  await open(A, 'Hi-Lo');
  await click(A, 'Deal');
  await click(A, 'Higher/same');
  await wait(200);
  if (await A.getByRole('button', { name: /Cash out/ }).count()) await click(A, 'Cash out');
  await A.waitForFunction(() => /Won|Lost/.test(document.querySelector('.result').textContent));
  await shot(A, '08-hilo');
});

await step('crash: launch and cash out', async () => {
  await open(A, 'Crash');
  await click(A, 'Launch');
  await A.waitForSelector('.big.good');
  await wait(400);
  await click(A, 'Cash out');
  await A.waitForSelector('.m.won, .m.bust');
  await shot(A, '09-crash');
});

await step('plinko: drop a ball', async () => {
  await open(A, 'Plinko');
  await click(A, 'Drop ball');
  await A.waitForFunction(() => /×/.test(document.querySelector('.result').textContent), null, { timeout: 5000 });
  await shot(A, '10-plinko');
});

// Creates a room as A and opens it as B (the invite link's room id).
async function makeRoom(title, stakeLabel) {
  await open(A, title);
  await click(A, 'Create room');
  await A.waitForFunction(() => window.__shared);
  const room = await A.evaluate(() => decodeURIComponent(window.__shared).match(/room_(\w+)/)[1]);
  await B.goto(`${BASE}?room=${room}`);
  await B.waitForSelector('#screen h2:not(:text("Loading…"))');
  await A.evaluate(() => { window.__shared = null; });
  return room;
}

await step("hold'em: two players, a hand to showdown, leave", async () => {
  await makeRoom("Texas Hold'em");
  await click(A, 'Join');
  await click(B, 'Join');
  await A.waitForFunction(() => document.querySelectorAll('.prow').length === 2, null, { timeout: 5000 });
  await click(A, 'Deal');
  await A.waitForSelector('.mine .pcard');
  await B.waitForSelector('.mine .pcard', { timeout: 5000 });
  await shot(A, '11-poker-hand');
  // Each player checks/calls whenever it's their turn until the hand ends.
  for (let i = 0; i < 20; i++) {
    for (const P of [A, B]) {
      const btn = P.getByRole('button', { name: /^(Check|Call)/ });
      if (await btn.count()) { await btn.first().click(); await wait(250); }
    }
    if (await A.getByRole('button', { name: 'Deal next hand' }).count()) break;
    await wait(600);
  }
  await A.waitForSelector('text=Deal next hand', { timeout: 5000 });
  await shot(A, '11-poker-showdown');
  await click(A, 'End table');
  await A.waitForSelector('text=Table closed');
  assert.equal(wallets.get(7001).chips + wallets.get(7002).chips > 0, true);
});

await step('coinflip duel: accept and reveal', async () => {
  await makeRoom('Coinflip Duel');
  await click(B, 'Accept');
  await B.waitForSelector('text=wins', { timeout: 5000 });
  await A.waitForSelector('text=wins', { timeout: 6000 });
  await shot(B, '12-coinduel');
});

await step('dice duel: accept and reveal', async () => {
  await makeRoom('Dice Duel');
  await click(B, 'Accept');
  await B.waitForSelector('text=wins', { timeout: 8000 });
  await shot(B, '13-diceduel');
});

await step('rock paper scissors: both pick', async () => {
  await makeRoom('Rock Paper Scissors');
  await click(B, 'Accept');
  for (let i = 0; i < 6; i++) {
    for (const [P, k] of [[A, i % 3], [B, (i + 1) % 3]]) { await P.waitForTimeout(2300); if (await P.locator('.rps button').count()) await P.locator('.rps button').nth(k).click(); }
    if (await A.locator('text=wins').count()) break;
  }
  await A.waitForSelector('text=wins', { timeout: 5000 });
  await shot(A, '14-rps');
});

await step('jackpot: both join, host draws', async () => {
  await makeRoom('Jackpot');
  await click(A, 'Join');
  await click(B, 'Join');
  await A.waitForFunction(() => document.querySelectorAll('.prow').length === 2, null, { timeout: 5000 });
  await click(A, 'Draw');
  await A.waitForSelector('text=takes', { timeout: 8000 });
  await shot(A, '15-jackpot');
});

await step('russian roulette: play until bang', async () => {
  await makeRoom('Russian Roulette');
  await click(A, 'Join');
  await click(B, 'Join');
  await A.waitForFunction(() => document.querySelectorAll('.prow').length === 2, null, { timeout: 5000 });
  await click(A, 'Spin');
  for (let i = 0; i < 12 && !(await A.locator('text=New round').count()); i++) {
    for (const P of [A, B]) {
      await P.waitForTimeout(400);
      const b = P.getByRole('button', { name: 'Pull the trigger' });
      if (await b.count()) await b.click();
    }
    await wait(2100);
  }
  await A.waitForSelector('text=New round', { timeout: 5000 });
  await shot(A, '16-russian');
});

await step('tic-tac-toe: full game', async () => {
  await makeRoom('Tic-tac-toe');
  await click(B, 'Join');
  await A.waitForSelector('.ttt', { timeout: 5000 });
  const order = [[A, 0], [B, 3], [A, 1], [B, 4], [A, 2]];
  for (const [P, cell] of order) {
    await P.waitForFunction(() => document.querySelector('.result')?.textContent === 'Your move', null, { timeout: 5000 });
    await P.locator('.ttt button').nth(cell).click();
  }
  await A.waitForSelector('text=You won', { timeout: 5000 });
  await shot(A, '17-ttt');
  await click(A, 'Rematch');
  await B.waitForFunction(() => document.querySelector('.result')?.textContent === 'Your move', null, { timeout: 5000 });
});

await step('connect four: a few moves', async () => {
  await makeRoom('Connect Four');
  await click(B, 'Join');
  for (const [P, c] of [[A, 3], [B, 3], [A, 4]]) {
    await P.waitForFunction(() => document.querySelector('.result')?.textContent === 'Your move', null, { timeout: 5000 });
    await P.locator('.c4cols button').nth(c).click();
  }
  await B.waitForFunction(() => document.querySelectorAll('.c4 .disc').length === 3, null, { timeout: 5000 });
  await shot(B, '18-connect4');
});

await step('trivia: answer and skip through a round', async () => {
  await makeRoom('Trivia');
  await click(A, 'Start');
  for (let i = 0; i < 6 && !(await A.locator('text=Final scores').count()); i++) {
    await A.waitForSelector('.qcard, h3');
    if (await A.locator('.answers button:not([disabled])').count()) await A.locator('.answers button').first().click();
    await wait(200);
    if (await A.getByRole('button', { name: 'Skip question' }).count()) await click(A, 'Skip question');
    await wait(200);
  }
  await A.waitForSelector('text=Final scores', { timeout: 5000 });
  await shot(A, '19-trivia');
});

await step('hangman: guess letters until over', async () => {
  await makeRoom('Hangman');
  await click(A, 'Start');
  for (const L of 'EAORISTNLUCDPMHGBYFKWVZXJQ') {
    if (await A.locator('text=New word').count()) break;
    await A.locator('.keys button', { hasText: new RegExp(`^${L}$`) }).click();
    await wait(80);
  }
  await A.waitForSelector('text=New word', { timeout: 5000 });
  await shot(A, '20-hangman');
});

await step('shop lists the Stars packs', async () => {
  await home(A);
  await A.locator('#shop').click();
  await A.waitForSelector('.tile:has-text("2,500 chips")');
  await shot(A, '21-shop');
  await A.evaluate(() => window.__backFn());
  await A.waitForSelector('.tile');
});

// Four players for the Persian games: A creates, everyone joins; the 4th join deals.
const C = await newPlayer(7003, 'Cyrus');
const D = await newPlayer(7004, 'Dara');
const FOUR = [A, B, C, D];
async function fourJoin(title) {
  const room = await makeRoom(title);
  for (const P of [C, D]) {
    await P.goto(`${BASE}?room=${room}`);
    await P.waitForSelector('#screen h2:not(:text("Loading…"))');
  }
  for (const P of FOUR) { await P.getByRole('button', { name: /Join/ }).first().click(); await wait(150); }
  await A.waitForSelector('.ttable', { timeout: 6000 });
}
// The page whose turn it is: it shows tappable cards, or the given button.
async function whoseTurn(test, tries = 30) {
  for (let i = 0; i < tries; i++) {
    for (const P of FOUR) if (await test(P)) return P;
    await wait(300);
  }
  throw new Error('nobody to act');
}
// Cards in a hand overlap: tap the visible left strip, not the centre (the next card's).
const tapCard = (P) => P.locator('.fan .pcard.tap').first().click({ position: { x: 8, y: 20 } });
async function playTrick() {
  for (let k = 0; k < 4; k++) {
    const P = await whoseTurn((p) => p.locator('.fan .pcard.tap').count());
    const before = await P.locator('.fan .pcard').count();
    await tapCard(P);
    await P.waitForFunction((n) => document.querySelectorAll('.fan .pcard').length === n - 1, before, { timeout: 5000 });
  }
}

await step('hokm: four join, the Hakem calls trump, one trick', async () => {
  await fourJoin('Hokm');
  const hakem = await whoseTurn((p) => p.locator('text=You are the Hakem').count());
  assert.equal(await hakem.locator('.fan .pcard').count(), 5, 'the Hakem sees five cards');
  await shot(hakem, '22-hokm-trump');
  await click(hakem, '♥', { exact: true });
  await hakem.waitForFunction(() => document.querySelectorAll('.fan .pcard').length === 13, null, { timeout: 5000 });
  await playTrick();
  await A.waitForSelector('.tcard.glow', { timeout: 5000 });
  await shot(A, '22-hokm');
});

await step('shelem: bidding, kitty, trump, one trick', async () => {
  await fourJoin('Shelem');
  for (let i = 0; i < 3; i++) {
    const P = await whoseTurn((p) => p.getByRole('button', { name: 'Pass', exact: true }).count());
    await click(P, 'Pass', { exact: true });
    await wait(300);
  }
  const bidder = await whoseTurn((p) => p.locator('text=You took the kitty').count());
  assert.equal(await bidder.locator('.fan .pcard').count(), 16, 'the bidder holds the kitty');
  await shot(bidder, '23-shelem-kitty');
  for (let n = 16; n > 12; n--) {
    await tapCard(bidder);
    await bidder.waitForFunction((m) => document.querySelectorAll('.fan .pcard').length === m - 1, n, { timeout: 5000 });
  }
  await click(bidder, '♠', { exact: true });
  await bidder.waitForSelector('text=Your lead', { timeout: 5000 });
  await playTrick();
  await A.waitForSelector('.tcard.glow', { timeout: 5000 });
  await shot(A, '23-shelem');
});

await step('back navigation returns home', async () => {
  await open(A, 'Mines');
  await A.evaluate(() => window.__backFn());
  await A.waitForSelector('.tile');
});

await browser.close();
server.close();
console.log(failures ? `\n${failures} UI check(s) failed` : '\nAll UI checks passed');
process.exit(failures ? 1 : 0);
