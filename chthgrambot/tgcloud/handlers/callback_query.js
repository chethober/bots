// Inline buttons: /status toggles, ⚙️ Settings (st:<key>), setup wizard, and relayed-message actions.
import { api } from 'sdk';
import { getSettings, patchSettings, loadSettingsRow, sanitize, resolveCredentials } from '../lib/settings.js';
import { normalizeLocale, LOCALES, LOCALE_NAMES } from '../lib/i18n.js';
import { t } from '../lib/strings.js';
import { getRelay, getConnection, getChat } from '../lib/store.js';
import { promptAnswer, markRelay } from '../lib/relay.js';
import { aiReply } from '../lib/secretary.js';
import { describeAiError } from '../lib/ai.js';
import { isAllowed } from '../lib/config.js';
import { statusKeyboard, settingsKeyboard, nextSetting } from '../lib/ui.js';
import { startSetup, cancelSetup } from '../lib/setup.js';

export default async function (q) {
  const answer = (text) => api.answerCallbackQuery({ callback_query_id: q.id, text }).catch(() => {});
  if (!isAllowed(q.from.id)) return answer();
  if (q.data === 'noop') return answer();

  if (q.data === 'setup' || q.data === 'setup_cancel') {
    await answer();
    const chatId = q.message?.chat.id ?? q.from.id;
    return q.data === 'setup' ? startSetup(chatId, q.from.id) : cancelSetup(chatId, q.from.id);
  }
  if (q.data?.startsWith('r:')) return handleRelayButton(q, answer);

  if (q.data?.startsWith('lang:')) {
    const code = q.data.slice(5);
    const locale = LOCALES.includes(code) ? code : normalizeLocale(code);
    await patchSettings(q.from.id, { uiLocale: locale });
    await answer();
    const text = t(locale, 'language_set', { name: LOCALE_NAMES[locale] ?? locale });
    if (q.message) {
      await api.editMessageText({ chat_id: q.message.chat.id, message_id: q.message.message_id, text }).catch(() => {});
    } else {
      await api.sendMessage({ chat_id: q.from.id, text }).catch(() => {});
    }
    return;
  }

  if (q.data?.startsWith('st:')) {
    const patch = nextSetting(await getSettings(q.from.id), q.data.slice(3));
    if (!patch) return answer();
    const s = await patchSettings(q.from.id, patch);
    await answer();
    if (q.message) {
      const hasCreds = !!resolveCredentials(await loadSettingsRow(q.from.id), q.from.id);
      await api.editMessageReplyMarkup({
        chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: settingsKeyboard(s, hasCreds),
      }).catch(() => {});
    }
    return;
  }

  if (!['pause', 'resume'].includes(q.data)) return answer();

  const enabled = q.data === 'resume';
  await patchSettings(q.from.id, { enabled });
  await answer(enabled ? 'Auto-replies resumed' : 'Auto-replies paused');
  if (q.message) {
    await api.editMessageReplyMarkup({
      chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: statusKeyboard(enabled),
    }).catch(() => {});
  }
}

// ✍️ Reply / 🤖 Let AI answer / 🙈 Ignore under a relayed contact message.
async function handleRelayButton(q, answer) {
  const [, action, id] = q.data.split(':');
  const ownerChatId = q.message?.chat.id ?? q.from.id;
  const relay = await getRelay(q.from.id, Number(id));
  if (!relay) return answer('This message is too old');

  if (action === 'ans') {
    await answer();
    return promptAnswer(relay, ownerChatId);
  }
  if (action === 'ign') {
    await markRelay(relay, 'ignored', ownerChatId);
    return answer('Ignored');
  }
  if (action === 'ai') {
    const [conn, row, chat] = await Promise.all([
      getConnection(relay.connectionId), loadSettingsRow(q.from.id), getChat(q.from.id, relay.chatId),
    ]);
    const creds = resolveCredentials(row, q.from.id);
    if (!conn?.isEnabled || !chat) return answer('Business connection is not active');
    if (!creds) return answer(describeAiError({ kind: 'nocreds' }).slice(0, 190));
    await answer('Writing a reply…');
    const s = sanitize(row?.data ?? {});
    const ok = await aiReply({ conn, row, s, creds, chat, contactName: relay.contactName, replyToId: relay.contactMsgId, quote: true });
    if (ok) await markRelay(relay, 'ai', ownerChatId);
  }
}
