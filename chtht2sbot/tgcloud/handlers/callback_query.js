// handlers/callback_query.js — language selection, the ⚙️ Settings toggles (st:<op>) and
// the About screen's ⭐ Tip buttons (lib/tips.js).
import { api } from 'sdk';
import { setLocale, LOCALE_NAMES, localeFor } from '../lib/i18n.js';
import { isAdminId, sendHome, settingsView, toggleSetting } from '../lib/panel.js';
import { t } from '../lib/strings.js';
import { aboutKeyboard, isTipCallback, onTipCallback } from '../lib/tips.js';
import { SOURCE_URL } from '../lib/config.js';

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

  // A language pick: confirm in the new language, then re-send home so the
  // reply keyboard is relabelled (that also removes the picker).
  if (data.startsWith('lang:')) {
    await setLocale(q.from.id, data.slice(5));
    const locale = await localeFor(q.from);
    await api.answerCallbackQuery({ callback_query_id: q.id, text: t(locale, 'language_set', { name: LOCALE_NAMES[locale] ?? locale }) }).catch(() => {});
    await sendHome(q.from);
    return;
  }

  if (isTipCallback(data)) {
    const locale = await localeFor(q.from);
    return onTipCallback(q, locale, aboutKeyboard(locale, SOURCE_URL));
  }

  await api.answerCallbackQuery({ callback_query_id: q.id }).catch(() => {});
}
