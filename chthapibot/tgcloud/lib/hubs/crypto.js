// 💰 Crypto hub. Callback prefix `cr`.
//   cr:mk markets · cr:wl watchlist · cr:tr trending · cr:mv movers · cr:gl global · cr:pf portfolio
//   cr:c:<id> coin card · cr:f:<id> follow toggle · cr:a:<id> alert menu · cr:pa:<id> add to portfolio
//   A trailing `:r` means "refresh this card in place"; without it a new card is sent.
import {
  coinsByIds, topCoins, trending, globalStats, getFearAndGreed, btcFees, resolveCoin,
  getBinanceTicker, fngEmoji, symbolOf, DEFAULT_COINS,
} from '../apis/crypto.js';
import { listFollows, addFollow, removeFollow, isFollowing, getPrefs, listPositions, addPosition, reducePosition, LIMITS } from '../store.js';
import { registerKind, registerSchedule, createNotification, upsertSchedule, findSchedule, deleteNotification } from '../notify.js';
import { localParts, parseSchedule, describePattern } from '../time.js';
import { btn, menu, show, send, notice, ask, requireManage, fits, homeRow, navRow } from '../ui.js';
import { esc, usd, usdCompact, chg, num } from '../format.js';

const BACK = [btn('⬅️ Crypto', 'm:crypto')];

// ── entry points ──────────────────────────────────────────────────────────

export async function home(ctx) {
  const [coins, fng] = await Promise.all([coinsByIds(['bitcoin', 'ethereum']), getFearAndGreed()]);
  const btc = coins.get('bitcoin');
  const eth = coins.get('ethereum');
  const line = [btc && `BTC ${usd(btc.price)} ${chg(btc.ch24h)}`, eth && `ETH ${usd(eth.price)} ${chg(eth.ch24h)}`].filter(Boolean).join('  ·  ');
  await menu(ctx, {
    text: ['💰 <b>Crypto</b>', '', line || '<i>Prices unavailable right now.</i>',
      fng ? `${fngEmoji(fng.value)} Fear &amp; Greed ${fng.value} — ${esc(fng.label)}` : ''].filter(Boolean).join('\n'),
    keyboard: [
      // Your stuff · the market · actions
      [btn('⭐ Watchlist', 'cr:wl'), btn('💼 Portfolio', 'cr:pf'), btn('🔎 Coin lookup', 'cr:s')],
      [btn('📊 Top 10', 'cr:mk'), btn('🔥 Trending', 'cr:tr'), btn('📈 Movers', 'cr:mv')],
      [btn('🌍 Global', 'cr:gl'), btn('🔔 Alerts', 'cr:al'), btn('🗓 Summary', 'cr:sum')],
      homeRow(),
    ],
  });
}

export const commands = {
  async crypto(ctx, args) {
    if (!args.length) return home(ctx);
    return openCoinFromText(ctx, args.join(' '), 'c');
  },
  portfolio: (ctx) => portfolioCard(ctx, false),
  watchlist: (ctx) => watchlistCard(ctx, false),
  async price(ctx, [sym]) {
    if (!sym) return notice(ctx, 'Usage: <code>/price btc</code> or <code>/price ETHBTC</code>');
    const s = sym.toUpperCase();
    const pair = s.length <= 5 && !s.endsWith('USDT') ? `${s}USDT` : s;
    const t = await getBinanceTicker(pair);
    if (!t) return notice(ctx, `⚠️ No Binance ticker for <b>${esc(pair)}</b>.`);
    await notice(ctx, `📈 <b>${esc(t.symbol)}</b> (Binance)\nLast: <b>${usd(t.price)}</b>  ${chg(t.changePct)}\n24h: ${usd(t.low)} – ${usd(t.high)} · vol ${usdCompact(t.volume)}`);
  },
  // /alert crypto btc above 100k · /alert crypto eth move 5 · /alert fng below 20
  async alert(ctx, args) {
    const [kind = '', ...rest] = args.map((a) => a.toLowerCase());
    if (kind === 'fng') return createFng(ctx, rest[0], rest[1]);
    if (kind === 'crypto' && rest.length >= 3) {
      const r = await resolveCoin(rest[0]);
      if (!r.id) return notice(ctx, `⚠️ Couldn't find <b>${esc(rest[0])}</b>.`);
      if (rest[1] === 'move') return createPct(ctx, r, rest[2]);
      return createPrice(ctx, r, rest[1], rest[2]);
    }
    return notice(ctx, 'Usage:\n<code>/alert crypto btc above 100k</code>\n<code>/alert crypto eth move 5</code> (±5% in 24h)\n<code>/alert fng below 20</code>\nOr use /crypto → 🔔 Alerts.');
  },
};

