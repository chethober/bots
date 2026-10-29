// Apple Music API. The developer token (APPLE_MUSIC_DEVELOPER_TOKEN) is the
// bot's; each user's Music User Token comes from MusicKit JS in the Mini App
// and lasts about six months (there is no refresh: they sign in again).
// Apple lets apps add tracks to library playlists but not remove them.

import { request, ProviderError } from '../http.js';
import { APPLE_MUSIC_DEVELOPER_TOKEN, MINIAPP_URL } from '../config.js';

const P = 'apple';
const HOST = 'https://api.music.apple.com';
const MAX_PLAYLISTS = 200;

const storefront = (acct) => acct.extra?.storefront || 'us';

async function call(acct, method, path, body) {
  const headers = { Authorization: `Bearer ${APPLE_MUSIC_DEVELOPER_TOKEN}` };
  if (acct) headers['Music-User-Token'] = acct.accessToken;
  try {
    return await request(P, HOST + (path.startsWith('/v1') ? path : `/v1${path}`), { method, body, headers });
  } catch (e) {
    if (e instanceof ProviderError && (e.status === 401 || e.status === 403)) {
      throw new ProviderError(P, e.status, 'Apple Music sign-in expired: connect it again.', 'EXPIRED');
    }
    throw e;
  }
}

async function all(acct, path) {
  const out = [];
  let next = path;
  while (next && out.length < 2000) {
    const page = await call(acct, 'GET', next);
    out.push(...(page.data ?? []));
    next = page.next;
  }
  return out;
}

const toTrack = (sf, s) => {
  const id = String(s.attributes?.playParams?.catalogId ?? s.id);
  return { id, title: s.attributes?.name, artist: s.attributes?.artistName, url: `https://music.apple.com/${sf}/song/${id}` };
};

// Catalog (shared) playlists have ids like pl.…; library playlists p.….
const isCatalog = (id) => id.startsWith('pl.');

export const apple = {
  id: P,
  name: 'Apple Music',
  icon: '🍎',
  available: () => Boolean(APPLE_MUSIC_DEVELOPER_TOKEN && MINIAPP_URL),
  canPlay: false,

  /** Check a Music User Token; returns the account's storefront. */
  async verify(token) {
    const data = await call({ accessToken: token }, 'GET', '/me/storefront');
    return data?.data?.[0]?.id ?? 'us';
  },

  async profile(acct) {
    return { name: `Apple Music (${storefront(acct).toUpperCase()})`, extra: acct.extra ?? {} };
  },

  trackUrl: (id) => `https://music.apple.com/us/song/${id}`,
  playlistUrl: (id) => (isCatalog(id) ? `https://music.apple.com/us/playlist/${id}` : 'https://music.apple.com/library/playlists'),

  parsePlaylistLink(text) {
    return /music\.apple\.com\/[^\s]*?\/playlist\/(?:[^/\s?]+\/)?(p(?:l)?\.[A-Za-z0-9_-]+)/.exec(text)?.[1] ?? null;
  },

  async listPlaylists(acct) {
    const items = await all(acct, '/me/library/playlists?limit=100');
    return items.slice(0, MAX_PLAYLISTS).map((p) => ({
      id: p.id, name: p.attributes?.name, total: null, editable: p.attributes?.canEdit !== false,
    }));
  },

  async getPlaylist(acct, id) {
    const path = isCatalog(id) ? `/catalog/${storefront(acct)}/playlists/${id}` : `/me/library/playlists/${id}`;
    const p = (await call(acct, 'GET', path)).data?.[0];
    if (!p) throw new ProviderError(P, 404, 'Playlist not found');
    return { id: p.id, name: p.attributes?.name, editable: !isCatalog(id) && p.attributes?.canEdit !== false };
  },

  async findPlaylistByName(acct, name) {
    const wanted = name.trim().toLowerCase();
    return (await this.listPlaylists(acct)).find((p) => p.editable && p.name?.trim().toLowerCase() === wanted) ?? null;
  },

  async createPlaylist(acct, name, description) {
    const p = (await call(acct, 'POST', '/me/library/playlists', { attributes: { name, description } })).data?.[0];
    return { id: p.id, name: p.attributes?.name ?? name };
  },

  async playlistTracks(acct, id) {
    const sf = storefront(acct);
    const path = isCatalog(id) ? `/catalog/${sf}/playlists/${id}/tracks?limit=100` : `/me/library/playlists/${id}/tracks?limit=100`;
    return (await all(acct, path)).filter((s) => s.type?.endsWith('songs')).map((s) => toTrack(sf, s));
  },

  async addTracks(acct, playlistId, ids) {
    for (let i = 0; i < ids.length; i += 100) {
      await call(acct, 'POST', `/me/library/playlists/${playlistId}/tracks`, {
        data: ids.slice(i, i + 100).map((id) => ({ id, type: 'songs' })),
      });
    }
  },

  /** ❤️ Love the song and add it to the library. */
  async like(acct, id) {
    await call(acct, 'PUT', `/me/ratings/songs/${id}`, { type: 'rating', attributes: { value: 1 } });
    await call(acct, 'POST', `/me/library?ids%5Bsongs%5D=${id}`).catch((e) => console.warn('apple library add failed', e.message));
  },

  async search(acct, { title, artist }) {
    const sf = storefront(acct);
    const term = encodeURIComponent([artist, title].filter(Boolean).join(' '));
    const hit = (await call(acct, 'GET', `/catalog/${sf}/search?types=songs&limit=1&term=${term}`)).results?.songs?.data?.[0];
    return hit ? toTrack(sf, hit) : null;
  },
};
