// 🎲 Random hub data: discovery (books, movies, series, anime, games, music, radio,
// art, Pokémon, pets), fun bits (jokes, quotes, words, Wikipedia, xkcd) and trivia.
// Every fetcher returns a plain object with `kind` + `ref` (for ♥ Save), or null.
import { getJson, safely } from '../http.js';
import { cached, getConfig } from '../store.js';
import { int, pick } from '../rng.js';

const stripHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const UA = { 'User-Agent': 'chthapibot/1.0 (Telegram bot; https://t.me/chthapibot)' };

// ── books ─────────────────────────────────────────────────────────────────

export const BOOK_SUBJECTS = [['fantasy', 'Fantasy'], ['science_fiction', 'Sci-fi'], ['mystery_and_detective_stories', 'Mystery'],
  ['romance', 'Romance'], ['thriller', 'Thriller'], ['history', 'History'], ['biography', 'Biography'], ['horror', 'Horror'],
  ['humor', 'Humor'], ['poetry', 'Poetry'], ['self-help', 'Self-help'], ['young_adult_fiction', 'Young adult']];

export function bookBySubject(subject) {
  return safely(async () => {
    const meta = await cached(`fun:olsub:${subject}`, 86400, () => safely(() => getJson(`https://openlibrary.org/subjects/${subject}.json?limit=1`)));
    const max = Math.min(meta?.work_count ?? 200, 800);
    const w = (await getJson(`https://openlibrary.org/subjects/${subject}.json?limit=1&offset=${int(max)}`)).works?.[0];
    if (!w) return null;
    return {
      kind: 'book', ref: w.key.replace('/works/', ''), title: w.title, author: w.authors?.map((a) => a.name).join(', ') || 'Unknown author',
      year: w.first_publish_year ?? null, cover: w.cover_id ? `https://covers.openlibrary.org/b/id/${w.cover_id}-L.jpg` : null,
      url: `https://openlibrary.org${w.key}`,
    };
  });
}

// A free public-domain classic from Project Gutenberg (most popular first).
export function classicBook() {
  return safely(async () => {
    const n = 1 + int(40);
    const page = await cached(`fun:gut:${n}`, 7 * 86400, () => safely(() => getJson(`https://gutendex.com/books/?page=${n}`)));
    const b = page?.results?.length ? pick(page.results) : null;
    if (!b) return null;
    return {
      kind: 'book', ref: `g${b.id}`, title: b.title, author: b.authors?.map((a) => a.name.split(', ').reverse().join(' ')).join(', ') || 'Unknown author',
      year: null, cover: b.formats?.['image/jpeg'] ?? null, url: `https://www.gutenberg.org/ebooks/${b.id}`, free: true,
    };
  });
}

// ── movies ────────────────────────────────────────────────────────────────

