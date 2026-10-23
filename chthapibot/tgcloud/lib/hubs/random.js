// 🎲 Random hub. Callback prefix `rd`.
//   rd:t tools · rd:td:<i> Telegram dice · rd:tc coin · rd:tr/tR:<expr> roll · rd:tn/tN:<a>:<b> number
//   rd:tp/tP pick · rd:ts shuffle · rd:tt/tT teams · rd:t8 8-ball · rd:tk:<n> cards
//   rd:d discover · rd:m:<kind> filter menu · rd:x:<kind>:<filter>[:<extra>] show one
//   rd:f fun · rd:f:<kind> show one · rd:q trivia · rd:qq:<cat> question · rd:qt leaderboard
//   rd:sch scheduled picks · rd:sc:<kind> menu · rd:scs:<kind> set · rd:sco:<kind> off
import { api, db } from 'sdk';
import { eq, and, desc } from 'sdk/db';
import { triviaScores } from '../../schema.js';
import * as fun from '../apis/fun.js';
import { getTrendingBook, getDailyFact } from '../apis/random.js';
import { int, pick, shuffled, roll, drawCards, EIGHT_BALL, teams as splitTeams } from '../rng.js';
import { getPrefs, putCache, getCache } from '../store.js';
import { registerSchedule, upsertSchedule, findSchedule, deleteNotification } from '../notify.js';
import { registerSavedKind, rememberItem, saveBtn } from './saved.js';
import { localParts, parseSchedule, describePattern } from '../time.js';
import { btn, menu, show, send, notice, ask, requireManage, homeRow, fits, navRow } from '../ui.js';
import { esc, link, truncate } from '../format.js';

const BACK = [btn('⬅️ Random', 'm:random')];
const DICE = ['🎲', '🎯', '🏀', '⚽', '🎳', '🎰'];

// ── entry points ──────────────────────────────────────────────────────────

export function home(ctx) {
  return menu(ctx, {
    text: '🎲 <b>Random</b>\n\nDice and pickers, something to watch, read or play, fun bits and trivia.',
    keyboard: [
      [btn('🎬 Discover', 'rd:d'), btn('🎲 Tools', 'rd:t')],
      [btn('😄 Fun', 'rd:f'), btn('🧠 Trivia', 'rd:q')],
      [btn('♥ Saved', 'sv:l:random:0'), btn('🗓 Scheduled picks', 'rd:sch')],
      [btn('🔔 Notifications', 'n:l:random:0'), btn('🏠 Main menu', 'm:home')],
    ],
  });
}

const shortcut = (kind, filter = '') => (ctx) => discover(ctx, kind, filter);
const funShortcut = (kind) => (ctx) => funOne(ctx, kind);

export const commands = {
  random: (ctx) => home(ctx),
  dice: (ctx, [e]) => sendDice(ctx, DICE.includes(e) ? e : '🎲'),
  roll: (ctx, args) => (args.length ? rollDice(ctx, args.join('')) : askRoll(ctx)),
  flip: (ctx) => coin(ctx),
  coin: (ctx) => coin(ctx),
  number: (ctx, [a, b]) => (a ? number(ctx, a, b) : askNumber(ctx)),
  pick: (ctx, args) => (args.length ? pickOne(ctx, args.join(' ')) : askPick(ctx)),
  shuffle: (ctx, args) => (args.length ? shuffleList(ctx, args.join(' ')) : ask(ctx, 'random.shuffle', '🔀 Send items to shuffle, comma-separated.', { placeholder: 'a, b, c' })),
  teams: (ctx, args) => (args.length ? makeTeams(ctx, args.join(' ')) : askTeams(ctx)),
  '8ball': (ctx, args) => eightBall(ctx, args.join(' ')),
  cards: (ctx, [n]) => cards(ctx, +n || 1),
  book: (ctx, [subject]) => discover(ctx, 'b', subject ? fun.BOOK_SUBJECTS.find(([k, l]) => k.startsWith(subject.toLowerCase()) || l.toLowerCase().startsWith(subject.toLowerCase()))?.[0] ?? 'trend' : 'trend'),
  movie: (ctx, [g]) => discover(ctx, 'm', g ? `${fun.MOVIE_GENRES.find(([, l]) => l.toLowerCase().startsWith(g.toLowerCase()))?.[0] ?? ''}` : ''),
  series: (ctx, [g]) => discover(ctx, 's', g ? fun.SERIES_GENRES.find((x) => x.toLowerCase().startsWith(g.toLowerCase())) ?? '' : ''),
  anime: shortcut('a'),
  game: shortcut('g', 'f2p'),
  album: shortcut('l'),
  radio: (ctx, [tag]) => discover(ctx, 'r', tag ?? ''),
  art: shortcut('A'),
  pokemon: shortcut('p'),
  dog: shortcut('d'),
  cat: shortcut('c'),
  fact: funShortcut('fact'),
  joke: funShortcut('joke'),
  quote: funShortcut('quote'),
  advice: funShortcut('advice'),
  wiki: funShortcut('wiki'),
  onthisday: funShortcut('otd'),
  word: funShortcut('word'),
  xkcd: (ctx, [n]) => funOne(ctx, 'xkcd', +n || null),
  bored: funShortcut('bored'),
  trivia: (ctx, [arg]) => (arg === 'top' ? leaderboard(ctx, send) : trivia(ctx, 0)),
};

