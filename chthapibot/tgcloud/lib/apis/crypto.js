// Crypto data. CoinGecko is the primary source; responses are cached in the DB
// (free tier ≈ 30 calls/min, shared by every chat). When CoinGecko fails, prices
// fall back to Coinlore (top 100 by symbol) and then Binance USDT pairs.
import { getJson, safely } from '../http.js';
import { cached } from '../store.js';

const CG = 'https://api.coingecko.com/api/v3';

export const DEFAULT_COINS = ['bitcoin', 'ethereum', 'solana'];

// Ticker shortcuts → CoinGecko ids.
const ALIASES = {
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin', xrp: 'ripple', ada: 'cardano',
  doge: 'dogecoin', ton: 'the-open-network', trx: 'tron', dot: 'polkadot', avax: 'avalanche-2',
  link: 'chainlink', ltc: 'litecoin', pol: 'polygon-ecosystem-token', matic: 'polygon-ecosystem-token',
  shib: 'shiba-inu', atom: 'cosmos', xlm: 'stellar', near: 'near', sui: 'sui', apt: 'aptos',
  usdt: 'tether', usdc: 'usd-coin', pepe: 'pepe', arb: 'arbitrum', op: 'optimism', hype: 'hyperliquid',
};
const SYMBOLS = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB', ripple: 'XRP' };

export function normalizeCoin(input) {
  const s = String(input ?? '').trim().toLowerCase();
  return ALIASES[s] ?? s;
}

export function symbolOf(id, fallback) {
  if (fallback) return fallback.toUpperCase();
  return SYMBOLS[id] ?? Object.entries(ALIASES).find(([, v]) => v === id)?.[0]?.toUpperCase() ?? id;
}

function toCoin(c) {
  return {
    id: c.id, symbol: (c.symbol ?? '').toUpperCase(), name: c.name, image: c.image ?? null,
    price: c.current_price, rank: c.market_cap_rank, mcap: c.market_cap, volume: c.total_volume,
    ch1h: c.price_change_percentage_1h_in_currency ?? null,
    ch24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null,
    ch7d: c.price_change_percentage_7d_in_currency ?? null,
    high24: c.high_24h, low24: c.low_24h, ath: c.ath, athChange: c.ath_change_percentage,
  };
}

const marketsUrl = (q) => `${CG}/coins/markets?vs_currency=usd&price_change_percentage=1h,24h,7d&${q}`;

// Top N by market cap (cached 2 min). If CoinGecko is rate-limiting, Coinlore's list
// stands in; its rows use the lowercase symbol as id, which coinCard resolves later.
export async function topCoins(n = 100) {
  const cg = await cached(`cg:top:${n}`, 120, () => safely(async () => (await getJson(marketsUrl(`order=market_cap_desc&per_page=${n}&page=1`))).map(toCoin)));
  if (cg?.length) return cg;
  return (await coinloreTop())?.slice(0, n).map((c) => ({ ...c, id: ALIASES[c.symbol.toLowerCase()] ?? c.symbol.toLowerCase() })) ?? null;
}

// Market data for specific ids → Map id → coin. `symbols` (id → SYMBOL) enables fallbacks.
export async function coinsByIds(ids, symbols = {}) {
  ids = [...new Set(ids.map(normalizeCoin))].filter(Boolean);
  const out = new Map();
  if (!ids.length) return out;
  const key = `cg:ids:${[...ids].sort().join(',')}`.slice(0, 500);
  const list = await cached(key, 60, () => safely(async () =>
    (await getJson(marketsUrl(`ids=${ids.map(encodeURIComponent).join(',')}&per_page=250`))).map(toCoin)));
  for (const c of list ?? []) out.set(c.id, c);

  const missing = ids.filter((id) => !out.has(id));
  if (missing.length) {
    const lore = await coinloreTop();
    for (const id of missing) {
      const sym = symbols[id] ?? symbolOf(id);
      const hit = lore?.find((c) => c.symbol === sym);
      if (hit) { out.set(id, { ...hit, id }); continue; }
      const t = await getBinanceTicker(`${sym}USDT`);
      if (t) out.set(id, { id, symbol: sym, name: sym, price: t.price, ch24h: t.changePct, high24: t.high, low24: t.low });
    }
  }
  return out;
}

