// handlers/my_chat_member.js — the bot was added to or removed from a chat.
// Groups and channels that add the bot get alerts (it needs to be an admin who
// can post in a channel); removing it, or a user blocking it, turns them off.
// Admins hear about groups and channels coming and going.

import { api } from 'sdk';
import { ADMIN_IDS, MIN_CVSS } from '../lib/config.js';
import { upsertChat, setActive } from '../lib/chats.js';
import { esc } from '../lib/format.js';
import { t } from '../lib/strings.js';

const notifyAdmins = (text) => Promise.all(ADMIN_IDS.map((id) => api.sendMessage({ chat_id: id, text, parse_mode: 'HTML' }).catch(() => {})));

export default async function (update) {
  const { chat } = update;
  const status = update.new_chat_member?.status;
  const wasOut = ['left', 'kicked', undefined].includes(update.old_chat_member?.status);
  const joined = wasOut && (status === 'administrator' || status === 'member');
  const gone = status === 'left' || status === 'kicked';

  if (chat.type === 'private') {
    // A user blocked the bot (kicked) or unblocked it (member); /start handles the rest.
    if (status === 'kicked') await setActive(chat.id, false);
    return;
  }
  if (!joined && !gone) return;

  await upsertChat(chat, { active: joined });
  const what = `${chat.type} <b>${esc(chat.title ?? '—')}</b>${chat.username ? ` @${esc(chat.username)}` : ''} (<code>${chat.id}</code>)`;
  if (joined) {
    await api.sendMessage({ chat_id: chat.id, text: t('en', 'chat_welcome', { min: MIN_CVSS }), parse_mode: 'HTML' })
      .catch((e) => console.warn('cannot post the welcome in', chat.id, e.description));
    await notifyAdmins(`📢 Added to ${what}: it now gets alerts.`);
  } else {
    await notifyAdmins(`🔕 Removed from ${what}: no more alerts there.`);
  }
}
