// 🏆 Sports hub. Callback prefix `sp`.
//   sp:g:<group> leagues · sp:l:<code> league menu · sp:sc|fx|st|nw:<code> cards
//   sp:tm:<code>:<page> teams · sp:t:<code>:<id> team card · sp:f:<code>:<id> follow team
//   sp:ta:<code>:<id> team alerts · sp:tl / sp:tt toggles · sp:fl:<code> follow league
//   sp:la:<code> league alerts · sp:ll / sp:lt toggles · sp:my my teams · sp:ft find team
//   sp:f1:<n|d|c|k> F1 views. A trailing `:r` refreshes a card in place.
import {
  GROUPS, LEAGUES, leagueOf, leagueGames, leagueFixtures, gameSummary, standings, news, teams, teamInfo,
  teamGames, searchTeams, tennisMatches, golfBoard, mmaCards, raceResults, cricket, highlights, isHalftime,
} from '../apis/espn.js';
import * as f1 from '../apis/f1.js';
import { listFollows, addFollow, removeFollow, isFollowing, getPrefs, LIMITS } from '../store.js';
import { registerKind, createNotification, listNotifications, deleteNotification, updateParams } from '../notify.js';
import { whenLocal } from '../time.js';
import { btn, menu, show, send, notice, ask, requireManage, pagerRow, homeRow, fits, navRow } from '../ui.js';
import { esc, link, countdown } from '../format.js';

const LEADS = [15, 30, 60, 1440, 0];
const leadLabel = (m) => (m === 0 ? 'off' : m === 1440 ? '1 day' : `${m} min`);
const groupLabel = (g) => GROUPS.find(([k]) => k === g)?.[1] ?? g;
const emojiOf = (lg) => groupLabel(lg.group).split(' ')[0];
const BACK = [btn('⬅️ Sports', 'm:sports')];

// ── entry points ──────────────────────────────────────────────────────────

export async function home(ctx) {
  const follows = [...await listFollows(ctx.chatId, 'team'), ...await listFollows(ctx.chatId, 'league')];
  const rows = [];
  for (let i = 0; i < GROUPS.length; i += 3) rows.push(GROUPS.slice(i, i + 3).map(([g, label]) => btn(label, `sp:g:${g}`)));
  await menu(ctx, {
    text: `🏆 <b>Sports</b>\n\n${follows.length ? `Following: ${follows.map((f) => esc(f.label)).join(', ')}` : 'Follow teams and leagues to get kickoff reminders, live updates and results.'}`,
    keyboard: [[btn('📋 My teams', 'sp:my'), btn('🔎 Find team', 'sp:ft')], ...rows, [btn('🔔 Notifications', 'n:l:sports:0'), btn('🏠 Main menu', 'm:home')]],
  });
}

export const commands = {
  async sports(ctx, args) {
    if (!args.length) return home(ctx);
    const lg = leagueOf(args[0]);
    if (lg) return leagueMenu(ctx, lg.code);
    return findTeams(ctx, args.join(' '));
  },
  async scores(ctx, [code]) {
    if (!code) return home(ctx);
    const lg = leagueOf(code);
    if (!lg) return notice(ctx, `Unknown league <b>${esc(code)}</b>. Try /sports.`);
    return scoresCard(ctx, lg.code, send);
  },
  f1: (ctx) => scoresCard(ctx, 'f1', send),
  myteams: (ctx) => myTeams(ctx, send),
};

export const callbacks = {
  async sp(ctx, [op, a, b, c]) {
    const refresh = [a, b, c].includes('r');
    if (!['f', 'fl', 'tt', 'tl', 'lt', 'll'].includes(op)) await ctx.answer(refresh ? 'Refreshing…' : undefined);
    const out = refresh ? show : send;
    switch (op) {
      case 'g': return groupMenu(ctx, a);
      case 'l': return leagueMenu(ctx, a);
      case 'sc': return scoresCard(ctx, a, out);
      case 'fx': return fixturesCard(ctx, a, out);
      case 'st': return standingsCard(ctx, a, +b || 0, b === undefined ? send : show);
      case 'nw': return newsCard(ctx, a);
      case 'tm': return teamsList(ctx, a, +b || 0);
      case 't': return teamCard(ctx, a, b, out);
      case 'f': return toggleTeam(ctx, a, b);
      case 'ta': return teamAlerts(ctx, a, b);
      case 'tl': case 'tt': return editTeamAlert(ctx, op, a, b, c);
      case 'fl': return toggleLeague(ctx, a);
      case 'la': return leagueAlerts(ctx, a);
      case 'll': case 'lt': return editLeagueAlert(ctx, op, a);
      case 'my': return myTeams(ctx, out);
      case 'ft': return ask(ctx, 'sports.find', '🔎 Which team? e.g. <code>arsenal</code>, <code>lakers</code>, <code>real madrid</code>', { placeholder: 'arsenal' });
      case 'f1': return f1View(ctx, a, out);
    }
  },
};

export const inputs = {
  find: (ctx, text) => findTeams(ctx, text),
};