export const MOVIE_GENRES = [[28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'], [99, 'Documentary'],
  [18, 'Drama'], [10751, 'Family'], [14, 'Fantasy'], [27, 'Horror'], [9648, 'Mystery'], [10749, 'Romance'], [878, 'Sci-fi'], [53, 'Thriller']];
export const DECADES = ['1970', '1980', '1990', '2000', '2010', '2020'];
const TMDB_GENRE_NAMES = Object.fromEntries([...MOVIE_GENRES, [36, 'History'], [10402, 'Music'], [10752, 'War'], [37, 'Western'], [10770, 'TV movie']]);

// Apple's chart labels for the same genres (limited mode without a TMDB key).
const APPLE_GENRE = { 28: /action/i, 12: /adventure/i, 16: /kids|anima/i, 35: /comedy/i, 80: /thriller|crime/i, 99: /documentary/i, 18: /drama/i, 10751: /kids|family/i, 14: /sci-fi|fantasy/i, 27: /horror/i, 9648: /thriller|mystery/i, 10749: /romance/i, 878: /sci-fi/i, 53: /thriller/i };

export async function hasTmdb() {
  return !!(await getConfig('tmdb_key'));
}

export async function movie(genre, decade) {
  const key = await getConfig('tmdb_key');
  if (key) {
    const m = await safely(async () => {
      const q = [`api_key=${encodeURIComponent(key)}`, 'vote_count.gte=300', 'sort_by=popularity.desc', 'include_adult=false', `page=${1 + int(10)}`];
      if (genre) q.push(`with_genres=${genre}`);
      if (decade) q.push(`primary_release_date.gte=${decade}-01-01`, `primary_release_date.lte=${+decade + 9}-12-31`);
      const d = await getJson(`https://api.themoviedb.org/3/discover/movie?${q.join('&')}`);
      const r = d.results?.length ? pick(d.results) : null;
      return r && {
        kind: 'movie', ref: `t${r.id}`, title: r.title, year: r.release_date?.slice(0, 4) ?? '', rating: r.vote_average ? `★ ${r.vote_average.toFixed(1)}/10` : '',
        overview: r.overview ?? '', image: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
        url: `https://www.themoviedb.org/movie/${r.id}`, genre: (r.genre_ids ?? []).map((id) => TMDB_GENRE_NAMES[id]).filter(Boolean).slice(0, 2).join(', '),
      };
    });
    if (m) return m;
  }
  // Limited mode: Apple's US top-movies chart (no decade filter).
  const chart = await cached('fun:applemovies', 21600, () => safely(async () =>
    (await getJson('https://itunes.apple.com/us/rss/topmovies/limit=100/json')).feed.entry.map((e) => ({
      kind: 'movie', ref: `a${e.id?.attributes?.['im:id'] ?? e['im:name'].label}`.slice(0, 40), title: e['im:name'].label,
      year: e['im:releaseDate']?.label?.slice(0, 4) ?? '', rating: '', overview: e.summary?.label ?? '',
      image: e['im:image']?.at(-1)?.label?.replace(/\d+x\d+bb/, '600x900bb') ?? null,
      url: (Array.isArray(e.link) ? e.link[0] : e.link)?.attributes?.href ?? null, genre: e.category?.attributes?.label ?? '', director: e['im:artist']?.label ?? '',
    }))));
  if (!chart?.length) return null;
  const pool = genre && APPLE_GENRE[genre] ? chart.filter((m) => APPLE_GENRE[genre].test(m.genre)) : chart;
  return { ...pick(pool.length ? pool : chart), limited: true };
}

// ── series (TVmaze) ───────────────────────────────────────────────────────

export const SERIES_GENRES = ['Drama', 'Comedy', 'Crime', 'Science-Fiction', 'Thriller', 'Action', 'Romance', 'Horror', 'Fantasy', 'Mystery', 'Anime', 'Family'];

export function series(genre) {
  return safely(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const p = int(60);
      const page = await cached(`fun:tvm:${p}`, 7 * 86400, () => safely(async () =>
        (await getJson(`https://api.tvmaze.com/shows?page=${p}`)).map((s) => ({
          id: s.id, name: s.name, genres: s.genres, rating: s.rating?.average, weight: s.weight, premiered: s.premiered, ended: s.ended,
          network: s.network?.name ?? s.webChannel?.name ?? '', image: s.image?.original ?? s.image?.medium ?? null, summary: stripHtml(s.summary).slice(0, 600), url: s.url,
        }))));
      const pool = (page ?? []).filter((s) => (s.rating ?? 0) >= 7.3 && s.weight >= 60 && (!genre || s.genres.includes(genre)));
      if (pool.length) {
        const s = pick(pool);
        return { kind: 'series', ref: String(s.id), title: s.name, year: s.premiered?.slice(0, 4) ?? '', ended: s.ended?.slice(0, 4) ?? null, rating: s.rating, genres: s.genres, network: s.network, image: s.image, overview: s.summary, url: s.url };
      }
    }
    return null;
  });
}

// ── anime (Kitsu; requires its JSON:API Accept header) ───────────────────

export const ANIME_CATEGORIES = [['action', 'Action'], ['comedy', 'Comedy'], ['romance', 'Romance'], ['fantasy', 'Fantasy'], ['science-fiction', 'Sci-fi'],
  ['horror', 'Horror'], ['sports', 'Sports'], ['slice-of-life', 'Slice of life'], ['mystery', 'Mystery'], ['drama', 'Drama'], ['adventure', 'Adventure']];

export function anime(category) {
  return safely(async () => {
    const H = { Accept: 'application/vnd.api+json' };
    const filter = category ? `&filter%5Bcategories%5D=${encodeURIComponent(category)}` : '';
    const base = `https://kitsu.io/api/edge/anime?sort=popularityRank${filter}`;
    const count = await cached(`fun:kitsu:${category ?? 'all'}`, 86400, () => safely(async () => (await getJson(`${base}&page%5Blimit%5D=1`, { headers: H })).meta?.count));
    const offset = int(Math.min(count ?? 100, 400));
    const a = (await getJson(`${base}&page%5Blimit%5D=1&page%5Boffset%5D=${offset}`, { headers: H })).data?.[0];
    if (!a) return null;
    const x = a.attributes;
    return {
      kind: 'anime', ref: a.id, title: x.canonicalTitle, year: x.startDate?.slice(0, 4) ?? '', rating: x.averageRating ? `★ ${(x.averageRating / 10).toFixed(1)}/10` : '',
      episodes: x.episodeCount, type: x.subtype, overview: (x.synopsis ?? '').slice(0, 600), image: x.posterImage?.large ?? x.posterImage?.medium ?? null,
      url: `https://kitsu.app/anime/${x.slug}`,
    };
  });
}

