// Private chat between a user and the bot itself: commands + a preview playground.
import { api } from 'sdk';
import { PANEL_URL, isAllowed, SOURCE_URL } from '../lib/config.js';
import { t } from '../lib/strings.js';
import { normalizeLocale, languageKeyboard, mainKeyboard, matchButton } from '../lib/i18n.js';
import { getSettings, patchSettings, loadSettingsRow, resolveCredentials, MOODS, EMOJI_STYLES } from '../lib/settings.js';
import { getUserConnection, countRepliesToday, addSamples, countSamples, findRelayByOwnerMessage } from '../lib/store.js';
import { previewReply } from '../lib/secretary.js';
import { describeAiError } from '../lib/ai.js';
import { panelKeyboard, statusKeyboard, setupButton, settingsKeyboard } from '../lib/ui.js';
import { startSetup, cancelSetup, handleSetupInput } from '../lib/setup.js';
import { deliverAnswer } from '../lib/relay.js';

export default async function (message) {
  if (message.chat.type !== 'private' || !message.from) return;
  const userId = message.from.id;
  const chat_id = message.chat.id;
  const send = (text, extra = {}) => api.sendMessage({ chat_id, text, ...extra });

  if (!isAllowed(userId)) return send(t(normalizeLocale(message.from.language_code), 'private'));

  const localeOf = async () => {
    const s = await getSettings(userId);
    return s.uiLocale && s.uiLocale !== 'auto' ? s.uiLocale : normalizeLocale(message.from.language_code);
  };

  // ⚙️ Settings: one-tap everyday settings, plus the panel for everything else.
  const sendSettings = async () => {
    const [locale, s, row] = await Promise.all([localeOf(), getSettings(userId), loadSettingsRow(userId)]);
    return send(t(locale, 'settings_title'), { reply_markup: settingsKeyboard(s, !!resolveCredentials(row, userId)) });
  };

  const text = message.text ?? '';
  const cmd = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : null;

  // Unified reply-keyboard buttons (⚙️ Settings · 🌐 Language · 🔗 Source code).
  const button = matchButton(text);
  if (button) {
    const locale = await localeOf();
    if (button === 'language') return send(t(locale, 'choose_language'), { reply_markup: languageKeyboard() });
    if (button === 'source') {
      return send(t(locale, 'source_here'), { reply_markup: { inline_keyboard: [[{ text: t(locale, 'source'), url: SOURCE_URL }]] } });
    }
    return sendSettings();
  }

  // A reply to a relayed contact message is the answer to send back to them.
  if (message.reply_to_message && !cmd) {
    const relay = await findRelayByOwnerMessage(userId, message.reply_to_message.message_id);
    if (relay) return deliverAnswer(relay, message);
  }

  // Forwarding your own messages teaches the "speak as me" style.
  if (message.forward_origin) {
    const o = message.forward_origin;
    const fullName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ');
    const mine = (o.type === 'user' && o.sender_user?.id === userId)
      || (o.type === 'hidden_user' && o.sender_user_name === fullName);
    if (!mine) return send('Only forward messages that you wrote yourself. I learn your style from those.');
    const added = await addSamples(userId, [text || message.caption || ''], 'forward');
    const total = await countSamples(userId);
    return send(added ? `📝 Learned (${total} samples). Keep forwarding, or send /learn for options.` : 'That one is too short or not text, skipped.');
  }

  // An active setup wizard consumes plain text (Account ID, then API token).
  if (!cmd) {
    const row = await loadSettingsRow(userId);
    if (await handleSetupInput(message, row)) return;
  }

  switch (cmd) {
    case '/start':
    case '/help': {
      await setupChat(chat_id);
      const hasCreds = resolveCredentials(await loadSettingsRow(userId), userId);
      const locale = await localeOf();
      await send(t(locale, 'help'), { reply_markup: mainKeyboard() });
      if (!hasCreds) await send('⚙️ Tap below to connect Cloudflare AI and finish setup.', { reply_markup: { inline_keyboard: [[setupButton()]] } });
      return;
    }

    case '/language':
    case '/lang':
      return send(t(await localeOf(), 'choose_language'), { reply_markup: languageKeyboard() });

    case '/setup':
      return startSetup(chat_id, userId);

    case '/settings':
      return sendSettings();

    case '/learn': {
      const [n, s] = await Promise.all([countSamples(userId), getSettings(userId)]);
      return send(`🪞 Teach me to write like you\n\nI have ${n} samples of your writing.${s.voice === 'me' ? '' : '\n\nRight now I answer as your assistant. Turn on "Speak as me" in the panel so I write as you.'}

Ways to teach me:
1. Just chat as usual. When "Learn from my messages" is on, I save what you type in your business chats.
2. Forward me messages you wrote, in bulk if you like.
3. Paste examples in the panel → Speak as me.

Then tap "Analyze my style" in the panel to turn the samples into a style guide you can edit.`, { reply_markup: panelKeyboard() });
    }

    case '/cancel':
      return cancelSetup(chat_id, userId);

    case '/panel':
      if (!PANEL_URL) return send('The panel URL is not configured yet (PANEL_URL in tgcloud/lib/config.js).');
      return send('Manage your secretary:', { reply_markup: panelKeyboard() });

    case '/pause':
      await patchSettings(userId, { enabled: false });
      return send('⏸ Auto-replies paused.', { reply_markup: statusKeyboard(false) });

    case '/resume':
      await patchSettings(userId, { enabled: true });
      return send('▶️ Auto-replies resumed.', { reply_markup: statusKeyboard(true) });

    case '/status': {
      const [s, conn, row, today] = await Promise.all([
        getSettings(userId), getUserConnection(userId), loadSettingsRow(userId), countRepliesToday(userId),
      ]);
      const creds = resolveCredentials(row, userId);
      return send([
        `Business connection: ${!conn ? '❌ not connected' : conn.isEnabled ? '✅ connected' : '❌ disabled'}`,
        conn?.isEnabled && !conn.canReply ? '⚠️ "Reply to messages" permission is off' : '',
        `Auto-replies: ${s.enabled ? '▶️ on' : '⏸ paused'}${s.scheduleMode === 'window' ? ` (only ${s.scheduleFrom}–${s.scheduleTo})` : ''}`,
        `AI credentials: ${creds ? `✅ ${creds.source}` : '❌ missing — send /setup'}`,
        `Mood: ${MOODS[s.mood].label} · Emoji: ${EMOJI_STYLES[s.emojiStyle].label} · Temp: ${s.temperature}`,
        `Replies today: ${today}`,
      ].filter(Boolean).join('\n'), { reply_markup: statusKeyboard(s.enabled) });
    }
  }

  if (cmd || !text) return send(t(await localeOf(), 'unknown'));

  // Playground: show how the secretary would answer this message.
  await api.sendChatAction({ chat_id, action: 'typing' }).catch(() => {});
  try {
    const reply = await previewReply(userId, null, text, message.from.first_name);
    return send(`🧪 Preview:\n\n${reply.join('\n\n')}`);
  } catch (e) {
    const fix = e.kind === 'nocreds' || e.kind === 'auth' ? [[setupButton()]] : [];
    return send(`⚠️ ${describeAiError(e)}`, { reply_markup: panelKeyboard(fix) });
  }
}

async function setupChat(chat_id) {
  await api.setMyCommands({
    commands: [
      { command: 'settings', description: 'Quick settings' },
      { command: 'panel', description: 'Open the management panel' },
      { command: 'setup', description: 'Connect Cloudflare AI step by step' },
      { command: 'learn', description: 'Teach me to write like you' },
      { command: 'status', description: 'Connection and usage' },
      { command: 'pause', description: 'Pause auto-replies' },
      { command: 'resume', description: 'Resume auto-replies' },
      { command: 'language', description: 'Change language' },
      { command: 'help', description: 'How it works' },
    ],
  }).catch(() => {});
  if (PANEL_URL) {
    await api.setChatMenuButton({
      chat_id, menu_button: { type: 'web_app', text: 'Panel', web_app: { url: PANEL_URL } },
    }).catch(() => {});
  }
}
