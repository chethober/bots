// Minimal Spotify Web API client (user-authorized via a stored refresh token).

import { db, fetch } from 'sdk';
import { eq, inArray } from 'sdk/db';
import { settings } from '../schema.js';
import { saveSetting } from './settings.js';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from './config.js';

const API = 'https://api.spotify.com/v1';
const KEYS = ['client_id', 'client_secret', 'refresh_token', 'access_token', 'expires_at'];

export class SpotifyNotConfigured extends Error {}

async function loadSettings() {
  const rows = await db.select().from(settings).where(inArray(settings.key, KEYS)).all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  // Credentials saved via /spotify win over the ones in config.js.
  s.client_id ||= SPOTIFY_CLIENT_ID;
  s.client_secret ||= SPOTIFY_CLIENT_SECRET;
  return s;
}

/** clientId/clientSecret are optional; without them config.js's app is used. */
export async function saveCredentials({ clientId, clientSecret, refreshToken }) {
  if (clientId && clientSecret) {
    await saveSetting('client_id', clientId);
    await saveSetting('client_secret', clientSecret);
  } else {
    await db.delete(settings).where(inArray(settings.key, ['client_id', 'client_secret'])).run();
  }
  await saveSetting('refresh_token', refreshToken);
  await db.delete(settings).where(inArray(settings.key, ['access_token', 'expires_at'])).run();
}

export async function isConfigured() {
  const s = await loadSettings();
  return Boolean(s.client_id && s.client_secret && s.refresh_token);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(str) {
  if (typeof btoa === 'function') return btoa(str);
  let out = '';
  for (let i = 0; i < str.length; i += 3) {
    const [a, b, c] = [str.charCodeAt(i), str.charCodeAt(i + 1), str.charCodeAt(i + 2)];
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
      + (Number.isNaN(b) ? '=' : B64[(n >> 6) & 63])
      + (Number.isNaN(c) ? '=' : B64[n & 63]);
  }
  return out;
}

function form(obj) {
  return Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

async function accessToken(force = false) {
  const s = await loadSettings();
  if (!s.client_id || !s.client_secret || !s.refresh_token) {
    throw new SpotifyNotConfigured('Spotify is not connected yet.');
  }
  if (!force && s.access_token && Number(s.expires_at) > Date.now() + 60_000) return s.access_token;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${base64(`${s.client_id}:${s.client_secret}`)}`,
    },
    body: form({ grant_type: 'refresh_token', refresh_token: s.refresh_token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${data.error_description ?? data.error ?? res.status}`);

  await saveSetting('access_token', data.access_token);
  await saveSetting('expires_at', String(Date.now() + data.expires_in * 1000));
  if (data.refresh_token) await saveSetting('refresh_token', data.refresh_token);
  return data.access_token;
}

async function call(method, path, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(attempt > 0);
    const res = await fetch(path.startsWith('http') ? path : API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && attempt === 0) continue;
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Spotify ${method} ${path} → ${res.status}: ${data?.error?.message ?? ''}`);
    return data;
  }
}

export const trackUri = (id) => `spotify:track:${id}`;

export async function searchTrack({ title, artist }) {
  const q = artist ? `track:${title} artist:${artist}` : title;
  const data = await call('GET', `/search?type=track&limit=1&q=${encodeURIComponent(q)}`);
  const hit = data?.tracks?.items?.[0];
  if (hit) return hit.id;
  if (artist) { // loose fallback
    const loose = await call('GET', `/search?type=track&limit=1&q=${encodeURIComponent(`${artist} ${title}`)}`);
    return loose?.tracks?.items?.[0]?.id ?? null;
  }
  return null;
}

export async function me() {
  return call('GET', '/me');
}

export async function getPlaylist(id) {
  return call('GET', `/playlists/${id}?fields=id,name,external_urls`);
}

export async function findPlaylistByName(name) {
  const wanted = name.trim().toLowerCase();
  let url = '/me/playlists?limit=50';
  while (url) {
    const page = await call('GET', url);
    const hit = page.items.find((p) => p?.name?.trim().toLowerCase() === wanted);
    if (hit) return hit;
    url = page.next;
  }
  return null;
}

export async function createPlaylist(name, isPublic, description) {
  return call('POST', '/me/playlists', { name, public: isPublic, description });
}

export async function setPlaylistDescription(playlistId, description) {
  await call('PUT', `/playlists/${playlistId}`, { description });
}

/** All track URIs in playlist order (local files / episodes skipped). */
export async function playlistTrackUris(playlistId) {
  const uris = [];
  let url = `/playlists/${playlistId}/items?limit=50&additional_types=track&fields=next,items(item(uri,type))`;
  while (url) {
    const page = await call('GET', url);
    for (const it of page.items) {
      const item = it.item ?? it.track;
      if (item?.type === 'track' && item.uri?.startsWith('spotify:track:')) uris.push(item.uri);
    }
    url = page.next;
  }
  return uris;
}

export async function addTracks(playlistId, uris, position) {
  for (let i = 0; i < uris.length; i += 100) {
    const body = { uris: uris.slice(i, i + 100) };
    if (position !== undefined) body.position = position + i;
    await call('POST', `/playlists/${playlistId}/items`, body);
  }
}

export async function removeTracks(playlistId, uris) {
  for (let i = 0; i < uris.length; i += 100) {
    await call('DELETE', `/playlists/${playlistId}/items`, {
      items: uris.slice(i, i + 100).map((uri) => ({ uri })),
    });
  }
}

/**
 * Remove repeated tracks from a playlist, keeping each one at its first position.
 * Spotify removes every occurrence of a URI, so each duplicate is removed and
 * re-inserted once where it first appeared.
 */
export async function dedupePlaylist(playlistId) {
  const list = await playlistTrackUris(playlistId);
  const seen = new Set();
  const dups = [];
  for (const uri of list) {
    if (seen.has(uri) && !dups.includes(uri)) dups.push(uri);
    seen.add(uri);
  }
  let current = [...list];
  for (const uri of dups) {
    const first = current.indexOf(uri);
    await removeTracks(playlistId, [uri]);
    current = current.filter((u) => u !== uri);
    await addTracks(playlistId, [uri], first);
    current.splice(first, 0, uri);
  }
  return { removed: list.length - current.length, tracks: current };
}

export async function resolveFromLink(url) {
  // song.link maps YouTube / Apple Music / Deezer / SoundCloud / Tidal links to Spotify.
  const res = await fetch(`https://api.song.link/v1-alpha.1/links?userCountry=US&url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const uid = data?.linksByPlatform?.spotify?.entityUniqueId; // "SPOTIFY_SONG::<id>"
  return uid?.startsWith('SPOTIFY_SONG::') ? uid.slice('SPOTIFY_SONG::'.length) : null;
}
