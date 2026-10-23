// Private chat between a user and the bot itself: reply-keyboard buttons, the
// setup wizard, answers to relayed messages, style samples and a preview
// playground. /start is the only command; everything else is a button.
import { api } from 'sdk';
import { PANEL_URL, isAllowed, SOURCE_URL } from '../lib/config.js';
import { t } from '../lib/strings.js';
import { normalizeLocale, languageKeyboard } from '../lib/i18n.js';
import { getSettings, loadSettingsRow, resolveCredentials } from '../lib/settings.js';
import { addSamples, countSamples, findRelayByOwnerMessage } from '../lib/store.js';
import { previewReply } from '../lib/secretary.js';
import { describeAiError } from '../lib/ai.js';
import { panelKeyboard, setupButton, settingsKeyboard, statusView } from '../lib/ui.js';
import { startSetup, handleSetupInput } from '../lib/setup.js';
import { deliverAnswer } from '../lib/relay.js';
import { drop, localeOf, mainKeyboard, matchButton, showHome, showScreen } from '../lib/screen.js';

export default async function (message) {
  if (message.chat.type !== 'private' || !message.from) return;
  const userId = message.from.id;
  const chat_id = message.chat.id;
  const send = (text, extra = {}) => api.sendMessage({ chat_id, text, ...extra });
  const screen = (text, extra = {}) => showScreen(chat_id, { text, ...extra });

  if (!isAllowed(userId)) return send(t(normalizeLocale(message.from.language_code), 'private'));

  const locale = await localeOf(userId, message.from);
  const text = message.text ?? '';
  const cmd = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : null;

  // Reply-keyboard buttons; the tap itself is deleted.
  const button = matchButton(text);
  if (button) {
    await drop(chat_id, message.message_id);
    switch (button) {
      case 'status':
        return showScreen(chat_id, await statusView(userId, locale));
      case 'settings': {
        const [s, row] = await Promise.all([getSettings(userId), loadSettingsRow(userId)]);
        return screen(t(locale, 'settings_title'), { reply_markup: settingsKeyboard(s, !!resolveCredentials(row, userId), locale) });
      }
      case 'learn': {
        const [n, s] = await Promise.all([countSamples(userId), getSettings(userId)]);
        const hint = s.voice === 'me' ? '' : t(locale, 'learn_hint');
        return screen(t(locale, 'learn', { n, hint }), { reply_markup: panelKeyboard(locale) });
      }
      case 'setup':
        return startSetup(chat_id, userId, locale);
      case 'language':
        return screen(t(locale, 'choose_language'), { reply_markup: languageKeyboard() });
      case 'help':
        return screen(t(locale, 'help'));
      case 'source':
        return screen(t(locale, 'source_here'), { reply_markup: { inline_keyboard: [[{ text: t(locale, 'kb_source'), url: SOURCE_URL }]] } });
    }
  }

  // A reply to a relayed contact message is the answer to send back to them.
  if (message.reply_to_message && !cmd) {
    const relay = await findRelayByOwnerMessage(userId, message.reply_to_message.message_id);
    if (relay) return deliverAnswer(relay, message, locale);
  }

  // Forwarding your own messages teaches the "speak as me" style.
  if (message.forward_origin) {
    const o = message.forward_origin;
    const fullName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ');
    const mine = (o.type === 'user' && o.sender_user?.id === userId)
      || (o.type === 'hidden_user' && o.sender_user_name === fullName);
    if (!mine) return screen(t(locale, 'forward_not_mine'));
    const added = await addSamples(userId, [text || message.caption || ''], 'forward');
    const total = await countSamples(userId);
    return screen(added ? t(locale, 'learned', { n: total }) : t(locale, 'learn_skipped'));
  }

  // An active setup wizard consumes plain text (Account ID, then API token).
  if (!cmd) {
    const row = await loadSettingsRow(userId);
    if (await handleSetupInput(message, row, locale)) return;
  }

  // /start (or any old command): tidy up and show home.
  if (cmd) {
    await drop(chat_id, message.message_id);
    return sendHome(chat_id, userId, locale);
  }
  if (!text) return screen(t(locale, 'use_buttons'));

  // Playground: show how the secretary would answer this message.
  await api.sendChatAction({ chat_id, action: 'typing' }).catch(() => {});
  try {
    const reply = await previewReply(userId, null, text, message.from.first_name);
    return send(t(locale, 'preview', { text: reply.join('\n\n') }));
  } catch (e) {
    const fix = e.kind === 'nocreds' || e.kind === 'auth' ? [[setupButton(locale)]] : [];
    return send(`⚠️ ${describeAiError(e, locale)}`, { reply_markup: panelKeyboard(locale, fix) });
  }
}

// Home: the help text with the reply keyboard, plus a setup nudge until AI is
// connected. Users have no command menu (the keyboard replaces it).
export async function sendHome(chat_id, userId, locale) {
  await api.deleteMyCommands({}).catch(() => {});
  if (PANEL_URL) {
    await api.setChatMenuButton({
      chat_id, menu_button: { type: 'web_app', text: t(locale, 'menu_panel'), web_app: { url: PANEL_URL } },
    }).catch(() => {});
  }
  await showHome(chat_id, { text: t(locale, 'help'), reply_markup: mainKeyboard(locale) });
  if (!resolveCredentials(await loadSettingsRow(userId), userId)) {
    await showScreen(chat_id, { text: t(locale, 'connect_prompt'), reply_markup: { inline_keyboard: [[setupButton(locale)]] } });
  }
}
