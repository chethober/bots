// Finding songs by name with the iTunes Search API (free, no key). Results link
// to their song.link page, which lookup.js reads as an Apple Music id.

import { fetch } from 'sdk';

export async function searchSongs(term, limit = 6) {
  const res = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(term)}`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return (data?.results ?? []).filter((r) => r.trackId).map((r) => ({
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName,
    artwork: r.artworkUrl100,
    url: `https://song.link/i/${r.trackId}`,
  }));
}
