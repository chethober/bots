// Connecting music accounts.
//
//   Spotify      PKCE in the Mini App: the page makes the verifier/challenge,
//                spotifyStart stores the verifier, Spotify sends the user back to
//                <MINIAPP_URL>/callback.html, and spotifyFinish swaps the code.
//   Apple Music  MusicKit JS in the Mini App returns a Music User Token.
//   YouTube      Google's device flow, right in the chat: the user types a code
//                at google.com/device and taps ✅.
//
// When a login page loses its Mini App session (opened in a browser), it shows
// a `/connect <state> <code>` message to send to the bot instead.

import { db } from 'sdk';
import { and, eq, lt } from 'sdk/db';
import { logins } from '../schema.js';
import { APPLE_MUSIC_DEVELOPER_TOKEN, SPOTIFY_CLIENT_ID } from './config.js';
import { PROVIDERS } from './providers/index.js';
import { saveAccount } from './accounts.js';
import { now, randomId } from './util.js';

const LOGIN_TTL = 30 * 60;

export class LoginError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.code = code;
  }
}

async function newLogin(userId, provider, fields = {}) {
  await db.delete(logins).where(lt(logins.createdAt, now() - LOGIN_TTL)).run();
  await db.delete(logins).where(and(eq(logins.userId, userId), eq(logins.provider, provider))).run();
  const state = randomId(24);
  await db.insert(logins).values({ state, userId, provider, createdAt: now(), ...fields }).run();
  return state;
}

async function takeLogin(userId, state, provider) {
  const row = await db.select().from(logins).where(eq(logins.state, String(state ?? ''))).get();
  if (!row || row.userId !== userId || (provider && row.provider !== provider) || row.createdAt < now() - LOGIN_TTL) {
    throw new LoginError('EXPIRED', 'This login expired. Start it again.');
  }
  return row;
}

const dropLogin = (state) => db.delete(logins).where(eq(logins.state, state)).run();

async function saveWithProfile(userId, providerId, fields) {
  const provider = PROVIDERS[providerId];
  const acct = { userId, provider: providerId, ...fields };
  const { name, extra } = await provider.profile(acct);
  await saveAccount(userId, providerId, { ...fields, accessToken: acct.accessToken, refreshToken: acct.refreshToken ?? null, expiresAt: acct.expiresAt ?? null, name, extra: { ...fields.extra, ...extra } });
  return name;
}

// --- Spotify -----------------------------------------------------------------

export async function spotifyStart(userId, { clientId, challenge, verifier, redirectUri }) {
  const client = String(clientId || SPOTIFY_CLIENT_ID || '').trim();
  if (!/^[0-9a-f]{32}$/i.test(client)) throw new LoginError('CLIENT_ID', 'A Spotify client id is 32 letters and digits.');
  if (!/^https:\/\/[^/\s]+\/callback\.html$/.test(redirectUri ?? '')) throw new LoginError('REDIRECT', 'Bad redirect URI.');
  if (!/^[A-Za-z0-9_.~-]{43,128}$/.test(verifier ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(challenge ?? '')) {
    throw new LoginError('PKCE', 'Bad PKCE values.');
  }
  const state = await newLogin(userId, 'spotify', { verifier, clientId: client, redirectUri });
  return { url: PROVIDERS.spotify.authorizeUrl({ clientId: client, redirectUri, state, challenge }) };
}

export async function spotifyFinish(userId, state, code) {
  const row = await takeLogin(userId, state, 'spotify');
  const tok = await PROVIDERS.spotify.exchangeCode({ clientId: row.clientId, code, redirectUri: row.redirectUri, verifier: row.verifier });
  const name = await saveWithProfile(userId, 'spotify', {
    accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt: Date.now() + tok.expires_in * 1000,
    clientId: row.clientId === SPOTIFY_CLIENT_ID ? null : row.clientId,
  });
  await dropLogin(row.state);
  return { provider: 'spotify', name };
}

// --- Apple Music ---------------------------------------------------------------

export async function appleStart(userId) {
  if (!APPLE_MUSIC_DEVELOPER_TOKEN) throw new LoginError('UNAVAILABLE', 'Apple Music is not set up on this bot.');
  return { developerToken: APPLE_MUSIC_DEVELOPER_TOKEN, state: await newLogin(userId, 'apple') };
}

export async function appleFinish(userId, token, state) {
  if (state) await takeLogin(userId, state, 'apple');
  if (!token || token.length < 20) throw new LoginError('TOKEN', 'Missing Apple Music token.');
  const storefront = await PROVIDERS.apple.verify(token);
  const name = await saveWithProfile(userId, 'apple', { accessToken: token, refreshToken: null, expiresAt: null, extra: { storefront } });
  if (state) await dropLogin(state);
  return { provider: 'apple', name };
}

// --- YouTube Music -------------------------------------------------------------

export async function youtubeStart(userId) {
  const d = await PROVIDERS.youtube.deviceStart();
  const state = await newLogin(userId, 'youtube', { deviceCode: d.device_code });
  return { state, userCode: d.user_code, url: d.verification_url ?? d.verification_uri ?? 'https://www.google.com/device' };
}

/** The connected account's name, or null while the user hasn't entered the code. */
export async function youtubePoll(userId, state) {
  const row = await takeLogin(userId, state, 'youtube');
  const tok = await PROVIDERS.youtube.devicePoll(row.deviceCode);
  if (!tok) return null;
  const name = await saveWithProfile(userId, 'youtube', {
    accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt: Date.now() + tok.expires_in * 1000,
  });
  await dropLogin(row.state);
  return { provider: 'youtube', name };
}

// --- The /connect fallback ------------------------------------------------------

export async function connectFromChat(userId, state, payload) {
  const row = await takeLogin(userId, state);
  if (row.provider === 'spotify') return spotifyFinish(userId, state, payload);
  if (row.provider === 'apple') return appleFinish(userId, payload, state);
  throw new LoginError('EXPIRED');
}
