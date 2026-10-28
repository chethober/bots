// handlers/channel_post.js — a post in a channel the bot administers feeds the
// channel's chat → playlist syncs.

import { extractRefs } from '../lib/tracks.js';
import { onChatPost } from '../lib/sync.js';

export default async function (post) {
  const refs = extractRefs(post);
  if (refs.length) await onChatPost(post, refs, 0);
}