// ── games ─────────────────────────────────────────────────────────────────

export const GAME_GENRES = ['shooter', 'mmorpg', 'strategy', 'moba', 'racing', 'sports', 'card', 'battle-royale', 'fantasy', 'survival'];

export function freeGame(genre) {
  return safely(async () => {
    const list = await cached(`fun:f2p:${genre ?? 'all'}`, 86400, () => safely(() => getJson(`https://www.freetogame.com/api/games${genre ? `?category=${genre}` : ''}`)));
    if (!list?.length) return null;
    const g = pick(list);
    return { kind: 'game', ref: String(g.id), title: g.title, genre: g.genre, platform: g.platform, overview: g.short_description, image: g.thumbnail, url: g.game_url, year: g.release_date?.slice(0, 4) ?? '', publisher: g.publisher };
  });
}

export function gameDeal() {
  return safely(async () => {
    const list = await cached('fun:deals', 3600, () => safely(() => getJson('https://www.cheapshark.com/api/1.0/deals?pageSize=30&storeID=1&onSale=1&sortBy=Deal%20Rating', { headers: UA })));
    if (!list?.length) return null;
    const d = pick(list);
    return { kind: 'deal', title: d.title, price: d.salePrice, normal: d.normalPrice, savings: Math.round(+d.savings), metacritic: +d.metacriticScore || null, steam: d.steamRatingText ?? '', image: d.thumb, url: `https://www.cheapshark.com/redirect?dealID=${d.dealID}` };
  });
}

export function giveaway() {
  return safely(async () => {
    const list = await cached('fun:giveaways', 3600, () => safely(() => getJson('https://www.gamerpower.com/api/giveaways?type=game&sort-by=popularity')));
    if (!list?.length) return null;
    const g = pick(list.slice(0, 30));
    return { kind: 'giveaway', title: g.title, worth: g.worth, ends: g.end_date, platforms: g.platforms, image: g.image, url: g.open_giveaway_url, overview: g.description?.slice(0, 300) ?? '' };
  });
}

// ── music & radio ─────────────────────────────────────────────────────────

export const ALBUM_GENRES = ['Pop', 'Hip-Hop/Rap', 'Rock', 'Country', 'R&B/Soul', 'Alternative', 'Latin', 'Dance', 'Electronic'];

export function album(genre) {
  return safely(async () => {
    const list = await cached('fun:albums', 21600, () => safely(async () =>
      (await getJson('https://rss.applemarketingtools.com/api/v2/us/music/most-played/100/albums.json')).feed.results));
    if (!list?.length) return null;
    const pool = genre ? list.filter((a) => a.genres?.some((g) => g.name === genre)) : list;
    const a = pick(pool.length ? pool : list);
    return { kind: 'album', ref: a.id, title: a.name, artist: a.artistName, year: a.releaseDate?.slice(0, 4) ?? '', genres: (a.genres ?? []).map((g) => g.name).filter((g) => g !== 'Music'), image: a.artworkUrl100?.replace('100x100bb', '600x600bb') ?? null, url: a.url };
  });
}

export const RADIO_TAGS = ['jazz', 'rock', 'pop', 'classical', 'lofi', 'chillout', 'electronic', 'hiphop', 'ambient', 'news'];

export function radio(tag) {
  return safely(async () => {
    const path = tag ? `bytag/${encodeURIComponent(tag)}` : 'topclick';
    // Radio Browser runs several mirrors; try the next one if a mirror is down.
    const list = await cached(`fun:radio:${tag ?? 'top'}`, 21600, async () => {
      for (const host of ['de1', 'de2', 'fi1']) {
        const r = await safely(() => getJson(`https://${host}.api.radio-browser.info/json/stations/${path}?order=clickcount&reverse=true&limit=60&hidebroken=true`, { headers: UA }));
        if (r?.length) return r;
      }
      return null;
    });
    if (!list?.length) return null;
    const s = pick(list);
    return { kind: 'radio', title: s.name.trim(), country: s.country, tags: s.tags?.split(',').slice(0, 4).join(', ') ?? '', codec: s.codec, bitrate: s.bitrate, homepage: s.homepage || null, stream: s.url_resolved || s.url, image: s.favicon || null };
  });
}

