// handlers/callback_query.js — language selection from the /language buttons.
import { api } from 'sdk';
import { setLocale, LOCALE_NAMES, localeFor } from '../lib/i18n.js';
import { t } from '../lib/strings.js';

export default async function (q) {
  const data = q.data ?? '';
  if (data.startsWith('lang:')) {
    await setLocale(q.from.id, data.slice(5));
    await api.answerCallbackQuery({ callback_query_id: q.id }).catch(() => {});
    const locale = await localeFor(q.from);
    const text = t(locale, 'language_set', { name: LOCALE_NAMES[locale] ?? locale });
    try {
      await api.editMessageText({ chat_id: q.message.chat.id, message_id: q.message.message_id, text });
    } catch {
      await api.sendMessage({ chat_id: q.from.id, text });
    }
    return;
  }
  await api.answerCallbackQuery({ callback_query_id: q.id }).catch(() => {});
}
