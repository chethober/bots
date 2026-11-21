// ✨ Picks for a chat, from what it plays. No account or key needed: the
// Deezer API (free, keyless) knows each artist's related artists and top
// tracks, with 30-second previews.
//
//   1. The chat's seeds (its playlists' newest tracks and its queue) give its
//      artists, weighted by how often and how recently they come up.
//   2. Each top artist's related artists are scored by how many seed artists
//      point to them, and how high up.
//   3. The best related artists' top tracks, one artist after another, with a
//      deeper cut by one of the chat's own artists every third pick.
//   4. Songs the chat already has are left out, two picks per artist at most.
//
// A chat with nothing to go on gets Deezer's chart. Picks are cached per chat
// for an hour (settings), so opening the tab doesn't cost 20 requests each time.

import { fetch } from 'sdk';
import { cleanTitle } from './lookup.js';
import { getSetting, saveSetting } from './settings.js';
import { now } from './util.js';

const DEEZER = 'https://api.deezer.com';
const SEED_ARTISTS = 5;
const RELATED_ARTISTS = 8;
const PER_ARTIST = 2;
const LIMIT = 20;
export const RECS_TTL = 3600;
export const RECS_REFRESH = 60; // 🔄 at most once a minute per chat

async function dz(path) {
  try {
    const res = await fetch(DEEZER + path, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch (e) {
    console.warn('deezer failed', path, e.message);
    return [];
  }
}

/** The first artist of "A, B & C feat. D". */
export const mainArtist = (artist) => String(artist ?? '')
  .split(/\s*(?:,|&|;|\/|\bfeat\.?\s|\bft\.?\s|\bx\s|\bwith\s)\s*/i)[0]
  .replace(/\s+-\s+Topic$/i, '').trim();

/** Same song, whatever the service calls it. */
export const songKey = (title, artist) => `${cleanTitle(title).toLowerCase().replace(/\s*[([].*$/, '')}|${mainArtist(artist).toLowerCase()}`;

/** Artists by weight: each seed counts, newer ones (later in the list) a bit more. */
export function topArtists(seeds, n = SEED_ARTISTS) {
  const weights = new Map();
  seeds.forEach((s, i) => {
    const name = mainArtist(s.artist);
    if (!name) return;
    const k = name.toLowerCase();
    const w = weights.get(k) ?? { name, weight: 0 };
    w.weight += 1 + i / Math.max(1, seeds.length);
    weights.set(k, w);
  });
  return [...weights.values()].sort((a, b) => b.weight - a.weight).slice(0, n);
}

const toPick = (t, reason, because = null) => ({
  title: t.title_short || t.title,
  artist: t.artist?.name ?? null,
  url: t.link || `https://www.deezer.com/track/${t.id}`,
  artwork: t.album?.cover_medium ?? t.album?.cover ?? null,
  preview: t.preview || null,
  reason,
  because,
});

/** Round-robin over lists, so one artist doesn't fill the page. */
function interleave(lists) {
  const out = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

/**
 * Up to `limit` picks for these seeds ([{ title, artist }], oldest first):
 * { title, artist, url, artwork, preview, reason: similar | more | trending, because }.
 */
export async function recommend(seeds, { limit = LIMIT, exclude = [] } = {}) {
  const known = new Set([...seeds, ...exclude].map((s) => songKey(s.title, s.artist)));
  const perArtist = new Map();
  const out = [];
  const take = (pick) => {
    const k = songKey(pick.title, pick.artist);
    const a = mainArtist(pick.artist).toLowerCase();
    if (!pick.title || known.has(k) || (perArtist.get(a) ?? 0) >= PER_ARTIST || out.length >= limit) return;
    known.add(k);
    perArtist.set(a, (perArtist.get(a) ?? 0) + 1);
    out.push(pick);
  };

  const top = topArtists(seeds);
  const found = (await Promise.all(top.map(async (a) => {
    const [hit] = await dz(`/search/artist?limit=1&q=${encodeURIComponent(a.name)}`);
    return hit ? { id: hit.id, name: hit.name, weight: a.weight } : null;
  }))).filter(Boolean);

  if (found.length) {
    const seedIds = new Set(found.map((a) => a.id));
    const scores = new Map();
    const related = await Promise.all(found.map((a) => dz(`/artist/${a.id}/related?limit=12`)));
    related.forEach((list, i) => list.forEach((r, rank) => {
      if (!r?.id || seedIds.has(r.id)) return;
      const s = scores.get(r.id) ?? { id: r.id, name: r.name, score: 0, because: found[i].name };
      s.score += found[i].weight * (1 - rank / 15);
      scores.set(r.id, s);
    }));
    const picks = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, RELATED_ARTISTS);
    const [similar, more] = await Promise.all([
      Promise.all(picks.map((p) => dz(`/artist/${p.id}/top?limit=4`).then((ts) => ts.map((t) => toPick(t, 'similar', p.because))))),
      Promise.all(found.slice(0, 3).map((a) => dz(`/artist/${a.id}/top?limit=10`).then((ts) => ts.map((t) => toPick(t, 'more', a.name))))),
    ]);
    const fresh = interleave(similar);
    const deep = interleave(more);
    while ((fresh.length || deep.length) && out.length < limit) {
      for (let i = 0; i < 2 && fresh.length; i++) take(fresh.shift());
      if (deep.length) take(deep.shift());
    }
  }
  if (out.length < limit / 2) {
    for (const t of await dz('/chart/0/tracks?limit=30')) take(toPick(t, 'trending'));
  }
  return out;
}

const cacheKey = (chatId, threadId) => `recs:${chatId}:${threadId}`;

/** The chat's cached picks, or new ones (`refresh`, or when the hour is up). */
export async function chatPicks(chatId, threadId, seedsOf, { refresh = false } = {}) {
  let cached = null;
  try { cached = JSON.parse(await getSetting(cacheKey(chatId, threadId)) ?? 'null'); } catch { /* stale format */ }
  const age = cached ? now() - cached.at : Infinity;
  if (cached && (age < (refresh ? RECS_REFRESH : RECS_TTL))) return cached;
  const { seeds, exclude } = await seedsOf();
  const items = await recommend(seeds, { exclude });
  const fresh = { at: now(), seeds: seeds.length, items };
  await saveSetting(cacheKey(chatId, threadId), JSON.stringify(fresh));
  return fresh;
}
