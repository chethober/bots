// endpoints/chatApp — the chat Mini App (web/chat.html): playlists, the shared
// queue, the group player, the sleep timer and ✨ picks of one chat.
// Input: { op, chat, ... } (see lib/chatapp.js); `chat` is the Mini App's start param.

import { handleChatApp } from '../lib/chatapp.js';
import { caller } from '../lib/miniapp.js';

export default async function (input, ctx) {
  return handleChatApp(caller(ctx), input ?? {});
}
