// handlers/callback_query.js — language selection and the settings reaction toggle.
import { api } from 'sdk';
import { setLocale, LOCALE_NAMES, localeFor, languageKeyboard } from '../lib/i18n.js';
import { getSetting, saveSetting } from '../lib/settings.js';
import { ADDED_REACTION, SOURCE_URL } from '../lib/config.js';
import { t } from '../lib/strings.js';

async function reaction() {
  const enabled = (await getSetting('reaction_enabled')) !== '0';
  return { enabled, emoji: (await getSetting('reaction_emoji')) || ADDED_REACTION };
}

// Rebuild the ⚙️ Settings inline keyboard (language + reaction toggle + source).
async function settingsKeyboard(locale) {
  const { enabled, emoji } = await reaction();
  const rows = languageKeyboard().inline_keyboard.slice();
  rows.push([{ text: enabled ? t(locale, 'reaction_on', { emoji }) : t(locale, 'reaction_off'), callback_data: 'react:toggle' }]);
  rows.push([{ text: t(locale, 'source'), url: SOURCE_URL }]);
  return { inline_keyboard: rows };
}

export default async function (q) {
  const data = q.data ?? '';

  if (data === 'react:toggle') {
    const { enabled } = await reaction();
    await saveSetting('reaction_enabled', enabled ? '0' : '1');
    await api.answerCallbackQuery({ callback_query_id: q.id }).catch(() => {});
    const locale = await localeFor(q.from);
    await api.editMessageReplyMarkup({
      chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: await settingsKeyboard(locale),
    }).catch(() => {});
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