// ── navigation ────────────────────────────────────────────────────────────

function groupMenu(ctx, group) {
  const leagues = LEAGUES.filter((l) => l.group === group);
  const cols = leagues.length > 8 ? 3 : 2;
  const rows = [];
  for (let i = 0; i < leagues.length; i += cols) rows.push(leagues.slice(i, i + cols).map((l) => btn(l.name, `sp:l:${l.code}`)));
  return menu(ctx, { text: `${groupLabel(group)}\n\nPick a competition:`, keyboard: [...rows, navRow('⬅️ Sports', 'm:sports')] });
}

async function leagueMenu(ctx, code) {
  const lg = leagueOf(code);
  if (!lg) return;
  const following = await isFollowing(ctx.chatId, 'league', lg.code);
  const back = navRow(`⬅️ ${groupLabel(lg.group).replace(/^\S+ /, '')}`, `sp:g:${lg.group}`);
  const follow = btn(following ? '✅ Following' : '⭐ Follow', `sp:fl:${lg.code}`);
  const alertsBtn = following && lg.type !== 'team' && lg.type !== 'cricket' ? [btn('🔔 Alert settings', `sp:la:${lg.code}`)] : [];
  let keyboard;
  if (lg.type === 'team') {
    keyboard = [[btn('📺 Scores', `sp:sc:${lg.code}`), btn('📅 Fixtures', `sp:fx:${lg.code}`), btn('🏆 Table', `sp:st:${lg.code}`)],
      [btn('👥 Teams', `sp:tm:${lg.code}:0`), btn('📰 News', `sp:nw:${lg.code}`), follow], back];
  } else if (lg.type === 'f1') {
    keyboard = [[btn('🏁 Next weekend', 'sp:f1:n'), btn('🏆 Last race', 'sp:sc:f1'), btn('📅 Calendar', 'sp:f1:k')],
      [btn('👤 Drivers', 'sp:f1:d'), btn('🏭 Constructors', 'sp:f1:c'), btn('📰 News', 'sp:nw:f1')], [follow, ...alertsBtn], back];
  } else if (lg.type === 'cricket') {
    keyboard = [[btn('📺 Live & recent', 'sp:sc:cricket')], back];
  } else {
    keyboard = [[btn('📺 Live & results', `sp:sc:${lg.code}`), btn('📰 News', `sp:nw:${lg.code}`)], [follow, ...alertsBtn], back];
  }
  const hint = lg.type === 'team' ? 'Follow a team (👥 Teams) for kickoff reminders and live scores.'
    : lg.type === 'cricket' ? 'Live and recent matches from every competition ESPN tracks.'
      : 'Follow to get a reminder before each event and the result after.';
  return menu(ctx, { text: `${emojiOf(lg)} <b>${esc(lg.name)}</b>\n\n<i>${hint}</i>`, keyboard });
}

// ── cards ─────────────────────────────────────────────────────────────────

function gameLine(g, tz, teamId) {
  const name = (s) => (s.id && s.id === teamId ? `<b>${esc(s.name)}</b>` : esc(s.name));
  const score = `${name(g.home)} ${esc(g.home.score ?? '')}–${esc(g.away.score ?? '')} ${name(g.away)}`;
  if (g.state === 'in') return `🔴 ${score} · <i>${esc(g.detail)}</i>`;
  if (g.state === 'post') return `✅ ${score} · <i>${esc(g.detail || 'FT')}</i>`;
  if (/postpon|cancel|delay/i.test(g.detail)) return `⚠️ ${name(g.home)} vs ${name(g.away)} · <i>${esc(g.detail)}</i>`;
  return `🗓 ${name(g.home)} vs ${name(g.away)} · <i>${whenLocal(g.date, tz)}</i>`;
}

export function pickGames(games, recent = 4, upcoming = 5) {
  const post = games.filter((g) => g.state === 'post').slice(-recent);
  const live = games.filter((g) => g.state === 'in');
  const pre = games.filter((g) => g.state === 'pre').slice(0, upcoming);
  return [...post, ...live, ...pre];
}

async function scoresCard(ctx, code, out) {
  const lg = leagueOf(code);
  if (!lg) return;
  const { tz } = await getPrefs(ctx.chatId);
  const refresh = [btn('🔄 Refresh', `sp:sc:${lg.code}:r`), btn('⬅️ Back', `sp:l:${lg.code}`)];
  const title = `${emojiOf(lg)} <b>${esc(lg.name)}</b>`;
  let lines;
  if (lg.type === 'team') {
    const games = await leagueGames(lg.code, lg.group === 'soccer' || lg.group === 'rugby' ? 2 : 1);
    if (!games) return notice(ctx, '⚠️ ESPN is unavailable right now.');
    lines = pickGames(games, 5, 6).map((g) => gameLine(g, tz));
  } else if (lg.type === 'f1') {
    lines = f1Lines(await f1.status(), tz);
  } else if (lg.type === 'cricket') {
    lines = cricketLines(await cricket());
  } else if (lg.type === 'tennis') {
    lines = tennisLines(await tennisMatches(lg.code), tz);
  } else if (lg.type === 'golf') {
    lines = golfLines(await golfBoard(lg.code), tz);
  } else if (lg.type === 'mma') {
    lines = mmaLines(await mmaCards(lg.code), tz);
  } else {
    lines = racingLines(await raceResults(lg.code), tz);
  }
  if (!lines?.length) lines = ['<i>Nothing on right now.</i>'];
  await out(ctx, { text: [title, '', ...lines].join('\n').slice(0, 4000), keyboard: [refresh] });
}

