import { db, api } from 'sdk';
import { settings as settingsTable } from '../schema.js';
import { sanitize, loadSettingsRow, resolveCredentials, inSchedule, now } from './settings.js';
import { buildMessages, generate, decorate, describeAiError, analyzeStyle } from './ai.js';
import { isAllowed } from './config.js';
import * as store from './store.js';
import { setupButton } from './ui.js';
import { relayToOwner } from './relay.js';

const sleep = (ms) => (typeof setTimeout === 'function' && ms > 0
  ? new Promise((r) => setTimeout(r, ms))
  : Promise.resolve());

// Text the model sees for a message, including non-text content.
export function messageText(m) {
  const kinds = {
    photo: 'photo', video: 'video', voice: 'voice message', video_note: 'video message',
    audio: 'audio', document: 'file', sticker: 'sticker', location: 'location',
    contact: 'contact card', animation: 'GIF', poll: 'poll',
  };
  const kind = Object.keys(kinds).find((k) => m[k]);
  const extra = m.sticker?.emoji ? ` ${m.sticker.emoji}` : '';
  const text = m.text ?? m.caption ?? '';
  if (!kind) return text;
  return `[sent a ${kinds[kind]}${extra}]${text ? ` ${text}` : ''}`;
}

const nameOf = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || '';

// Handles an incoming business_message update.
export async function handleBusinessMessage(msg) {
  if (msg.sender_business_bot) return;          // a reply we (or another bot) sent
  if (msg.chat.type !== 'private') return;
  const conn = await store.getConnection(msg.business_connection_id);
  if (!conn || !conn.isEnabled) return;
  const ownerId = conn.userId;
  if (!isAllowed(ownerId)) return;

  const text = messageText(msg);
  if (!text) return;
  const row = await loadSettingsRow(ownerId);
  const s = sanitize(row?.data ?? {});

  // The owner wrote in this chat personally: remember it and step back for a while.
  if (msg.from?.id === ownerId) {
    await store.touchChat(ownerId, msg.chat);
    if (s.historySize > 0) await store.addMessage(ownerId, msg.chat.id, 'owner', text, msg.message_id);
    if (s.learnStyle && msg.text && !msg.forward_origin) await store.addSamples(ownerId, [msg.text], 'chat');
    if (s.ownerPauseMinutes > 0) {
      await store.updateChat(ownerId, msg.chat.id, { pausedUntil: now() + s.ownerPauseMinutes * 60 });
    }
    return;
  }
  if (msg.from?.is_bot) return;                 // avoid bot-to-bot loops

  // Non-text content goes to the owner unless they chose to let the AI guess from a description.
  const nonText = !msg.text && s.nonText !== 'ai';
  const chat = await store.touchChat(ownerId, msg.chat);
  // 'contact_media' doesn't count as "newer" for burst merging, so a text sent just before still gets a reply.
  const myId = await store.addMessage(ownerId, msg.chat.id, nonText ? 'contact_media' : 'contact', text, msg.message_id);

  if (!s.enabled || !conn.canReply || chat?.muted) return;
  if (chat?.pausedUntil > now()) return;
  if (!inSchedule(s)) return;

  const bc = { business_connection_id: conn.id, chat_id: msg.chat.id };
  if (nonText) {
    if (s.nonText === 'relay') await relayToOwner(conn, msg, nameOf(msg.from));
    return;
  }

  const creds = resolveCredentials(row, ownerId);
  if (!creds) {
    await notifyOwner(conn, row, 'I received a message but have no Cloudflare AI credentials yet. Tap below to connect them.', [[setupButton()]]);
    return;
  }

  if (s.markRead && conn.canRead) {
    api.readBusinessMessage({ ...bc, message_id: msg.message_id }).catch(() => {});
  }

  // Wait a little so a burst of messages gets a single reply (the newest handler answers).
  if (s.replyDelay > 0) {
    await api.sendChatAction({ ...bc, action: 'typing' }).catch(() => {});
    await sleep(s.replyDelay * 1000);
    if (await store.hasNewerContactMessage(ownerId, msg.chat.id, myId)) return;
  }
  await aiReply({ conn, row, s, creds, chat, contactName: nameOf(msg.from), replyToId: msg.message_id });
}