export const callbacks = {
  async cr(ctx, [op, a, b]) {
    const refresh = a === 'r' || b === 'r';
    if (op !== 'f') await ctx.answer(refresh ? 'Refreshing…' : undefined); // follow toggles answer with their own toast
    const out = refresh ? show : send;
    switch (op) {
      case 'mk': return marketsCard(ctx, out);
      case 'wl': return watchlistCard(ctx, refresh);
      case 'tr': return trendingCard(ctx, out);
      case 'mv': return moversCard(ctx, out);
      case 'gl': return globalCard(ctx, out);
      case 'pf': return portfolioCard(ctx, refresh);
      case 'c': return coinCard(ctx, a, out);
      case 's': return ask(ctx, 'crypto.search', '🔎 Which coin? Name or ticker, e.g. <code>pepe</code>', { placeholder: 'bitcoin' });
      case 'f': return toggleFollow(ctx, a);
      case 'fa': return toggleFollow(ctx, a, true);
      case 'a': return alertMenu(ctx, a);
      case 'ab': case 'be': case 'pm': return askAlertValue(ctx, op, a);
      case 'al': return alertsHub(ctx);
      case 'an': return ask(ctx, 'crypto.alertcoin', '🔔 Alert for which coin?', { placeholder: 'btc' });
      case 'fg': return fngMenu(ctx);
      case 'fga': case 'fgb': return askFng(ctx, op === 'fga' ? 'above' : 'below');
      case 'wa': return (await requireManage(ctx)) && ask(ctx, 'crypto.follow', '⭐ Which coin to add to your watchlist?', { placeholder: 'sol' });
      case 'we': return watchlistEdit(ctx);
      case 'wx': return unfollowFromEdit(ctx, a);
      case 'wd': return addDefaults(ctx);
      case 'pa': return (await requireManage(ctx)) && askPortfolioAdd(ctx, a);
      case 'pr': return (await requireManage(ctx)) && ask(ctx, 'crypto.prem', '➖ Send coin and amount to remove, or <code>all</code>, e.g. <code>btc 0.1</code> or <code>eth all</code>', { placeholder: 'btc 0.1' });
      case 'sum': return summaryMenu(ctx);
      case 'sumoff': return summaryOff(ctx);
      case 'sumset': return (await requireManage(ctx)) && ask(ctx, 'crypto.sum', '🗓 When? e.g. <code>08:00</code>, <code>08:00 weekdays</code>, <code>18:30 fri</code>', { placeholder: '08:00' });
    }
  },
};

export const inputs = {
  search: (ctx, text) => openCoinFromText(ctx, text, 'c'),
  follow: (ctx, text) => openCoinFromText(ctx, text, 'fa'),
  alertcoin: (ctx, text) => openCoinFromText(ctx, text, 'a'),
  async alertval(ctx, text, data) {
    if (data.op === 'pm') return createPct(ctx, data, text);
    return createPrice(ctx, data, data.op === 'ab' ? 'above' : 'below', text);
  },
  fng: (ctx, text, data) => createFng(ctx, data.cond, text),
  async padd(ctx, text, data) {
    // "btc 0.5 @ 60000" or, when the coin is known, "0.5 @ 60000"
    const m = /^\s*(?:([a-z0-9.-]+)\s+)?([\d.,]+)\s*(?:@\s*\$?([\d.,]+[km]?))?\s*$/i.exec(text);
    if (!m || (!m[1] && !data?.id)) return notice(ctx, 'Usage: <code>btc 0.5</code> or <code>btc 0.5 @ 60000</code>');
    const coin = data?.id && !m[1] ? data : await resolveCoin(m[1]);
    if (!coin.id) return notice(ctx, `⚠️ Couldn't find <b>${esc(m[1])}</b>.`);
    const amount = parseAmount(m[2]);
    const price = m[3] ? parseAmount(m[3]) : null;
    if (!(amount > 0) || (m[3] && !(price > 0))) return notice(ctx, 'Amount and price must be positive numbers.');
    const pos = await addPosition(ctx.chatId, coin.id, coin.symbol, amount, price);
    await notice(ctx, `💼 <b>${esc(symbolOf(coin.id, coin.symbol))}</b>: ${num(pos.amount, 8)}${pos.avgPrice != null ? ` @ avg ${usd(pos.avgPrice)}` : ''}`);
    return portfolioCard(ctx, false);
  },
  async prem(ctx, text) {
    const m = /^\s*([a-z0-9.-]+)\s+(all|[\d.,]+)\s*$/i.exec(text);
    if (!m) return notice(ctx, 'Usage: <code>btc 0.1</code> or <code>btc all</code>');
    const coin = await resolveCoin(m[1]);
    const id = coin.id ?? m[1].toLowerCase();
    const left = await reducePosition(ctx.chatId, id, m[2].toLowerCase() === 'all' ? null : parseAmount(m[2]));
    if (left == null) return notice(ctx, `No <b>${esc(m[1])}</b> in your portfolio.`);
    await notice(ctx, left ? `➖ ${esc(symbolOf(id, coin.symbol))} left: ${num(left, 8)}` : `➖ Removed ${esc(symbolOf(id, coin.symbol))}.`);
    return portfolioCard(ctx, false);
  },
  sum: (ctx, text) => summarySet(ctx, text),
};