// ── art, Pokémon, pets ────────────────────────────────────────────────────

export async function artwork() {
  return (await artworkOnce()) ?? artworkOnce();
}

function artworkOnce() {
  return safely(async () => {
    // Many public-domain records have no image: take a page of 20 and pick one that does.
    const d = await getJson(`https://api.artic.edu/api/v1/artworks/search?query%5Bterm%5D%5Bis_public_domain%5D=true&limit=20&page=${1 + int(450)}&fields=id,title,artist_display,date_display,image_id,medium_display`);
    const withImage = (d.data ?? []).filter((x) => x.image_id);
    if (!withImage.length) return null;
    const a = pick(withImage);
    return { kind: 'art', ref: String(a.id), title: a.title, artist: a.artist_display ?? '', date: a.date_display ?? '', medium: a.medium_display ?? '', image: `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`, url: `https://www.artic.edu/artworks/${a.id}` };
  });
}

export function pokemon() {
  return safely(async () => {
    const id = 1 + int(1025);
    const [p, s] = await Promise.all([getJson(`https://pokeapi.co/api/v2/pokemon/${id}`), safely(() => getJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`))]);
    const flavor = s?.flavor_text_entries?.filter((f) => f.language.name === 'en').at(-1)?.flavor_text?.replace(/[\n\f]+/g, ' ') ?? '';
    return {
      kind: 'pokemon', ref: String(id), title: p.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), id,
      types: p.types.map((t) => t.type.name), height: p.height / 10, weight: p.weight / 10, genus: s?.genera?.find((g) => g.language.name === 'en')?.genus ?? '',
      overview: flavor, image: p.sprites?.other?.['official-artwork']?.front_default ?? p.sprites?.front_default ?? null, url: `https://www.pokemon.com/us/pokedex/${p.name}`,
    };
  });
}

export const dogPhoto = () => safely(async () => (await getJson('https://dog.ceo/api/breeds/image/random')).message ?? null);
export const catPhoto = () => safely(async () => (await getJson('https://api.thecatapi.com/v1/images/search'))[0]?.url ?? null);

// ── fun bits ──────────────────────────────────────────────────────────────

export async function joke() {
  const j = await safely(() => getJson('https://v2.jokeapi.dev/joke/Any?safe-mode'));
  if (j && !j.error) return { kind: 'joke', setup: j.type === 'twopart' ? j.setup : j.joke, punchline: j.type === 'twopart' ? j.delivery?.trim() : null, category: j.category };
  const d = await safely(() => getJson('https://icanhazdadjoke.com/'));
  return d?.joke ? { kind: 'joke', setup: d.joke, punchline: null, category: 'Dad joke' } : null;
}

export function quote() {
  return safely(async () => {
    const q = (await getJson('https://zenquotes.io/api/random'))[0];
    if (!q?.q || /too many requests/i.test(q.q)) return null;
    return { kind: 'quote', ref: q.q.slice(0, 30).replace(/[^a-z0-9]/gi, '').slice(0, 24) || String(Date.now()), text: q.q, author: q.a };
  });
}

export const advice = () => safely(async () => (await getJson(`https://api.adviceslip.com/advice?t=${Date.now()}`)).slip?.advice ?? null);

export const bored = () => safely(async () => {
  const b = await getJson('https://bored-api.appbrewery.com/random');
  return b.activity ? { activity: b.activity, type: b.type, participants: b.participants, price: b.price, duration: b.duration } : null;
});

export function wikiRandom() {
  return safely(async () => {
    const w = await getJson('https://en.wikipedia.org/api/rest_v1/page/random/summary', { headers: UA });
    return { kind: 'wiki', title: w.title, extract: w.extract?.slice(0, 900) ?? '', image: w.thumbnail?.source ?? null, url: w.content_urls?.desktop?.page };
  });
}

// Events on this day (month/day in the chat's zone), 5 picked across the centuries.
export function onThisDay(month, day) {
  return cached(`fun:otd:${month}-${day}`, 86400, () => safely(async () => {
    const d = await getJson(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`, { headers: UA });
    return (d.events ?? []).map((e) => ({ year: e.year, text: e.text, url: e.pages?.[0]?.content_urls?.desktop?.page ?? null }));
  }));
}

// Fallback when random-word-api only yields words the dictionary doesn't know.
const GOOD_WORDS = ['serendipity', 'ephemeral', 'luminous', 'petrichor', 'sonder', 'halcyon', 'mellifluous', 'quixotic', 'ineffable', 'sanguine',
  'eloquent', 'labyrinth', 'nostalgia', 'reverie', 'solace', 'wanderlust', 'zenith', 'ebullient', 'cogent', 'gregarious', 'laconic', 'pensive',
  'resilient', 'tenacious', 'vivacious', 'whimsical', 'aplomb', 'bucolic', 'cacophony', 'dulcet', 'effervescent', 'felicity', 'gossamer',
  'idyllic', 'jubilant', 'kinetic', 'lissome', 'meander', 'nebulous', 'opulent', 'panacea', 'quintessential', 'rhapsody', 'sagacious',
  'talisman', 'ubiquitous', 'verdant', 'wistful', 'zephyr', 'alacrity', 'benevolent', 'candor', 'diligent', 'enigma', 'fortitude'];

// A word that has a dictionary entry; `seed` makes "word of the day" stable for a date.
// The dictionary API rate-limits bursts, so lookups are sequential: up to 3 random words,
// then up to 2 from the curated list.
export async function word(seed) {
  const entry = (w) => cached(`fun:dict:${String(w).toLowerCase()}`, 30 * 86400, async () => {
    const e = await safely(() => getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`));
    if (!Array.isArray(e) || !e[0]?.meanings?.length) return null;
    return {
      kind: 'word', ref: e[0].word, word: e[0].word, phonetic: e[0].phonetic ?? e[0].phonetics?.find((p) => p.text)?.text ?? '',
      meanings: e[0].meanings.slice(0, 3).map((m) => ({ pos: m.partOfSpeech, def: m.definitions[0]?.definition ?? '', example: m.definitions[0]?.example ?? null })),
    };
  });
  const load = async () => {
    const random = (await safely(() => getJson('https://random-word-api.herokuapp.com/word?number=3'))) ?? [];
    for (const w of [...random, pick(GOOD_WORDS), pick(GOOD_WORDS)]) {
      const hit = await entry(w);
      if (hit) return hit;
    }
    return null;
  };
  return seed ? cached(`fun:wotd:${seed}`, 2 * 86400, load) : load();
}

export async function xkcd(num) {
  const latest = await cached('fun:xkcd:latest', 21600, () => safely(async () => (await getJson('https://xkcd.com/info.0.json')).num));
  const n = num ?? (latest ? 1 + int(latest) : null);
  if (!n) return null;
  return cached(`fun:xkcd:${n}`, 30 * 86400, () => safely(async () => {
    const c = await getJson(`https://xkcd.com/${n}/info.0.json`);
    return { kind: 'xkcd', ref: String(c.num), num: c.num, title: c.safe_title ?? c.title, alt: c.alt, image: c.img, url: `https://xkcd.com/${c.num}/`, year: c.year };
  }));
}

// ── trivia (Open Trivia DB; ~1 request / 5 s per IP) ─────────────────────

export const TRIVIA_CATEGORIES = [[0, '🎲 Any'], [9, '🧠 General'], [10, '📚 Books'], [11, '🎬 Film'], [12, '🎵 Music'], [14, '📺 TV'],
  [15, '🎮 Games'], [17, '🔬 Science'], [18, '💻 Computers'], [21, '⚽️ Sports'], [22, '🌍 Geography'], [23, '🏛 History'], [27, '🐾 Animals']];

// → { question, options[], correct, category, difficulty } | { busy: true } | null
export async function triviaQuestion(category, difficulty) {
  const q = ['amount=1', 'type=multiple', 'encode=url3986'];
  if (+category) q.push(`category=${category}`);
  if (difficulty) q.push(`difficulty=${difficulty}`);
  const d = await safely(() => getJson(`https://opentdb.com/api.php?${q.join('&')}`));
  if (!d) return null;
  if (d.response_code === 5) return { busy: true };
  const r = d.results?.[0];
  if (!r) return null;
  const dec = (s) => decodeURIComponent(s);
  const correct = dec(r.correct_answer);
  const options = [correct, ...r.incorrect_answers.map(dec)];
  for (let i = options.length - 1; i > 0; i--) { const j = int(i + 1); [options[i], options[j]] = [options[j], options[i]]; }
  return { question: dec(r.question), options, correct: options.indexOf(correct), category: dec(r.category), difficulty: r.difficulty };
}
