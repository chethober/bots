// handlers/channel_post.js — a post in a channel the bot administers feeds the
// channel's chat → playlist syncs; /app, /playlist, /top, /random and /song answer in the channel.

import { extractRefs } from '../lib/tracks.js';
import { onChatPost } from '../lib/sync.js';
import { onChatCommand, parseCommand } from '../lib/chatcmds.js';
import { postAppButton } from '../lib/applink.js';
import { fireDueTimers } from '../lib/sleep.js';

export default async function (post) {
  await fireDueTimers();
  const command = parseCommand(post.text);
  if (command?.cmd === 'app') return postAppButton(post, 0);
  if (command) return onChatCommand(post, command, 0);
  const refs = extractRefs(post);
  if (refs.length) await onChatPost(post, refs, 0);
  return null;
}