export const callbacks = {
  async rd(ctx, [op, a, b, c]) {
    await ctx.answer();
    switch (op) {
      case 't': return toolsMenu(ctx);
      case 'td': return sendDice(ctx, DICE[+a] ?? '🎲');
      case 'tc': return coin(ctx);
      case 'tr': return askRoll(ctx);
      case 'tR': return rollDice(ctx, a);
      case 'tn': return askNumber(ctx);
      case 'tN': return number(ctx, a, b);
      case 'tp': return askPick(ctx);
      case 'tP': return repick(ctx);
      case 'ts': return ask(ctx, 'random.shuffle', '🔀 Send items to shuffle, comma-separated.', { placeholder: 'a, b, c' });
      case 'tt': return askTeams(ctx);
      case 'tT': return reteam(ctx);
      case 't8': return ask(ctx, 'random.eightball', '🎱 Ask a yes/no question.', { placeholder: 'Will it rain tomorrow?' });
      case 'tk': return a ? cards(ctx, +a) : menu(ctx, { text: '🃏 How many cards?', keyboard: [[1, 2, 3, 5, 7].map((n) => btn(String(n), `rd:tk:${n}`)), navRow('⬅️ Tools', 'rd:t')] });
      case 'd': return discoverMenu(ctx);
      case 'm': return filterMenu(ctx, a);
      case 'x': return discover(ctx, a, b ?? '', c);
      case 'f': return a ? funOne(ctx, a) : funMenu(ctx);
      case 'q': return triviaMenu(ctx);
      case 'qq': return trivia(ctx, +a || 0);
      case 'qt': return leaderboard(ctx, send);
      case 'sch': return picksMenu(ctx);
      case 'sc': return pickSchedule(ctx, a);
      case 'scs': return (await requireManage(ctx)) && ask(ctx, 'random.sched', `🗓 When should the ${esc(PICKS[a]?.label ?? a)} arrive? e.g. <code>20:00 fri</code>, <code>08:00</code>`, { data: { kind: a }, placeholder: '20:00 fri' });
      case 'sco': return pickOff(ctx, a);
    }
  },
};

export const inputs = {
  roll: (ctx, text) => rollDice(ctx, text),
  number: (ctx, text) => number(ctx, ...text.trim().split(/[\s,–-]+/)),
  pick: (ctx, text) => pickOne(ctx, text),
  shuffle: (ctx, text) => shuffleList(ctx, text),
  teams: (ctx, text) => makeTeams(ctx, text),
  eightball: (ctx, text) => eightBall(ctx, text),
  sched: (ctx, text, data) => pickSet(ctx, data.kind, text),
};

// ── tools ─────────────────────────────────────────────────────────────────

function toolsMenu(ctx) {
  return menu(ctx, {
    text: '🎲 <b>Tools</b>',
    keyboard: [
      DICE.map((e, i) => btn(e, `rd:td:${i}`)),
      [btn('🪙 Coin flip', 'rd:tc'), btn('🎲 Roll dice', 'rd:tr'), btn('🔢 Number', 'rd:tn')],
      [btn('👉 Pick one', 'rd:tp'), btn('🔀 Shuffle', 'rd:ts'), btn('👥 Split teams', 'rd:tt')],
      [btn('🎱 Magic 8-ball', 'rd:t8'), btn('🃏 Draw cards', 'rd:tk')],
      navRow('⬅️ Random', 'm:random'),
    ],
  });
}

const parseList = (text) => text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 100);

const sendDice = (ctx, emoji) => api.sendDice({ chat_id: ctx.chatId, emoji });

function coin(ctx) {
  return send(ctx, { text: `🪙 <b>${pick(['Heads', 'Tails'])}</b>`, keyboard: [[btn('🪙 Again', 'rd:tc')]] });
}

const askRoll = (ctx) => ask(ctx, 'random.roll', '🎲 What to roll? e.g. <code>d20</code>, <code>2d6</code>, <code>3d6+2</code>', { placeholder: '2d6' });

function rollDice(ctx, expr) {
  const r = roll(expr);
  if (!r) return notice(ctx, 'Use dice notation like <code>d20</code>, <code>2d6</code> or <code>3d6+2</code> (up to 50 dice, 1000 sides).');
  const sum = r.rolls.length > 1 ? `(${r.rolls.join(' + ')})` : String(r.rolls[0]);
  const detail = r.rolls.length > 1 || r.mod ? ` <i>${sum}${r.mod ? ` ${r.mod > 0 ? '+' : '−'} ${Math.abs(r.mod)}` : ''}</i>` : '';
  return send(ctx, { text: `🎲 ${r.expr} → <b>${r.total}</b>${detail}`, keyboard: [[btn('🎲 Again', `rd:tR:${r.expr}`)]] });
}

