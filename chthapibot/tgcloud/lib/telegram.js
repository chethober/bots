// Sending and editing "cards": { text (HTML), image?, keyboard? }.
// An image is shown as a large link preview above the text, which keeps the
// 4096-char text limit (a photo caption is capped at 1024) and lets the card be edited.
import { api, BotApiError } from 'sdk';

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

export function sendCard(chatId, card, extra = {}) {
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
