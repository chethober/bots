// App shell: wallet header, home grid, navigation, personal game screens and rooms.

import { tg, call, play, toast, haptic, fmt, h, busy, setBalance, stakePicker } from './kit.js';

tg?.ready();
tg?.expand();
try { tg?.disableVerticalSwipes?.(); } catch {}

// kind: 'personal' (one table per player) · 'room' (shareable multiplayer) · 'custom' (own endpoint)
const GAMES = [
  { key: 'crash', ico: '🚀', t: 'Crash', d: 'Cash out before it crashes', kind: 'custom', sec: 'Casino' },
  { key: 'plinko', ico: '🔴', t: 'Plinko', d: 'Drop balls, up to 130×', kind: 'custom', sec: 'Casino' },
  { key: 'sl', ico: '🎰', t: 'Slots', d: '7️⃣7️⃣7️⃣ pays 150×', kind: 'personal', sec: 'Casino' },
  { key: 'rl', ico: '🎡', t: 'Roulette', d: 'European wheel', kind: 'personal', sec: 'Casino' },
  { key: 'cf', ico: '🪙', t: 'Coinflip', d: 'Heads or tails, 1.95×', kind: 'personal', sec: 'Casino' },
  { key: 'dc', ico: '🎲', t: 'Over / Under 7', d: 'Two dice, up to 5.5×', kind: 'personal', sec: 'Casino' },
  { key: 'bj', ico: '🃏', t: 'Blackjack', d: 'Beat the dealer, 3:2', kind: 'personal', sec: 'Cards & solo' },
  { key: 'vp', ico: '🂡', t: 'Video Poker', d: 'Jacks or Better', kind: 'personal', sec: 'Cards & solo' },
  { key: 'mn', ico: '💣', t: 'Mines', d: 'Dodge mines, cash out', kind: 'personal', sec: 'Cards & solo' },
  { key: 'hl', ico: '📈', t: 'Hi-Lo', d: 'Higher or lower streaks', kind: 'personal', sec: 'Cards & solo' },
  { key: 'ph', ico: '♠️', t: "Texas Hold'em", d: '2–8 players, no-limit', kind: 'room', bet: 200, sec: 'With friends' },
  { key: 'cd', ico: '🪙', t: 'Coinflip Duel', d: 'One flip, winner takes all', kind: 'room', bet: 100, sec: 'With friends' },
  { key: 'dd', ico: '🎲', t: 'Dice Duel', d: 'Higher roll wins', kind: 'room', bet: 100, sec: 'With friends' },
  { key: 'rp', ico: '✂️', t: 'Rock Paper Scissors', d: 'Secret picks', kind: 'room', bet: 100, sec: 'With friends' },
  { key: 'jp', ico: '🎟', t: 'Jackpot', d: 'One winner takes the pot', kind: 'room', bet: 100, sec: 'With friends' },
  { key: 'rr', ico: '🔫', t: 'Russian Roulette', d: 'Survivors split the pot', kind: 'room', bet: 100, sec: 'With friends' },
  { key: 'tt', ico: '❌', t: 'Tic-tac-toe', d: 'Free · 2 players', kind: 'room', bet: 0, sec: 'Party (free)' },
  { key: 'c4', ico: '🔴', t: 'Connect Four', d: 'Free · 2 players', kind: 'room', bet: 0, sec: 'Party (free)' },
  { key: 'tv', ico: '🧠', t: 'Trivia', d: 'Free · fastest finger', kind: 'room', bet: 0, sec: 'Party (free)' },
  { key: 'hm', ico: '🔤', t: 'Hangman', d: 'Free · guess together', kind: 'room', bet: 0, sec: 'Party (free)' },
];
const BY_KEY = Object.fromEntries(GAMES.map((g) => [g.key, g]));

const screen = document.getElementById('screen');
let current = null;      // { destroy() } of the open screen
const stack = [];        // back navigation: functions that re-open previous screens