const askNumber = (ctx) => ask(ctx, 'random.number', '🔢 Range? e.g. <code>1 100</code>', { placeholder: '1 100' });

function number(ctx, a, b) {
  let lo = Math.trunc(+a);
  let hi = b == null || b === '' ? null : Math.trunc(+b);
  if (hi == null) [lo, hi] = [1, lo];
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi || Math.abs(hi - lo) > 1e9) return notice(ctx, 'Send a range like <code>1 100</code>.');
  if (lo > hi) [lo, hi] = [hi, lo];
  return send(ctx, { text: `🔢 ${lo}–${hi} → <b>${lo + int(hi - lo + 1)}</b>`, keyboard: [[btn('🔄 Again', `rd:tN:${lo}:${hi}`)]] });
}

const askPick = (ctx) => ask(ctx, 'random.pick', '👉 Send the options, comma-separated: <code>pizza, sushi, tacos</code>', { placeholder: 'pizza, sushi, tacos' });

async function pickOne(ctx, text) {
  const items = parseList(text);
  if (items.length < 2) return notice(ctx, 'Give me at least two options, comma-separated.');
  await putCache(`rd:list:${ctx.chatId}`, items, 3600);
  return send(ctx, { text: `👉 <b>${esc(pick(items))}</b>\n<i>from ${items.length} options</i>`, keyboard: [[btn('🔄 Pick again', 'rd:tP')]] });
}

async function repick(ctx) {
  const items = await getCache(`rd:list:${ctx.chatId}`);
  return items ? send(ctx, { text: `👉 <b>${esc(pick(items))}</b>\n<i>from ${items.length} options</i>`, keyboard: [[btn('🔄 Pick again', 'rd:tP')]] }) : askPick(ctx);
}

function shuffleList(ctx, text) {
  const items = parseList(text);
  if (items.length < 2) return notice(ctx, 'Give me at least two items, comma-separated.');
  return send(ctx, { text: ['🔀 <b>Shuffled</b>', '', ...shuffled(items).map((x, i) => `${i + 1}. ${esc(x)}`)].join('\n') });
}

const askTeams = (ctx) => ask(ctx, 'random.teams', '👥 Send names, then <code>/</code> and the number of teams: <code>Ann, Bob, Cy, Dee / 2</code>', { placeholder: 'Ann, Bob, Cy, Dee / 2' });

async function makeTeams(ctx, text) {
  const [namesPart, nPart] = text.split('/');
  const names = parseList(namesPart ?? '');
  const n = Math.max(2, Math.min(10, +(nPart ?? 2) || 2));
  if (names.length < n) return notice(ctx, `Need at least ${n} names for ${n} teams.`);
  await putCache(`rd:teams:${ctx.chatId}`, { names, n }, 3600);
  return teamsCard(ctx, names, n);
}

function teamsCard(ctx, names, n) {
  const out = splitTeams(names, n);
  return send(ctx, { text: ['👥 <b>Teams</b>', '', ...out.map((t, i) => `<b>Team ${i + 1}</b>: ${t.map(esc).join(', ')}`)].join('\n'), keyboard: [[btn('🔄 Reshuffle', 'rd:tT')]] });
}

async function reteam(ctx) {
  const last = await getCache(`rd:teams:${ctx.chatId}`);
  return last ? teamsCard(ctx, last.names, last.n) : askTeams(ctx);
}

function eightBall(ctx, question) {
  return send(ctx, { text: `${question ? `❓ <i>${esc(truncate(question, 200))}</i>\n` : ''}🎱 <b>${esc(pick(EIGHT_BALL))}</b>`, keyboard: [[btn('🎱 Ask again', 'rd:t8')]] });
}

function cards(ctx, n) {
  const hand = drawCards(n);
  const red = (c) => /[♥♦]/.test(c);
  return send(ctx, { text: `🃏 ${hand.map((c) => (red(c) ? `<b>${c}</b>` : c)).join('  ')}`, keyboard: [[btn('🃏 Draw again', `rd:tk:${hand.length}`)]] });
}

// ── discover ──────────────────────────────────────────────────────────────

const KINDS = {
  b: { label: '📚 Book', saved: 'book' }, m: { label: '🎬 Movie', saved: 'movie' }, s: { label: '📺 Series', saved: 'series' },
  a: { label: '🎌 Anime', saved: 'anime' }, g: { label: '🎮 Game', saved: 'game' }, l: { label: '🎵 Album', saved: 'album' },
  r: { label: '📻 Radio' }, A: { label: '🖼 Art', saved: 'art' }, p: { label: '⚡ Pokémon' }, d: { label: '🐶 Dog' }, c: { label: '🐱 Cat' },
};

