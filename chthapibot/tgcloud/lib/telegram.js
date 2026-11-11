// Sending and editing "cards": { text (HTML), image?, keyboard?, widget?, before? }.
// An image is shown as a large link preview above the text, which keeps the
// 4096-char text limit (a photo caption is capped at 1024) and lets the card be edited.
// A card with a `widget` is sent as a message widget in private chats, and as its
// text everywhere else or when the widget can't be sent (lib/widgets).
// `before` lists cards to send first (e.g. the weather widget ahead of the briefing).
import { api, BotApiError } from 'sdk';
import { sendWidgetCard, editWidgetCard, widgetsOn, isPrivateChat } from './widgets/index.js';

function previewOf(card) {
  return card.image
    ? { url: card.image, prefer_large_media: true, show_above_text: true }
    : { is_disabled: true };
}

function markupOf(card) {
  if (!card.keyboard) return undefined;
  // Telegram rejects the whole message if any row is not an array of buttons.
  if (!Array.isArray(card.keyboard) || card.keyboard.some((row) => !Array.isArray(row) || row.some((b) => !b?.text))) {
    throw new Error(`Malformed inline keyboard: ${JSON.stringify(card.keyboard).slice(0, 200)}`);
  }
  return { inline_keyboard: card.keyboard.filter((row) => row.length) };
}

export async function sendCard(chatId, card, extra = {}) {
  for (const pre of card.before ?? []) await sendCard(chatId, pre).catch((e) => console.warn(`card before: ${e.description ?? e.message}`));
  if (card.widget) {
    const sent = await sendWidgetCard(chatId, card, extra);
    if (sent) return sent;
  }
  return api.sendMessage({
    chat_id: chatId,
    text: card.text,
    parse_mode: 'HTML',
    link_preview_options: previewOf(card),
    reply_markup: markupOf(card),
    ...extra,
  });
}

export async function editCard(message, card) {
  if (message.widget) {
    if (card.widget && await editWidgetCard(message, card)) return;
    // A widget can't turn into text, nor change its height: replace the message.
    await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id }).catch(() => {});
    return sendCard(message.chat.id, card);
  }
  if (card.widget && widgetsOn() && isPrivateChat(message.chat.id)) {
    // An older text card refreshed after widgets arrived: replace it with the widget.
    const sent = await sendWidgetCard(message.chat.id, card);
    if (sent) return api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id }).catch(() => {});
  }
  try {
    await api.editMessageText({
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: card.text,
      parse_mode: 'HTML',
      link_preview_options: previewOf(card),
      reply_markup: markupOf(card),
    });
  } catch (e) {
    // Refreshing a card whose data hasn't changed is not an error.
    if (!(e instanceof BotApiError && e.code === 400 && /not modified/i.test(e.description))) throw e;
  }
}

export function sendText(chatId, html, extra = {}) {
  return sendCard(chatId, { text: html }, extra);
}

// True if Telegram says we can no longer write to this chat (blocked, kicked, deleted).
export function isChatGone(e) {
  return e instanceof BotApiError && (e.code === 403 || (e.code === 400 && /chat not found/i.test(e.description)));
}
