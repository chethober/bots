// Music links and audio files are recognized in messages.
import assert from 'node:assert/strict';
import { extractRefs, refOfUrl } from '../tgcloud/lib/tracks.js';

const msg = (text, extra = {}) => {
  const entities = [...text.matchAll(/(?:https?:\/\/)?[\w.-]+\.[a-z]{2,}\/\S*/g)].map((m) => ({ type: 'url', offset: m.index, length: m[0].length }));
  return { text, entities, ...extra };
};

assert.deepEqual(refOfUrl('https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=x'),
  { platform: 'spotify', id: '4uLU6hMCjMI75M1A2tKUQC', url: 'https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=x' });
assert.equal(refOfUrl('spotify:track:4uLU6hMCjMI75M1A2tKUQC').url, 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
assert.equal(refOfUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share').id, 'dQw4w9WgXcQ');
assert.equal(refOfUrl('youtu.be/dQw4w9WgXcQ').url, 'https://youtu.be/dQw4w9WgXcQ');
assert.equal(refOfUrl('https://www.youtube.com/watch?list=PL1&v=dQw4w9WgXcQ').platform, 'youtube');
assert.equal(refOfUrl('https://music.apple.com/us/album/never-gonna/1558533900?i=1558534271').id, '1558534271');
assert.equal(refOfUrl('https://music.apple.com/us/song/never-gonna-give-you-up/1558534271').id, '1558534271');
assert.deepEqual(refOfUrl('https://www.deezer.com/track/3135556'), { url: 'https://www.deezer.com/track/3135556' });
assert.deepEqual(refOfUrl('https://song.link/i/1558534271'), { url: 'https://song.link/i/1558534271' });
assert.equal(refOfUrl('https://example.com/page'), null);
assert.equal(refOfUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), null);

const refs = extractRefs(msg('listen https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC and spotify:track:0VjIjW4GlUZAMYd2vXMi3b'));
assert.deepEqual(refs.map((r) => r.id), ['4uLU6hMCjMI75M1A2tKUQC', '0VjIjW4GlUZAMYd2vXMi3b']);
assert.deepEqual(extractRefs({ audio: { title: 'Song', performer: 'Band' } }), [{ query: { title: 'Song', artist: 'Band' } }]);
assert.deepEqual(extractRefs({ audio: { file_name: 'Band_-_Song.mp3' } }), [{ query: { title: 'Song', artist: 'Band' } }]);
assert.deepEqual(extractRefs({ caption: 'x', caption_entities: [{ type: 'text_link', offset: 0, length: 1, url: 'https://youtu.be/dQw4w9WgXcQ' }] })[0].id, 'dQw4w9WgXcQ');
assert.deepEqual(extractRefs(msg('no music here')), []);
console.log('ok: music refs');

// song.link records map a song to each service's id.
import { idFor, metaOf, pageUrl } from '../tgcloud/lib/songlink.js';
const record = {
  entityUniqueId: 'ITUNES_SONG::1558534271',
  entitiesByUniqueId: {
    'ITUNES_SONG::1558534271': { id: '1558534271', type: 'song', title: 'Never Gonna Give You Up', artistName: 'Rick Astley' },
    'SPOTIFY_SONG::4PTG3Z6ehGkBFwjybzWkR8': { id: '4PTG3Z6ehGkBFwjybzWkR8', type: 'song' },
    'YOUTUBE_VIDEO::lYBUbBu4W08': { id: 'lYBUbBu4W08', type: 'song' },
  },
  linksByPlatform: {
    appleMusic: { entityUniqueId: 'ITUNES_SONG::1558534271' },
    spotify: { entityUniqueId: 'SPOTIFY_SONG::4PTG3Z6ehGkBFwjybzWkR8' },
    youtubeMusic: { entityUniqueId: 'YOUTUBE_VIDEO::lYBUbBu4W08' },
  },
};
assert.equal(idFor(record, 'spotify'), '4PTG3Z6ehGkBFwjybzWkR8');
assert.equal(idFor(record, 'youtube'), 'lYBUbBu4W08');
assert.equal(idFor(record, 'apple'), '1558534271');
assert.equal(idFor(null, 'spotify'), null);
assert.deepEqual(metaOf(record), { title: 'Never Gonna Give You Up', artist: 'Rick Astley' });
assert.equal(pageUrl('youtube', 'lYBUbBu4W08'), 'https://song.link/y/lYBUbBu4W08');
console.log('ok: song.link mapping');