function discoverMenu(ctx) {
  return menu(ctx, {
    text: '🎬 <b>Discover</b>\nPick something to get a random suggestion.',
    keyboard: [
      // Watch · read & listen · play & look
      [btn('🎬 Movie', 'rd:m:m'), btn('📺 Series', 'rd:m:s'), btn('🎌 Anime', 'rd:m:a')],
      [btn('📚 Book', 'rd:m:b'), btn('🎵 Album', 'rd:m:l'), btn('📻 Radio', 'rd:m:r')],
      [btn('🎮 Game', 'rd:m:g'), btn('🖼 Art', 'rd:x:A'), btn('⚡ Pokémon', 'rd:x:p')],
      [btn('🐶 Dog', 'rd:x:d'), btn('🐱 Cat', 'rd:x:c')],
      navRow('⬅️ Random', 'm:random'),
    ],
  });
}

const grid = (items, cols, make) => {
  const rows = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols).map(make).filter((x) => fits(x.callback_data)));
  return rows;
};

async function filterMenu(ctx, kind) {
  const back = navRow('⬅️ Discover', 'rd:d');
  if (kind === 'b') {
    return menu(ctx, { text: '📚 <b>Book</b> — pick a shelf', keyboard: [[btn('🔥 Trending today', 'rd:x:b:trend'), btn('🆓 Free classics', 'rd:x:b:gut')], ...grid(fun.BOOK_SUBJECTS, 3, ([k, l]) => btn(l, `rd:x:b:${k}`)), back] });
  }
  if (kind === 'm') {
    const tmdb = await fun.hasTmdb();
    return menu(ctx, {
      text: `🎬 <b>Movie</b> — pick a genre${tmdb ? ' (then a decade)' : ''}${tmdb ? '' : '\n<i>Limited mode: picks from Apple’s US top-100 chart. Add a TMDB key for the full catalogue and decades.</i>'}`,
      keyboard: [[btn('🎲 Any', tmdb ? 'rd:m:md' : 'rd:x:m')], ...grid(fun.MOVIE_GENRES, 3, ([id, l]) => btn(l, tmdb ? `rd:m:md${id}` : `rd:x:m:${id}`)), back],
    });
  }
  if (kind.startsWith('md')) {
    const genre = kind.slice(2);
    return menu(ctx, { text: '🎬 <b>Movie</b> — which decade?', keyboard: [[btn('Any decade', `rd:x:m:${genre}`)], ...grid(fun.DECADES, 3, (d) => btn(`${d}s`, `rd:x:m:${genre}:${d}`)), [...navRow('⬅️ Genres', 'rd:m:m')]] });
  }
  if (kind === 's') return menu(ctx, { text: '📺 <b>Series</b> — pick a genre (rated 7.3+)', keyboard: [[btn('🎲 Any', 'rd:x:s')], ...grid(fun.SERIES_GENRES, 3, (g) => btn(g, `rd:x:s:${g}`)), back] });
  if (kind === 'a') return menu(ctx, { text: '🎌 <b>Anime</b> — pick a genre', keyboard: [[btn('🎲 Any popular', 'rd:x:a')], ...grid(fun.ANIME_CATEGORIES, 3, ([k, l]) => btn(l, `rd:x:a:${k}`)), back] });
  if (kind === 'g') {
    return menu(ctx, {
      text: '🎮 <b>Game</b>',
      keyboard: [[btn('💸 Steam deal', 'rd:x:g:deal'), btn('🎁 Free giveaway', 'rd:x:g:give')], [btn('🆓 Free-to-play (any)', 'rd:x:g:f2p')],
        ...grid(fun.GAME_GENRES, 3, (g) => btn(g.replace('-', ' '), `rd:x:g:f2p:${g}`)), back],
    });
  }
  if (kind === 'l') return menu(ctx, { text: '🎵 <b>Album</b> — from Apple Music’s most-played', keyboard: [[btn('🎲 Any', 'rd:x:l')], ...grid(fun.ALBUM_GENRES, 3, (g) => btn(g, `rd:x:l:${g}`)), back] });
  if (kind === 'r') return menu(ctx, { text: '📻 <b>Radio</b> — pick a style', keyboard: [[btn('🎲 Most popular', 'rd:x:r')], ...grid(fun.RADIO_TAGS, 3, (t) => btn(t, `rd:x:r:${t}`)), back] });
}

async function fetchItem(kind, filter, extra) {
  switch (kind) {
    case 'b': {
      if (filter === 'gut') return fun.classicBook();
      if (filter && filter !== 'trend') return fun.bookBySubject(filter);
      const t = await getTrendingBook();
      return t && { kind: 'book', ...t };
    }
    case 'm': return fun.movie(+filter || null, extra || null);
    case 's': return fun.series(filter || null);
    case 'a': return fun.anime(filter || null);
    case 'g': return filter === 'deal' ? fun.gameDeal() : filter === 'give' ? fun.giveaway() : fun.freeGame(extra || null);
    case 'l': return fun.album(filter || null);
    case 'r': return fun.radio(filter || null);
    case 'A': return fun.artwork();
    case 'p': return fun.pokemon();
    case 'd': { const url = await fun.dogPhoto(); return url && { kind: 'pet', image: url, title: '🐶 Good dog' }; }
    case 'c': { const url = await fun.catPhoto(); return url && { kind: 'pet', image: url, title: '🐱 Here’s a cat' }; }
  }
  return null;
}

