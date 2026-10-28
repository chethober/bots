// The forum supergroup whose topics are watched.
export const FORUM_ID = -1002906907652;

// Telegram user ids allowed to run admin commands even if they aren't forum admins.
export const ADMIN_IDS = [6330862227];

// Spotify app credentials. /spotify then only needs the refresh token.
// The real values live in the git-ignored tgcloud/lib/secrets.js (see
// secrets.example.js in the project root).
export { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from './secrets.js';

// Default for deleting a post when every track in it is already in the topic's
// playlist. Admins can flip it in ⚙️ Settings; that choice is stored in the DB.
export const DELETE_DUPLICATES = true;

// Default reaction put on a post once its tracks were added. Admins can turn it
// off/on or change the emoji with /reaction; that choice is stored in the DB.
export const ADDED_REACTION = '👌';

// Description of every topic's Spotify playlist.
export const playlistDescription = (topic) => `${topic}@chthbr`;

// Make auto-created playlists public?
export const PUBLIC_PLAYLISTS = false;

// Public source code for this bot (ℹ️ About).
export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chtht2sbot';
