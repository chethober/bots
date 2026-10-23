import { table, integer, text, uniqueIndex } from 'sdk/db';

// Key/value settings: Spotify credentials and the cached access token.
export const settings = table('settings', {
  key:   text('key').primaryKey(),
  value: text('value'),
});

// One row per forum topic → the Spotify playlist it feeds.
export const topics = table('topics', {
  threadId:   integer('thread_id').primaryKey(),
  name:       text('name'),
  playlistId: text('playlist_id'),
});

// Every track known to be in a topic's playlist, so reposts can be detected.
export const tracks = table('tracks', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  threadId:  integer('thread_id').notNull(),
  trackId:   text('track_id').notNull(),
  messageId: integer('message_id'),
  addedAt:   integer('added_at').notNull(),
}, (t) => ({
  topicTrack: uniqueIndex('idx_tracks_topic_track').on(t.threadId, t.trackId),
}));