async function fixturesCard(ctx, code, out) {
  const lg = leagueOf(code);
  const { tz } = await getPrefs(ctx.chatId);
  const games = await leagueFixtures(lg.code, 7);
  if (!games) return notice(ctx, '⚠️ ESPN is unavailable right now.');
  const lines = games.slice(0, 20).map((g) => gameLine(g, tz));
  await out(ctx, {
    text: [`📅 <b>${esc(lg.name)}</b> — next 7 days`, '', ...(lines.length ? lines : ['<i>No fixtures in the next 7 days.</i>'])].join('\n'),
    keyboard: [[btn('🔄 Refresh', `sp:fx:${lg.code}:r`), btn('⬅️ Back', `sp:l:${lg.code}`)]],
  });
}

async function standingsCard(ctx, code, page, out) {
  const lg = leagueOf(code);
  const groups = await standings(lg.code);
  if (!groups?.length) return notice(ctx, `No standings available for ${esc(lg.name)}.`);
  page = Math.min(page, groups.length - 1);
  const g = groups[page];
  const width = (label) => Math.max(4, ...g.rows.map((r) => String(r.cols.find(([l]) => l === label)?.[1] ?? '').length + 1));
  const widths = g.rows[0]?.cols.map(([label]) => width(label)) ?? [];
  const header = g.rows[0]?.cols.map(([label], i) => label.padStart(widths[i])).join('') ?? '';
  const rows = g.rows.slice(0, 24).map((r, i) => `${String(r.rank ?? i + 1).padStart(2)} ${r.team.slice(0, 14).padEnd(14)}${r.cols.map(([, v], j) => String(v).padStart(widths[j])).join('')}`);
  await out(ctx, {
    text: `🏆 <b>${esc(g.name)}</b>\n<pre>${esc(`   ${''.padEnd(14)}${header}\n${rows.join('\n')}`)}</pre>`,
    keyboard: [...pagerRow(page, groups.length, (p) => `sp:st:${lg.code}:${p}`), [btn('⬅️ Back', `sp:l:${lg.code}`)]],
  });
}

async function newsCard(ctx, code) {
  const lg = leagueOf(code);
  const items = await news(lg.code);
  if (!items?.length) return notice(ctx, `No news for ${esc(lg.name)} right now.`);
  await send(ctx, {
    text: [`📰 <b>${esc(lg.name)} news</b>`, '', ...items.map((a) => `• ${link(a.url, a.title)}`)].join('\n'),
    keyboard: [[btn('⬅️ Back', `sp:l:${lg.code}`)]],
  });
}

async function teamsList(ctx, code, page) {
  const lg = leagueOf(code);
  const list = await teams(lg.code);
  if (!list?.length) return notice(ctx, `No team list for ${esc(lg.name)}.`);
  const per = 12;
  const pages = Math.ceil(list.length / per);
  page = Math.min(page, pages - 1);
  const slice = list.slice(page * per, (page + 1) * per);
  const rows = [];
  for (let i = 0; i < slice.length; i += 2) rows.push(slice.slice(i, i + 2).map((t) => btn(t.short ?? t.name, `sp:t:${lg.code}:${t.id}`)));
  await show(ctx, {
    text: `👥 <b>${esc(lg.name)}</b> — pick a team`,
    keyboard: [...rows, ...pagerRow(page, pages, (p) => `sp:tm:${lg.code}:${p}`), [btn('⬅️ Back', `sp:l:${lg.code}`)]],
  });
}

async function teamCard(ctx, code, id, out) {
  const lg = leagueOf(code);
  const [info, games, { tz }, following] = await Promise.all([teamInfo(code, id), teamGames(code, id), getPrefs(ctx.chatId), isFollowing(ctx.chatId, 'team', `${code}:${id}`)]);
  if (!info) return notice(ctx, '⚠️ Team data is unavailable right now.');
  const all = (games ?? []).map((g) => ({ ...g, date: new Date(g.date) }));
  const recent = all.filter((g) => g.state === 'post').slice(-3);
  const live = all.filter((g) => g.state === 'in');
  const next = all.filter((g) => g.state === 'pre').slice(0, 3);
  const lines = [`${emojiOf(lg)} <b>${esc(info.name)}</b> · ${esc(lg.name)}`];
  if (info.standing || info.record) lines.push([info.standing, info.record && `record ${info.record}`].filter(Boolean).map(esc).join(' · '));
  if (live.length) lines.push('', '<b>Live</b>', ...live.map((g) => gameLine(g, tz, id)));
  if (recent.length) lines.push('', '<b>Recent</b>', ...recent.map((g) => gameLine(g, tz, id)));
  if (next.length) lines.push('', '<b>Next</b>', ...next.map((g) => gameLine(g, tz, id)));
  else if (info.next) lines.push('', '<b>Next</b>', gameLine({ ...info.next, date: new Date(info.next.date) }, tz, id));
  await out(ctx, {
    text: lines.join('\n'),
    image: info.logo,
    keyboard: [[btn(following ? '✅ Following' : '⭐ Follow', `sp:f:${code}:${id}`), ...(following ? [btn('🔔 Alerts', `sp:ta:${code}:${id}`)] : [])],
      [btn('🔄', `sp:t:${code}:${id}:r`), btn('⬅️ League', `sp:l:${code}`)]],
  });
}