// Generates an AI reply from the chat history and sends it into the business chat.
// Returns false if nothing was sent.
export async function aiReply({ conn, row, s, creds, chat, contactName, replyToId, quote = s.quoteReply }) {
  const ownerId = conn.userId;
  const bc = { business_connection_id: conn.id, chat_id: chat.chatId };
  api.sendChatAction({ ...bc, action: 'typing' }).catch(() => {});

  const history = await store.getHistory(ownerId, chat.chatId, Math.max(1, s.historySize));
  const lastContact = history.filter((m) => m.role.startsWith('contact')).slice(-3).map((m) => m.text).join('\n');
  const { samples, examples } = await styleContext(ownerId, s, lastContact);
  const ctx = { ownerName: conn.firstName, contactName, contactNote: chat?.note, samples, examples };

  let reply;
  try {
    reply = await generate(s, creds, buildMessages(s, history, ctx));
  } catch (e) {
    console.error('AI failed', e.kind, e.message);
    await notifyOwner(conn, row, describeAiError(e), e.kind === 'auth' ? [[setupButton()]] : undefined);
    if (!s.fallbackText) return false;
    reply = s.fallbackText;
  }

  const parts = decorate(s, reply);
  let sent;
  for (const [i, part] of parts.entries()) {
    if (i > 0) {   // pause like a human typing the next message
      await api.sendChatAction({ ...bc, action: 'typing' }).catch(() => {});
      await sleep(Math.min(4000, 600 + part.length * 40));
    }
    sent = await api.sendMessage({
      ...bc,
      text: part,
      ...(quote && replyToId && i === 0 ? { reply_parameters: { message_id: replyToId } } : {}),
    });
  }
  await store.addMessage(ownerId, chat.chatId, 'bot', reply, sent.message_id);
  if (s.historySize === 0) await store.clearHistory(ownerId, chat.chatId);
  if (Math.random() < 0.02) await store.pruneOld();
  return true;
}

// Generates a reply without sending it anywhere (panel playground and bot DM preview).
// Returns the message texts the secretary would send.
export async function previewReply(ownerId, input, text, ownerName) {
  const row = await loadSettingsRow(ownerId);
  const s = sanitize(input ?? row?.data ?? {});
  const creds = requireCreds(row, ownerId);
  const { samples, examples } = await styleContext(ownerId, s, text);
  const ctx = { ownerName, contactName: 'a friend', samples, examples };
  const reply = await generate(s, creds, buildMessages(s, [{ role: 'contact', text }], ctx));
  return decorate(s, reply);
}

// Builds a style guide from the owner's samples (not saved; the panel shows it for review).
export async function buildStyleProfile(ownerId, input, ownerName) {
  const row = await loadSettingsRow(ownerId);
  const s = sanitize(input ?? row?.data ?? {});
  const creds = requireCreds(row, ownerId);
  const samples = await store.getSamples(ownerId, 120);
  if (samples.length < 5) throw Object.assign(new Error('Need at least 5 style samples first'), { kind: 'few_samples' });
  return analyzeStyle(s, creds, samples, ownerName);
}

// Writing samples and similar past conversations for "speak as me" mode.
async function styleContext(ownerId, s, incoming) {
  if (s.voice !== 'me') return { samples: [], examples: [] };
  const [samples, examples] = await Promise.all([
    store.getSamples(ownerId, s.styleExamples),
    store.findExamples(ownerId, incoming, s.dialogExamples),
  ]);
  return { samples, examples };
}

function requireCreds(row, ownerId) {
  const creds = resolveCredentials(row, ownerId);
  if (!creds) throw Object.assign(new Error('No Cloudflare credentials configured'), { kind: 'nocreds' });
  return creds;
}

// DMs the owner about a problem, at most once per hour.
async function notifyOwner(conn, row, text, inline_keyboard) {
  if ((row?.lastErrorAt ?? 0) > now() - 3600) return;
  await db.insert(settingsTable).values({ userId: conn.userId, data: row?.data ?? {}, lastErrorAt: now() })
    .onConflictDoUpdate({ target: settingsTable.userId, set: { lastErrorAt: now() } }).run();
  await api.sendMessage({
    chat_id: conn.userChatId, text: `⚠️ ${text}`, ...(inline_keyboard ? { reply_markup: { inline_keyboard } } : {}),
  }).catch(() => {});
}
