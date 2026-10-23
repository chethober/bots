// The bot was connected to, edited in, or disconnected from a business account.
import { api } from 'sdk';
import { upsertConnection } from '../lib/store.js';
import { isAllowed } from '../lib/config.js';
import { panelKeyboard, setupButton } from '../lib/ui.js';
import { loadSettingsRow, resolveCredentials } from '../lib/settings.js';
import { localeOf } from '../lib/screen.js';
import { t } from '../lib/strings.js';

export default async function (bc) {
  const conn = await upsertConnection(bc);
  const chat_id = conn.userChatId;
  const locale = await localeOf(conn.userId, bc.user);

  if (!isAllowed(conn.userId)) {
    await api.sendMessage({ chat_id, text: t(locale, 'private') }).catch(() => {});
    return;
  }
  if (!conn.isEnabled) {
    await api.sendMessage({ chat_id, text: t(locale, 'bc_disconnected') }).catch(() => {});
    return;
  }
  const lines = [t(locale, 'bc_connected')];
  if (!conn.canReply) lines.push('', t(locale, 'bc_no_reply'));
  const hasCreds = resolveCredentials(await loadSettingsRow(conn.userId), conn.userId);
  if (!hasCreds) lines.push('', t(locale, 'bc_need_key'));
  lines.push('', t(locale, 'bc_tune'));
  await api.sendMessage({
    chat_id, text: lines.join('\n'), reply_markup: panelKeyboard(locale, hasCreds ? [] : [[setupButton(locale)]]),
  }).catch(() => {});
}