async function findTeams(ctx, text) {
  const hits = await searchTeams(text);
  if (!hits.length) return notice(ctx, `No team matches <b>${esc(text)}</b>. Browse via /sports → a sport → 👥 Teams.`);
  await send(ctx, {
    text: `🔎 Teams matching <b>${esc(text)}</b>:`,
    keyboard: hits.filter((h) => fits(`sp:t:${h.code}:${h.id}:r`)).map((h) => [btn(`${h.name} · ${leagueOf(h.code).name}`, `sp:t:${h.code}:${h.id}`)]),
  });
}

// ── individual-sport renderers ───────────────────────────────────────────

function f1Lines(s, tz) {
  if (!s) return ['<i>F1 data unavailable.</i>'];
  const out = [];
  if (s.next) out.push(`🏁 Next: <b>${esc(s.next.name)}</b>`, esc(s.next.place), `${whenLocal(s.next.start, tz)} — in <b>${countdown(new Date(s.next.start))}</b>`);
  if (s.last) {
    out.push('', `🏆 Last: <b>${esc(s.last.name)}</b>`);
    const medals = ['🥇', '🥈', '🥉'];
    if (s.last.podium?.length) s.last.podium.forEach((p) => out.push(`${medals[p.pos - 1] ?? p.pos} ${esc(p.driver)} <i>(${esc(p.team)})</i>${p.pos > 1 && p.gap != null ? ` +${p.gap.toFixed(3)}s` : ''}`));
    else out.push('<i>Results not published yet.</i>');
  }
  return out;
}

function cricketLines(leagues) {
  if (!leagues) return null;
  return leagues.slice(0, 6).flatMap((l) => ['', `<b>${esc(l.league)}</b>`, ...l.games.slice(0, 4).map((g) => {
    const icon = g.state === 'in' ? '🔴' : g.state === 'post' ? '✅' : '🗓';
    const sides = g.sides.map((s) => `${esc(s.name)} ${esc(s.score)}`.trim()).join(' v ');
    return `${icon} ${sides}${g.note || g.detail ? `\n   <i>${esc(g.note || g.detail)}</i>` : ''}`;
  })]).slice(1);
}

function tennisLines(events, tz) {
  if (!events) return null;
  const out = [];
  for (const e of events.slice(0, 2)) {
    const live = e.matches.filter((m) => m.state === 'in');
    const done = e.matches.filter((m) => m.state === 'post').sort((a, b) => b.date - a.date);
    const next = e.matches.filter((m) => m.state === 'pre').sort((a, b) => a.date - b.date);
    out.push(`<b>${esc(e.name)}</b>`);
    const line = (m) => {
      const p = m.players.map((x) => `${x.winner ? '<b>' : ''}${esc(x.name)}${x.winner ? '</b>' : ''} ${x.sets.join(' ')}`.trim());
      return `${m.state === 'in' ? '🔴' : m.state === 'post' ? '✅' : '🗓'} ${p.join(' – ')}${m.round ? ` <i>· ${esc(m.round)}</i>` : ''}${m.state === 'pre' ? ` <i>${whenLocal(m.date, tz)}</i>` : ''}`;
    };
    out.push(...[...live, ...done.slice(0, 6 - Math.min(live.length, 6)), ...next.slice(0, 3)].slice(0, 10).map(line), '');
  }
  return out;
}

function golfLines(events, tz) {
  if (!events) return null;
  return events.slice(0, 1).flatMap((e) => [
    `<b>${esc(e.name)}</b> · <i>${esc(e.state === 'pre' ? `starts ${whenLocal(e.start, tz)}` : e.detail)}</i>`,
    ...(e.state === 'pre' ? [] : e.players.slice(0, 10).map((p) => `${esc(String(p.pos)).padEnd(3)} ${esc(p.name)} <b>${esc(p.score)}</b>`)),
  ]);
}

function mmaLines(events, tz) {
  if (!events) return null;
  return events.slice(0, 1).flatMap((e) => [
    `<b>${esc(e.name)}</b>`, `<i>${whenLocal(e.date, tz)}${e.state === 'in' ? ' · live' : ''}</i>`, '',
    ...e.fights.slice(0, 8).map((f) => f.winner
      ? `✅ <b>${esc(f.winner)}</b> def. ${esc(f.winner === f.a ? f.b : f.a)} <i>${esc(f.weight)}</i>`
      : `${f.state === 'in' ? '🔴' : '🥊'} ${esc(f.a)} vs ${esc(f.b)} <i>${esc(f.weight)}</i>`),
  ]);
}

