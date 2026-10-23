// Inline buttons: 📊 Status pause/resume, ⚙️ Settings (st:<key>), language
// (lang:<code>), the setup wizard, and relayed-message actions.
import { api } from 'sdk';
import { getSettings, patchSettings, loadSettingsRow, sanitize, resolveCredentials } from '../lib/settings.js';
import { normalizeLocale, LOCALES, LOCALE_NAMES } from '../lib/i18n.js';
import { t } from '../lib/strings.js';
import { getRelay, getConnection, getChat } from '../lib/store.js';
import { promptAnswer, markRelay } from '../lib/relay.js';
import { aiReply } from '../lib/secretary.js';
import { describeAiError } from '../lib/ai.js';
import { isAllowed } from '../lib/config.js';
import { statusView, settingsKeyboard, nextSetting } from '../lib/ui.js';
import { startSetup, cancelSetup } from '../lib/setup.js';
import { localeOf, updateScreen } from '../lib/screen.js';
import { sendHome } from './message.js';

export default async function (q) {
  const answer = (text) => api.answerCallbackQuery({ callback_query_id: q.id, text }).catch(() => {});
  if (!isAllowed(q.from.id)) return answer();
  if (q.data === 'noop') return answer();
  const chatId = q.message?.chat.id ?? q.from.id;
  const locale = await localeOf(q.from.id, q.from);

  if (q.data === 'setup') {
    await answer();
    return startSetup(chatId, q.from.id, locale);
  }
  if (q.data === 'setup_cancel') {
    await cancelSetup(chatId, q.from.id);
    return answer(t(locale, 'setup_cancelled'));
  }
  if (q.data?.startsWith('r:')) return handleRelayButton(q, answer, chatId, locale);

  // A language pick: re-send home so the reply keyboard is relabelled (that also
  // removes the picker).
  if (q.data?.startsWith('lang:')) {
    const code = q.data.slice(5);
    const chosen = LOCALES.includes(code) ? code : normalizeLocale(code);
    await patchSettings(q.from.id, { uiLocale: chosen });
    await answer(t(chosen, 'language_set', { name: LOCALE_NAMES[chosen] ?? chosen }));
    return sendHome(chatId, q.from.id, chosen);
  }

  if (q.data?.startsWith('st:')) {
    const patch = nextSetting(await getSettings(q.from.id), q.data.slice(3));
    if (!patch) return answer();
    const s = await patchSettings(q.from.id, patch);
    await answer();
    if (q.message) {
      const hasCreds = !!resolveCredentials(await loadSettingsRow(q.from.id), q.from.id);
      await api.editMessageReplyMarkup({
        chat_id: chatId, message_id: q.message.message_id, reply_markup: settingsKeyboard(s, hasCreds, locale),
      }).catch(() => {});
    }
    return;
  }

  if (!['pause', 'resume'].includes(q.data)) return answer();

  const enabled = q.data === 'resume';
  await patchSettings(q.from.id, { enabled });
  await answer(t(locale, enabled ? 'resumed' : 'paused'));
  await updateScreen(chatId, q.message?.message_id, await statusView(q.from.id, locale));
}

// ✍️ Reply / 🤖 Let AI answer / 🙈 Ignore under a relayed contact message.
async function handleRelayButton(q, answer, ownerChatId, locale) {
  const [, action, id] = q.data.split(':');
  const relay = await getRelay(q.from.id, Number(id));
  if (!relay) return answer(t(locale, 'too_old'));

  if (action === 'ans') {
    await answer();
    return promptAnswer(relay, ownerChatId, locale);
  }
  if (action === 'ign') {
    await markRelay(relay, 'ignored', ownerChatId, locale);
    return answer(t(locale, 'relay_ignored'));
  }
  if (action === 'ai') {
    const [conn, row, chat] = await Promise.all([
      getConnection(relay.connectionId), loadSettingsRow(q.from.id), getChat(q.from.id, relay.chatId),
    ]);
    const creds = resolveCredentials(row, q.from.id);
    if (!conn?.isEnabled || !chat) return answer(t(locale, 'not_active'));
    if (!creds) return answer(describeAiError({ kind: 'nocreds' }, locale).slice(0, 190));
    await answer(t(locale, 'writing'));
    const s = sanitize(row?.data ?? {});
    const ok = await aiReply({ conn, row, s, creds, chat, contactName: relay.contactName, replyToId: relay.contactMsgId, quote: true });
    if (ok) await markRelay(relay, 'ai', ownerChatId, locale);
  }
}
