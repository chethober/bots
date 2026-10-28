// The music services, by id. Each one has the same shape: playlists
// (list/get/find/create/tracks/add), search, links and, for Spotify, the player.

import { spotify } from './spotify.js';
import { youtube } from './youtube.js';
import { apple } from './apple.js';

export const PROVIDERS = { spotify, youtube, apple };
export const PROVIDER_IDS = Object.keys(PROVIDERS);
export const providerOf = (id) => PROVIDERS[id] ?? null;
