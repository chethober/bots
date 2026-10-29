// What song a music link is, so it can be found on another service.
//
// song.link (Odesli) retired its keyless API in 2026 (it answers 401
// PUBLIC_API_ACCESS_DEPRECATED). With SONGLINK_API_KEY it's still used and
// gives every service's id at once. Without one, each service's own free
// metadata gives the title and artist, and the other services are searched by
// name (tracks.js):
//   Spotify       the track page's og:title / og:description
//   YouTube       oEmbed (title, channel)
//   Apple Music   the iTunes lookup API
//   Deezer        api.deezer.com
//   SoundCloud    oEmbed ("Title by Artist")
//   anything else the page's og:title ("Artist - Title", "Title by Artist")
// song.link's web pages ("Listen anywhere") still work without a key.

import { fetch } from 'sdk';
import { SONGLINK_API_KEY } from './config.js';

/** A lookup service's rate limit is used up for now (backfill.js waits and continues). */
export class LookupLimit extends Error {}

const SONGLINK_PLATFORMS = {
  spotify: ['spotify'],
  youtube: ['youtubeMusic', 'youtube'],
  apple: ['appleMusic', 'itunes'],
};

// The universal "listen anywhere" page for a provider's track id.
export const SONGLINK_PREFIX = { spotify: 's', youtube: 'y', apple: 'i' };
export const pageUrl = (provider, id) => `https://song.link/${SONGLINK_PREFIX[provider]}/${id}`;

/** The id `provider` uses for the song in a lookup record. */
export const idFor = (rec, provider) => rec?.ids?.[provider] ?? null;

/** Title and artist of a lookup record. */
export const metaOf = (rec) => (rec?.title ? { title: rec.title, artist: rec.artist ?? null } : null);

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 429) throw new LookupLimit(`rate limit: ${hostOf(url)}`);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function getPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TelegramBot)', 'Accept-Language': 'en' } });
  if (res.status === 429) throw new LookupLimit(`rate limit: ${hostOf(url)}`);
  if (!res.ok) return null;
  return res.text();
}

const hostOf = (url) => /^https?:\/\/([^/]+)/.exec(url)?.[1] ?? url;

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function meta(html, prop) {
  const m = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i').exec(html ?? '')
    ?? new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i').exec(html ?? '');
  return m ? decode(m[1]).trim() : null;
}

/** "(Official Video)", "[Lyrics]" and the like, which spoil a search. */
export const cleanTitle = (title) => String(title ?? '')
  .replace(/\s*[([][^)\]]*\b(official|video|audio|lyrics?|visualizer|mv|hd|4k|hq)\b[^)\]]*[)\]]/gi, '')
  .replace(/\s+/g, ' ').trim();

/** "Artist - Title" or "Title by Artist" from one string. */
function split(text, artistHint = null) {
  const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(text);
  if (dash) return { artist: dash[1].trim(), title: cleanTitle(dash[2]) };
  const by = /^(.+?)\s+by\s+(.+)$/i.exec(text);
  if (by) return { title: cleanTitle(by[1]), artist: by[2].trim() };
  return { title: cleanTitle(text), artist: artistHint };
}

async function viaSonglink(url) {
  const data = await getJson(`https://api.song.link/v1-alpha.1/links?userCountry=US&key=${encodeURIComponent(SONGLINK_API_KEY)}&url=${encodeURIComponent(url)}`);
  if (!data) return null;
  const ids = {};
  for (const [provider, platforms] of Object.entries(SONGLINK_PLATFORMS)) {
    for (const platform of platforms) {
      const uid = data.linksByPlatform?.[platform]?.entityUniqueId;
      const entity = uid && data.entitiesByUniqueId?.[uid];
      if (entity?.id && (entity.type === 'song' || platform.startsWith('youtube'))) {
        ids[provider] = String(entity.id);
        break;
      }
    }
  }
  const main = data.entitiesByUniqueId?.[data.entityUniqueId];
  return { title: main?.title ?? null, artist: main?.artistName ?? null, ids, music: true };
}

const spotifyMeta = async (id) => {
  const html = await getPage(`https://open.spotify.com/track/${id}`);
  const title = meta(html, 'og:title');
  return title ? { title, artist: meta(html, 'og:description')?.split(' · ')[0] ?? null } : null;
};

async function youtubeMeta(id, url) {
  const o = await getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
  if (!o?.title) return null;
  const channel = String(o.author_name ?? '');
  const topic = / - Topic$/.test(channel);
  // Only music: a random video's title mustn't drag a random song into a playlist.
  const music = topic || /VEVO$/i.test(channel) || /music\.youtube\.com/.test(url) || /\s[-–—]\s/.test(o.title);
  const parsed = topic ? { title: cleanTitle(o.title), artist: channel.replace(/ - Topic$/, '') } : split(o.title, channel);
  return { ...parsed, music };
}

const appleMeta = async (id) => {
  const r = (await getJson(`https://itunes.apple.com/lookup?id=${id}`))?.results?.[0];
  return r?.trackName ? { title: r.trackName, artist: r.artistName ?? null } : null;
};

async function deezerMeta(url) {
  const id = /deezer\.com\/(?:[a-z]{2}\/)?track\/(\d+)/.exec(url)?.[1];
  if (!id) return null;
  const r = await getJson(`https://api.deezer.com/track/${id}`);
  return r?.title ? { title: r.title, artist: r.artist?.name ?? null } : null;
}

async function soundcloudMeta(url) {
  const o = await getJson(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  if (!o?.title) return null;
  // "Track by Uploader"; the track part may itself be "Artist - Track".
  return split(o.title.replace(/\s+by\s+[^]+$/i, ''), o.author_name ?? null);
}

async function pageMeta(url) {
  const html = await getPage(url);
  // A link that ended up on a home page (a removed track) has no song in it.
  const landed = meta(html, 'og:url');
  if (landed && /^https?:\/\/[^/]+\/?$/.test(landed)) return null;
  const title = meta(html, 'og:title') ?? /<title>([^<]*)<\/title>/i.exec(html ?? '')?.[1];
  if (!title) return null;
  return split(decode(title).replace(/\s*[|•·]\s*(SoundCloud|TIDAL|Deezer|Amazon Music|Audiomack|Anghami|Boomplay|Yandex.*)$/i, ''));
}

/**
 * What song `url` is: { title, artist, ids: { spotify?, youtube?, apple? }, music }
 * or null. `ref` is the link's parsed form from tracks.js (platform and id when
 * it's on one of the services). Throws LookupLimit when a service is rate limiting.
 */
export async function lookup(url, ref = {}) {
  if (SONGLINK_API_KEY) {
    const rec = await viaSonglink(url);
    if (rec) return rec;
  }
  // song.link pages carry the service and id: song.link/s/<spotify>, /y/<youtube>, /i/<apple>.
  const page = /song\.link\/([syi])\/([\w-]+)/.exec(url);
  const platform = ref.platform ?? (page && { s: 'spotify', y: 'youtube', i: 'apple' }[page[1]]);
  const id = ref.id ?? page?.[2];
  let found = null;
  if (platform === 'spotify') found = await spotifyMeta(id);
  else if (platform === 'youtube') found = await youtubeMeta(id, url);
  else if (platform === 'apple') found = await appleMeta(id);
  else if (/deezer\.com\/(?:[a-z]{2}\/)?track\//.test(url)) found = await deezerMeta(url);
  else if (/soundcloud\.com\//.test(url)) found = await soundcloudMeta(url);
  else found = await pageMeta(url);
  if (!found?.title) return null;
  return { music: true, ...found, ids: platform ? { [platform]: id } : {} };
}