function racingLines(events, tz) {
  if (!events) return null;
  return events.slice(0, 1).flatMap((e) => [
    `<b>${esc(e.name)}</b> · <i>${esc(e.state === 'pre' ? whenLocal(e.date, tz) : e.detail)}</i>`,
    ...(e.state === 'pre' ? [] : e.order.slice(0, 10).map((n, i) => `${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} ${esc(n)}`)),
  ]);
}

async function f1View(ctx, view, out) {
  const { tz } = await getPrefs(ctx.chatId);
  const back = [btn('⬅️ F1', 'sp:l:f1')];
  if (view === 'n') {
    const w = await f1.nextWeekend();
    if (!w) return notice(ctx, '⚠️ F1 schedule unavailable.');
    return out(ctx, { text: [`🏁 <b>${esc(w.name)}</b> (round ${w.round})`, esc(`${w.circuit} — ${w.place}`), '', ...w.sessions.map(([n, t]) => `${Date.parse(t) < Date.now() ? '✅' : '🗓'} ${esc(n)}: ${whenLocal(t, tz)}`)].join('\n'), keyboard: [back] });
  }
  if (view === 'd' || view === 'c') {
    const rows = view === 'd' ? await f1.driverStandings() : await f1.constructorStandings();
    if (!rows) return notice(ctx, '⚠️ Standings unavailable.');
    const table = rows.slice(0, 20).map((r) => `${String(r.pos).padStart(2)} ${r.name.slice(0, 20).padEnd(20)} ${String(r.pts).padStart(5)}`).join('\n');
    return out(ctx, { text: `🏆 <b>${view === 'd' ? 'Drivers' : 'Constructors'}</b>\n<pre>${esc(table)}</pre>`, keyboard: [back] });
  }
  if (view === 'k') {
    const races = await f1.calendar();
    if (!races) return notice(ctx, '⚠️ Calendar unavailable.');
    const now = Date.now();
    return out(ctx, { text: ['📅 <b>F1 calendar</b>', '', ...races.map((r) => `${Date.parse(r.date) < now ? '✅' : '🗓'} ${r.round}. ${esc(r.name)} — ${whenLocal(r.date, tz).split(',')[0]}`)].join('\n'), keyboard: [back] });
  }
}

// ── following & alerts ────────────────────────────────────────────────────

async function followCount(chatId) {
  return (await listFollows(chatId, 'team')).length + (await listFollows(chatId, 'league')).length;
}

async function findRow(chatId, kind, code, team) {
  return (await listNotifications(chatId, 'sports')).find((n) => n.kind === kind && n.params.code === code && (team == null || n.params.team === team)) ?? null;
}

async function toggleTeam(ctx, code, id) {
  if (!(await requireManage(ctx))) return;
  const ref = `${code}:${id}`;
  if (await isFollowing(ctx.chatId, 'team', ref)) {
    await removeFollow(ctx.chatId, 'team', ref);
    const n = await findRow(ctx.chatId, 'team', code, id);
    if (n) await deleteNotification(ctx.chatId, n.id);
    await ctx.answer('Unfollowed');
  } else {
    if (await followCount(ctx.chatId) >= LIMITS.teams) return ctx.answer(`You can follow up to ${LIMITS.teams} teams and leagues.`);
    const info = await teamInfo(code, id);
    const label = info?.short ?? info?.name ?? id;
    await addFollow(ctx.chatId, 'sports', 'team', ref, label, { abbr: info?.abbr }, LIMITS.teams);
    const nid = await createNotification(ctx.chatId, 'sports', 'team', { code, team: id, label, lead: 30, start: true, half: true, final: true, sent: {} });
    await ctx.answer(nid === 'limit' ? 'Followed (notification limit reached — no alerts)' : '⭐ Following — alerts on');
  }
  return teamCard(ctx, code, id, show);
}

async function toggleLeague(ctx, code) {
  if (!(await requireManage(ctx))) return;
  const lg = leagueOf(code);
  if (await isFollowing(ctx.chatId, 'league', code)) {
    await removeFollow(ctx.chatId, 'league', code);
    const n = await findRow(ctx.chatId, 'event', code);
    if (n) await deleteNotification(ctx.chatId, n.id);
    await ctx.answer('Unfollowed');
  } else {
    if (await followCount(ctx.chatId) >= LIMITS.teams) return ctx.answer(`You can follow up to ${LIMITS.teams} teams and leagues.`);
    await addFollow(ctx.chatId, 'sports', 'league', code, lg.name, null, LIMITS.teams);
    if (lg.type !== 'team' && lg.type !== 'cricket') {
      await createNotification(ctx.chatId, 'sports', 'event', { code, label: lg.name, lead: 30, final: true, sent: {} });
      await ctx.answer('⭐ Following — reminders and results on');
    } else {
      await ctx.answer('⭐ Following — shown in My teams and /daily');
    }
  }
  return leagueMenu(ctx, code);
}

