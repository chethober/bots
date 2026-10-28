// YouTube Music through the YouTube Data API v3 (YouTube Music playlists are
// YouTube playlists). Users sign in with Google's device flow: they type a code
// at google.com/device, so no redirect is needed.
//
// Quota: a project gets 10,000 units a day; adding a video costs 50 and a
// search 100, so tracks are matched through song.link first.

import { request, ProviderError } from '../http.js';
import { authed } from '../accounts.js';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../config.js';

const P = 'youtube';
const API = 'https://www.googleapis.com/youtube/v3';
const TOKEN = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/youtube';
const MAX_PLAYLISTS = 200;

function refresh(acct) {
  return request(P, TOKEN, {
    method: 'POST',
    form: { client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: acct.refreshToken, grant_type: 'refresh_token' },
  });
}

function call(acct, method, path, body) {
  return authed(acct, refresh, (token) => request(P, API + path, { method, body, headers: { Authorization: `Bearer ${token}` } }));
}

// "Artist - Topic" channels are YouTube Music's auto-generated artist channels.
const toTrack = (videoId, snippet) => ({
  id: videoId,
  title: snippet.title,
  artist: (snippet.videoOwnerChannelTitle ?? snippet.channelTitle ?? '').replace(/ - Topic$/, ''),
  url: `https://music.youtube.com/watch?v=${videoId}`,
});

async function pages(acct, path, each) {
  let token = '';
  do {
    const page = await call(acct, 'GET', `${path}&maxResults=50${token ? `&pageToken=${token}` : ''}`);
    if (each(page.items ?? []) === false) return;
    token = page.nextPageToken;
  } while (token);
}

export const youtube = {
  id: P,
  name: 'YouTube Music',
  icon: '🔴',
  available: () => Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
  canPlay: false,

  /** Start a device login: { device_code, user_code, verification_url, expires_in }. */
  deviceStart() {
    return request(P, 'https://oauth2.googleapis.com/device/code', { method: 'POST', form: { client_id: GOOGLE_CLIENT_ID, scope: SCOPE } });
  },

  /** Token JSON once the user entered the code; null while they haven't yet. */
  async devicePoll(deviceCode) {
    try {
      return await request(P, TOKEN, {
        method: 'POST',
        form: {
          client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        },
      });
    } catch (e) {
      if (e instanceof ProviderError && ['authorization_pending', 'slow_down'].includes(e.reason)) return null;
      throw e;
    }
  },

  async profile(acct) {
    const data = await call(acct, 'GET', '/channels?part=snippet&mine=true');
    return { name: data.items?.[0]?.snippet?.title ?? 'YouTube', extra: {} };
  },

  trackUrl: (id) => `https://music.youtube.com/watch?v=${id}`,
  playlistUrl: (id) => `https://music.youtube.com/playlist?list=${id}`,

  parsePlaylistLink(text) {
    return /[?&]list=([A-Za-z0-9_-]{10,})/.exec(text)?.[1] ?? null;
  },

  async listPlaylists(acct) {
    const out = [];
    await pages(acct, '/playlists?part=snippet,contentDetails&mine=true', (items) => {
      for (const p of items) out.push({ id: p.id, name: p.snippet?.title, total: p.contentDetails?.itemCount ?? null, editable: true });
      return out.length < MAX_PLAYLISTS;
    });
    return out;
  },

  async getPlaylist(acct, id) {
    const p = (await call(acct, 'GET', `/playlists?part=snippet&id=${encodeURIComponent(id)}`)).items?.[0];
    if (!p) throw new ProviderError(P, 404, 'Playlist not found');
    const mine = (await call(acct, 'GET', '/channels?part=id&mine=true')).items?.[0]?.id;
    return { id: p.id, name: p.snippet.title, editable: p.snippet.channelId === mine };
  },

  async findPlaylistByName(acct, name) {
    const wanted = name.trim().toLowerCase();
    return (await this.listPlaylists(acct)).find((p) => p.name?.trim().toLowerCase() === wanted) ?? null;
  },

  async createPlaylist(acct, name, description) {
    const p = await call(acct, 'POST', '/playlists?part=snippet,status', {
      snippet: { title: name, description }, status: { privacyStatus: 'private' },
    });
    return { id: p.id, name: p.snippet.title };
  },

  async playlistTracks(acct, id) {
    const out = [];
    await pages(acct, `/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(id)}`, (items) => {
      for (const it of items) {
        const videoId = it.contentDetails?.videoId;
        const s = it.snippet ?? {};
        if (videoId && s.title !== 'Deleted video' && s.title !== 'Private video') out.push(toTrack(videoId, s));
      }
    });
    return out;
  },

  async addTracks(acct, playlistId, ids) {
    for (const videoId of ids) {
      await call(acct, 'POST', '/playlistItems?part=snippet', {
        snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
      });
    }
  },

  async search(acct, { title, artist }) {
    const q = encodeURIComponent([artist, title].filter(Boolean).join(' '));
    const hit = (await call(acct, 'GET', `/search?part=snippet&type=video&videoCategoryId=10&maxResults=1&q=${q}`)).items?.[0];
    return hit ? toTrack(hit.id.videoId, hit.snippet) : null;
  },
};
