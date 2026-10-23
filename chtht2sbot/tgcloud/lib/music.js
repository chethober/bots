// Find the Spotify track ids a message refers to.

import { resolveFromLink, searchTrack } from './spotify.js';

const SPOTIFY_TRACK = /(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/g;
const OTHER_MUSIC = /(?:youtube\.com|youtu\.be|music\.apple\.com|deezer\.com|deezer\.page\.link|soundcloud\.com|tidal\.com|song\.link|odesli\.co|music\.amazon\.)/i;

function messageUrls(message) {
  const text = message.text ?? message.caption ?? '';
  const entities = message.entities ?? message.caption_entities ?? [];
  const urls = [];
  for (const e of entities) {
    if (e.type === 'url') urls.push(text.slice(e.offset, e.offset + e.length));
    if (e.type === 'text_link') urls.push(e.url);
  }
  // spotify:track: URIs aren't recognized as entities.
  for (const m of text.matchAll(/spotify:track:[A-Za-z0-9]{22}/g)) urls.push(m[0]);
  return [...new Set(urls)];
}

function audioQuery(audio) {
  if (audio.title) return { title: audio.title, artist: audio.performer };
  const name = (audio.file_name ?? '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ').trim();
  if (!name) return null;
  const [artist, title] = name.split(/\s+-\s+/, 2);
  return title ? { title, artist } : { title: name };
}

/** Ordered, de-duplicated list of Spotify track ids found in the message. */
export async function extractTrackIds(message) {
  const ids = [];
  for (const url of messageUrls(message)) {
    const direct = [...url.matchAll(SPOTIFY_TRACK)].map((m) => m[1]);
    if (direct.length) ids.push(...direct);
    else if (OTHER_MUSIC.test(url)) {
      const id = await resolveFromLink(url).catch(() => null);
      if (id) ids.push(id);
    }
  }
  if (message.audio) {
    const q = audioQuery(message.audio);
    const id = q && await searchTrack(q);
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}
