// handlers/inline_query.js — "@bot" typed in any chat: share your anonymous link.
// Whatever is typed after "@bot" becomes the invitation text. Needs inline mode
// switched on in BotFather (/setinline).

import { api } from 'sdk';
import { T, invitation } from '../lib/texts.js';
import { getOrCreateUser } from '../lib/users.js';
import { personalLink } from '../lib/util.js';

const MAX_QUERY = 200;

export default async function (q, ctx) {
  try {
    const user = await getOrCreateUser(q.from);
    const link = await personalLink(user.code);
    const custom = (q.query ?? '').trim().slice(0, MAX_QUERY);
    const button = { inline_keyboard: [[{ text: T.btnSendAnon(user), url: link }]] };

    const article = (id, title, description, text) => ({
      type: 'article',
      id,
      title,
      description,
      input_message_content: { message_text: text, link_preview_options: { is_disabled: true } },
      reply_markup: button,
    });

    const results = [];
    if (custom) results.push(article('custom', T.inlineCustomTitle, custom, custom));
    const inviteDesc = user.paused ? T.inlinePaused : invitation(user);
    results.push(article('invite', T.inlineShareTitle, inviteDesc, T.inlineInvite(user)));
    results.push(article('link', T.inlineLinkTitle, link, link));

    await api.answerInlineQuery({
      inline_query_id: q.id,
      results,
      is_personal: true,
      cache_time: 10,
    });
  } catch (e) {
    // 400 "query is too old" just means the user moved on.
    console.warn(`inline_query failed: ${e.code ?? ''} ${e.description ?? e.message}`);
  }
}