async function discover(ctx, kind, filter = '', extra) {
  if (!KINDS[kind]) return null;
  const item = await fetchItem(kind, filter, extra);
  if (!item) return notice(ctx, `⚠️ No ${KINDS[kind].label.replace(/^\S+ /, '').toLowerCase()} right now — try again in a moment.`);
  // Keep an empty filter slot when there is an extra (e.g. any genre + a decade).
  const again = `rd:x:${kind}${filter || extra ? `:${filter ?? ''}` : ''}${extra ? `:${extra}` : ''}`;
  const card = renderItem(item);
  if (item.ref && KINDS[kind].saved) await rememberItem(item.kind, item.ref, item);
  card.keyboard = [
    [...(item.ref && KINDS[kind].saved ? [saveBtn(item.kind, item.ref)] : []), btn('🔄 Another', fits(again) ? again : `rd:x:${kind}`)].filter(Boolean),
    [btn('⬅️ Discover', kind === 'A' || kind === 'p' || kind === 'd' || kind === 'c' ? 'rd:d' : `rd:m:${kind}`)],
  ];
  return send(ctx, card);
}

const year = (y, end) => (y ? ` (${y}${end && end !== y ? `–${end}` : ''})` : '');
const titled = (x) => (x.year && x.title?.endsWith(`(${x.year})`) ? `<b>${esc(x.title)}</b>` : `<b>${esc(x.title)}</b>${year(x.year)}`);
const lines = (...parts) => parts.filter((l) => l != null && l !== false).join('\n');

// Text + image for any discover/fun item (also used to reopen saved items).
export function renderItem(x) {
  switch (x.kind) {
    case 'book':
      return { text: [`📚 <b>${esc(x.title)}</b>`, `by ${esc(x.author)}${x.year ? ` · ${x.year}` : ''}`, x.free ? '🆓 Free to read on Project Gutenberg' : null, '', link(x.url, x.free ? 'Read it →' : 'Open Library →')].filter((l) => l !== null).join('\n'), image: x.cover };
    case 'movie':
      return { text: lines(`🎬 ${titled(x)}`, `<i>${esc([x.genre, x.director && `dir. ${x.director}`, x.rating].filter(Boolean).join(' · '))}</i>`, '', esc(truncate(x.overview, 700)), '', x.url && link(x.url, x.limited ? 'Apple TV →' : 'TMDB →'), x.limited && '<i>Limited mode: Apple top-100 chart</i>'), image: x.image };
    case 'series':
      return { text: [`📺 <b>${esc(x.title)}</b>${year(x.year, x.ended)}`, `<i>${esc([x.genres?.join(', '), x.network, x.rating && `★ ${x.rating}`].filter(Boolean).join(' · '))}</i>`, '', esc(truncate(x.overview, 700)), '', link(x.url, 'TVmaze →')].join('\n'), image: x.image };
    case 'anime':
      return { text: [`🎌 <b>${esc(x.title)}</b>${year(x.year)}`, `<i>${esc([x.type, x.episodes && `${x.episodes} eps`, x.rating].filter(Boolean).join(' · '))}</i>`, '', esc(truncate(x.overview, 700)), '', link(x.url, 'Kitsu →')].join('\n'), image: x.image };
    case 'game':
      return { text: [`🎮 <b>${esc(x.title)}</b>`, `<i>${esc([x.genre, x.platform, x.year, x.publisher].filter(Boolean).join(' · '))}</i>`, '', esc(x.overview ?? ''), '', link(x.url, '🆓 Play free →')].join('\n'), image: x.image };
    case 'deal':
      return { text: [`💸 <b>${esc(x.title)}</b>`, `<s>$${esc(x.normal)}</s> → <b>$${esc(x.price)}</b> (−${x.savings}%)`, [x.metacritic && `Metacritic ${x.metacritic}`, x.steam && `Steam: ${esc(x.steam)}`].filter(Boolean).join(' · '), '', link(x.url, 'Get the deal →')].filter(Boolean).join('\n'), image: x.image };
    case 'giveaway':
      return { text: [`🎁 <b>${esc(x.title)}</b>`, `<i>${esc([x.worth !== 'N/A' && `worth ${x.worth}`, x.platforms, x.ends !== 'N/A' && `ends ${x.ends}`].filter(Boolean).join(' · '))}</i>`, '', esc(truncate(x.overview, 400)), '', link(x.url, 'Claim →')].join('\n'), image: x.image };
    case 'album':
      return { text: lines(`🎵 <b>${esc(x.title)}</b>`, `by ${esc(x.artist)}${x.year ? ` · ${x.year}` : ''}`, x.genres?.length && `<i>${esc(x.genres.join(', '))}</i>`, '', link(x.url, 'Apple Music →')), image: x.image };
    case 'radio':
      return { text: [`📻 <b>${esc(x.title)}</b>`, `<i>${esc([x.country, x.tags].filter(Boolean).join(' · '))}</i>`, `${esc(x.codec)} ${x.bitrate ? `${x.bitrate} kbps` : ''}`, '', [link(x.stream, '▶️ Listen'), x.homepage && link(x.homepage, 'Website')].filter(Boolean).join(' · ')].join('\n') };
    case 'art':
      return { text: [`🖼 <b>${esc(x.title)}</b>`, esc(x.artist), `<i>${esc([x.date, x.medium].filter(Boolean).join(' · '))}</i>`, '', link(x.url, 'Art Institute of Chicago →')].join('\n'), image: x.image };
    case 'pokemon':
      return { text: [`⚡ <b>#${x.id} ${esc(x.title)}</b>${x.genus ? ` — ${esc(x.genus)}` : ''}`, `Type: ${esc(x.types.join(' / '))} · ${x.height} m · ${x.weight} kg`, '', esc(x.overview)].join('\n'), image: x.image };
    case 'pet':
      return { text: x.title, image: x.image };
    case 'quote':
      return { text: `💬 <i>“${esc(x.text)}”</i>\n— ${esc(x.author)}` };
    case 'word':
      return { text: [`🔤 <b>${esc(x.word)}</b> ${esc(x.phonetic)}`, '', ...x.meanings.flatMap((m) => [`<i>${esc(m.pos)}</i> — ${esc(m.def)}`, ...(m.example ? [`   “${esc(m.example)}”`] : [])])].join('\n') };
    case 'xkcd':
      return { text: [`🖍 <b>xkcd #${x.num}: ${esc(x.title)}</b>`, `<i>${esc(x.alt)}</i>`, '', link(x.url, 'xkcd.com →')].join('\n'), image: x.image };
  }
  return { text: esc(x.title ?? '') };
}

