// ESPN public site API (site.web.api.espn.com — site.api.espn.com returns 403 to the
// platform). A league catalogue keyed by short codes keeps callback data small.
import { getJson, safely } from '../http.js';
import { cached } from '../store.js';

const SITE = 'https://site.web.api.espn.com/apis/site/v2/sports';
const V2 = 'https://site.web.api.espn.com/apis/v2/sports';

// type: 'team' (two-sided games) | 'tennis' | 'golf' | 'mma' | 'racing' | 'f1' | 'cricket'
export const GROUPS = [
  ['soccer', '⚽️ Soccer'], ['basketball', '🏀 Basketball'], ['football', '🏈 Football'], ['baseball', '⚾️ Baseball'],
  ['hockey', '🏒 Hockey'], ['rugby', '🏉 Rugby'], ['cricket', '🏏 Cricket'], ['tennis', '🎾 Tennis'],
  ['golf', '⛳️ Golf'], ['mma', '🥊 MMA'], ['motorsport', '🏎 Motorsport'],
];

const L = (code, group, path, name, type = 'team') => ({ code, group, path, name, type });
export const LEAGUES = [
  L('epl', 'soccer', 'soccer/eng.1', 'Premier League'), L('champ', 'soccer', 'soccer/eng.2', 'Championship'),
  L('facup', 'soccer', 'soccer/eng.fa', 'FA Cup'), L('laliga', 'soccer', 'soccer/esp.1', 'LaLiga'),
  L('seriea', 'soccer', 'soccer/ita.1', 'Serie A'), L('bundes', 'soccer', 'soccer/ger.1', 'Bundesliga'),
  L('ligue1', 'soccer', 'soccer/fra.1', 'Ligue 1'), L('ered', 'soccer', 'soccer/ned.1', 'Eredivisie'),
  L('primeira', 'soccer', 'soccer/por.1', 'Primeira Liga'), L('superlig', 'soccer', 'soccer/tur.1', 'Süper Lig'),
  L('spl', 'soccer', 'soccer/sco.1', 'Scottish Prem'), L('ucl', 'soccer', 'soccer/uefa.champions', 'Champions League'),
  L('uel', 'soccer', 'soccer/uefa.europa', 'Europa League'), L('uecl', 'soccer', 'soccer/uefa.europa.conf', 'Conference League'),
  L('unl', 'soccer', 'soccer/uefa.nations', 'Nations League'), L('mls', 'soccer', 'soccer/usa.1', 'MLS'),
  L('ligamx', 'soccer', 'soccer/mex.1', 'Liga MX'), L('brasil', 'soccer', 'soccer/bra.1', 'Brasileirão'),
  L('argen', 'soccer', 'soccer/arg.1', 'Argentina'), L('saudi', 'soccer', 'soccer/ksa.1', 'Saudi Pro League'),
  L('libert', 'soccer', 'soccer/conmebol.libertadores', 'Libertadores'), L('wc', 'soccer', 'soccer/fifa.world', 'World Cup'),
  L('euro', 'soccer', 'soccer/uefa.euro', 'Euros'), L('copa', 'soccer', 'soccer/conmebol.america', 'Copa América'),
  L('nba', 'basketball', 'basketball/nba', 'NBA'), L('wnba', 'basketball', 'basketball/wnba', 'WNBA'),
  L('ncaam', 'basketball', 'basketball/mens-college-basketball', 'NCAA Men'), L('ncaaw', 'basketball', 'basketball/womens-college-basketball', 'NCAA Women'),
  L('nfl', 'football', 'football/nfl', 'NFL'), L('ncaaf', 'football', 'football/college-football', 'NCAA Football'),
  L('mlb', 'baseball', 'baseball/mlb', 'MLB'), L('nhl', 'hockey', 'hockey/nhl', 'NHL'),
  L('6n', 'rugby', 'rugby/180659', 'Six Nations'), L('trc', 'rugby', 'rugby/244293', 'Rugby Championship'),
  L('rwc', 'rugby', 'rugby/164205', 'Rugby World Cup'), L('prem', 'rugby', 'rugby/267979', 'Premiership'),
  L('urc', 'rugby', 'rugby/270557', 'URC'), L('top14', 'rugby', 'rugby/270559', 'Top 14'),
  L('superr', 'rugby', 'rugby/242041', 'Super Rugby'), L('ercc', 'rugby', 'rugby/271937', 'Champions Cup'),
  L('cricket', 'cricket', 'cricket', 'Live & recent', 'cricket'),
  L('atp', 'tennis', 'tennis/atp', 'ATP', 'tennis'), L('wta', 'tennis', 'tennis/wta', 'WTA', 'tennis'),
  L('pga', 'golf', 'golf/pga', 'PGA Tour', 'golf'), L('lpga', 'golf', 'golf/lpga', 'LPGA', 'golf'),
  L('dpwt', 'golf', 'golf/eur', 'DP World Tour', 'golf'), L('liv', 'golf', 'golf/liv', 'LIV Golf', 'golf'),
  L('ufc', 'mma', 'mma/ufc', 'UFC', 'mma'),
  L('f1', 'motorsport', 'racing/f1', 'Formula 1', 'f1'), L('nascar', 'motorsport', 'racing/nascar-premier', 'NASCAR Cup', 'racing'),
  L('indy', 'motorsport', 'racing/irl', 'IndyCar', 'racing'),
];
// Soccer menu order: top-5 leagues, European cups, other European leagues, Americas/Asia, internationals.
const SOCCER_ORDER = ['epl', 'laliga', 'seriea', 'bundes', 'ligue1', 'ucl', 'uel', 'uecl', 'champ', 'facup', 'ered', 'primeira', 'superlig', 'spl', 'saudi', 'mls', 'ligamx', 'brasil', 'argen', 'libert', 'wc', 'euro', 'copa', 'unl'];
LEAGUES.sort((a, b) => (a.group === 'soccer' && b.group === 'soccer' ? SOCCER_ORDER.indexOf(a.code) - SOCCER_ORDER.indexOf(b.code) : 0));
export const LEAGUE = Object.fromEntries(LEAGUES.map((l) => [l.code, l]));
export const ALIASES = { premier: 'epl', pl: 'epl', 'eng.1': 'epl', 'esp.1': 'laliga', 'ita.1': 'seriea', 'ger.1': 'bundes', bundesliga: 'bundes', 'fra.1': 'ligue1', worldcup: 'wc', 'uefa.champions': 'ucl', 'usa.1': 'mls' };

