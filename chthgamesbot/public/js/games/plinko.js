// Plinko: balls follow the path the server rolled, peg by peg.
import { h, call, toast, haptic, fmt, setBalance, balance, stakePicker } from '../kit.js';

const ROWS = 12;
const TABLES = {
  low: [8.4, 3, 1.5, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.5, 3, 8.4],
  medium: [24, 9, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 9, 24],
  high: [130, 24, 8, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8, 24, 130],
};
const STEP = 140;

export function mount(root) {
  const canvas = h('canvas#plinkoCanvas');
  const last = h('div.result');
  const stake = stakePicker({ value: 10 });
  let risk = 'medium';
  const seg = h('div.seg', ['low', 'medium', 'high'].map((r) => {
    const b = h('button', { onclick: () => {
      if (balls.length) return toast('Wait for the balls to land');
      risk = r;
      [...seg.children].forEach((x) => x.classList.toggle('on', x === b));
      haptic('select');
      draw(performance.now());
    } }, r[0].toUpperCase() + r.slice(1));
    if (r === risk) b.classList.add('on');
    return b;
  }));
  const drop = h('button.big', 'Drop ball');
  root.append(canvas, last, h('div.panel', stake.el, h('div.row', h('span.l', 'Risk'), seg), drop));

  const g = canvas.getContext('2d');
  let balls = [], raf = 0, flash = { slot: -1, until: 0 }, geo, dead = false, inflight = 0;

  function layout() {
    const w = canvas.getBoundingClientRect().width;
    const hh = w * 0.95;
    canvas.style.height = hh + 'px';
    canvas.width = w * devicePixelRatio;
    canvas.height = hh * devicePixelRatio;
    const d = devicePixelRatio;
    const gap = (w * d) / (ROWS + 3);
    geo = { d, gap, top: gap * 0.9, cx: (w * d) / 2, slotY: gap * 0.9 + gap * ROWS + gap * 0.2 };
  }
  const pegX = (row, i) => geo.cx + (i - row / 2) * geo.gap;
  const pegY = (row) => geo.top + row * geo.gap;
  const slotColor = (m) => (m >= 10 ? '#e5484d' : m >= 2 ? '#f2711c' : m >= 1 ? '#f5b301' : '#8a8a8e');

  function rr(x, y, w, hh, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r);
    g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
  }
  function ballPos(b, now) {
    const t = Math.max(0, now - b.start) / STEP;
    const row = Math.min(Math.floor(t), ROWS);
    const f = Math.min(t - row, 1);
    let rights = 0;
    for (let i = 0; i < row; i++) rights += b.path[i];
    const fromX = geo.cx + (rights - row / 2) * geo.gap;
    const toX = geo.cx + (rights + (row < ROWS ? b.path[row] : 0) - (row + 1) / 2) * geo.gap;
    const y0 = pegY(row) - geo.gap * 0.45;
    const y1 = row < ROWS ? pegY(row + 1) - geo.gap * 0.45 : geo.slotY + geo.gap * 0.1;
    return { x: fromX + (toX - fromX) * f, y: y0 + (y1 - y0) * f * f - Math.sin(f * Math.PI) * geo.gap * 0.18 };
  }
  function draw(now) {
    if (!geo) return;
    const { d, gap } = geo;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = getComputedStyle(document.body).getPropertyValue('--hint').trim() || '#888';
    for (let r = 0; r < ROWS; r++) for (let i = 0; i <= r + 2; i++) {
      g.beginPath(); g.arc(pegX(r + 2, i), pegY(r), 2.6 * d, 0, Math.PI * 2); g.fill();
    }
    const t = TABLES[risk], sw = gap * 0.92, sh = gap * 0.62;
    g.font = `700 ${Math.round(gap * 0.26)}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let s = 0; s <= ROWS; s++) {
      const x = pegX(ROWS + 1, s + 0.5);
      const lit = flash.slot === s && now < flash.until;
      g.fillStyle = slotColor(t[s]);
      g.globalAlpha = lit ? 1 : 0.85;
      const y = geo.slotY + (lit ? 3 * d : 0);
      rr(x - sw / 2, y, sw, sh, 6 * d);
      g.globalAlpha = 1; g.fillStyle = '#fff';
      g.fillText(t[s] >= 100 ? Math.round(t[s]) : t[s], x, y + sh / 2);
    }
    g.fillStyle = '#e5484d';
    for (const b of balls) { const p = ballPos(b, now); g.beginPath(); g.arc(p.x, p.y, gap * 0.17, 0, Math.PI * 2); g.fill(); }
  }
  function loop(now) {
    if (dead) return;
    const done = balls.filter((b) => now - b.start >= STEP * (ROWS + 1));
    done.forEach((b) => b.land());
    balls = balls.filter((b) => !done.includes(b));
    draw(now);
    raf = balls.length || now < flash.until ? requestAnimationFrame(loop) : 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  drop.addEventListener('click', async () => {
    if (inflight >= 3) return;
    inflight++;
    const bet = stake.get();
    const usedRisk = risk;
    setBalance(balance - bet);
    haptic('light');
    try {
      const res = await call('plinko', { bet, risk: usedRisk });
      balls.push({
        path: res.path, start: performance.now(),
        land() {
          setBalance(res.chips);
          flash = { slot: res.slot, until: performance.now() + 500 };
          const net = res.payout - bet;
          last.className = 'result' + (net > 0 ? ' win' : net < 0 ? ' lose' : '');
          last.textContent = `${res.mult}× · ${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}`;
          haptic(res.mult >= 2 ? 'success' : 'light');
        },
      });
      kick();
    } catch (e) {
      setBalance(balance + bet);
      toast(e.message || 'Something went wrong', 'error');
    } finally {
      inflight--;
    }
  });

  const onResize = () => { layout(); draw(performance.now()); };
  requestAnimationFrame(onResize);
  window.addEventListener('resize', onResize);
  return { update() {}, destroy() { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); } };
}
