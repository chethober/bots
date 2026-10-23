// ☀️ The daily briefing, assembled from the chat's toggled sections (prefs.daily).
// Feeds shared by every chat (book, recipe, scores…) are memoized per scheduler run via `memo`.
import { getTrendingBook, getRandomRecipe, getDailyFact } from './apis/random.js';
import { leagueGames } from './apis/espn.js';
import { getWeather } from './apis/weather.js';
import * as f1 from './apis/f1.js';
import * as fun from './apis/fun.js';
import { myLines, pickGames } from './hubs/sports.js';
import { marketLines } from './hubs/crypto.js';
import { registerSchedule } from './notify.js';
import { getPrefs } from './store.js';
import { localParts, whenLocal } from './time.js';
import { btn } from './ui.js';
import { esc, link, truncate, countdown } from './format.js';

// Order here is the order in the briefing. Defaults live in DEFAULT_DAILY (lib/store.js).
export const SECTIONS = [
  { key: 'weather', label: '🌤 Weather' },
  { key: 'crypto', label: '💰 Crypto' },
  { key: 'teams', label: '🏟 My teams' },
  { key: 'f1', label: '🏎 Next F1 race' },
  { key: 'book', label: '📚 Book' },
  { key: 'movie', label: '🎬 Movie' },
  { key: 'recipe', label: '🍲 Recipe' },
  { key: 'quote', label: '💬 Quote' },
  { key: 'fact', label: '🤓 Fact' },
  { key: 'word', label: '🔤 Word' },
];

export function createMemo() {
  const m = new Map();
  return (key, fn) => {
    if (!m.has(key)) m.set(key, fn());
    return m.get(key);
  };
}

// Followed teams/leagues; without follows, today's Premier League.
async function sportsLines(chatId, tz, memo) {
  const mine = await myLines(chatId, tz, memo);
  if (mine?.length) return ['🏟 <b>My teams</b>', ...mine];
  const games = await memo('lg:epl', () => leagueGames('epl', 1));
  if (!games) return null;
  return ['⚽️ <b>Premier League</b>', ...pickGames(games, 3, 4).map((g) => {
    if (g.state === 'pre') return `🗓 ${esc(g.home.name)} vs ${esc(g.away.name)}`;
    return `${g.state === 'in' ? '🔴' : '✅'} ${esc(g.home.name)} ${esc(g.home.score ?? '')}–${esc(g.away.score ?? '')} ${esc(g.away.name)}`;
  })];
}

// Each builder returns lines for its section, or null to skip it.
const BUILDERS = {
  async weather(p) {
    if (p.lat == null) return ['<i>📍 Share a location in /settings to see the weather here.</i>'];
    const w = await getWeather(p.lat, p.lon);
    return w && [`${w.icon} <b>${esc(w.label)}</b>, ${Math.round(w.temp)}°C (${Math.round(w.min)}°…${Math.round(w.max)}°), wind ${Math.round(w.wind)} km/h`];
  },
  crypto: async (p) => ['💰 <b>Markets</b>', ...await marketLines(p.chatId)],
  teams: (p, memo) => sportsLines(p.chatId, p.tz, memo),
  async f1(p, memo) {
    const s = await memo('f1:status', () => f1.status());
    return s?.next && ['🏎 <b>Formula 1</b>', `${esc(s.next.name)} — ${whenLocal(s.next.start, p.tz)} (in ${countdown(new Date(s.next.start))})`];
  },
  async book(p, memo) {
    const b = await memo('book', getTrendingBook);
    return b && ['📚 <b>Trending book</b>', `${link(b.url, b.title)} — ${esc(b.author)}`];
  },
  async movie(p, memo) {
    const m = await memo('movie', () => fun.movie(null, null));
    return m && ['🎬 <b>Movie pick</b>', `${m.url ? link(m.url, m.title) : esc(m.title)}${m.year ? ` (${m.year})` : ''}${m.genre ? ` · <i>${esc(m.genre)}</i>` : ''}`];
  },
  async recipe(p, memo) {
    const r = await memo('recipe', getRandomRecipe);
    return r && ['🍲 <b>Cook tonight</b>', `${esc(r.name)} <i>(${esc([r.area, r.category].filter(Boolean).join(' '))})</i>${r.video ? ` · ${link(r.video, 'video')}` : ''}`, 'Full recipe: /recipe'];
  },
  async quote(p, memo) {
    const q = await memo('quote', fun.quote);
    return q && ['💬 <b>Quote</b>', `<i>“${esc(q.text)}”</i> — ${esc(q.author)}`];
  },
  async fact(p, memo) {
    const f = await memo('fact', getDailyFact);
    return f && ['🤓 <b>Did you know?</b>', esc(f.text)];
  },
  async word(p) {
    const w = await fun.word(localParts(new Date(), p.tz).ymd);
    return w && ['🔤 <b>Word of the day</b>', `<b>${esc(w.word)}</b> <i>${esc(w.meanings[0]?.pos ?? '')}</i> — ${esc(truncate(w.meanings[0]?.def ?? '', 200))}`];
  },
};

export async function buildDaily(chatId, memo = createMemo()) {
  const p = await getPrefs(chatId);
  const on = SECTIONS.filter((s) => p.daily[s.key]);
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: p.tz });
  const parts = await Promise.all(on.map((s) => BUILDERS[s.key](p, memo).catch(() => null)));
  const out = [`☀️ <b>Daily briefing</b> — ${esc(today)}`];
  for (const lines of parts) if (lines?.length) out.push('', ...lines);
  if (!on.length) out.push('', '<i>Every section is off — pick some in 🧩 Sections.</i>');
  const book = p.daily.book ? await memo('book', getTrendingBook) : null;
  return {
    text: out.join('\n').slice(0, 4000),
    image: book?.cover ?? null,
    keyboard: [[btn('🔄 Refresh', 'dl:r'), btn('🧩 Sections', 'st:dsec'), btn('⏰ Time', 'st:daily')]],
  };
}

registerSchedule('daily', {
  label: 'Daily briefing',
  render: (chatId, env) => buildDaily(chatId, env.memo),
});