// ---- navigation ------------------------------------------------------------------
function show(open, { push = true } = {}) {
  current?.destroy?.();
  current = null;
  screen.replaceChildren();
  window.scrollTo(0, 0);
  if (push && stack.length) { /* caller decides */ }
  current = open() ?? null;
  screen.classList.remove('enter');
  void screen.offsetWidth;
  screen.classList.add('enter');
  const canBack = stack.length > 0;
  document.getElementById('back').classList.toggle('hidden', !canBack || !!tg?.BackButton);
  if (tg?.BackButton) canBack ? tg.BackButton.show() : tg.BackButton.hide();
}
function go(open) {
  stack.push(currentOpen);
  currentOpen = open;
  show(open);
}
function back() {
  const prev = stack.pop();
  if (!prev) return;
  currentOpen = prev;
  show(prev);
}
let currentOpen = home;
tg?.BackButton?.onClick(back);
document.getElementById('back').addEventListener('click', back);

// ---- wallet ------------------------------------------------------------------------
let dailyIn = 0;
async function loadWallet(claim = false) {
  try {
    const w = await call('wallet', claim ? { claim: true } : {});
    document.getElementById('name').textContent = w.name;
    setBalance(w.chips);
    dailyIn = w.dailyIn;
    renderDaily();
    if (claim) toast(`+${fmt(w.daily)} chips!`, 'success');
  } catch (e) {
    toast(e.message || 'Could not load your wallet', 'error');
  }
}
function renderDaily() {
  const b = document.getElementById('daily');
  b.disabled = dailyIn > 0;
  b.classList.toggle('ready', dailyIn <= 0);
  b.textContent = dailyIn > 0 ? `🎁 ${Math.ceil(dailyIn / 3600)}h` : '🎁 Claim';
}
document.getElementById('daily').addEventListener('click', () => loadWallet(true));
setInterval(() => { if (dailyIn > 0) { dailyIn = Math.max(0, dailyIn - 60); renderDaily(); } }, 60_000);

// ---- home ------------------------------------------------------------------------------
let homeShown = false;
function home() {
  const secs = [...new Set(GAMES.map((g) => g.sec))];
  let i = 0;
  // Tiles cascade in on the first visit only; coming back home should be instant.
  screen.classList.toggle('stagger', !homeShown);
  homeShown = true;
  secs.forEach((sec, s) => {
    screen.append(h('h3', sec));
    screen.append(h('div.grid', { 'data-sec': s }, GAMES.filter((g) => g.sec === sec).map((g) =>
      h('button.tile', { onclick: () => openGame(g.key), style: `--i:${Math.min(i++, 12)}` },
        h('span.ico', g.ico), h('span.t', g.t), h('span.d', g.d)))));
  });
  screen.append(h('div.note',
    'Play-money chips only: you start with 1,000 and get a free bonus every day. Chips can\'t be bought, sold or withdrawn. ',
    'Multiplayer games make a room with an invite link. You can also type @chthgamesbot in any chat.'));
}

function openGame(key) {
  const g = BY_KEY[key];
  haptic('light');
  if (g.kind === 'custom' || g.kind === 'personal') return go(() => personalScreen(g));
  return go(() => newRoomScreen(g));
}

async function loadModule(key) {
  return import(`./games/${key}.js`);
}

// ---- personal games ------------------------------------------------------------------
function personalScreen(g) {
  screen.append(h('h2', `${g.ico} ${g.t}`));
  const root = h('div');
  screen.append(root);
  let inst = null;
  let dead = false;
  (async () => {
    const mod = await loadModule(g.key);
    if (dead) return;
    if (g.kind === 'custom') { inst = mod.mount(root, {}); return; }
    const ctx = {
      game: g.key,
      async act(data) { return play({ op: 'act', game: g.key, data }); },
      async deal(bet, variant = '') { return play({ op: 'deal', game: g.key, bet, variant }); },
    };
    inst = mod.mount(root, ctx);
    try {
      const res = await play({ op: 'open', game: g.key });
      if (!dead) inst.update(res.view, null);
    } catch (e) { toast(e.message, 'error'); }
  })();
  return { destroy() { dead = true; inst?.destroy?.(); } };
}