async function teamAlerts(ctx, code, id) {
  const n = await findRow(ctx.chatId, 'team', code, id);
  if (!n) return notice(ctx, 'Follow the team first.');
  const p = n.params;
  const mark = (on) => (on ? '✅' : '⬜️');
  await show(ctx, {
    text: `🔔 <b>${esc(p.label)}</b> alerts\n\nKickoff reminder, live start, halftime and full-time score. Checked about every 10 minutes, so reminders are approximate.`,
    keyboard: [
      [btn(`⏰ Reminder: ${leadLabel(p.lead)}`, `sp:tl:${code}:${id}`)],
      [btn(`${mark(p.start)} Start`, `sp:tt:${code}:${id}:start`), btn(`${mark(p.half)} Halftime`, `sp:tt:${code}:${id}:half`), btn(`${mark(p.final)} Final`, `sp:tt:${code}:${id}:final`)],
      [btn(`${n.active ? '⏸ Pause all' : '▶️ Resume'}`, `sp:tt:${code}:${id}:active`)],
      [btn('⬅️ Team', `sp:t:${code}:${id}:r`)],
    ],
  });
}

async function editTeamAlert(ctx, op, code, id, flag) {
  if (!(await requireManage(ctx))) return;
  const n = await findRow(ctx.chatId, 'team', code, id);
  if (!n) return ctx.answer('Follow the team first.');
  await ctx.answer();
  if (flag === 'active') {
    await updateParams(ctx.chatId, n.id, n.params, { active: n.active ? 0 : 1 });
  } else {
    const p = { ...n.params };
    if (op === 'tl') p.lead = LEADS[(LEADS.indexOf(p.lead) + 1) % LEADS.length];
    else if (['start', 'half', 'final'].includes(flag)) p[flag] = !p[flag];
    await updateParams(ctx.chatId, n.id, p);
  }
  return teamAlerts(ctx, code, id);
}

async function leagueAlerts(ctx, code) {
  const n = await findRow(ctx.chatId, 'event', code);
  if (!n) return notice(ctx, 'Follow the competition first.');
  await show(ctx, {
    text: `🔔 <b>${esc(n.params.label)}</b> alerts\n\nA reminder before each event and the result afterwards.`,
    keyboard: [[btn(`⏰ Reminder: ${leadLabel(n.params.lead)}`, `sp:ll:${code}`), btn(`${n.params.final ? '✅' : '⬜️'} Results`, `sp:lt:${code}`)], [btn('⬅️ Back', `sp:l:${code}`)]],
  });
}

async function editLeagueAlert(ctx, op, code) {
  if (!(await requireManage(ctx))) return;
  const n = await findRow(ctx.chatId, 'event', code);
  if (!n) return ctx.answer('Follow the competition first.');
  await ctx.answer();
  const p = { ...n.params };
  if (op === 'll') p.lead = LEADS[(LEADS.indexOf(p.lead) + 1) % LEADS.length];
  else p.final = !p.final;
  await updateParams(ctx.chatId, n.id, p);
  return leagueAlerts(ctx, code);
}

// ── my teams (also used by /daily) ───────────────────────────────────────

// Lines for followed teams/leagues: live, today's and next games, recent results.
export async function myLines(chatId, tz, memo = (k, f) => f()) {
  const [teamsF, leaguesF] = await Promise.all([listFollows(chatId, 'team'), listFollows(chatId, 'league')]);
  if (!teamsF.length && !leaguesF.length) return null;
  const now = Date.now();
  const out = [];
  for (const f of teamsF) {
    const [code, id] = f.ref.split(':');
    const games = ((await memo(`tg:${f.ref}`, () => teamGames(code, id))) ?? []).map((g) => ({ ...g, date: new Date(g.date) }));
    const live = games.find((g) => g.state === 'in');
    const last = games.filter((g) => g.state === 'post').at(-1);
    const next = games.find((g) => g.state === 'pre');
    const pick = live ?? (last && now - last.date < 36 * 3600e3 ? last : next ?? last);
    out.push(pick ? gameLine(pick, tz, id) : `${esc(f.label)} — <i>no games scheduled</i>`);
  }
  for (const f of leaguesF) {
    const lg = leagueOf(f.ref);
    if (!lg) continue;
    if (lg.type === 'team') {
      const games = (await memo(`lg:${lg.code}`, () => leagueGames(lg.code, 1))) ?? [];
      const today = games.filter((g) => g.state === 'in' || Math.abs(new Date(g.date) - now) < 18 * 3600e3).slice(0, 4);
      if (today.length) out.push(`<i>${esc(lg.name)}</i>`, ...today.map((g) => gameLine(g, tz)));
    } else if (lg.type === 'f1') {
      const s = await memo('f1:status', () => f1.status());
      if (s?.next) out.push(`🏎 ${esc(s.next.name)} — ${whenLocal(s.next.start, tz)}`);
    } else {
      const ev = await memo(`ev:${lg.code}`, () => eventsFor(lg));
      const e = ev?.find((x) => x.state === 'in') ?? ev?.find((x) => x.state === 'pre') ?? ev?.[0];
      if (e) out.push(`${emojiOf(lg)} ${esc(e.name)} — ${e.state === 'in' ? 'live' : e.state === 'post' ? 'finished' : whenLocal(e.start, tz)}`);
    }
  }
  return out;
}