// ── coin lookup ───────────────────────────────────────────────────────────

// Resolves text to a coin, then runs `next` ('c' open, 'fa' follow, 'a' alert menu, 'pa' portfolio add).
async function openCoinFromText(ctx, text, next) {
  const r = await resolveCoin(text);
  if (r.id) return runNext(ctx, next, r.id);
  if (!r.choices?.length) return notice(ctx, `⚠️ No coin matches <b>${esc(text)}</b>.`);
  const rows = r.choices.filter((c) => fits(`cr:${next}:${c.id}`))
    .map((c) => [btn(`${c.symbol} · ${c.name}${c.rank ? ` (#${c.rank})` : ''}`, `cr:${next}:${c.id}`)]);
  await send(ctx, { text: `🔎 Which one did you mean by <b>${esc(text)}</b>?`, keyboard: rows });
}

function runNext(ctx, next, id) {
  if (next === 'fa') return toggleFollow(ctx, id, true);
  if (next === 'a') return alertMenu(ctx, id);
  if (next === 'pa') return askPortfolioAdd(ctx, id);
  return coinCard(ctx, id, send);
}

async function coinCard(ctx, id, out) {
  let c = (await coinsByIds([id])).get(id);
  if (!c) {
    // Ids from fallback lists may be plain symbols; resolve them to a real coin.
    const r = await resolveCoin(id);
    if (r.id && r.id !== id) c = (await coinsByIds([r.id], { [r.id]: r.symbol })).get(r.id);
    if (c) id = c.id;
  }
  if (!c) return notice(ctx, `⚠️ No market data for <b>${esc(id)}</b>.`);
  const following = await isFollowing(ctx.chatId, 'coin', id);
  const lines = [
    `🪙 <b>${esc(c.name)}</b> (${esc(c.symbol)})${c.rank ? ` · #${c.rank}` : ''}`,
    '',
    `Price: <b>${usd(c.price)}</b>`,
    `1h ${chg(c.ch1h)} · 24h ${chg(c.ch24h)} · 7d ${chg(c.ch7d)}`,
    c.low24 != null ? `24h range: ${usd(c.low24)} – ${usd(c.high24)}` : null,
    c.mcap ? `Market cap: ${usdCompact(c.mcap)}${c.volume ? ` · Vol: ${usdCompact(c.volume)}` : ''}` : null,
    c.ath ? `ATH: ${usd(c.ath)} (${chg(c.athChange)})` : null,
  ].filter(Boolean);
  const actions = [btn(following ? '✅ Following' : '⭐ Follow', `cr:f:${id}`), btn('🔔 Alert', `cr:a:${id}`)];
  await out(ctx, {
    text: lines.join('\n'),
    image: c.image,
    keyboard: [actions.filter((x) => fits(x.callback_data)),
      [btn('💼 Add', `cr:pa:${id}`), btn('🔄', `cr:c:${id}:r`)].filter((x) => fits(x.callback_data)), BACK],
  });
}

async function toggleFollow(ctx, id, fromText = false) {
  if (!(await requireManage(ctx))) return;
  if (!fromText && (await isFollowing(ctx.chatId, 'coin', id))) {
    await removeFollow(ctx.chatId, 'coin', id);
    if (ctx.message) await ctx.answer('Removed from watchlist');
  } else {
    const c = (await coinsByIds([id])).get(id);
    const res = await addFollow(ctx.chatId, 'crypto', 'coin', id, c?.symbol ?? symbolOf(id), { symbol: c?.symbol, name: c?.name }, LIMITS.coins);
    if (res === 'limit') {
      await ctx.answer?.('Watchlist full');
      return notice(ctx, `Your watchlist is full (${LIMITS.coins} coins).`);
    }
    if (ctx.message && !fromText) await ctx.answer('Added to watchlist ⭐');
    if (fromText) return notice(ctx, `⭐ ${esc(c?.name ?? id)} ${res === 'exists' ? 'is already on' : 'added to'} your watchlist.`);
  }
  if (ctx.message) return coinCard(ctx, id, show);
}

// ── lists ─────────────────────────────────────────────────────────────────

function coinButtons(coins, perRow = 5) {
  const btns = coins.filter((c) => fits(`cr:c:${c.id}`)).map((c) => btn(c.symbol, `cr:c:${c.id}`));
  const rows = [];
  for (let i = 0; i < btns.length; i += perRow) rows.push(btns.slice(i, i + perRow));
  return rows;
}

const coinLine = (c, i) => `${i != null ? `${i + 1}. ` : ''}<b>${esc(c.symbol)}</b> ${usd(c.price)}  ${chg(c.ch24h)}`;

async function marketsCard(ctx, out) {
  const top = await topCoins(100);
  if (!top) return notice(ctx, '⚠️ Market data is unavailable right now.');
  const ten = top.slice(0, 10);
  await out(ctx, {
    text: ['📊 <b>Top 10 by market cap</b>', '', ...ten.map((c, i) => `${coinLine(c, i)} · 7d ${chg(c.ch7d)}`)].join('\n'),
    keyboard: [...coinButtons(ten), [btn('🔄 Refresh', 'cr:mk:r')], BACK],
  });
}

async function watchlistCard(ctx, refresh) {
  const rows = await listFollows(ctx.chatId, 'coin');
  const out = refresh ? show : send;
  if (!rows.length) {
    return out(ctx, {
      text: '⭐ <b>Watchlist</b>\n\nEmpty. Add coins to track them here, in /daily and in summaries.',
      keyboard: [[btn('➕ Add coin', 'cr:wa'), btn('➕ BTC, ETH, SOL', 'cr:wd')], BACK],
    });
  }
  const data = await coinsByIds(rows.map((r) => r.ref), Object.fromEntries(rows.map((r) => [r.ref, r.meta?.symbol])));
  const lines = rows.map((r) => {
    const c = data.get(r.ref);
    return c ? `<b>${esc(c.symbol || r.label)}</b> ${usd(c.price)}  ${chg(c.ch24h)} · 7d ${chg(c.ch7d)}` : `<b>${esc(r.label)}</b> — <i>no data</i>`;
  });
  await out(ctx, {
    text: ['⭐ <b>Watchlist</b>', '', ...lines].join('\n'),
    keyboard: [...coinButtons(rows.map((r) => ({ id: r.ref, symbol: data.get(r.ref)?.symbol || r.label }))),
      [btn('➕ Add', 'cr:wa'), btn('✏️ Edit', 'cr:we'), btn('🔄', 'cr:wl:r')], BACK],
  });
}

async function watchlistEdit(ctx) {
  if (!(await requireManage(ctx))) return;
  const rows = await listFollows(ctx.chatId, 'coin');
  await show(ctx, {
    text: '✏️ <b>Edit watchlist</b>\nTap a coin to remove it.',
    keyboard: [...rows.filter((r) => fits(`cr:wx:${r.ref}`)).map((r) => [btn(`❌ ${r.label}`, `cr:wx:${r.ref}`)]), [btn('✅ Done', 'cr:wl:r')]],
  });
}

async function unfollowFromEdit(ctx, id) {
  if (!(await requireManage(ctx))) return;
  await removeFollow(ctx.chatId, 'coin', id);
  return watchlistEdit(ctx);
}

async function addDefaults(ctx) {
  if (!(await requireManage(ctx))) return;
  for (const id of DEFAULT_COINS) await addFollow(ctx.chatId, 'crypto', 'coin', id, symbolOf(id), { symbol: symbolOf(id) }, LIMITS.coins);
  return watchlistCard(ctx, true);
}

async function trendingCard(ctx, out) {
  const t = await trending();
  if (!t?.length) return notice(ctx, '⚠️ Trending data is unavailable right now.');
  await out(ctx, {
    text: ['🔥 <b>Trending on CoinGecko</b>', '', ...t.map((c, i) => `${i + 1}. <b>${esc(c.symbol)}</b> ${esc(c.name)}${c.rank ? ` #${c.rank}` : ''} · ${usd(c.price)} ${chg(c.ch24h)}`)].join('\n'),
    keyboard: [...coinButtons(t), [btn('🔄 Refresh', 'cr:tr:r')], BACK],
  });
}

async function moversCard(ctx, out) {
  const top = (await topCoins(100))?.filter((c) => c.ch24h != null);
  if (!top?.length) return notice(ctx, '⚠️ Market data is unavailable right now.');
  const sorted = [...top].sort((a, b) => b.ch24h - a.ch24h);
  const gainers = sorted.slice(0, 5);
  const losers = sorted.slice(-5).reverse();
  await out(ctx, {
    text: ['📈 <b>24h movers</b> <i>(top 100)</i>', '', '<b>Gainers</b>', ...gainers.map((c) => coinLine(c)), '', '<b>Losers</b>', ...losers.map((c) => coinLine(c))].join('\n'),
    keyboard: [...coinButtons([...gainers, ...losers]), [btn('🔄 Refresh', 'cr:mv:r')], BACK],
  });
}

async function globalCard(ctx, out) {
  const [g, fng, fees] = await Promise.all([globalStats(), getFearAndGreed(), btcFees()]);
  const lines = ['🌍 <b>Global market</b>', ''];
  if (g) {
    lines.push(`Market cap: <b>${usdCompact(g.mcap)}</b> ${chg(g.mcapChange24h)}`, `24h volume: ${usdCompact(g.volume)}`,
      `Dominance: BTC ${g.btcDom?.toFixed(1)}%${g.ethDom != null ? ` · ETH ${g.ethDom.toFixed(1)}%` : ''}`);
  } else {
    lines.push('<i>Global stats unavailable.</i>');
  }
  if (fng) lines.push('', `${fngEmoji(fng.value)} Fear &amp; Greed: <b>${fng.value}</b> — ${esc(fng.label)}${fng.yesterday != null ? ` (yesterday ${fng.yesterday})` : ''}`);
  if (fees) lines.push(`⛽ BTC fees: fast ${fees.fastestFee} · 30m ${fees.halfHourFee} · 1h ${fees.hourFee} sat/vB`);
  await out(ctx, { text: lines.join('\n'), keyboard: [[btn('🔄 Refresh', 'cr:gl:r')], BACK] });
}

// ── portfolio ─────────────────────────────────────────────────────────────

async function portfolioCard(ctx, refresh) {
  const out = refresh ? show : send;
  const pos = await listPositions(ctx.chatId);
  const keyboard = [[btn('➕ Add', 'cr:pa'), btn('➖ Remove', 'cr:pr'), btn('🔄', 'cr:pf:r')], BACK];
  if (!pos.length) {
    return out(ctx, { text: '💼 <b>Portfolio</b>\n\nEmpty. Add a position like <code>btc 0.5 @ 60000</code> (the buy price is optional).', keyboard });
  }
  const data = await coinsByIds(pos.map((p) => p.coin), Object.fromEntries(pos.map((p) => [p.coin, p.symbol])));
  let total = 0, cost = 0, value24hAgo = 0, pnlKnown = false;
  const lines = pos.map((p) => {
    const c = data.get(p.coin);
    const sym = esc(c?.symbol || p.symbol || p.coin);
    if (!c?.price) return `<b>${sym}</b> ${num(p.amount, 8)} — <i>no price</i>`;
    const value = p.amount * c.price;
    total += value;
    if (c.ch24h != null) value24hAgo += value / (1 + c.ch24h / 100);
    let pnl = '';
    if (p.avgPrice != null) {
      pnlKnown = true;
      cost += p.amount * p.avgPrice;
      const d = value - p.amount * p.avgPrice;
      pnl = ` · P/L ${d >= 0 ? '+' : '−'}${usd(Math.abs(d))} (${chg((c.price / p.avgPrice - 1) * 100)})`;
    }
    return `<b>${sym}</b> ${num(p.amount, 8)} = <b>${usd(value)}</b>${pnl}`;
  });
  const summary = [`Total: <b>${usd(total)}</b>${value24hAgo ? ` · 24h ${chg((total / value24hAgo - 1) * 100)}` : ''}`];
  if (pnlKnown && cost) summary.push(`P/L on priced positions: ${chg(((total - unpricedValue(pos, data)) / cost - 1) * 100)}`);
  await out(ctx, { text: ['💼 <b>Portfolio</b>', '', ...lines, '', ...summary].join('\n'), keyboard });
}

function unpricedValue(pos, data) {
  return pos.filter((p) => p.avgPrice == null).reduce((s, p) => s + p.amount * (data.get(p.coin)?.price ?? 0), 0);
}

function askPortfolioAdd(ctx, id) {
  if (id) {
    return ask(ctx, 'crypto.padd', `💼 How much <b>${esc(symbolOf(id))}</b>? e.g. <code>0.5</code> or <code>0.5 @ 60000</code> (buy price optional)`,
      { data: { id, symbol: symbolOf(id) }, placeholder: '0.5 @ 60000' });
  }
  return ask(ctx, 'crypto.padd', '💼 Send coin and amount, optionally with the buy price: <code>btc 0.5 @ 60000</code>', { placeholder: 'btc 0.5 @ 60000' });
}

// ── alerts ────────────────────────────────────────────────────────────────

// "65000", "65,000", "65k", "1.2m", "$0.35" → number, or NaN.
function parseAmount(s) {
  const m = /^\$?([\d,]*\.?\d+)\s*([km])?$/i.exec(String(s ?? '').trim());
  if (!m) return NaN;
  return Number(m[1].replace(/,/g, '')) * ({ k: 1e3, m: 1e6 }[m[2]?.toLowerCase()] ?? 1);
}

async function alertsHub(ctx) {
  await menu(ctx, {
    text: '🔔 <b>Crypto alerts</b>\n\n• Price above / below a level\n• ±X% move within 24h (at most once a day)\n• Fear &amp; Greed above / below a value\n\nAlerts are checked about every 10 minutes.',
    keyboard: [
      [btn('➕ Price / move alert', 'cr:an'), btn('😱 Fear & Greed alert', 'cr:fg')],
      [btn('📋 My crypto alerts', 'n:l:crypto:0')],
      navRow('⬅️ Crypto', 'm:crypto'),
    ],
  });
}

async function alertMenu(ctx, id) {
  if (!(await requireManage(ctx))) return;
  const c = (await coinsByIds([id])).get(id);
  await send(ctx, {
    text: `🔔 Alert for <b>${esc(c?.name ?? id)}</b>${c ? ` (now ${usd(c.price)})` : ''}`,
    keyboard: [[btn('⬆️ Above', `cr:ab:${id}`), btn('⬇️ Below', `cr:be:${id}`), btn('↕️ ±% in 24h', `cr:pm:${id}`)].filter((x) => fits(x.callback_data))],
  });
}

async function askAlertValue(ctx, op, id) {
  if (!(await requireManage(ctx))) return;
  const c = (await coinsByIds([id])).get(id);
  const sym = c?.symbol ?? symbolOf(id);
  const data = { op, id, symbol: sym, name: c?.name };
  if (op === 'pm') return ask(ctx, 'crypto.alertval', `↕️ Alert when <b>${esc(sym)}</b> moves by at least how many % in 24h? e.g. <code>5</code>`, { data, placeholder: '5' });
  return ask(ctx, 'crypto.alertval', `${op === 'ab' ? '⬆️' : '⬇️'} Alert when <b>${esc(sym)}</b> goes ${op === 'ab' ? 'above' : 'below'}… (now ${usd(c?.price)})`, { data, placeholder: c?.price ? String(Math.round(c.price * (op === 'ab' ? 1.1 : 0.9))) : '' });
}

async function createPrice(ctx, coin, cond, value) {
  if (!(await requireManage(ctx))) return;
  const price = parseAmount(value);
  if (!['above', 'below'].includes(cond) || !(price > 0)) return notice(ctx, 'Send a positive price like <code>100000</code> or <code>100k</code>.');
  const c = (await coinsByIds([coin.id])).get(coin.id);
  const symbol = c?.symbol ?? coin.symbol ?? symbolOf(coin.id);
  const id = await createNotification(ctx.chatId, 'crypto', 'price', { coin: coin.id, symbol, cond, price });
  if (id === 'limit') return notice(ctx, 'You have 50 active notifications. Remove some in /notifications.');
  const met = c?.price != null && (cond === 'above' ? c.price >= price : c.price <= price);
  await notice(ctx, `🔔 Alert set: <b>${esc(symbol)}</b> ${cond} <b>${usd(price)}</b>${c ? `\nNow: ${usd(c.price)}` : ''}${met ? '\n<i>Already met — it will fire on the next check.</i>' : ''}`);
}

async function createPct(ctx, coin, value) {
  if (!(await requireManage(ctx))) return;
  const pct = Number(String(value).replace('%', ''));
  if (!(pct > 0 && pct <= 100)) return notice(ctx, 'Send a percentage between 0 and 100, e.g. <code>5</code>.');
  const symbol = coin.symbol ?? symbolOf(coin.id);
  const id = await createNotification(ctx.chatId, 'crypto', 'pct', { coin: coin.id, symbol, pct });
  if (id === 'limit') return notice(ctx, 'You have 50 active notifications. Remove some in /notifications.');
  await notice(ctx, `🔔 Alert set: <b>${esc(symbol)}</b> moves ±${pct}% in 24h (at most once a day).`);
}

function fngMenu(ctx) {
  return send(ctx, { text: '😱 <b>Fear &amp; Greed alert</b>', keyboard: [[btn('⬆️ Above', 'cr:fga'), btn('⬇️ Below', 'cr:fgb')]] });
}

async function askFng(ctx, cond) {
  if (!(await requireManage(ctx))) return;
  return ask(ctx, 'crypto.fng', `😱 Alert when Fear &amp; Greed goes ${cond}… (0–100)`, { data: { cond }, placeholder: cond === 'above' ? '75' : '25' });
}

async function createFng(ctx, cond, value) {
  if (!(await requireManage(ctx))) return;
  const v = Number(value);
  if (!['above', 'below'].includes(cond) || !Number.isInteger(v) || v < 0 || v > 100) return notice(ctx, 'Usage: <code>/alert fng below 20</code> (0–100)');
  const id = await createNotification(ctx.chatId, 'crypto', 'fng', { cond, value: v });
  if (id === 'limit') return notice(ctx, 'You have 50 active notifications. Remove some in /notifications.');
  const f = await getFearAndGreed();
  await notice(ctx, `🔔 Alert set: Fear &amp; Greed ${cond} <b>${v}</b>${f ? `\nNow: ${f.value} (${esc(f.label)})` : ''}`);
}

const crossed = (cond, cur, target) => cur != null && (cond === 'above' ? cur >= target : cur <= target);

async function pricesFor(rows) {
  return coinsByIds(rows.map((n) => n.params.coin), Object.fromEntries(rows.map((n) => [n.params.coin, n.params.symbol])));
}

registerKind('price', {
  describe: (n) => `💰 ${esc(n.params.symbol)} ${n.params.cond} ${usd(n.params.price)}`,
  async evaluate(rows) {
    const data = await pricesFor(rows);
    return rows.flatMap((n) => {
      const c = data.get(n.params.coin);
      if (!crossed(n.params.cond, c?.price, n.params.price)) return [];
      return [{
        n, then: 'deactivate', reArm: true,
        card: { text: `🚨 <b>${esc(n.params.symbol)}</b> is ${n.params.cond} ${usd(n.params.price)}\nNow: <b>${usd(c.price)}</b> ${chg(c.ch24h)}`, keyboard: [[btn('🔁 Re-arm', `n:re:${n.id}`), ...(fits(`cr:c:${n.params.coin}`) ? [btn('📈 Open', `cr:c:${n.params.coin}`)] : [])]] },
      }];
    });
  },
});

registerKind('pct', {
  describe: (n) => `↕️ ${esc(n.params.symbol)} moves ±${n.params.pct}% in 24h`,
  async evaluate(rows, env) {
    const data = await pricesFor(rows);
    return rows.flatMap((n) => {
      const c = data.get(n.params.coin);
      if (c?.ch24h == null || Math.abs(c.ch24h) < n.params.pct) return [];
      const tz = env.prefsOf(n.chatId).tz;
      if (n.lastFiredAt && localParts(new Date(n.lastFiredAt * 1000), tz).ymd === localParts(env.now, tz).ymd) return [];
      return [{
        n, then: 'touch',
        card: { text: `${c.ch24h >= 0 ? '🚀' : '📉'} <b>${esc(n.params.symbol)}</b> ${chg(c.ch24h)} in 24h\nNow: <b>${usd(c.price)}</b>`, keyboard: fits(`cr:c:${n.params.coin}`) ? [[btn('📈 Open', `cr:c:${n.params.coin}`)]] : undefined },
      }];
    });
  },
});

registerKind('fng', {
  describe: (n) => `😱 Fear &amp; Greed ${n.params.cond} ${n.params.value}`,
  async evaluate(rows) {
    const f = await getFearAndGreed();
    if (!f) return [];
    return rows.filter((n) => crossed(n.params.cond, f.value, n.params.value)).map((n) => ({
      n, then: 'deactivate', reArm: true,
      card: { text: `${fngEmoji(f.value)} Fear &amp; Greed is <b>${f.value}</b> (${esc(f.label)}) — ${n.params.cond} ${n.params.value}`, keyboard: [[btn('🔁 Re-arm', `n:re:${n.id}`)]] },
    }));
  },
});

// ── scheduled summary ─────────────────────────────────────────────────────

async function summaryMenu(ctx) {
  const n = await findSchedule(ctx.chatId, 'crypto', 'crypto_summary');
  await menu(ctx, {
    text: `🗓 <b>Crypto summary</b>\nYour watchlist, Fear &amp; Greed and the global market, sent on a schedule.\n\nNow: <b>${n?.active ? `${n.params.time} ${describePattern(n.params.pattern)}` : 'off'}</b>`,
    keyboard: [[btn('⏰ Set time', 'cr:sumset'), ...(n ? [btn('🚫 Turn off', 'cr:sumoff')] : [])], navRow('⬅️ Crypto', 'm:crypto')],
  });
}

async function summarySet(ctx, text) {
  if (!(await requireManage(ctx))) return;
  const s = parseSchedule(text);
  if (!s) return notice(ctx, 'Usage: <code>08:00</code>, <code>08:00 weekdays</code>, <code>18:30 fri</code>');
  const p = await getPrefs(ctx.chatId);
  const id = await upsertSchedule(ctx.chatId, 'crypto', 'crypto_summary', s.time, s.pattern, p.tz);
  if (id === 'limit') return notice(ctx, 'You have 50 active notifications. Remove some in /notifications.');
  await notice(ctx, `🗓 Crypto summary at <b>${s.time}</b> ${describePattern(s.pattern)} (${esc(p.tz)}).`);
}

async function summaryOff(ctx) {
  if (!(await requireManage(ctx))) return;
  const n = await findSchedule(ctx.chatId, 'crypto', 'crypto_summary');
  if (n) await deleteNotification(ctx.chatId, n.id);
  return summaryMenu(ctx);
}

// Shared by the scheduled summary and /daily: watchlist (or defaults) + F&G lines.
export async function marketLines(chatId) {
  const follows = await listFollows(chatId, 'coin');
  const ids = follows.length ? follows.map((f) => f.ref) : DEFAULT_COINS;
  const [data, fng] = await Promise.all([
    coinsByIds(ids, Object.fromEntries(follows.map((f) => [f.ref, f.meta?.symbol]))),
    getFearAndGreed(),
  ]);
  const lines = ids.map((id) => {
    const c = data.get(id);
    return c ? `<b>${esc(c.symbol)}</b> ${usd(c.price)}  ${chg(c.ch24h)}` : `<b>${esc(symbolOf(id))}</b> — <i>no data</i>`;
  });
  if (fng) lines.push(`${fngEmoji(fng.value)} Fear &amp; Greed ${fng.value} — ${esc(fng.label)}`);
  return lines;
}

registerSchedule('crypto_summary', {
  label: 'Crypto summary',
  async render(chatId) {
    const [lines, g] = await Promise.all([marketLines(chatId), globalStats()]);
    if (g) lines.push(`🌍 Market cap ${usdCompact(g.mcap)} ${chg(g.mcapChange24h)} · BTC dom ${g.btcDom?.toFixed(1)}%`);
    return { text: ['🗓 <b>Crypto summary</b>', '', ...lines].join('\n'), keyboard: [[btn('⭐ Watchlist', 'cr:wl'), btn('💰 Crypto', 'm:crypto')]] };
  },
});
