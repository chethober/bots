// Texas Hold'em table: board and pot on the felt, seats below, your cards and actions at the bottom.
import { h, haptic, fmt, busy, cardEl, avatar, lobbyButtons } from '../kit.js';
import { htmlLines } from './mp.js';

export function mount(root, ctx) {
  let lastSeq = -1, lastHand = -1, lastBoard = 0;
  return {
    update(view, res, info) {
      const me = info.me;
      if (!view || view.phase === 'lobby') return renderLobby(view, info);
      if (view.phase === 'ended') {
        const b = h('button.big', { onclick: () => busy(b, () => ctx.again()) }, '🔁 New table');
        return root.replaceChildren(h('div.waiting', h('span.big-ico', '🏁'), 'Table closed — stacks were paid out.'), b);
      }

      const seat = view.seats.find((p) => p.id === me && !p.left);
      const myTurn = view.phase === 'hand' && view.seats[view.toAct]?.id === me;
      if (view.seq !== lastSeq && lastSeq !== -1) haptic(myTurn ? 'medium' : 'select');
      const newHand = view.hand !== lastHand;
      const boardStart = newHand ? 0 : lastBoard;
      lastSeq = view.seq; lastHand = view.hand; lastBoard = view.board?.length ?? 0;

      const board = h('div.board', (view.board ?? []).map((c, i) => {
        const el = cardEl(c, 'small');
        el.style.setProperty('--w', 'min(12vw, 46px)');
        if (i < boardStart) el.style.animation = 'none';
        else el.style.animationDelay = `${(i - boardStart) * 120}ms`;
        return el;
      }));
      const felt = h('div.ptable',
        h('div', { style: { fontSize: '12px', opacity: .8 } }, `Hand #${view.hand} · blinds ${view.sb}/${view.bb}`),
        board,
        h('div.pot', view.phase === 'hand' ? `Pot ${fmt(view.pot)}` : ' '));

      const seats = h('div.seats', view.seats.filter((p) => !p.left || p.inHand).map((p, i) => {
        const idx = view.seats.indexOf(p);
        const turn = view.phase === 'hand' && idx === view.toAct;
        const tags = [];
        if (idx === view.dealer) tags.push(h('span.tag', 'D'));
        if (p.inHand && p.stack === 0 && !p.folded) tags.push(h('span.tag', { style: { background: 'var(--bad)', color: '#fff' } }, 'ALL-IN'));
        const cards = p.id === me ? null : (p.hole ?? (p.inHand && !p.folded ? [null, null] : []));
        return h(`div.seat${turn ? '.turn' : ''}${p.folded && p.inHand ? '.folded' : ''}`,
          h('div.top', avatar(p), h('span.nm', p.id === me ? `${p.name} (you)` : p.name), ...tags),
          h('div.st', `${fmt(p.stack)}${p.bet ? ` · bet ${fmt(p.bet)}` : ''}${p.folded && p.inHand ? ' · folded' : ''}`),
          cards ? h('div.cards', cards.map((c) => { const el = cardEl(c, 'small'); el.style.setProperty('--w', '36px'); el.style.animation = 'none'; return el; })) : '');
      }));

      const kids = [felt];
      if (seat?.hole) {
        kids.push(h('div.mine', seat.hole.map((c) => {
          const el = cardEl(c, 'big');
          if (!newHand) el.style.animation = 'none';
          return el;
        })));
      }
      kids.push(seats);

      if (view.phase === 'hand') {
        const actor = view.seats[view.toAct];
        if (myTurn) {
          const t = view.targets;
          const a = (k, label, cls = '') => {
            const b = h(`button.big${cls ? '.' + cls : ''}`, { onclick: () => busy(b, () => ctx.act(`ph:a:${view.seq}:${k}`)) }, label);
            return b;
          };
          const btns = [a('f', 'Fold', 'ghost'), a('c', t.toCall ? `Call ${fmt(t.toCall)}` : 'Check', 'good')];
          if (t.max > view.currentBet) {
            if (t.m < t.max) btns.push(a('m', `Raise to ${fmt(t.m)}`));
            if (t.h < t.max && t.h > t.m) btns.push(a('h', `½ pot → ${fmt(t.h)}`));
            if (t.p < t.max && t.p > t.h) btns.push(a('p', `Pot → ${fmt(t.p)}`));
            btns.push(a('a', `All-in ${fmt(t.max)}`, 'bad'));
          }
          kids.push(h('div.actions', btns));
        } else {
          kids.push(h('p.muted', { style: { textAlign: 'center' } }, `Waiting for ${actor.name}…`));
          if (seat) {
            const b = h('button.big.ghost', { onclick: () => busy(b, () => ctx.act(`ph:t:${view.seq}`)) }, '⏰ Fold AFK player (10 min)');
            kids.push(b);
          }
        }
      } else {
        // between hands
        if (view.result) kids.push(htmlLines(view.result));
        const row = [];
        if (seat) {
          const next = h('button.big', { onclick: () => busy(next, () => ctx.act(`ph:n:${view.hand}`)) }, '🃏 Deal next hand');
          row.push(next);
        } else {
          const join = h('button.big', { onclick: () => busy(join, () => ctx.act(view.data[0])) }, `🎟 Sit in (${fmt(view.buyin)})`);
          row.push(join);
        }
        kids.push(...row);
        if (seat) {
          const leave = h('button.big.ghost', { onclick: () => busy(leave, () => ctx.act('ph:l')) }, `🚪 Leave with ${fmt(seat.stack)}`);
          const end = h('button.big.ghost', { onclick: () => busy(end, () => ctx.act('ph:e')) }, '🏁 End table');
          kids.push(h('div.btns', leave, end));
        }
      }
      kids.push(htmlLines(view.log?.slice(-4)));
      root.replaceChildren(...kids);
    },
  };

  function renderLobby(view, info) {
    const seats = view?.seats ?? [];
    const isHost = info.me === info.creator.id;
    const joined = seats.some((p) => p.id === info.me);
    root.replaceChildren(
      h('div.ptable', h('div', { style: { fontSize: '40px' } }, '♠️♥️♣️♦️'), h('div.pot', `Buy-in ${fmt(info.bet)}`),
        h('div', { style: { fontSize: '13px', opacity: .8 } }, `${seats.length}/8 seated`)),
      h('div.players', { style: { marginTop: '12px' } }, seats.map((p) => h('div.prow', avatar(p), h('div.nm', p.name + (p.id === info.me ? ' (you)' : '')), h('div.val', fmt(p.stack))))),
      lobbyButtons(info, ctx, (b) => {
        const a = b.data.split(':')[1];
        return a === 'j' ? !joined : isHost;
      }),
      h('p.muted', isHost ? 'Sit down yourself, invite friends, then deal (2+ players).' : 'Sit in and wait for the host to deal.'),
    );
  }
}
