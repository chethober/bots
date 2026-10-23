// Crash: the curve climbs until a hidden crash point; the server clock decides everything.
import { h, call, toast, haptic, fmt, setBalance, stakePicker, busy } from '../kit.js';

const GROWTH = 0.00007; // must match tgcloud/lib/crash.js

export function mount(root) {
  const canvas = h('canvas');
  const multEl = h('div.m', '1.00×', h('small', 'Place a bet to launch'));
  const hist = h('div.history');
  const stake = stakePicker({ value: 100 });
  const auto = h('input.num', { type: 'number', inputmode: 'decimal', placeholder: 'off', min: 1.01, step: 0.1 });
  const btn = h('button.big', 'Launch');
  root.append(h('div.stage', canvas, multEl), hist,
    h('div.panel', stake.el, h('div.row', h('label.l', 'Auto ×'), auto), btn),
    h('p.muted', 'The multiplier climbs until a hidden crash point. Cash out before it busts to win stake × multiplier. Auto cash-out pays at your target even if you look away.'));

  const g = canvas.getContext('2d');
  let round = null, t0 = 0, raf = 0, poll = 0, dead = false;
  const history = [];
  const multAt = (ms) => Math.floor(Math.exp(GROWTH * Math.max(0, ms)) * 100) / 100;

  function size() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * devicePixelRatio;
    canvas.height = r.height * devicePixelRatio;
  }
  function draw(ms, color) {
    const w = canvas.width, hh = canvas.height;
    g.clearRect(0, 0, w, hh);
    const span = Math.max(8000, ms * 1.15);
    const top = Math.max(2, Math.exp(GROWTH * span));
    g.lineWidth = 4 * devicePixelRatio;
    g.strokeStyle = color;
    g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = (ms * i) / 80;
      const x = (t / span) * w;
      const y = hh - ((Math.exp(GROWTH * t) - 1) / (top - 1)) * hh * 0.85 - hh * 0.06;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.lineTo((ms / span) * w, hh); g.lineTo(0, hh); g.closePath();
    g.globalAlpha = 0.12; g.fillStyle = color; g.fill(); g.globalAlpha = 1;
  }
  function frame() {
    if (!round || round.phase !== 'play' || dead) return;
    const ms = performance.now() - t0;
    const m = multAt(ms);
    multEl.className = 'm';
    multEl.innerHTML = `${m.toFixed(2)}×<small>${round.auto ? `auto at ${round.auto}× · ` : ''}win ${fmt(Math.floor(round.bet * m))}</small>`;
    draw(ms, getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#2481cc');
    raf = requestAnimationFrame(frame);
  }
  function show(r) {
    const was = round;
    round = r;
    cancelAnimationFrame(raf);
    clearTimeout(poll);
    if (dead) return;
    if (!r) { btn.textContent = 'Launch'; btn.className = 'big'; return; }
    if (r.phase === 'play') {
      t0 = performance.now() - r.elapsed;
      btn.textContent = 'Cash out'; btn.className = 'big good';
      raf = requestAnimationFrame(frame);
      poll = setTimeout(refresh, 900);
      return;
    }
    btn.textContent = 'Launch again'; btn.className = 'big';
    const ms = Math.log(r.point) / GROWTH;
    if (r.cashed) {
      multEl.className = 'm won';
      multEl.innerHTML = `+${fmt(r.payout - r.bet)}<small>cashed at ${r.cashed}× · crashed at ${r.point}×</small>`;
      draw(ms, '#2fb36b');
    } else {
      multEl.className = 'm bust';
      multEl.innerHTML = `${r.point.toFixed(2)}×<small>crashed — lost ${fmt(r.bet)}</small>`;
      draw(ms, '#e5484d');
    }
    if (was && was.phase === 'play') {
      haptic(r.cashed ? 'success' : 'error');
      history.unshift(r.point);
      hist.replaceChildren(...history.slice(0, 20).map((p) => h(`span.${p < 2 ? 'lo' : 'hi'}`, `${p.toFixed(2)}×`)));
    }
  }
  async function refresh() {
    try {
      const res = await call('crash', { op: 'status' });
      setBalance(res.chips);
      show(res.round);
    } catch { if (!dead) poll = setTimeout(refresh, 2000); }
  }
  btn.addEventListener('click', () => busy(btn, async () => {
    let res;
    if (round && round.phase === 'play') res = await call('crash', { op: 'cashout' });
    else {
      res = await call('crash', { op: 'start', bet: stake.get(), auto: auto.value ? Number(auto.value) : null });
      haptic('medium');
    }
    setBalance(res.chips);
    show(res.round);
  }));

  requestAnimationFrame(() => { size(); refresh(); });
  return { update() {}, destroy() { dead = true; cancelAnimationFrame(raf); clearTimeout(poll); } };
}