function coinloreTop() {
  return cached('lore:top', 120, () => safely(async () => {
    const d = await getJson('https://api.coinlore.net/api/tickers/?start=0&limit=100');
    return d.data.map((c) => ({
      symbol: c.symbol, name: c.name, price: +c.price_usd, rank: +c.rank, mcap: +c.market_cap_usd,
      ch1h: +c.percent_change_1h, ch24h: +c.percent_change_24h, ch7d: +c.percent_change_7d,
    }));
  }));
}

// Name/symbol search (cached 1 day): [{ id, name, symbol, rank }]
export function searchCoins(query) {
  const q = String(query).trim().toLowerCase().slice(0, 40);
  return cached(`cg:search:${q}`, 86400, () => safely(async () =>
    (await getJson(`${CG}/search?query=${encodeURIComponent(q)}`)).coins.slice(0, 8)
      .map((c) => ({ id: c.id, name: c.name, symbol: c.symbol?.toUpperCase(), rank: c.market_cap_rank }))));
}

// Resolves free text ("btc", "pepe", "the-open-network") to one coin id, or a list to pick from.
export async function resolveCoin(text) {
  const raw = String(text).trim().toLowerCase();
  const id = normalizeCoin(raw);
  if (ALIASES[raw]) return { id, symbol: symbolOf(id), name: id };
  const results = (await searchCoins(raw)) ?? [];
  const exact = results.find((c) => c.id === id || c.symbol?.toLowerCase() === raw || c.name.toLowerCase() === raw);
  if (exact) return { id: exact.id, symbol: exact.symbol, name: exact.name };
  if (results.length) return { choices: results };
  // Search unavailable (rate limit): accept a CoinGecko id or a top-100 symbol/name directly.
  const top = (await topCoins(100)) ?? [];
  const hit = top.find((c) => c.id === id || c.symbol.toLowerCase() === raw || c.name.toLowerCase() === raw);
  if (hit) return { id: hit.id, symbol: hit.symbol, name: hit.name };
  if (/^[a-z0-9-]{2,60}$/.test(id) && (await coinsByIds([id])).has(id)) return { id, symbol: symbolOf(id), name: id };
  return { choices: [] };
}

// Trending searches on CoinGecko (cached 10 min).
export function trending() {
  return cached('cg:trending', 600, () => safely(async () =>
    (await getJson(`${CG}/search/trending`)).coins.slice(0, 10).map(({ item }) => ({
      id: item.id, name: item.name, symbol: item.symbol?.toUpperCase(), rank: item.market_cap_rank,
      price: item.data?.price ?? null, ch24h: item.data?.price_change_percentage_24h?.usd ?? null,
    }))));
}

// Global market stats (cached 10 min); CoinPaprika as fallback.
export function globalStats() {
  return cached('cg:global', 600, async () => {
    const cg = await safely(async () => (await getJson(`${CG}/global`)).data);
    if (cg) {
      return {
        mcap: cg.total_market_cap?.usd, volume: cg.total_volume?.usd, mcapChange24h: cg.market_cap_change_percentage_24h_usd,
        btcDom: cg.market_cap_percentage?.btc, ethDom: cg.market_cap_percentage?.eth, coins: cg.active_cryptocurrencies,
      };
    }
    return safely(async () => {
      const p = await getJson('https://api.coinpaprika.com/v1/global');
      return { mcap: p.market_cap_usd, volume: p.volume_24h_usd, mcapChange24h: p.market_cap_change_24h, btcDom: p.bitcoin_dominance_percentage, ethDom: null, coins: p.cryptocurrencies_number };
    });
  });
}

// Fear & Greed (cached 30 min): { value, label, yesterday }
export function getFearAndGreed() {
  return cached('fng', 1800, () => safely(async () => {
    const d = (await getJson('https://api.alternative.me/fng/?limit=2')).data;
    return { value: Number(d[0].value), label: d[0].value_classification, yesterday: d[1] ? Number(d[1].value) : null };
  }));
}

// Bitcoin network fees in sat/vB (cached 5 min).
export function btcFees() {
  return cached('mempool:fees', 300, () => safely(() => getJson('https://mempool.space/api/v1/fees/recommended')));
}

export function getBinanceTicker(symbol) {
  return safely(async () => {
    const t = await getJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
    return { symbol: t.symbol, price: Number(t.lastPrice), changePct: Number(t.priceChangePercent), high: Number(t.highPrice), low: Number(t.lowPrice), volume: Number(t.quoteVolume) };
  });
}

export function fngEmoji(value) {
  if (value == null) return '❔';
  if (value < 25) return '😱';
  if (value < 45) return '😟';
  if (value <= 55) return '😐';
  if (value <= 75) return '😏';
  return '🤑';
}

