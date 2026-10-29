// Finding the songs a message refers to, and matching them on a service.
//
// A "ref" is what a message carries: a track link on one of the services
// ({ platform, id, url }), any other music link ({ url }), or an audio file's
// tags ({ query: { title, artist } }).

import { lookup, idFor, metaOf, LookupLimit } from './lookup.js';

const PATTERNS = {
  spotify: /(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/,
  youtube: /(?:(?:music|www|m)\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  apple: /music\.apple\.com\/[a-z]{2}\/(?:album\/[^?#\s]*\?(?:[^\s#]*&)?i=(\d+)|song\/(?:[^/?#\s]+\/)?(\d+))/,
};
const OTHER_MUSIC = /(?:deezer\.com|deezer\.page\.link|link\.deezer\.com|soundcloud\.com|on\.soundcloud\.com|tidal\.com|song\.link|album\.link|odesli\.co|music\.amazon\.|amazon\.com\/music|pandora\.com|audiomack\.com|music\.yandex\.|napster\.com|anghami\.com|boomplay\.com)/i;

function messageUrls(message) {
  const text = message.text ?? message.caption ?? '';
  const entities = message.entities ?? message.caption_entities ?? [];
  const urls = [];
  for (const e of entities) {
    // Entity offsets count UTF-16 code units, like JS string indexes.
    if (e.type === 'url') urls.push(text.slice(e.offset, e.offset + e.length));
    if (e.type === 'text_link') urls.push(e.url);
  }
  // spotify:track: URIs aren't recognized as entities.
  for (const m of text.matchAll(/spotify:track:[A-Za-z0-9]{22}/g)) urls.push(m[0]);
  return [...new Set(urls)];
}

/** Title and artist from an audio file's tags, or its file name. */
export function audioQuery(audio) {
  if (audio.title) return { title: audio.title, artist: audio.performer };
  const name = (audio.file_name ?? '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ').trim();
  if (!name) return null;
  const [artist, title] = name.split(/\s+-\s+/, 2);
  return title ? { title, artist } : { title: name };
}

/** The music ref a link is (or null if it isn't one). */
export function refOfUrl(raw) {
  let url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  for (const [platform, re] of Object.entries(PATTERNS)) {
    const m = re.exec(raw);
    if (!m) continue;
    if (raw.startsWith('spotify:')) url = `https://open.spotify.com/track/${m[1]}`;
    return { platform, id: m[1] ?? m[2], url };
  }
  return OTHER_MUSIC.test(raw) ? { url } : null;
}

/** Every music ref in a message, in order. */
export function extractRefs(message) {
  const refs = messageUrls(message).map(refOfUrl).filter(Boolean);
  if (message.audio) {
    const query = audioQuery(message.audio);
    if (query) refs.push({ query });
  }
  return refs;
}

/**
 * The track on `provider` a ref points to: { id, title?, artist? } or null.
 * `memo` (a Map) shares link lookups between the playlists one post feeds.
 * A link on another service is matched by its id when the lookup knows it
 * (song.link with a key), else by searching its title and artist; lookup.js
 * only lets music through, so a random YouTube video doesn't drag a song in.
 * `strict` rethrows LookupLimit instead of giving up on the link.
 */
export async function resolveRef(ref, provider, acct, memo = new Map(), { strict = false } = {}) {
  if (ref.platform === provider.id) return { id: ref.id };
  if (ref.url) {
    const rec = await lookupOnce(ref, memo, strict);
    const id = idFor(rec, provider.id);
    if (id) return { id, ...metaOf(rec) };
    if (!rec?.music || !rec.title) return null;
    const hit = await provider.search(acct, { title: rec.title, artist: rec.artist }).catch(() => null);
    return hit?.id ? { id: hit.id, title: rec.title, artist: rec.artist } : null;
  }
  if (ref.query) return provider.search(acct, ref.query).catch(() => null);
  return null;
}

async function lookupOnce(ref, memo, strict = false) {
  if (!memo.has(ref.url)) {
    try {
      memo.set(ref.url, await lookup(ref.url, ref));
    } catch (e) {
      if (strict && e instanceof LookupLimit) throw e;
      console.warn('lookup failed', ref.url, e.message);
      return null; // not memoized: a later try may work
    }
  }
  return memo.get(ref.url);
}

/** Title and artist of a ref, when they can be known. */
export async function describeRef(ref, memo = new Map()) {
  if (ref.query) return ref.query;
  return metaOf(await lookupOnce(ref, memo));
}

/** A saved song ({ title, artist, url }) on `provider`: by its link first, then by name. */
export async function matchSong(song, provider, acct, memo = new Map()) {
  const ref = (song.url && refOfUrl(song.url)) || { query: { title: song.title, artist: song.artist } };
  const hit = await resolveRef(ref, provider, acct, memo);
  if (hit?.id || !song.title || ref.query) return hit?.id ? hit : null;
  return provider.search(acct, { title: song.title, artist: song.artist }).catch(() => null);
}
