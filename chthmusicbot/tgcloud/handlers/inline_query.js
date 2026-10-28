// handlers/inline_query.js — "@bot <song>" anywhere: songs found by name, each
// sent as a link. In a group with a player the link is queued, and in a synced
// chat it's added to the playlist, like any posted link.
// Inline mode must be turned on in @BotFather (/setinline).

import { api } from 'sdk';
import { searchSongs } from '../lib/itunes.js';
import { localeFor } from '../lib/i18n.js';
import { t } from '../lib/strings.js';
import { esc } from '../lib/util.js';

export default async function (q) {
  const locale = await localeFor(q.from);
  const query = (q.query ?? '').trim();
  const results = query.length < 2 ? [] : (await searchSongs(query, 10)).map((s, i) => ({
    type: 'article',
    id: String(i),
    title: s.title,
    description: [s.artist, s.album].filter(Boolean).join(' · '),
    thumbnail_url: s.artwork,
    input_message_content: {
      message_text: `🎵 <b>${esc(s.title)}</b> — ${esc(s.artist)}\n${s.url}`,
      parse_mode: 'HTML',
    },
  }));
  await api.answerInlineQuery({
    inline_query_id: q.id,
    results,
    cache_time: 300,
    is_personal: false,
    button: { text: t(locale, 'inline_open_bot'), start_parameter: 'find' },
  });
}
