// song.link (Odesli): maps a track link from one service to the others.

import { fetch } from 'sdk';
import { SONGLINK_API_KEY } from './config.js';

const PLATFORMS = {
  spotify: ['spotify'],
  youtube: ['youtubeMusic', 'youtube'],
  apple: ['appleMusic', 'itunes'],
};

/** song.link's rate limit (10 requests a minute without a key) is used up. */
export class SonglinkLimit extends Error {}

/** The song.link record for `url`, or null if it doesn't know the link. Throws SonglinkLimit on 429. */
export async function songlink(url) {
  const key = SONGLINK_API_KEY ? `&key=${encodeURIComponent(SONGLINK_API_KEY)}` : '';
  const res = await fetch(`https://api.song.link/v1-alpha.1/links?userCountry=US&url=${encodeURIComponent(url)}${key}`);
  if (res.status === 429) throw new SonglinkLimit('song.link rate limit');
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/** The track id `provider` uses for the song in a song.link record. */
export function idFor(data, provider) {
  for (const platform of PLATFORMS[provider] ?? []) {
    const uid = data?.linksByPlatform?.[platform]?.entityUniqueId;
    const entity = uid && data.entitiesByUniqueId?.[uid];
    if (entity?.id && (entity.type === 'song' || platform.startsWith('youtube'))) return String(entity.id);
  }
  return null;
}

/** Title and artist of the song a record is about. */
export function metaOf(data) {
  const entity = data?.entitiesByUniqueId?.[data?.entityUniqueId];
  return entity ? { title: entity.title, artist: entity.artistName } : null;
}

// The universal "listen anywhere" page for a provider's track id.
export const SONGLINK_PREFIX = { spotify: 's', youtube: 'y', apple: 'i' };
export const pageUrl = (provider, id) => `https://song.link/${SONGLINK_PREFIX[provider]}/${id}`;
