// Widget cards built from stored state: { kind, height, data } for lib/widgets/index.js.
// Pure (no SDK), so test/validate.js checks sizes and hidden state. Every label comes
// translated from strings.js; the templates hold no words of their own.
//
// Nothing hidden goes in: the crash point only once the round is over (as in
// lib/crash.js publicView), and a plinko drop only after the server made it.

import { t } from '../strings.js';
import { RTL } from '../i18n.js';
import { DAILY_COOLDOWN } from '../config.js';
import { ROWS, TABLES } from '../plinko.js';

const MAX_DATA = 1024;
const bytes = (s) => new TextEncoder().encode(s).length;
const labels = (locale, keys) => keys.map((k) => t(locale, k));
const rtl = (locale) => (RTL.has(locale) ? 1 : 0);

// Measured in Chromium at 376 px (body content + ~4 px), the same in every language.
export const HEIGHTS = { wallet: 217, crash: 245, plinko: 306 };

function card(kind, data, height = HEIGHTS[kind]) {
  if (bytes(JSON.stringify(data)) > MAX_DATA) throw new Error(`${kind} widget payload over ${MAX_DATA} bytes`);
  return { kind, height, data };
}

// 💰 The player card. `player` is a players row.
export function walletWidget(player, locale) {
  let name = String(player.name ?? '');
  const data = () => ({
    n: name,
    c: player.chips,
    p: player.played,
    w: player.wins,
    b: player.bestWin,
    nx: player.lastDaily + DAILY_COOLDOWN,
    cd: DAILY_COOLDOWN,
    rt: rtl(locale),
    l: labels(locale, ['w_balance', 'w_games', 'w_winrate', 'w_best', 'w_bonus', 'w_ready']),
  });
  while (name.length > 1 && bytes(JSON.stringify(data())) > MAX_DATA) name = name.slice(0, -2) + '…';
  return card('wallet', data());
}

// 🚀 A finished crash round, from its stored session state (lib/crash.js).
export function crashWidget(st, locale) {
  if (st?.phase !== 'done') throw new Error('crash round not finished: the crash point is still secret');
  return card('crash', {
    k: `c${Number(st.start).toString(36)}`,
    b: st.bet,
    a: st.auto ?? null,
    x: st.point,
    co: st.cashed ?? null,
    po: st.payout ?? 0,
    rt: rtl(locale),
    l: labels(locale, ['w_crash', 'w_bet', 'w_auto', 'w_cashed', 'w_crashed', 'w_payout', 'w_won', 'w_lost', 'w_even']),
  });
}

// 🔴 A finished plinko drop: `res` is what lib/plinko.js drop() returned, `payout` what
// was credited, `id` anything unique to the drop (it lets each viewer see it play once).
export function plinkoWidget(res, { bet, risk, payout }, locale, id = Date.now()) {
  const table = TABLES[risk];
  if (!table || res.path?.length !== ROWS || res.path.reduce((a, b) => a + b, 0) !== res.slot || table[res.slot] !== res.mult) {
    throw new Error('plinko widget: drop does not match lib/plinko.js');
  }
  return card('plinko', {
    k: `p${Number(id).toString(36)}`,
    b: bet,
    p: res.path.join(''),
    s: res.slot,
    m: res.mult,
    t: table,
    po: payout,
    rt: rtl(locale),
    l: [t(locale, 'w_plinko'), t(locale, `w_risk_${risk}`), ...labels(locale, ['w_bet', 'w_payout', 'w_won', 'w_lost', 'w_even'])],
  });
}

// 🏆 The leaderboard. `rows` are players rows, richest first (at most TOP_ROWS are
// shown); `me` is the viewer's row and `rank` their place among all players. The
// viewer's row is tinted, and added under a divider when they are outside the list.
// Only names and chip counts go in, as in the text leaderboard.
export const TOP_ROWS = 10;

// 24 px of padding, the title (30), 38 per row, 13 for the divider (checked in Chromium).
export const topHeight = (d) => 54 + Math.max(1, d.r.length) * 38 + (d.my ? 51 : 0);

export function topWidget(rows, me, rank, locale) {
  const list = rows.slice(0, TOP_ROWS);
  const at = me ? list.findIndex((p) => p.id === me.id) : -1;
  let max = 32;
  const cut = (s) => { const a = [...String(s ?? '')]; return a.length > max ? `${a.slice(0, max - 1).join('')}…` : a.join(''); };
  const data = () => ({
    t: t(locale, 'top_title'),
    r: list.map((p) => [cut(p.name), p.chips]),
    me: at,
    ...(me && at < 0 && rank > 0 ? { my: [rank, cut(me.name), me.chips] } : {}),
    rt: rtl(locale),
    l: labels(locale, ['w_you', 'w_top_empty']),
  });
  while (max > 4 && bytes(JSON.stringify(data())) > MAX_DATA) max -= 2;
  const d = data();
  return card('top', d, topHeight(d));
}
