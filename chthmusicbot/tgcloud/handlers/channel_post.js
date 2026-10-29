// handlers/channel_post.js — a post in a channel the bot administers feeds the
// channel's chat → playlist syncs; /playlist, /top, /random and /song answer in the channel.

import { extractRefs } from '../lib/tracks.js';
import { onChatPost } from '../lib/sync.js';
import { onChatCommand, parseCommand } from '../lib/chatcmds.js';

export default async function (post) {
  const command = parseCommand(post.text);
  if (command) return onChatCommand(post, command, 0);
  const refs = extractRefs(post);
  if (refs.length) await onChatPost(post, refs, 0);
  return null;
}
