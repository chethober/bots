// Roulette: a European wheel spins so the server's number stops under the pointer.
import { h, busy, haptic, stakePicker, TABLE_BETS, resultLine, reduced, sleep } from '../kit.js';

const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = (n) => (n === 0 ? '#1b8e4b' : REDS.has(n) ? '#d93a3f' : '#1d1d1f');

function drawWheel(cv) {
  const s = cv.width, c = s / 2, g = cv.getContext('2d');
  const step = (Math.PI * 2) / 37;
  g.clearRect(0, 0, s, s);
  g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fillStyle = '#6b3a17'; g.fill();
  ORDER.forEach((n, i) => {
    const a0 = -Math.PI / 2 + i * step - step / 2;
    g.beginPath(); g.moveTo(c, c); g.arc(c, c, c * 0.92, a0, a0 + step); g.closePath();
    g.fillStyle = colorOf(n); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = s / 300; g.stroke();
    g.save(); g.translate(c, c); g.rotate(a0 + step / 2 + Math.PI / 2);
    g.fillStyle = '#fff'; g.font = `700 ${s / 26}px system-ui`; g.textAlign = 'center';
    g.fillText(String(n), 0, -c * 0.8); g.restore();
  });
}

export function mount(root, ctx) {
  const cv = h('canvas', { width: 600, height: 600 });
  const hub = h('div.hub', '–');
  const wheel = h('div.wheel-wrap', cv, hub, h('div.pointer'));
  drawWheel(cv);
  let angle = 0;
  const out = h('div.result');
  const stake = stakePicker({ value: 50, options: TABLE_BETS });
  const bet = (type, label, cls) => {
    const b = h(`button${cls ? '.' + cls : ''}`, { onclick: () => busy(b, () => go(type)) }, label);
    return b;
  };
  const log = h('div.log');
  root.append(wheel, out, h('div.panel', stake.el,
    h('div.rbets', { style: { marginTop: '10px' } },
      bet('r', 'Red', 'red'), bet('b', 'Black', 'black'), bet('z', '0 · 36×', 'green'), bet('e', 'Even'),
      bet('d', 'Odd'), bet('l', '1–18'), bet('h', '19–36')),
    h('p.muted', 'Even-money bets pay 2×, zero pays 36×.')), log);

  async function go(type) {
    const res = await ctx.act(`rl:p:${type}:${stake.get()}`);
    const n = res.result.detail.n;
    out.textContent = '';
    hub.textContent = '…';
    haptic('medium');
    const idx = ORDER.indexOf(n);
    const target = -(idx * 360) / 37;           // rotation that puts pocket idx at the top
    const delta = (((target - angle) % 360) + 360) % 360;
    angle += (reduced ? 0 : 360 * 5) + delta;   // always spins forward
    cv.style.transition = reduced ? 'none' : 'transform 3.2s cubic-bezier(.15,.65,.2,1)';
    cv.style.transform = `rotate(${angle}deg)`;
    await sleep(reduced ? 0 : 3200);
    hub.textContent = n;
    hub.style.color = n === 0 ? '#4ade80' : REDS.has(n) ? '#ff6b6f' : '#fff';
    resultLine(out, res.result.net);
    haptic(res.result.net > 0 ? 'success' : 'light');
    log.replaceChildren(...res.view.log.map((l) => h('div', l)));
  }
  return { update(view) { log.replaceChildren(...(view?.log ?? []).map((l) => h('div', l))); } };
}
