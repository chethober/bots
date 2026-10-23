// Shared building blocks for every game screen.

export const tg = window.Telegram?.WebApp;

export const fmt = (n) => Number(n).toLocaleString('en-US');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function call(name, input = {}) {
  return new Promise((resolve, reject) => {
    if (!tg?.Serverless) return reject(new Error('Open this inside Telegram.'));
    tg.Serverless.call(name, input, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

// The `play` endpoint returns its payload as a JSON string (see endpoints/play.js).
export async function play(input) {
  const res = await call('play', input);
  const out = JSON.parse(res.json);
  if (out.chips != null) setBalance(out.chips);
  return out;
}

export function haptic(kind) {
  try {
    if (['light', 'medium', 'heavy', 'rigid', 'soft'].includes(kind)) tg.HapticFeedback.impactOccurred(kind);
    else if (kind === 'select') tg.HapticFeedback.selectionChanged();
    else tg.HapticFeedback.notificationOccurred(kind);
  } catch {}
}

let toastTimer;
export function toast(msg, kind) {
  if (!msg) return;
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (kind === 'error' ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = t.className.replace('show', '').trim(); }, 2600);
  if (kind) haptic(kind);
}

// ---- balance -------------------------------------------------------------------
export let balance = 0;
export function setBalance(n) {
  const b = document.getElementById('bal');
  if (balance && n !== balance) {
    b.classList.remove('flash-up', 'flash-down');
    void b.offsetWidth;
    b.classList.add(n > balance ? 'flash-up' : 'flash-down');
    setTimeout(() => b.classList.remove('flash-up', 'flash-down'), 900);
  }
  balance = n;
  b.textContent = fmt(n);
}

// ---- DOM helper --------------------------------------------------------------
// h('div.cls#id', { onclick, style, ... }, ...children)
export function h(sel, props, ...kids) {
  const [tag, ...rest] = sel.split(/(?=[.#])/);
  const el = document.createElement(tag || 'div');
  for (const r of rest) {
    if (r[0] === '.') el.classList.add(r.slice(1));
    else el.id = r.slice(1);
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

// Runs an async action with the button disabled; errors become toasts.
export async function busy(btn, fn) {
  if (btn?.dataset.busy) return;
  if (btn) { btn.dataset.busy = '1'; btn.disabled = true; }
  try {
    return await fn();
  } catch (e) {
    toast(e.message || 'Something went wrong', 'error');
  } finally {
    if (btn) { delete btn.dataset.busy; btn.disabled = false; }
  }
}

// ---- cards -------------------------------------------------------------------
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
export function cardEl(c, cls = '') {
  if (c == null) return h(`div.pcard.back${cls ? '.' + cls.split(' ').join('.') : ''}`);
  const suit = Math.floor(c / 13);
  const el = h(`div.pcard${suit === 1 || suit === 2 ? '.red' : ''}${cls ? '.' + cls.split(' ').join('.') : ''}`,
    h('span.r', RANKS[c % 13]), h('span.s1', SUITS[suit]), h('span.s2', SUITS[suit]));
  return el;
}
export const cardName = (c) => `${RANKS[c % 13]}${SUITS[Math.floor(c / 13)]}`;

// ---- dice --------------------------------------------------------------------
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function dieEl(v = 1, cls = '') {
  const d = h(`div.die${cls ? '.' + cls : ''}`);
  for (let i = 0; i < 9; i++) d.append(h('i'));
  setDie(d, v);
  return d;
}
export function setDie(d, v) {
  [...d.children].forEach((p, i) => p.classList.toggle('on', PIPS[v].includes(i)));
}
// Tumbles the dice for a moment, then shows the server's values.
export async function rollDice(dice, values, ms = 700) {
  dice.forEach((d) => d.classList.add('rolling'));
  const until = performance.now() + (reduced ? 0 : ms);
  while (performance.now() < until) {
    dice.forEach((d) => setDie(d, 1 + Math.floor(Math.random() * 6)));
    await sleep(80);
  }
  dice.forEach((d, i) => { d.classList.remove('rolling'); setDie(d, values[i]); });
}

// ---- stake picker ------------------------------------------------------------
// Free amount (1..5000) with quick chips, or a fixed set (`options`) as a segmented control.
export function stakePicker({ value = 100, options = null, label = 'Stake' } = {}) {
  let current = value;
  const wrap = h('div');
  if (options) {
    const seg = h('div.seg');
    for (const o of options) {
      const b = h('button', { onclick: () => { current = o; [...seg.children].forEach((x) => x.classList.toggle('on', x === b)); haptic('select'); } }, fmt(o));
      if (o === value) b.classList.add('on');
      seg.append(b);
    }
    wrap.append(h('div.row', h('span.l', label), seg));
  } else {
    const input = h('input.num', { type: 'number', inputmode: 'numeric', min: 1, max: 5000, value });
    input.addEventListener('input', () => { current = Math.floor(Number(input.value)) || 0; });
    const set = (v) => { current = Math.max(1, Math.min(5000, Math.floor(v))); input.value = current; haptic('select'); };
    const quick = [['½', () => current / 2], ['2×', () => current * 2], ['10', () => 10], ['100', () => 100], ['500', () => 500], ['Max', () => Math.min(balance, 5000)]];
    wrap.append(
      h('div.row', h('label.l', label), input),
      h('div.row', h('span.l'), h('div.chips', quick.map(([t, f]) => h('button.chip', { onclick: () => set(f()) }, t)))),
    );
  }
  return { el: wrap, get: () => current };
}

// ---- players -----------------------------------------------------------------
const COLORS = ['#e5484d', '#2481cc', '#2fb36b', '#f5b301', '#8e4ec6', '#f2711c', '#12a594', '#d6409f'];
export const colorOf = (id) => COLORS[Math.abs(Number(id)) % COLORS.length];
export function avatar(p) {
  return h('div.av', { style: { background: colorOf(p.id) } }, (p.name || '?').trim()[0]?.toUpperCase() ?? '?');
}
export function playerRow(p, { right = '', turn = false, out = false, me = false } = {}) {
  return h(`div.prow${turn ? '.turn' : ''}${out ? '.out' : ''}`, avatar(p), h('div.nm', p.name + (me ? ' (you)' : '')), h('div.val', right));
}

export function resultLine(el, net, text) {
  el.className = 'result' + (net > 0 ? ' win' : net < 0 ? ' lose' : '');
  el.textContent = text ?? (net > 0 ? `+${fmt(net)}` : net < 0 ? `−${fmt(-net)}` : '±0');
}

// Lobby buttons stored with a room (signed by the server), as big buttons.
export function lobbyButtons(info, ctx, filter = () => true) {
  const wrap = h('div.btns');
  for (const b of info.buttons.filter(filter)) {
    const el = h('button.big', { onclick: () => busy(el, () => ctx.act(b.data)) }, b.text);
    wrap.append(el);
  }
  return wrap;
}

// The table-game stakes the server accepts (lib/config.js BETS).
export const TABLE_BETS = [10, 50, 100, 500];
