// Formula 1: OpenF1 (sessions, results) + Jolpica (Ergast successor: schedule, standings).
// OpenF1's free tier allows ~3 requests/second, so calls are cached and kept sequential.
import { getJson, safely } from '../http.js';
import { cached } from '../store.js';

const OPENF1 = 'https://api.openf1.org/v1';
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';

// Every non-cancelled session this season (cached 6 h): [{ key, meeting, name, type, start, end, location, country }]
export function sessions(year = new Date().getUTCFullYear()) {
  return cached(`f1:sessions:${year}`, 21600, () => safely(async () =>
    (await getJson(`${OPENF1}/sessions?year=${year}`)).filter((s) => !s.is_cancelled)
      .map((s) => ({ key: s.session_key, meeting: s.meeting_key, name: s.session_name, type: s.session_type, start: s.date_start, end: s.date_end, location: s.location, country: s.country_name }))
      .sort((a, b) => a.start.localeCompare(b.start))));
}

export function meetingNames(year = new Date().getUTCFullYear()) {
  return cached(`f1:meetings:${year}`, 86400, () => safely(async () =>
    Object.fromEntries((await getJson(`${OPENF1}/meetings?year=${year}`)).map((m) => [m.meeting_key, m.meeting_name]))));
}

// Top-3 (or top-N) of a session, with driver names (cached 1 day once available).
export async function sessionResult(sessionKey, top = 3) {
  const key = `f1:result:${sessionKey}:${top}`;
  return cached(key, 86400, () => safely(async () => {
    const results = await getJson(`${OPENF1}/session_result?session_key=${sessionKey}&position%3C=${top}`);
    if (!results.length) return null;
    const drivers = (await safely(() => getJson(`${OPENF1}/drivers?session_key=${sessionKey}`))) ?? [];
    const by = new Map(drivers.map((d) => [d.driver_number, d]));
    return results.filter((r) => r.position >= 1).sort((a, b) => a.position - b.position).map((r) => ({
      pos: r.position, driver: by.get(r.driver_number)?.full_name ?? `#${r.driver_number}`, team: by.get(r.driver_number)?.team_name ?? '',
      gap: typeof r.gap_to_leader === 'number' ? r.gap_to_leader : null,
    }));
  }));
}

// Next race weekend from Jolpica, with session times (cached 1 h).
export function nextWeekend() {
  return cached('f1:next', 3600, () => safely(async () => {
    const r = (await getJson(`${JOLPICA}/current/next.json`)).MRData.RaceTable.Races[0];
    if (!r) return null;
    const at = (x) => (x ? `${x.date}T${x.time ?? '00:00:00Z'}` : null);
    const out = [
      ['Practice 1', at(r.FirstPractice)], ['Practice 2', at(r.SecondPractice)], ['Practice 3', at(r.ThirdPractice)],
      ['Sprint Qualifying', at(r.SprintQualifying ?? r.SprintShootout)], ['Sprint', at(r.Sprint)],
      ['Qualifying', at(r.Qualifying)], ['Race', at(r)],
    ].filter(([, t]) => t);
    return { round: r.round, name: r.raceName, circuit: r.Circuit?.circuitName, place: `${r.Circuit?.Location?.locality}, ${r.Circuit?.Location?.country}`, sessions: out };
  }));
}

export function driverStandings() {
  return cached('f1:drivers', 3600, () => safely(async () =>
    (await getJson(`${JOLPICA}/current/driverstandings.json`)).MRData.StandingsTable.StandingsLists[0]?.DriverStandings
      .map((s) => ({ pos: +s.position, name: `${s.Driver.givenName} ${s.Driver.familyName}`, team: s.Constructors?.[0]?.name ?? '', pts: s.points, wins: s.wins })) ?? null));
}

export function constructorStandings() {
  return cached('f1:constructors', 3600, () => safely(async () =>
    (await getJson(`${JOLPICA}/current/constructorstandings.json`)).MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings
      .map((s) => ({ pos: +s.position, name: s.Constructor.name, pts: s.points, wins: s.wins })) ?? null));
}

export function calendar() {
  return cached('f1:calendar', 21600, () => safely(async () =>
    (await getJson(`${JOLPICA}/current.json`)).MRData.RaceTable.Races.map((r) => ({ round: +r.round, name: r.raceName, date: `${r.date}T${r.time ?? '00:00:00Z'}`, place: r.Circuit?.Location?.country }))));
}

// Next race + last race podium for the F1 card.
export async function status() {
  const [list, names] = await Promise.all([sessions(), meetingNames()]);
  if (!list) return null;
  const now = Date.now();
  const races = list.filter((s) => s.name === 'Race');
  const next = races.find((s) => Date.parse(s.start) > now) ?? null;
  const last = [...races].reverse().find((s) => Date.parse(s.end ?? s.start) < now) ?? null;
  const podium = last ? await sessionResult(last.key) : null;
  const label = (s) => names?.[s.meeting] ?? `${s.country} Grand Prix`;
  return {
    next: next && { name: label(next), place: `${next.location}, ${next.country}`, start: next.start },
    last: last && { name: label(last), place: `${last.location}, ${last.country}`, podium },
  };
}
