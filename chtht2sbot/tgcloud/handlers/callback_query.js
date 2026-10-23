// handlers/callback_query.js — language selection and the ⚙️ Settings toggles (st:<op>).
import { api } from 'sdk';
import { setLocale, LOCALE_NAMES, localeFor } from '../lib/i18n.js';
import { isAdminId, settingsView, toggleSetting } from '../lib/panel.js';
import { t } from '../lib/strings.js';

export default async function (q) {
  const data = q.data ?? '';

  if (data.startsWith('st:')) {
    const locale = await localeFor(q.from);
    if (!(await isAdminId(q.from.id))) {
      await api.answerCallbackQuery({ callback_query_id: q.id, text: t(locale, 'admins_only'), show_alert: true }).catch(() => {});
      return;
    }
    await toggleSetting(data.slice(3));
    await api.answerCallbackQuery({ callback_query_id: q.id }).catch(() => {});
    const { reply_markup } = await settingsView(locale);
    await api.editMessageReplyMarkup({ chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup }).catch(() => {});
    return;
  }

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
