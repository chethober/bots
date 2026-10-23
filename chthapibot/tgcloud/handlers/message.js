// Text commands, replies to prompts, and location messages. Payload is the Message.
import { api } from 'sdk';
import { findCommand, runCallback, runInput, runFallbackText, saveLocation } from '../lib/hubs/index.js';
import { takePending, getPrefs } from '../lib/store.js';
import { notice, menuAction } from '../lib/ui.js';
import { esc } from '../lib/format.js';
import { normalizeLocale, matchButton } from '../lib/i18n.js';
import { t, SOURCE_URL } from '../lib/strings.js';

let botUsername = null;

export default async function (msg) {
  if (!msg.from || msg.from.is_bot) return;
  const ctx = {
    chatId: msg.chat.id,
    chatType: msg.chat.type,
    userId: msg.from.id,
    userName: msg.from.first_name,
    message: null,
    // Menu taps run callback actions; their pop-up toasts become short notices
    // ("Loading…"-style progress toasts are dropped).
    answer: async (t) => {
      if (t && !t.endsWith('…')) await notice(ctx, esc(t));
    },
  };
  ctx.locale = (await getPrefs(ctx.chatId)).locale || normalizeLocale(msg.from.language_code);

  try {
    if (msg.location) return await saveLocation(ctx, msg.location);

    const text = msg.text?.trim();
    if (!text) return;

    // Unified reply-keyboard buttons (⚙️ Settings · 🌐 Language · 🔗 Source code).
    const button = matchButton(text);
    if (button === 'source') {
      await api.sendMessage({ chat_id: ctx.chatId, text: t(ctx.locale, 'source_here'),
        reply_markup: { inline_keyboard: [[{ text: t(ctx.locale, 'source'), url: SOURCE_URL }]] } });
      return;
    }
    if (button) {
      await takePending(ctx.chatId, ctx.userId);
      return await findCommand(button === 'settings' ? 'settings' : 'language')(ctx, []);
    }

    if (text.startsWith('/')) {
      const [head, ...args] = text.split(/\s+/);
      const [name, mention] = head.slice(1).split('@');
      if (mention && mention.toLowerCase() !== (await username())) return; // for another bot
      const run = findCommand(name);
      if (!run) {
        if (ctx.chatType === 'private') await notice(ctx, 'Unknown command. Send /help for the list.');
        return;
      }
      // A new command abandons any prompt this user was answering (except /cancel, which reports it).
      if (name.toLowerCase() !== 'cancel') await takePending(ctx.chatId, ctx.userId);
      return await run(ctx, args);
    }

    // A tap on a reply-keyboard menu button runs its action like an inline button press.
    // A pending prompt wins over labels that could be typed answers ("5", "Italian");
    // labels with emoji/symbols ("🏠 Main menu") always act as buttons.
    const action = await menuAction(ctx, text);
    const buttonish = action && /[^\p{L}\p{N}\s.,:'’&()/+-]/u.test(text);
    const pending = buttonish ? null : await takePending(ctx.chatId, ctx.userId);
    if (pending) return await runInput(ctx, pending, text);
    if (action) {
      await takePending(ctx.chatId, ctx.userId);
      return await runCallback(ctx, action);
    }
    if (await runFallbackText(ctx, text)) return;
    if (ctx.chatType === 'private') await notice(ctx, 'Send /menu to see what I can do.');
  } catch (e) {
    console.error('message failed', msg.text, e);
    await notice(ctx, '⚠️ Something went wrong. Please try again in a moment.').catch(() => {});
  }
}

async function username() {
  botUsername ??= (await api.getMe()).username.toLowerCase();
  return botUsername;
}
