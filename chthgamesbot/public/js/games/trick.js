// Shared table for the Persian trick-taking games (Hokm, Shelem): scores, a felt with the
// four seats around the current trick (you at the bottom, play going to your right), your
// hand as a fan of cards, and a panel for the game's own phases (trump, bids, discards).
import { h, haptic, fmt, busy, cardEl, avatar, lobbyButtons } from '../kit.js';
import { htmlLines } from './mp.js';

export const SUITS = ['♠', '♥', '♦', '♣'];
const MARKS = ['🔵', '🔴'];

// opts: { key, ico, about, target, info(view) → [lines], panel(view, { actBtn, myTurn }) → [nodes],
//   pick(view, myTurn) → { can(slot), data(slot) } when the phase takes cards from the hand,
//   badge(view, seat) → a short tag for a seat (Hakem, bidder) }
export function mountTrick(root, ctx, opts) {
  let lastSeq = -1;
  const act = (data) => ctx.act(data);
  const actBtn = (label, data, cls = '') => {
    const b = h(`button.big${cls ? '.' + cls : ''}`, { onclick: () => busy(b, () => act(data)) }, label);
    return b;
  };

  return {
    update(view, res, info) {
      if (!view || view.phase === 'lobby') return lobby(view, info);
      if (view.cancelled) return root.replaceChildren(h('div.waiting', h('span.big-ico', '✖'), 'Cancelled — stakes refunded.'));
      const me = view.me;
      const myTurn = me >= 0 && view.toAct === me;
      if (view.seq !== lastSeq && lastSeq !== -1) haptic(myTurn ? 'medium' : 'select');
      lastSeq = view.seq;
      const team = (t) => view.seats.filter((_, i) => i % 2 === t).map((p) => p.name).join(' & ');
      const kids = [h('div.tscore',
        [0, 1].map((t) => h(`div.tteam${me >= 0 && me % 2 === t ? '.mine' : ''}`, h('span.nm', `${MARKS[t]} ${team(t)}`), h('b', fmt(view.score[t])))),
        h('div.tsub', view.phase === 'ended' ? 'Final score' : `Game to ${fmt(opts.target)} · hand #${view.hand}`))];

      if (view.phase === 'ended') {
        const won = me >= 0 && me % 2 === view.winner;
        kids.push(h(`div.result${me < 0 ? '' : won ? '.win' : '.lose'}`, `${MARKS[view.winner]} ${team(view.winner)} win${me >= 0 ? (won ? ' — you won!' : '') : ''}`));
        if (view.stake) kids.push(h('p.muted', { style: { textAlign: 'center' } }, `Each winner gets ${fmt(view.stake * 2)}.`));
        kids.push(htmlLines(view.result), h('button.big', { onclick: (e) => busy(e.currentTarget, () => ctx.again()) }, '🔁 New game'));
        return root.replaceChildren(...kids);
      }

      kids.push(h('div.tinfo', opts.info(view).map((l) => h('span', l))));
      kids.push(felt(view));

      // Your hand: in play only legal cards are tappable; other phases decide in `panel`.
      const mine = view.cards ? fan(view, myTurn) : null;
      if (mine) kids.push(mine);
      if (view.phase === 'play') {
        if (myTurn) kids.push(h('p.tprompt', view.trick.length ? 'Your turn — follow suit if you can' : 'Your lead'));
        else kids.push(h('p.muted.tprompt', `${view.seats[view.toAct].name} to play…`));
      } else {
        kids.push(...opts.panel(view, { actBtn, myTurn }));
      }
      if (me >= 0 && (me % 2) !== (view.toAct % 2)) kids.push(actBtn('⏰ Claim win (10 min AFK)', `${opts.key}:t:${view.seq}`, 'ghost'));
      if (view.result) kids.push(htmlLines(view.result));
      kids.push(htmlLines(view.log?.slice(-3)));
      root.replaceChildren(...kids);
    },
  };

  function felt(view) {
    const me = view.me >= 0 ? view.me : 0;
    // Bottom, right, top, left: you, the next to play, your partner, the one before you.
    const where = ['b', 'r', 't', 'l'];
    const shown = view.trick.length ? view.trick : (view.last?.cards ?? []);
    const old = !view.trick.length;
    const table = h('div.ttable');
    if (view.trump != null) table.append(h(`div.ttrump${view.trump === 1 || view.trump === 2 ? '.red' : ''}`, SUITS[view.trump]));
    for (let k = 0; k < 4; k++) {
      const seat = (me + k) % 4;
      const p = view.seats[seat];
      const turn = view.toAct === seat;
      const tags = [];
      if (opts.badge?.(view, seat)) tags.push(h('span.tag', opts.badge(view, seat)));
      table.append(h(`div.tseat.${where[k]}${turn ? '.turn' : ''}`,
        avatar(p), h('span.nm', `${MARKS[seat % 2]} ${p.name}${seat === view.me ? ' (you)' : ''}`), ...tags,
        view.counts ? h('span.cnt', `${view.counts[seat]} 🂠`) : ''));
      const played = shown.find((x) => x.seat === seat);
      if (played) {
        const el = cardEl(played.card, 'small');
        el.classList.add('tcard', where[k]);
        if (old) { el.classList.add('dim'); el.style.animation = 'none'; }
        if (old && view.last?.winner === seat) el.classList.replace('dim', 'glow');
        table.append(el);
      }
    }
    return table;
  }

  function fan(view, myTurn) {
    const slots = view.cards.flatMap((c, i) => (c == null ? [] : [i]));
    const pick = opts.pick?.(view, myTurn); // { data(slot), can(slot) } for a phase that takes cards
    const wrap = h('div.fan');
    const avail = Math.min(root.clientWidth || 358, 520);
    const w = Math.min(60, Math.floor(avail / 4.2));
    const step = Math.min(w * 0.7, (avail - w) / Math.max(slots.length - 1, 1));
    slots.forEach((i, n) => {
      const el = cardEl(view.cards[i]);
      el.style.setProperty('--w', `${w}px`);
      if (n) el.style.marginLeft = `${step - w}px`;
      let data = null;
      if (view.phase === 'play' && myTurn) data = view.legal?.includes(i) ? `${opts.key}:p:${view.seq}:${i}` : null;
      else if (pick) data = pick.can(i) ? pick.data(i) : null;
      if ((view.phase === 'play' && myTurn) || pick) {
        if (data) {
          el.classList.add('tap');
          el.addEventListener('click', () => { haptic('light'); busy(el, () => act(data)); });
        } else el.classList.add('dim');
      }
      wrap.append(el);
    });
    return wrap;
  }

  function lobby(view, info) {
    const seats = view?.seats ?? [];
    const joined = seats.some((p) => p.id === info.me);
    const isHost = info.me === info.creator.id;
    const kids = [
      h('div.waiting', h('span.big-ico', opts.ico), `${seats.length}/4 seated${info.bet ? ` · ${fmt(info.bet)} each` : ''}. ${opts.about}`),
      h('div.players', seats.map((p, i) => h('div.prow', avatar(p), h('div.nm', `${MARKS[i % 2]} ${p.name}${p.id === info.me ? ' (you)' : ''}`), h('div.val', i % 2 ? 'Team 2' : 'Team 1')))),
      lobbyButtons(info, ctx, (b) => { const a = b.data.split(':')[1]; return a === 'j' ? !joined : a === 'x' && isHost; }),
    ];
    if (joined) kids.push(actBtn('🚪 Leave', `${opts.key}:l`, 'ghost'));
    kids.push(h('p.muted', 'Partners sit opposite: the 1st and 3rd to join play the 2nd and 4th. The game starts when the 4th player joins.'));
    root.replaceChildren(...kids);
  }
}

export const suitButtons = (key, view, actBtn) => h('div.btns', SUITS.map((s, i) => actBtn(s, `${key}:h:${view.seq}:${i}`, i === 1 || i === 2 ? 'bad' : '')));
