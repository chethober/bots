// handlers/inline_query.js — "@bot" typed in any chat: share your anonymous link.
// Whatever is typed after "@bot" becomes the invitation text — unless it's a
// 📣 Answer publicly query ("❓ question 💬 answer", lib/answer.js), which becomes a
// question-and-answer card. Needs inline mode switched on in BotFather (/setinline).

import { api } from 'sdk';
import { parseAnswerQuery } from '../lib/answer.js';
import { textsFor } from '../lib/chats.js';
import { getOrCreateUser } from '../lib/users.js';
import { personalLink } from '../lib/util.js';

const MAX_QUERY = 200;

export default async function (q, ctx) {
  try {
    const L = await textsFor(q.from);
    const user = await getOrCreateUser(q.from);
    const link = await personalLink(user.code);
    const custom = (q.query ?? '').trim().slice(0, MAX_QUERY);
    const button = { inline_keyboard: [[{ text: L.btnSendAnon(user), url: link }]] };

    const article = (id, title, description, text) => ({
      type: 'article',
      id,
      title,
      description,
      input_message_content: { message_text: text, link_preview_options: { is_disabled: true } },
      reply_markup: button,
    });

    const results = [];
    const qa = parseAnswerQuery(q.query);
    if (qa) {
      results.push(qa.answer
        ? article('answer', L.inlineAnswerTitle, qa.answer, L.answerCard(qa.question, qa.answer))
        : article('question', L.inlineQuestionTitle, L.inlineAnswerHint, L.answerCard(qa.question, '')));
    } else if (custom) results.push(article('custom', L.inlineCustomTitle, custom, custom));
    const inviteDesc = user.paused ? L.inlinePaused : L.invitation(user);
    results.push(article('invite', L.inlineShareTitle, inviteDesc, L.inlineInvite(user)));
    results.push(article('link', L.inlineLinkTitle, link, link));

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