export function leagueOf(code) {
  const c = String(code ?? '').toLowerCase();
  return LEAGUE[c] ?? LEAGUE[ALIASES[c]] ?? null;
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

// ── normalizers ───────────────────────────────────────────────────────────

function scoreOf(x) {
  if (x?.score == null) return null;
  return typeof x.score === 'object' ? x.score.displayValue ?? x.score.value ?? null : x.score;
}

function sideOf(x) {
  const t = x?.team ?? {};
  return { id: t.id ?? null, name: t.shortDisplayName ?? t.displayName ?? t.name ?? '?', full: t.displayName ?? t.name ?? '?', abbr: t.abbreviation ?? '', score: scoreOf(x), winner: x?.winner === true };
}

// Two-sided game → { id, date, state, detail, statusName, home, away }
export function toGame(e) {
  const c = e.competitions?.[0] ?? e;
  const st = c.status ?? e.status ?? {};
  const type = st.type ?? {};
  return {
    id: e.id ?? c.id,
    date: new Date(c.date ?? e.date),
    state: type.state ?? 'pre',
    completed: type.completed === true,
    statusName: type.name ?? '',
    detail: type.shortDetail ?? type.detail ?? '',
    home: sideOf(c.competitors?.find((x) => x.homeAway === 'home') ?? c.competitors?.[0]),
    away: sideOf(c.competitors?.find((x) => x.homeAway === 'away') ?? c.competitors?.[1]),
  };
}

export const isHalftime = (g) => g.statusName === 'STATUS_HALFTIME' || /^(HT|Half(time)?)$/i.test(g.detail);

// ── scoreboards ───────────────────────────────────────────────────────────

async function board(path, date) {
  const today = !date;
  const ttl = today ? 120 : date < ymd(new Date()) ? 3600 : 1800;
  return cached(`espn:sb:${path}:${date ?? 'now'}`, ttl, () => safely(() => getJson(`${SITE}/${path}/scoreboard${date ? `?dates=${date}` : ''}`)));
}

// Team leagues: recent results, live games and upcoming (default board + past days).
export async function leagueGames(code, pastDays = 2) {
  const lg = leagueOf(code);
  const now = Date.now();
  const days = [null, ...Array.from({ length: pastDays }, (_, i) => ymd(new Date(now - (i + 1) * 86400e3)))];
  const boards = await Promise.all(days.map((d) => board(lg.path, d)));
  if (!boards[0]) return null;
  const seen = new Set();
  const games = [];
  for (const b of boards) for (const e of b?.events ?? []) if (!seen.has(e.id)) { seen.add(e.id); games.push(toGame(e)); }
  return games.sort((a, b) => a.date - b.date);
}

// Upcoming games over the next `days` days.
export async function leagueFixtures(code, days = 7) {
  const lg = leagueOf(code);
  const now = Date.now();
  const boards = await Promise.all(Array.from({ length: days }, (_, i) => board(lg.path, ymd(new Date(now + i * 86400e3)))));
  if (boards.every((b) => !b)) return null;
  const seen = new Set();
  const games = [];
  for (const b of boards) for (const e of b?.events ?? []) if (!seen.has(e.id)) { seen.add(e.id); games.push(toGame(e)); }
  return games.filter((g) => g.state === 'pre').sort((a, b) => a.date - b.date);
}

// One game's live status (cached 2 min) — used by match notifications.
export function gameSummary(code, eventId) {
  const lg = leagueOf(code);
  return cached(`espn:sum:${eventId}`, 120, () => safely(async () => {
    const d = await getJson(`${SITE}/${lg.path}/summary?event=${encodeURIComponent(eventId)}`);
    return toGame({ id: eventId, ...d.header, competitions: d.header?.competitions });
  }));
}

// Raw default scoreboard events (individual sports parse them differently).
export async function rawEvents(code) {
  return (await board(leagueOf(code).path, null))?.events ?? null;
}

// ── standings / news / teams ──────────────────────────────────────────────

const STAT_COLS = {
  soccer: [['GP', 'P'], ['W', 'W'], ['D', 'D'], ['L', 'L'], ['GD', 'GD'], ['P', 'Pts']],
  rugby: [['GP', 'P'], ['W', 'W'], ['L', 'L'], ['PD', 'PD'], ['P', 'Pts']],
  default: [['W', 'W'], ['L', 'L'], ['PCT', 'PCT'], ['GB', 'GB']],
  hockey: [['W', 'W'], ['L', 'L'], ['OTL', 'OT'], ['PTS', 'Pts']],
};

export function standings(code) {
  const lg = leagueOf(code);
  return cached(`espn:st:${code}`, 3600, () => safely(async () => {
    const d = await getJson(`${V2}/${lg.path}/standings`);
    const groups = (d.children?.length ? d.children : [d]).filter((g) => g.standings?.entries?.length);
    const cols = STAT_COLS[lg.group] ?? STAT_COLS.default;
    return groups.map((g) => {
      const rows = g.standings.entries.map((e) => {
        const stat = (abbr) => e.stats.find((s) => s.abbreviation === abbr)?.displayValue ?? '';
        const rank = Number(stat('R') || stat('SEED') || stat('RK') || 0) || null;
        return { id: e.team.id, team: e.team.shortDisplayName ?? e.team.displayName, abbr: e.team.abbreviation, rank, cols: cols.map(([a, label]) => [label, stat(a)]), pct: Number(stat('PCT')) || 0, pts: Number(stat('P') || stat('PTS')) || 0 };
      });
      rows.sort((a, b) => (a.rank && b.rank ? a.rank - b.rank : b.pts - a.pts || b.pct - a.pct));
      return { name: g.name ?? lg.name, rows };
    });
  }));
}

export function news(code) {
  const lg = leagueOf(code);
  return cached(`espn:nw:${code}`, 1800, () => safely(async () =>
    ((await getJson(`${SITE}/${lg.path}/news`)).articles ?? []).filter((a) => a.links?.web?.href).slice(0, 8)
      .map((a) => ({ title: a.headline, url: a.links.web.href, published: a.published }))));
}

export function teams(code) {
  const lg = leagueOf(code);
  return cached(`espn:teams:${code}`, 7 * 86400, () => safely(async () =>
    ((await getJson(`${SITE}/${lg.path}/teams`)).sports?.[0]?.leagues?.[0]?.teams ?? [])
      .map(({ team: t }) => ({ id: t.id, name: t.displayName, short: t.shortDisplayName, abbr: t.abbreviation }))
      .sort((a, b) => a.name.localeCompare(b.name))));
}

export function teamInfo(code, id) {
  const lg = leagueOf(code);
  return cached(`espn:team:${code}:${id}`, 1800, () => safely(async () => {
    const t = (await getJson(`${SITE}/${lg.path}/teams/${encodeURIComponent(id)}`)).team;
    return {
      id: t.id, name: t.displayName, short: t.shortDisplayName, abbr: t.abbreviation,
      logo: t.logos?.[0]?.href ?? null, record: t.record?.items?.[0]?.summary ?? null,
      standing: t.standingSummary ?? null, next: t.nextEvent?.[0] ? toGame(t.nextEvent[0]) : null,
    };
  }));
}

// A team's season: results plus fixtures (soccer lists fixtures separately).
export function teamGames(code, id) {
  const lg = leagueOf(code);
  return cached(`espn:tg:${code}:${id}`, 1800, () => safely(async () => {
    const base = `${SITE}/${lg.path}/teams/${encodeURIComponent(id)}/schedule`;
    const [res, fix] = await Promise.all([
      safely(() => getJson(base)),
      lg.group === 'soccer' ? safely(() => getJson(`${base}?fixture=true`)) : null,
    ]);
    if (!res && !fix) return null;
    const seen = new Set();
    const games = [];
    for (const e of [...(res?.events ?? []), ...(fix?.events ?? [])]) if (!seen.has(e.id)) { seen.add(e.id); games.push(toGame(e)); }
    return games.sort((a, b) => a.date - b.date).map((g) => ({ ...g, date: g.date.toISOString() }));
  }));
}

// Weekly index of every team in every team league, for name search.
export function teamIndex() {
  return cached('espn:teamindex', 7 * 86400, async () => {
    const out = [];
    const team = LEAGUES.filter((l) => l.type === 'team');
    for (let i = 0; i < team.length; i += 8) {
      const lists = await Promise.all(team.slice(i, i + 8).map((l) => teams(l.code)));
      lists.forEach((list, j) => (list ?? []).forEach((t) => out.push([team[i + j].code, t.id, t.name, t.short ?? '', t.abbr ?? ''])));
    }
    return out.length ? out : null;
  });
}

export async function searchTeams(query) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const index = (await teamIndex()) ?? [];
  const scored = [];
  for (const [code, id, name, short, abbr] of index) {
    const n = normalize(name);
    let score = 0;
    if (n === q || normalize(short) === q || abbr.toLowerCase() === q) score = 3;
    else if (n.startsWith(q) || normalize(short).startsWith(q)) score = 2;
    else if (n.includes(q)) score = 1;
    if (score) scored.push({ code, id, name, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 12);
}

function normalize(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
}

// ── individual sports ─────────────────────────────────────────────────────

const athlete = (x) => x?.athlete?.displayName ?? x?.athlete?.fullName ?? x?.team?.displayName ?? '?';

// Tennis: matches across the current tournaments (singles first).
export async function tennisMatches(code) {
  const events = await rawEvents(code);
  if (!events) return null;
  return events.map((e) => {
    const groups = (e.groupings ?? []).sort((a, b) => /single/i.test(b.grouping?.displayName) - /single/i.test(a.grouping?.displayName));
    const matches = groups.flatMap((g) => (g.competitions ?? []).map((c) => ({
      id: c.id, draw: g.grouping?.displayName ?? '', date: new Date(c.date), state: c.status?.type?.state, detail: c.status?.type?.shortDetail ?? '',
      round: c.round?.displayName ?? '',
      players: c.competitors.map((x) => ({ name: athlete(x), winner: x.winner === true, sets: (x.linescores ?? []).map((l) => l.value) })),
    })).filter((m) => m.players.length === 2 && m.players.every((x) => x.name && !/^(TBD|\?)$/.test(x.name))));
    return { id: e.id, name: e.name, state: e.status?.type?.state, start: new Date(e.date), end: e.endDate ? new Date(e.endDate) : null, matches };
  });
}

// Golf: leaderboard of the current/most recent tournament.
export async function golfBoard(code) {
  const events = await rawEvents(code);
  if (!events) return null;
  return events.map((e) => {
    const c = e.competitions?.[0] ?? {};
    const players = (c.competitors ?? []).slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .map((x) => ({ name: athlete(x), score: scoreOf(x) ?? '', pos: x.status?.position?.displayName ?? x.order ?? '' }));
    return { id: e.id, name: e.name, state: e.status?.type?.state, detail: e.status?.type?.shortDetail ?? '', start: new Date(e.date), players };
  });
}

// MMA: fight cards; the last competition is the main event.
export async function mmaCards(code) {
  const events = await rawEvents(code);
  if (!events) return null;
  return events.map((e) => ({
    id: e.id, name: e.name, date: new Date(e.date), state: e.status?.type?.state,
    fights: (e.competitions ?? []).map((c) => ({
      weight: c.type?.abbreviation ?? '', state: c.status?.type?.state, detail: c.status?.type?.shortDetail ?? '',
      a: athlete(c.competitors?.[0]), b: athlete(c.competitors?.[1]),
      winner: c.competitors?.find((x) => x.winner)?.athlete?.displayName ?? null,
    })).reverse(),
  }));
}

// Racing (NASCAR, IndyCar): running order of the current/last race.
export async function raceResults(code) {
  const events = await rawEvents(code);
  if (!events) return null;
  return events.map((e) => {
    const c = e.competitions?.[0] ?? {};
    const order = (c.competitors ?? []).slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map((x) => athlete(x));
    return { id: e.id, name: e.name, date: new Date(e.date), state: e.status?.type?.state, detail: e.status?.type?.shortDetail ?? '', order };
  });
}

// Cricket: every live/recent competition ESPN tracks, grouped by league.
export function cricket() {
  return cached('espn:cricket', 180, () => safely(async () => {
    const d = await getJson(`${SITE}/cricket/scorepanel`);
    return (d.scores ?? []).map((s) => ({
      league: s.leagues?.[0]?.name ?? 'Cricket',
      games: (s.events ?? []).map((e) => {
        const c = e.competitions?.[0] ?? {};
        return {
          id: e.id, name: e.name, date: e.date, state: e.status?.type?.state, detail: e.status?.type?.shortDetail ?? e.status?.summary ?? '',
          note: c.status?.summary ?? e.status?.summary ?? '',
          sides: (c.competitors ?? []).map((x) => ({ name: x.team?.shortDisplayName ?? x.team?.displayName ?? '?', score: x.score ?? '' })),
        };
      }),
    })).filter((l) => l.games.length);
  }));
}

// Soccer highlights (Scorebat free feed): best match for two team names.
export function highlights(home, away) {
  return safely(async () => {
    const feed = await cached('scorebat:feed', 900, () => safely(async () =>
      ((await getJson('https://www.scorebat.com/video-api/v3/')).response ?? []).map((m) => ({ title: m.title, url: m.matchviewUrl ?? m.url }))));
    const n = (s) => normalize(s).split(' ').filter((w) => w.length > 2);
    const want = [n(home), n(away)];
    return feed?.find((m) => {
      const t = normalize(m.title);
      return want.every((words) => words.some((w) => t.includes(w)));
    })?.url ?? null;
  });
}