// ---- rooms -------------------------------------------------------------------------------
function newRoomScreen(g) {
  screen.append(h('h2', `${g.ico} ${g.t}`));
  screen.append(h('p.muted', g.bet ? 'Pick the stake. Everyone who joins puts in the same amount; chips move only when the game is played.' : 'Free to play. Create a room and invite friends with the link.'));
  const stake = g.bet ? stakePicker({ value: g.bet, label: g.key === 'ph' ? 'Buy-in' : 'Stake' }) : null;
  const panel = h('div.panel', stake?.el ?? '');
  const btn = h('button.big', {
    onclick: () => busy(btn, async () => {
      const res = await play({ op: 'create', game: g.key, bet: stake ? stake.get() : 0 });
      haptic('success');
      // Replace this screen with the room (back goes home, not to the create form).
      currentOpen = () => roomScreen(res.room);
      show(currentOpen);
      share(res.link, g);
    }),
  }, 'Create room');
  panel.append(btn);
  screen.append(panel);
}

function share(link, g) {
  const text = `Join my ${g.t} game on Chth Games!`;
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  try { tg.openTelegramLink(url); } catch { navigator.clipboard?.writeText(link); toast('Invite link copied'); }
}

function roomScreen(room) {
  const head = h('h2', 'Loading…');
  const bar = h('div.room-bar');
  const root = h('div');
  screen.append(head, bar, root);
  let inst = null, info = null, last = '', timer = 0, dead = false, acting = 0;

  const ctx = {
    room,
    get info() { return info; },
    // New room for the same game and stake (rematch for one-shot games).
    async again() {
      const res = await play({ op: 'create', game: info.game, bet: info.bet });
      currentOpen = () => roomScreen(res.room);
      show(currentOpen);
      share(res.link, BY_KEY[info.game]);
    },
    async act(data) {
      acting++;
      try {
        const res = await play({ op: 'act', room, data });
        if (res.toast && (res.alert || res.toast.length > 0)) toast(res.toast, res.alert ? 'warning' : null);
        last = JSON.stringify(res.view);
        inst?.update(res.view, res, info);
        return res;
      } finally {
        acting--;
      }
    },
  };

  async function poll() {
    clearTimeout(timer);
    if (dead) return;
    if (!document.hidden && !acting) {
      try {
        const res = await play({ op: 'room', room });
        if (dead) return;
        if (!info) {
          info = res;
          const g = BY_KEY[res.game];
          head.textContent = `${g.ico} ${g.t}`;
          bar.append(
            h('span.code', res.bet ? `Stake ${fmt(res.bet)} · host ${res.creator.name}` : `Host ${res.creator.name}`),
            h('button.pill', { onclick: () => share(res.link, g) }, '📤 Invite'),
          );
          const mod = await loadModule(res.game);
          if (dead) return;
          inst = mod.mount(root, ctx);
        }
        info = { ...info, ...res };
        const sig = JSON.stringify(res.view);
        if (sig !== last) { last = sig; inst.update(res.view, null, info); }
      } catch (e) {
        if (!info) { head.textContent = 'Room not found'; root.replaceChildren(h('p.muted', e.message || '')); return; }
      }
    }
    timer = setTimeout(poll, 2000);
  }
  poll();
  const vis = () => { if (!document.hidden) poll(); };
  document.addEventListener('visibilitychange', vis);
  return { destroy() { dead = true; clearTimeout(timer); document.removeEventListener('visibilitychange', vis); inst?.destroy?.(); } };
}

// ---- boot --------------------------------------------------------------------------------
loadWallet();
const params = new URLSearchParams(location.search);
const start = params.get('room') ? `room_${params.get('room')}` : (tg?.initDataUnsafe?.start_param || params.get('game') || '');
show(home);
if (/^room_[a-z0-9]{8}$/.test(start)) go(() => roomScreen(start.slice(5)));
else if (BY_KEY[start]) openGame(start);