async function myTeams(ctx, out) {
  const { tz } = await getPrefs(ctx.chatId);
  const lines = await myLines(ctx.chatId, tz);
  const teamsF = await listFollows(ctx.chatId, 'team');
  const teamBtns = teamsF.filter((f) => fits(`sp:t:${f.ref}:r`)).map((f) => btn(f.label, `sp:t:${f.ref}`));
  const rows = [];
  for (let i = 0; i < teamBtns.length; i += 3) rows.push(teamBtns.slice(i, i + 3));
  await out(ctx, {
    text: ['📋 <b>My teams</b>', '', ...(lines ?? ['<i>You don’t follow anything yet. Use 🔎 Find team or browse a league.</i>'])].join('\n'),
    keyboard: [...rows, [btn('🔎 Find team', 'sp:ft'), btn('🔄', 'sp:my:r')], BACK],
  });
}

// Events of an individual-sport league in a common shape: { id, name, start, state, result() }.
async function eventsFor(lg) {
  if (lg.type === 'f1') {
    const list = (await f1.sessions()) ?? [];
    const names = (await f1.meetingNames()) ?? {};
    return list.filter((s) => ['Race', 'Qualifying', 'Sprint'].includes(s.name)).map((s) => ({
      id: `f1-${s.key}`, name: `${names[s.meeting] ?? s.country} — ${s.name}`, start: s.start, end: s.end, session: s,
      state: Date.parse(s.start) > Date.now() ? 'pre' : Date.parse(s.end) > Date.now() ? 'in' : 'post',
    }));
  }
  const loaders = { tennis: tennisMatches, golf: golfBoard, mma: mmaCards, racing: raceResults };
  const list = (await loaders[lg.type]?.(lg.code)) ?? [];
  return list.map((e) => ({ ...e, start: (e.start ?? e.date).toISOString?.() ?? e.start ?? e.date }));
}

