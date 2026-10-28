// Spotify Web API, signed in per user with PKCE (no client secret). A user
// can sign in with the bot's app (SPOTIFY_CLIENT_ID) or their own app's client id.

import { request } from '../http.js';
import { authed } from '../accounts.js';
import { formEncode } from '../util.js';
import { MINIAPP_URL, SPOTIFY_CLIENT_ID } from '../config.js';

const P = 'spotify';
const API = 'https://api.spotify.com/v1';
const TOKEN = 'https://accounts.spotify.com/api/token';
const MAX_PLAYLISTS = 200;

export const SCOPES = [
  'playlist-read-private', 'playlist-read-collaborative', 'playlist-modify-private', 'playlist-modify-public',
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
].join(' ');

const clientOf = (acct) => acct.clientId || SPOTIFY_CLIENT_ID;

function refresh(acct) {
  return request(P, TOKEN, {
    method: 'POST',
    form: { grant_type: 'refresh_token', refresh_token: acct.refreshToken, client_id: clientOf(acct) },
  });
}

function call(acct, method, path, body) {
  const url = path.startsWith('http') ? path : API + path;
  return authed(acct, refresh, (token) => request(P, url, { method, body, headers: { Authorization: `Bearer ${token}` } }));
}

const toTrack = (t) => ({
  id: t.id,
  title: t.name,
  artist: (t.artists ?? []).map((a) => a.name).join(', '),
  url: `https://open.spotify.com/track/${t.id}`,
});

export const spotify = {
  id: P,
  name: 'Spotify',
  icon: '🟢',
  // Logins open in the Mini App; without the bot's own app users bring theirs.
  available: () => Boolean(MINIAPP_URL),
  canPlay: true,

  authorizeUrl({ clientId, redirectUri, state, challenge }) {
    return `https://accounts.spotify.com/authorize?${formEncode({
      client_id: clientId, response_type: 'code', redirect_uri: redirectUri, state,
      code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES,
    })}`;
  },

  exchangeCode({ clientId, code, redirectUri, verifier }) {
    return request(P, TOKEN, {
      method: 'POST',
      form: { grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier },
    });
  },

  async profile(acct) {
    const me = await call(acct, 'GET', '/me');
    return { name: me.display_name || me.id, extra: { id: me.id } };
  },

  trackUrl: (id) => `https://open.spotify.com/track/${id}`,
  playlistUrl: (id) => `https://open.spotify.com/playlist/${id}`,

  parsePlaylistLink(text) {
    return /(?:playlist[/:])([A-Za-z0-9]{22})/.exec(text)?.[1] ?? null;
  },

  /** The user's playlists; `editable` = theirs or collaborative. */
  async listPlaylists(acct) {
    const out = [];
    let url = '/me/playlists?limit=50';
    while (url && out.length < MAX_PLAYLISTS) {
      const page = await call(acct, 'GET', url);
      for (const p of page.items ?? []) {
        if (!p) continue;
        out.push({
          id: p.id, name: p.name,
          total: p.items?.total ?? p.tracks?.total ?? null,
          editable: p.collaborative || p.owner?.id === acct.extra?.id,
        });
      }
      url = page.next;
    }
    return out;
  },

  async getPlaylist(acct, id) {
    const p = await call(acct, 'GET', `/playlists/${id}?fields=id,name,owner(id),collaborative`);
    return { id: p.id, name: p.name, editable: p.collaborative || p.owner?.id === acct.extra?.id };
  },

  async findPlaylistByName(acct, name) {
    const wanted = name.trim().toLowerCase();
    return (await this.listPlaylists(acct)).find((p) => p.editable && p.name?.trim().toLowerCase() === wanted) ?? null;
  },

  async createPlaylist(acct, name, description) {
    const p = await call(acct, 'POST', '/me/playlists', { name, description, public: false });
    return { id: p.id, name: p.name };
  },

  /** Every track in playlist order (local files and episodes skipped). */
  async playlistTracks(acct, id) {
    const out = [];
    let url = `/playlists/${id}/items?limit=50&additional_types=track`;
    while (url) {
      const page = await call(acct, 'GET', url);
      for (const it of page.items ?? []) {
        const t = it.item ?? it.track;
        if (t?.type === 'track' && t.id && !t.is_local) out.push(toTrack(t));
      }
      url = page.next;
    }
    return out;
  },

  async addTracks(acct, playlistId, ids) {
    for (let i = 0; i < ids.length; i += 100) {
      await call(acct, 'POST', `/playlists/${playlistId}/items`, { uris: ids.slice(i, i + 100).map((id) => `spotify:track:${id}`) });
    }
  },

  async search(acct, { title, artist }) {
    const q = artist ? `track:${title} artist:${artist}` : title;
    const data = await call(acct, 'GET', `/search?type=track&limit=1&q=${encodeURIComponent(q)}`);
    const hit = data?.tracks?.items?.[0];
    if (hit || !artist) return hit ? toTrack(hit) : null;
    const loose = await call(acct, 'GET', `/search?type=track&limit=1&q=${encodeURIComponent(`${artist} ${title}`)}`);
    return loose?.tracks?.items?.[0] ? toTrack(loose.tracks.items[0]) : null;
  },

  // --- Player (needs Spotify Premium and an active device) ------------------

  /** What's playing and what's next, or null when nothing is. */
  async playerState(acct) {
    const state = await call(acct, 'GET', '/me/player?additional_types=track');
    if (!state) return null;
    const queue = await call(acct, 'GET', '/me/player/queue').catch(() => null);
    return {
      playing: state.is_playing,
      device: state.device?.name,
      track: state.item?.type === 'track' ? toTrack(state.item) : null,
      next: (queue?.queue ?? []).filter((t) => t?.type === 'track').slice(0, 5).map(toTrack),
    };
  },

  async control(acct, action) {
    if (action === 'next') return call(acct, 'POST', '/me/player/next');
    if (action === 'prev') return call(acct, 'POST', '/me/player/previous');
    const state = await call(acct, 'GET', '/me/player');
    return call(acct, 'PUT', state?.is_playing ? '/me/player/pause' : '/me/player/play');
  },

  queue(acct, id) {
    return call(acct, 'POST', `/me/player/queue?uri=${encodeURIComponent(`spotify:track:${id}`)}`);
  },
};
