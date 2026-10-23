// handlers/inline_query.js — "@chthgamesbot [game] [stake]" in any chat posts a game lobby.

import { api, BotApiError } from 'sdk';
import { ensurePlayer } from '../lib/engine.js';
import { GAMES } from '../lib/games/index.js';
import { nameOf, parseBet } from '../lib/ui.js';
import { WEBAPP_URL } from '../lib/config.js';

export default async function (q) {
  try {
    await answer(q);
  } catch (e) {
    console.error(e);
  }
}

async function answer(q) {
  const me = await ensurePlayer(q.from);
  if (me.banned) return api.answerInlineQuery({ inline_query_id: q.id, results: [], cache_time: 0, is_personal: true });
  const creator = { id: q.from.id, name: nameOf(q.from) };

  const words = q.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const num = words.find((w) => /^\d+$/.test(w));
  const terms = words.filter((w) => w !== num);
  const matches = GAMES.filter((g) =>
    terms.every((t) => g.cmd.includes(t) || g.title.toLowerCase().includes(t) || g.about.toLowerCase().includes(t)));

  const results = await Promise.all((matches.length ? matches : GAMES).map(async (g) => {
    const bet = g.defaultBet ? parseBet(num, g.defaultBet) : 0;
    const lobby = await g.lobby({ creator, bet });
    return {
      type: 'article',
      id: `${g.key}-${bet}`,
      title: bet ? `${g.title} · ${bet} chips` : g.title,
      description: g.about,
      input_message_content: { message_text: lobby.text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
      reply_markup: lobby.markup,
    };
  }));

  // Results carry the querier's id in signed buttons, so they must never be shared.
  const answer = { inline_query_id: q.id, results, cache_time: 0, is_personal: true };
  try {
    await api.answerInlineQuery({ ...answer, button: { text: '🎮 Open game hub', web_app: { url: WEBAPP_URL } } });
  } catch (e) {
    if (!(e instanceof BotApiError)) throw e;
    console.warn('inline answer with hub button failed', e.description);
    await api.answerInlineQuery(answer);
  }
}