async function resultText(lg, e) {
  if (lg.type === 'f1') {
    if (e.session.name === 'Qualifying') return null;
    const podium = await f1.sessionResult(e.session.key);
    if (!podium) return undefined; // not published yet — try again next run
    return podium.map((p) => `${['🥇', '🥈', '🥉'][p.pos - 1]} ${esc(p.driver)} <i>(${esc(p.team)})</i>`).join('\n');
  }
  if (lg.type === 'racing') return e.order.slice(0, 3).map((n, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(n)}`).join('\n');
  if (lg.type === 'golf') return e.players.slice(0, 3).map((p) => `${esc(String(p.pos))} ${esc(p.name)} <b>${esc(p.score)}</b>`).join('\n');
  if (lg.type === 'mma') return e.fights.filter((f) => f.winner).slice(0, 5).map((f) => `✅ <b>${esc(f.winner)}</b> def. ${esc(f.winner === f.a ? f.b : f.a)}`).join('\n') || null;
  if (lg.type === 'tennis') {
    const final = e.matches.filter((m) => m.state === 'post' && /final/i.test(m.round) && !/semi|quarter/i.test(m.round) && /single/i.test(m.draw))[0];
    const w = final?.players.find((p) => p.winner);
    return w ? `🏆 <b>${esc(w.name)}</b> wins (${esc(final.players.map((p) => p.sets.join(' ')).join(' – '))})` : null;
  }
  return null;
}

// ── notification kinds ────────────────────────────────────────────────────

const SENT_TTL = 4 * 86400e3;

registerKind('team', {
  describe: (n) => {
    const p = n.params;
    const parts = [p.lead ? `⏰ ${leadLabel(p.lead)}` : null, p.start && 'start', p.half && 'HT', p.final && 'FT'].filter(Boolean);
    return `🏟 ${esc(p.label)} — ${parts.join(' · ') || 'no alerts'}`;
  },
  async evaluate(rows, env) {
    const fires = [];
    const now = +env.now;
    for (const n of rows) {
      const p = n.params;
      const lg = leagueOf(p.code);
      if (!lg) continue;
      const games = (await env.memo(`tg:${p.code}:${p.team}`, () => teamGames(p.code, p.team))) ?? [];
      const tz = env.prefsOf(n.chatId).tz;
      const sent = { ...(p.sent ?? {}) };
      const msgs = [];
      const leadMs = (p.lead || 0) * 60000;
      const priming = !p.primed;
      for (const g0 of games) {
        const t = Date.parse(g0.date);
        if (priming) {
          if (g0.state !== 'pre' && t > now - 6 * 3600e3) sent[g0.id] = ['kick', 'start', 'half', 'final'];
          continue;
        }
        if (t < now - 6 * 3600e3 || t > now + Math.max(leadMs, 0) + 20 * 60000) continue;
        const flags = new Set(sent[g0.id] ?? []);
        const vs = `${esc(g0.home.name)} vs ${esc(g0.away.name)}`;
        if (p.lead && g0.state === 'pre' && t > now && t - now <= leadMs + 10 * 60000 && !flags.has('kick')) {
          flags.add('kick');
          const mins = Math.round((t - now) / 60000);
          msgs.push(`⏰ ${vs} — ${mins >= 120 ? `starts ${whenLocal(new Date(t), tz)}` : `starts in about ${mins} min`}`);
        }
        if (t <= now + 5 * 60000 && !flags.has('final')) {
          const g = await env.memo(`sum:${g0.id}`, () => gameSummary(p.code, g0.id));
          if (g) {
            const score = `${esc(g.home.name)} <b>${esc(g.home.score ?? 0)}–${esc(g.away.score ?? 0)}</b> ${esc(g.away.name)}`;
            if (g.state === 'post') {
              if (p.final) {
                const hl = lg.group === 'soccer' ? await highlights(g.home.full ?? g.home.name, g.away.full ?? g.away.name) : null;
                msgs.push(`🏁 ${score} · ${esc(g.detail || 'FT')}${hl ? `\n🎬 ${link(hl, 'Highlights')}` : ''}`);
              }
              ['start', 'half', 'final', 'kick'].forEach((f) => flags.add(f));
            } else if (g.state === 'in') {
              if (!flags.has('start')) { flags.add('start'); if (p.start) msgs.push(`🟢 Started: ${vs}`); }
              if (isHalftime(g) && !flags.has('half')) { flags.add('half'); if (p.half) msgs.push(`⏸ Halftime: ${score}`); }
            }
          }
        }
        sent[g0.id] = [...flags];
      }
      // Forget flags for games that are long over.
      for (const id of Object.keys(sent)) {
        const g = games.find((x) => x.id === id);
        if (!g || now - Date.parse(g.date) > SENT_TTL) delete sent[id];
      }
      if (!priming && JSON.stringify(sent) === JSON.stringify(p.sent ?? {})) continue;
      fires.push({
        n, then: 'touch', patch: { params: { ...p, sent, primed: true } },
        card: msgs.length ? { text: [`${emojiOf(lg)} <b>${esc(p.label)}</b>`, ...msgs].join('\n'), keyboard: [[btn('📋 Team', `sp:t:${p.code}:${p.team}`)]] } : null,
      });
    }
    return fires;
  },
});

registerKind('event', {
  describe: (n) => `🏁 ${esc(n.params.label)} — ${[n.params.lead ? `⏰ ${leadLabel(n.params.lead)}` : null, n.params.final && 'results'].filter(Boolean).join(' · ') || 'no alerts'}`,
  async evaluate(rows, env) {
    const fires = [];
    const now = +env.now;
    for (const n of rows) {
      const p = n.params;
      const lg = leagueOf(p.code);
      if (!lg) continue;
      const events = (await env.memo(`ev:${p.code}`, () => eventsFor(lg))) ?? [];
      const tz = env.prefsOf(n.chatId).tz;
      const sent = { ...(p.sent ?? {}) };
      const msgs = [];
      const leadMs = (p.lead || 0) * 60000;
      const priming = !p.primed;
      for (const e of events) {
        const t = Date.parse(e.start);
        if (Number.isNaN(t) || t < now - 7 * 86400e3 || t > now + leadMs + 20 * 60000) continue;
        if (priming) {
          if (e.state !== 'pre') sent[e.id] = ['kick', 'final'];
          continue;
        }
        const flags = new Set(sent[e.id] ?? []);
        if (p.lead && e.state === 'pre' && t > now && t - now <= leadMs + 10 * 60000 && !flags.has('kick')) {
          flags.add('kick');
          const mins = Math.round((t - now) / 60000);
          msgs.push(`⏰ ${esc(e.name)} — ${mins >= 120 ? `starts ${whenLocal(new Date(t), tz)}` : `starts in about ${mins} min`}`);
        }
        if (e.state === 'post' && !flags.has('final')) {
          const text = p.final ? await resultText(lg, e) : null;
          if (text !== undefined) {
            flags.add('final');
            flags.add('kick');
            if (text) msgs.push(`🏁 <b>${esc(e.name)}</b>\n${text}`);
          }
        }
        sent[e.id] = [...flags];
      }
      for (const id of Object.keys(sent)) if (!events.some((e) => e.id === id && now - Date.parse(e.start) < 10 * 86400e3)) delete sent[id];
      if (!priming && JSON.stringify(sent) === JSON.stringify(p.sent ?? {})) continue;
      fires.push({ n, then: 'touch', patch: { params: { ...p, sent, primed: true } }, card: msgs.length ? { text: [`${emojiOf(lg)} <b>${esc(p.label)}</b>`, ...msgs].join('\n\n'), keyboard: [[btn('📺 Open', `sp:l:${p.code}`)]] } : null });
    }
    return fires;
  },
});