// ── fun ───────────────────────────────────────────────────────────────────

function funMenu(ctx) {
  return menu(ctx, {
    text: '😄 <b>Fun</b>',
    keyboard: [
      // Laugh · learn · words · do
      [btn('😂 Joke', 'rd:f:joke'), btn('🖍 xkcd', 'rd:f:xkcd'), btn('💬 Quote', 'rd:f:quote')],
      [btn('🤓 Fact', 'rd:f:fact'), btn('📖 Wikipedia', 'rd:f:wiki'), btn('📅 On this day', 'rd:f:otd')],
      [btn('🔤 Word of the day', 'rd:f:word'), btn('🔀 Random word', 'rd:f:rword')],
      [btn('🧭 Advice', 'rd:f:advice'), btn('🥱 Bored?', 'rd:f:bored')],
      navRow('⬅️ Random', 'm:random'),
    ],
  });
}

async function funCard(kind, tz, num, scheduled = false) {
  const now = localParts(new Date(), tz);
  switch (kind) {
    case 'fact': { const f = await getDailyFact(); return f && { text: `🤓 <b>Did you know?</b>\n\n${esc(f.text)}` }; }
    case 'joke': {
      const j = await fun.joke();
      return j && { text: `😂 ${esc(j.setup)}${j.punchline ? `\n\n<tg-spoiler>${esc(j.punchline)}</tg-spoiler>` : ''}` };
    }
    case 'quote': { const q = await fun.quote(); return q && { ...renderItem(q), item: q }; }
    case 'advice': { const a = await fun.advice(); return a && { text: `🧭 ${esc(a)}` }; }
    case 'wiki': {
      const w = await fun.wikiRandom();
      return w && { text: [`📖 <b>${esc(w.title)}</b>`, '', esc(w.extract), '', link(w.url, 'Wikipedia →')].join('\n'), image: w.image };
    }
    case 'otd': {
      const events = await fun.onThisDay(now.m, now.d);
      if (!events?.length) return null;
      const chosen = shuffled(events).slice(0, 6).sort((a, b) => a.year - b.year);
      const date = new Date(Date.UTC(2000, now.m - 1, now.d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      return { text: [`📅 <b>On this day — ${date}</b>`, '', ...chosen.map((e) => `• <b>${e.year}</b> ${esc(truncate(e.text, 220))}${e.url ? ` ${link(e.url, '→')}` : ''}`)].join('\n') };
    }
    case 'word': case 'rword': {
      const w = await fun.word(kind === 'word' ? now.ymd : null);
      return w && { ...renderItem(w), text: `${kind === 'word' && !scheduled ? '📅 <b>Word of the day</b>\n\n' : ''}${renderItem(w).text}`, item: w };
    }
    case 'xkcd': { const c = await fun.xkcd(num); return c && { ...renderItem(c), item: c }; }
    case 'bored': {
      const b = await fun.bored();
      return b && { text: `🥱 <b>${esc(b.activity)}</b>\n<i>${esc([b.type, `${b.participants} ${b.participants === 1 ? 'person' : 'people'}`, b.duration, b.price === 0 ? 'free' : null].filter(Boolean).join(' · '))}</i>` };
    }
  }
  return null;
}

async function funOne(ctx, kind, num) {
  const { tz } = await getPrefs(ctx.chatId);
  const card = await funCard(kind, tz, num);
  if (!card) return notice(ctx, '⚠️ Nothing came back — try again in a moment.');
  const item = card.item;
  delete card.item;
  if (item?.ref) await rememberItem(item.kind, item.ref, item);
  const again = kind === 'word' ? 'rd:f:rword' : `rd:f:${kind}`;
  card.keyboard = [[...(item?.ref ? [saveBtn(item.kind, item.ref)] : []), btn(kind === 'word' ? '🔀 Random word' : '🔄 Another', again)].filter(Boolean), [btn('⬅️ Fun', 'rd:f')]];
  return send(ctx, card);
}

// ── trivia ────────────────────────────────────────────────────────────────

function triviaMenu(ctx) {
  return menu(ctx, {
    text: '🧠 <b>Trivia</b>\nPick a category — answer the quiz poll to score. Daily streaks count days with at least one correct answer.',
    keyboard: [[btn('🏆 Leaderboard', 'rd:qt')], ...grid(fun.TRIVIA_CATEGORIES, 3, ([id, l]) => btn(l, `rd:qq:${id}`)), navRow('⬅️ Random', 'm:random')],
  });
}

async function trivia(ctx, category) {
  const q = await fun.triviaQuestion(category);
  // Open Trivia DB allows one request per ~5 s per IP and answers faster ones with 429 or code 5.
  if (!q || q.busy) return notice(ctx, '⏳ The trivia server allows one question every few seconds — tap again in a moment.');
  const msg = await api.sendPoll({
    chat_id: ctx.chatId,
    question: truncate(`${q.question}`, 300),
    options: q.options.map((o) => ({ text: truncate(o, 100) })),
    type: 'quiz',
    correct_option_id: q.correct,
    is_anonymous: false,
    explanation: truncate(`${q.category} · ${q.difficulty}`, 200),
    reply_markup: { inline_keyboard: [[btn('▶️ Next question', `rd:qq:${category}`), btn('🏆 Top', 'rd:qt')]] },
  });
  if (msg?.poll?.id) await putCache(`trivia:poll:${msg.poll.id}`, { chatId: ctx.chatId, correct: q.correct }, 3 * 86400);
}

// Called by handlers/poll_answer.js.
export async function recordAnswer(answer) {
  if (!answer.user || !answer.poll_id) return;
  const poll = await getCache(`trivia:poll:${answer.poll_id}`);
  if (!poll || !answer.option_ids?.length) return; // not ours, or a retracted vote
  const right = answer.option_ids[0] === poll.correct;
  const { tz } = await getPrefs(poll.chatId);
  const today = localParts(new Date(), tz).ymd;
  const yesterday = localParts(new Date(Date.now() - 86400e3), tz).ymd;
  const where = and(eq(triviaScores.chatId, poll.chatId), eq(triviaScores.userId, answer.user.id));
  const cur = await db.select().from(triviaScores).where(where).get();
  const name = [answer.user.first_name, answer.user.last_name].filter(Boolean).join(' ').slice(0, 40) || answer.user.username || 'Someone';
  let streak = cur?.streak ?? 0;
  let lastDay = cur?.lastDay ?? null;
  if (right && lastDay !== today) {
    streak = lastDay === yesterday ? streak + 1 : 1;
    lastDay = today;
  }
  const row = { name, answered: (cur?.answered ?? 0) + 1, correct: (cur?.correct ?? 0) + (right ? 1 : 0), streak, bestStreak: Math.max(cur?.bestStreak ?? 0, streak), lastDay };
  if (cur) await db.update(triviaScores).set(row).where(where).run();
  else await db.insert(triviaScores).values({ chatId: poll.chatId, userId: answer.user.id, ...row }).run();
}

async function leaderboard(ctx, out) {
  const [rows, { tz }] = await Promise.all([
    db.select().from(triviaScores).where(eq(triviaScores.chatId, ctx.chatId)).orderBy(desc(triviaScores.correct), triviaScores.answered).limit(10).all(),
    getPrefs(ctx.chatId),
  ]);
  const today = localParts(new Date(), tz).ymd;
  const yesterday = localParts(new Date(Date.now() - 86400e3), tz).ymd;
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((r, i) => {
    const live = r.lastDay === today || r.lastDay === yesterday ? r.streak : 0;
    return `${medals[i] ?? `${i + 1}.`} ${esc(r.name)} — <b>${r.correct}</b> ✓ (${Math.round((r.correct / Math.max(1, r.answered)) * 100)}%)${live > 1 ? ` · 🔥${live}` : ''}`;
  });
  return out(ctx, {
    text: ['🏆 <b>Trivia leaderboard</b>', '', ...(lines.length ? lines : ['<i>No answers yet — start a quiz!</i>'])].join('\n'),
    keyboard: [[btn('🧠 Play', 'rd:q')]],
  });
}

// ── scheduled picks ───────────────────────────────────────────────────────

const cap = (s) => s[0].toUpperCase() + s.slice(1);

const PICKS = {
  movie: { label: 'movie pick', make: () => fetchItem('m', '') },
  series: { label: 'series pick', make: () => fetchItem('s', '') },
  book: { label: 'book pick', make: () => fetchItem('b', 'trend') },
  anime: { label: 'anime pick', make: () => fetchItem('a', '') },
  album: { label: 'album pick', make: () => fetchItem('l', '') },
  quote: { label: 'quote', fun: 'quote' },
  fact: { label: 'fact', fun: 'fact' },
  word: { label: 'word of the day', fun: 'word' },
  otd: { label: 'on this day', fun: 'otd' },
  xkcd: { label: 'xkcd', fun: 'xkcd' },
};

async function picksMenu(ctx) {
  const rows = await Promise.all(Object.keys(PICKS).map(async (k) => [k, await findSchedule(ctx.chatId, 'random', `pick_${k}`)]));
  return menu(ctx, {
    text: ['🗓 <b>Scheduled picks</b>', 'Get a random pick on a schedule, e.g. a movie every Friday at 20:00.', '',
      ...rows.filter(([, n]) => n?.active).map(([k, n]) => `• ${esc(PICKS[k].label)} — ${n.params.time} ${describePattern(n.params.pattern)}`)].join('\n'),
    keyboard: [...grid(rows, 2, ([k, n]) => btn(`${n?.active ? '✅' : '➕'} ${cap(PICKS[k].label)}`, `rd:sc:${k}`)), navRow('⬅️ Random', 'm:random')],
  });
}

async function pickSchedule(ctx, kind) {
  const n = await findSchedule(ctx.chatId, 'random', `pick_${kind}`);
  return menu(ctx, {
    text: `🗓 <b>${esc(cap(PICKS[kind].label))}</b>\nNow: <b>${n?.active ? `${n.params.time} ${describePattern(n.params.pattern)}` : 'off'}</b>`,
    keyboard: [[btn('⏰ Set time', `rd:scs:${kind}`), ...(n ? [btn('🚫 Turn off', `rd:sco:${kind}`)] : [])], navRow('⬅️ Scheduled picks', 'rd:sch')],
  });
}

async function pickSet(ctx, kind, text) {
  if (!PICKS[kind] || !(await requireManage(ctx))) return;
  const s = parseSchedule(text);
  if (!s) return notice(ctx, 'Usage: <code>20:00 fri</code>, <code>08:00</code>, <code>09:00 weekdays</code>');
  const { tz } = await getPrefs(ctx.chatId);
  const id = await upsertSchedule(ctx.chatId, 'random', `pick_${kind}`, s.time, s.pattern, tz);
  if (id === 'limit') return notice(ctx, 'You have 50 active notifications. Remove some in /notifications.');
  return notice(ctx, `🗓 ${esc(cap(PICKS[kind].label))} at <b>${s.time}</b> ${describePattern(s.pattern)} (${esc(tz)}).`);
}

async function pickOff(ctx, kind) {
  if (!(await requireManage(ctx))) return;
  const n = await findSchedule(ctx.chatId, 'random', `pick_${kind}`);
  if (n) await deleteNotification(ctx.chatId, n.id);
  return pickSchedule(ctx, kind);
}

for (const [k, p] of Object.entries(PICKS)) {
  registerSchedule(`pick_${k}`, {
    label: p.label[0].toUpperCase() + p.label.slice(1),
    async render(chatId) {
      if (p.fun) {
        const { tz } = await getPrefs(chatId);
        const card = await funCard(p.fun, tz, null, true);
        if (!card) return { text: `🗓 Your ${p.label} is unavailable right now.` };
        if (card.item?.ref) await rememberItem(card.item.kind, card.item.ref, card.item);
        const save = card.item?.ref ? saveBtn(card.item.kind, card.item.ref) : null;
        delete card.item;
        return { ...card, text: `🗓 <b>Your ${esc(p.label)}</b>\n\n${card.text}`, keyboard: save ? [[save]] : undefined };
      }
      const item = await p.make();
      if (!item) return { text: `🗓 Your ${p.label} is unavailable right now.` };
      if (item.ref) await rememberItem(item.kind, item.ref, item);
      const card = renderItem(item);
      return { ...card, text: `🗓 <b>Your ${esc(p.label)}</b>\n\n${card.text}`, keyboard: item.ref ? [[saveBtn(item.kind, item.ref)].filter(Boolean)] : undefined };
    },
  });
}

// ── saved kinds ───────────────────────────────────────────────────────────

const ICONS = { book: '📚', movie: '🎬', series: '📺', anime: '🎌', game: '🎮', album: '🎵', art: '🖼', quote: '💬', word: '🔤', xkcd: '🖍' };
for (const [kind, icon] of Object.entries(ICONS)) {
  registerSavedKind(kind, {
    category: 'random', icon,
    title: (x) => (kind === 'quote' ? `“${truncate(x.text, 40)}” — ${x.author}` : kind === 'word' ? x.word : kind === 'xkcd' ? `#${x.num} ${x.title}` : x.title),
    render: (x) => ({ ...renderItem(x), keyboard: [[btn('⬅️ Saved', 'sv:l:random:0')]] }),
  });
}

