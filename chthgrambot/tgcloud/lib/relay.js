// Relays contacts' non-text messages to the owner and sends the owner's answers back.
import { api } from 'sdk';
import * as store from './store.js';

// Kinds of content, checked in order (an animation also carries `document`).
const KINDS = [
  ['photo', 'photo'], ['animation', 'GIF'], ['video', 'video'], ['voice', 'voice message'],
  ['video_note', 'video message'], ['audio', 'audio'], ['document', 'file'], ['sticker', 'sticker'],
  ['venue', 'venue'], ['location', 'location'], ['contact', 'contact card'], ['dice', 'dice'],
  ['poll', 'poll'], ['story', 'story'],
];

export function kindOf(m) {
  if (m.text) return 'text';
  return KINDS.find(([k]) => m[k])?.[0] ?? 'unknown';
}

export const kindLabel = (k) => KINDS.find(([key]) => key === k)?.[1] ?? 'message';

// Re-sends message `m` (any type) to `target` ({ chat_id, business_connection_id?, reply_parameters? })
// using file_ids, so it works across chats. With `fallback`, failures become a text description.
export async function resend(m, target, { caption: extraCaption, fallback = true } = {}) {
  const caption = [extraCaption, m.caption].filter(Boolean).join('\n\n') || undefined;
  const cap = caption ? { caption: caption.slice(0, 1024), ...(extraCaption ? {} : { caption_entities: m.caption_entities }) } : {};
  const t = target;
  try {
    switch (kindOf(m)) {
      case 'text': return await api.sendMessage({ ...t, text: m.text, entities: m.entities });
      case 'photo': return await api.sendPhoto({ ...t, photo: m.photo.at(-1).file_id, ...cap });
      case 'animation': return await api.sendAnimation({ ...t, animation: m.animation.file_id, ...cap });
      case 'video': return await api.sendVideo({ ...t, video: m.video.file_id, ...cap });
      case 'voice': return await api.sendVoice({ ...t, voice: m.voice.file_id, ...cap });
      case 'video_note': return await api.sendVideoNote({ ...t, video_note: m.video_note.file_id });
      case 'audio': return await api.sendAudio({ ...t, audio: m.audio.file_id, ...cap });
      case 'document': return await api.sendDocument({ ...t, document: m.document.file_id, ...cap });
      case 'sticker': return await api.sendSticker({ ...t, sticker: m.sticker.file_id });
      case 'venue': return await api.sendVenue({
        ...t, latitude: m.venue.location.latitude, longitude: m.venue.location.longitude,
        title: m.venue.title, address: m.venue.address,
      });
      case 'location': return await api.sendLocation({ ...t, latitude: m.location.latitude, longitude: m.location.longitude });
      case 'contact': return await api.sendContact({
        ...t, phone_number: m.contact.phone_number, first_name: m.contact.first_name, last_name: m.contact.last_name,
      });
      case 'dice': return await api.sendDice({ ...t, emoji: m.dice.emoji });
    }
  } catch (e) {
    if (!fallback) throw e;
    console.warn('resend failed, falling back to text', kindOf(m), e.description ?? e.message);
  }
  if (!fallback) throw new Error(`Sending a ${kindLabel(kindOf(m))} isn't supported, try text or media`);
  const desc = m.poll ? `[poll] ${m.poll.question?.text ?? m.poll.question ?? ''}` : `[${kindLabel(kindOf(m))}]`;
  return api.sendMessage({ ...t, text: [extraCaption, desc, m.caption].filter(Boolean).join('\n\n') });
}

const relayButtons = (id) => ({
  inline_keyboard: [
    [{ text: '✍️ Reply', callback_data: `r:ans:${id}` }, { text: '🤖 Let AI answer', callback_data: `r:ai:${id}` }],
    [{ text: '🙈 Ignore', callback_data: `r:ign:${id}` }],
  ],
});

const doneButton = (text) => ({ inline_keyboard: [[{ text, callback_data: 'noop' }]] });

// Sends a contact's message to the owner with answer buttons.
export async function relayToOwner(conn, msg, contactName) {
  const kind = kindOf(msg);
  const who = contactName + (msg.from?.username ? ` (@${msg.from.username})` : '');
  const relay = await store.createRelay({
    ownerId: conn.userId, connectionId: conn.id, chatId: msg.chat.id, contactMsgId: msg.message_id,
    contactName, kind,
  });
  const media = await resend(msg, { chat_id: conn.userChatId });
  const header = await api.sendMessage({
    chat_id: conn.userChatId,
    text: `📩 ${who} sent a ${kindLabel(kind)}.\n\nReply to this message with anything (text, photo, voice…) and I'll send it to them from your account.`,
    reply_parameters: { message_id: media.message_id },
    reply_markup: relayButtons(relay.id),
  });
  await store.updateRelay(relay.id, { mediaMsgId: media.message_id, headerMsgId: header.message_id });
  if (Math.random() < 0.05) await store.pruneRelays();
}

// "✍️ Reply" button: ask for the answer with a force-reply prompt.
export async function promptAnswer(relay, ownerChatId) {
  const prompt = await api.sendMessage({
    chat_id: ownerChatId,
    text: `✍️ Your answer to ${relay.contactName || 'them'}:`,
    reply_parameters: { message_id: relay.headerMsgId },
    reply_markup: { force_reply: true, input_field_placeholder: 'Type or send anything…' },
  });
  await store.updateRelay(relay.id, { promptMsgId: prompt.message_id });
}

// Sends the owner's message (any type) to the contact as an answer.
export async function deliverAnswer(relay, ownerMsg) {
  const ownerChatId = ownerMsg.chat.id;
  try {
    await resend(ownerMsg, {
      chat_id: relay.chatId,
      business_connection_id: relay.connectionId,
      reply_parameters: { message_id: relay.contactMsgId },
    }, { fallback: false });
  } catch (e) {
    const why = /24|expired|not found|PEER|BUSINESS/i.test(e.description ?? '')
      ? 'Telegram only allows replies in chats with a message from them in the last 24 hours.'
      : (e.description ?? e.message);
    await api.sendMessage({ chat_id: ownerChatId, text: `❌ Couldn't send: ${why}`, reply_parameters: { message_id: ownerMsg.message_id } });
    return;
  }
  const text = ownerMsg.text ?? (ownerMsg.caption ? `[sent a ${kindLabel(kindOf(ownerMsg))}] ${ownerMsg.caption}` : `[sent a ${kindLabel(kindOf(ownerMsg))}]`);
  await store.addMessage(relay.ownerId, relay.chatId, 'owner', text);
  await markRelay(relay, 'answered', ownerChatId);
  await api.sendMessage({
    chat_id: ownerChatId, text: `✅ Sent to ${relay.contactName || 'them'}.`, reply_parameters: { message_id: ownerMsg.message_id },
  }).catch(() => {});
}

export async function markRelay(relay, status, ownerChatId) {
  await store.updateRelay(relay.id, { status });
  const label = { answered: '✅ Answered', ai: '🤖 AI answered', ignored: '🙈 Ignored' }[status];
  if (relay.headerMsgId) {
    await api.editMessageReplyMarkup({
      chat_id: ownerChatId, message_id: relay.headerMsgId, reply_markup: doneButton(label),
    }).catch(() => {});
  }
}
