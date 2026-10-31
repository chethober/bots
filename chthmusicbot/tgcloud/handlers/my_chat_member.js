// handlers/my_chat_member.js — the bot was added to or removed from a chat.
// Syncs in a chat the bot left stay, marked ⚠️, until it's added back.

import { api } from 'sdk';
import { upsertChat } from '../lib/chats.js';
import { localeFor } from '../lib/i18n.js';
import { BOT_USERNAME } from '../lib/config.js';
import { t } from '../lib/strings.js';
import { reportChatMember } from '../lib/report.js';

export default async function (update) {
  await reportChatMember(update);
  const { chat } = update;
  if (chat.type === 'private') return;
  const status = update.new_chat_member?.status;
  const wasOut = ['left', 'kicked', undefined].includes(update.old_chat_member?.status);
  const joined = wasOut && (status === 'administrator' || status === 'member');
  const gone = status === 'left' || status === 'kicked';
  if (!joined && !gone) return;
  await upsertChat(chat, { active: joined });
  if (joined && chat.type !== 'channel') {
    const locale = await localeFor(update.from);
    await api.sendMessage({ chat_id: chat.id, text: t(locale, 'group_welcome', { bot: BOT_USERNAME }) })
      .catch((e) => console.warn('cannot greet', chat.id, e.description));
  }
}
