// endpoints/backfill — feed old forum posts (read by scripts/backfill.py with a
// user session) through the same logic as live posts. Admins only; duplicates
// are reported, never deleted.

import { EndpointError } from 'sdk';
import { ADMIN_IDS, FORUM_ID } from '../lib/config.js';
import { isConfigured } from '../lib/spotify.js';
import { handleMusic } from '../handlers/message.js';

export default async function ({ messages = [] }, ctx) {
  if (!ADMIN_IDS.includes(ctx.initData?.user?.id)) {
    throw new EndpointError('Admins only', { code: 'FORBIDDEN' });
  }
  if (!(await isConfigured())) {
    throw new EndpointError('Spotify is not connected', { code: 'SPOTIFY_NOT_CONNECTED' });
  }
  const results = [];
  for (const message of messages) {
    if (message.chat?.id !== FORUM_ID || !message.message_thread_id) continue;
    try {
      results.push({ message_id: message.message_id, status: await handleMusic(message, { backfill: true }) });
    } catch (e) {
      results.push({ message_id: message.message_id, status: 'error', error: e.message });
    }
  }
  return { results };
}
