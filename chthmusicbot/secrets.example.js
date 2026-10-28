// Copy to tgcloud/lib/secrets.js (git-ignored) and fill in what you have.
// Leave a value empty to turn that service off.

// Spotify: an app from https://developer.spotify.com/dashboard with the
// redirect URI <MINIAPP_URL>/callback. Only the client id is needed (the
// login uses PKCE). Users can also bring their own app's client id.
export const SPOTIFY_CLIENT_ID = '';

// YouTube Music: a Google Cloud OAuth client of type "TVs and Limited Input
// devices", with the YouTube Data API v3 enabled.
export const GOOGLE_CLIENT_ID = '';
export const GOOGLE_CLIENT_SECRET = '';

// Apple Music: a MusicKit developer token (an ES256 JWT, valid up to 6 months),
// made with scripts/apple-token.mjs.
export const APPLE_MUSIC_DEVELOPER_TOKEN = '';

// Optional song.link (Odesli) API key for a higher rate limit.
export const SONGLINK_API_KEY = '';
