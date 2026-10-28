// Text commands, replies to prompts, reply-keyboard taps and location messages.
// Payload is the Message.
//
// A private chat follows clean chat (lib/screen.js): the user's message is
// deleted once handled, a keyboard tap opens its screen, and typed text answers
// the open prompt. Groups keep inline menus and reply prompts.
import { api } from 'sdk';
import { findCommand, runCallback, runInput, runFallbackText, saveLocation } from '../lib/hubs/index.js';
import { sendHome } from '../lib/hubs/main.js';
import { takePending, getPrefs } from '../lib/store.js';
import { notice } from '../lib/ui.js';
import { drop, showScreen, closeScreen } from '../lib/screen.js';
import { sendCard } from '../lib/telegram.js';
import { esc } from '../lib/format.js';
import { normalizeLocale, LOCALES } from '../lib/i18n.js';
import { matchButton } from '../lib/keyboard.js';
import { t, SOURCE_URL } from '../lib/strings.js';
import { aboutKeyboard, thankTip } from '../lib/tips.js';

let botUsername = null;

export default async function (msg) {
  if (!msg.from || msg.from.is_bot) return;
  const ctx = {
    chatId: msg.chat.id,
    chatType: msg.chat.type,
    userId: msg.from.id,
    userName: msg.from.first_name,
    message: null,
    // Keyboard taps run callback actions; their pop-up toasts become short notices
    // ("Loading…"-style progress toasts are dropped).
    answer: async (t) => {
      if (t && !t.endsWith('…')) await notice(ctx, esc(t));
    },
  };
  ctx.locale = (await getPrefs(ctx.chatId)).locale || normalizeLocale(msg.from.language_code);
  const isPrivate = ctx.chatType === 'private';

  try {
    // A ⭐ tip from the About screen (lib/tips.js).
    if (msg.successful_payment) return await thankTip(msg, ctx.locale);
    if (isPrivate) await drop(ctx.chatId, msg.message_id);

    if (msg.location) {
      // Shared from the location screen: put the main keyboard back first.
      if (isPrivate) await sendHome(ctx);
      return await saveLocation(ctx, msg.location);
    }

    const text = msg.text?.trim();
    if (!text) return;

    if (isPrivate) {
      // ⬅️ Settings on the location screen.
      if (LOCALES.some((l) => t(l, 'btn_back_settings') === text)) {
        await sendHome(ctx);
        return await runCallback(ctx, 'st:home');
      }
      const action = matchButton(text);
      if (action) {
        await takePending(ctx.chatId, ctx.userId);
        if (action === 'about') {
          return await showScreen(ctx.chatId, () => sendCard(ctx.chatId, {
            text: t(ctx.locale, 'about'),
            keyboard: aboutKeyboard(ctx.locale, SOURCE_URL).inline_keyboard,
          }));
        }
        if (action === 'language') return await findCommand('language')(ctx, []);
        return await runCallback(ctx, action);
      }
    }

    if (text.startsWith('/')) {
      const [head, ...args] = text.split(/\s+/);
      const [name, mention] = head.slice(1).split('@');
      if (mention && mention.toLowerCase() !== (await username())) return; // for another bot
      const run = findCommand(name);
      if (!run) {
        if (isPrivate) await notice(ctx, 'Unknown command. Send /help for the list.');
        return;
      }
      // A new command abandons any prompt this user was answering (except /cancel, which reports it).
      if (name.toLowerCase() !== 'cancel') await takePending(ctx.chatId, ctx.userId);
      return await run(ctx, args);
    }

    const pending = await takePending(ctx.chatId, ctx.userId);
    if (pending) {
      if (isPrivate) await closeScreen(ctx.chatId); // the answered prompt
      return await runInput(ctx, pending, text);
    }
    if (await runFallbackText(ctx, text)) return;
    if (isPrivate) await sendHome(ctx);
  } catch (e) {
    console.error('message failed', msg.text, e);
    await notice(ctx, '⚠️ Something went wrong. Please try again in a moment.').catch(() => {});
  }
}

async function username() {
  botUsername ??= (await api.getMe()).username.toLowerCase();
  return botUsername;
}
