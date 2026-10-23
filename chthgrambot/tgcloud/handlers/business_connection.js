// The bot was connected to, edited in, or disconnected from a business account.
import { api } from 'sdk';
import { upsertConnection } from '../lib/store.js';
import { isAllowed } from '../lib/config.js';
import { panelKeyboard, setupButton } from '../lib/ui.js';
import { loadSettingsRow, resolveCredentials } from '../lib/settings.js';

export default async function (bc) {
  const conn = await upsertConnection(bc);
  const chat_id = conn.userChatId;

  if (!isAllowed(conn.userId)) {
    await api.sendMessage({ chat_id, text: 'Sorry, this secretary bot is private.' }).catch(() => {});
    return;
  }
  if (!conn.isEnabled) {
    await api.sendMessage({ chat_id, text: '👋 Disconnected. I will no longer answer your chats.' }).catch(() => {});
    return;
  }
  const lines = ['✅ Connected as your Telegram Business secretary.'];
  if (!conn.canReply) {
    lines.push('', '⚠️ I don\'t have permission to reply. Enable "Reply to messages" in Settings → Telegram Business → Chatbots.');
  }
  const hasCreds = resolveCredentials(await loadSettingsRow(conn.userId), conn.userId);
  if (!hasCreds) lines.push('', '🔑 One more step: connect a free Cloudflare AI key so I can write replies.');
  lines.push('', 'Open the panel to tune my mood, emoji style, creativity and more.');
  await api.sendMessage({
    chat_id, text: lines.join('\n'), reply_markup: panelKeyboard(hasCreds ? [] : [[setupButton()]]),
  }).catch(() => {});
}
