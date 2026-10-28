// handlers/message.js — every private-chat message: reply-keyboard buttons, /start
// (plain or with a link code), anonymous sends and replies, and the admin commands.
// The only slash commands are /start and the admin ones; everything else is a button.

import { ADMIN_IDS, PROMPT_MAX, SOURCE_URL, WORDS_MAX, WORD_MAX_LEN } from '../lib/config.js';
import { ban, bansView, dashboardView, isAdmin, recipientCount, sendOpenReports, unban } from '../lib/admin.js';
import { cancelRow, closeScreen, drop, matchButton, showScreen, textsFor } from '../lib/chats.js';
import { deliverAnonymous, deliverReply, findAlbumStart, findOwnerCopy, findReplyCopy } from '../lib/delivery.js';
import { isFiltered, ownerWords, parseWords } from '../lib/filter.js';
import { languageKeyboard } from '../lib/i18n.js';
import { linkView, sendHome, settingsView, statsView, wordsView } from '../lib/manage.js';
import { markSeen } from '../lib/receipts.js';
import { maybePrune } from '../lib/retention.js';
import { getOrCreateUser, getUser, getUserByCode, getState, setState, setPrompt, setWords } from '../lib/users.js';
import { aboutKeyboard, thankTip } from '../lib/tips.js';
import { safeApi } from '../lib/util.js';

const reply = (msg, text, extra = {}) => safeApi('sendMessage', { chat_id: msg.chat.id, text, ...extra });
const screen = (msg, text, extra = {}) => showScreen(msg.chat.id, { text, ...extra });
const withCancel = (L, rows = []) => ({ reply_markup: { inline_keyboard: [...rows, cancelRow(L)] } });

// "/start@MyBot abc" → { cmd: 'start', arg: 'abc' }
function parseCommand(text) {
  const m = /^\/([a-zA-Z0-9_]+)(?:@\S+)?(?:\s+([\s\S]*))?$/.exec(text ?? '');
  return m ? { cmd: m[1].toLowerCase(), arg: (m[2] ?? '').trim() } : null;
}

// A tapped reply-keyboard button; the tap itself is deleted.
async function onButton(msg, key, L) {
  const chatId = msg.chat.id;
  await drop(chatId, msg.message_id);
  switch (key) {
    case 'link':
      return showScreen(chatId, await linkView(await getOrCreateUser(msg.from), L));
    case 'stats': {
      const user = await getUser(msg.from.id);
      return showScreen(chatId, user ? await statsView(user, L) : { text: L.needLink });
    }
    case 'settings':
      return showScreen(chatId, settingsView(await getOrCreateUser(msg.from), L));
    case 'language':
      return screen(msg, L.chooseLanguage, { reply_markup: languageKeyboard() });
    case 'privacy':
      return screen(msg, L.privacy);
    case 'source': // 🔗 Source code, on keyboards sent before it moved into ℹ️ About
    case 'about':
      return screen(msg, L.about, { reply_markup: aboutKeyboard(L.locale, SOURCE_URL) });
  }
}

// /start: home; /start <code>: someone opened a link.
async function start(msg, code, L) {
  const userId = msg.from.id;
  await drop(msg.chat.id, msg.message_id);
  if (!code) {
    await setState(userId, 'idle');
    return sendHome(msg.from, L);
  }
  const owner = await getUserByCode(code);
  if (!owner) return screen(msg, L.invalidLink);
  if (owner.id === userId) return screen(msg, L.selfLink(owner));
  if (owner.paused) return screen(msg, L.ownerPaused(owner));
  await setState(userId, 'sending_to', owner.id);
  return screen(msg, L.sendPrompt(owner), withCancel(L));
}

// Validates and saves a new invitation text → { ok, text } (text = what to show).
async function savePrompt(user, raw, L) {
  const prompt = raw.trim();
  if ([...prompt].length > PROMPT_MAX) return { ok: false, text: L.textTooLong(PROMPT_MAX) };
  if (isFiltered(prompt)) return { ok: false, text: L.textFiltered };
  await setPrompt(user.id, prompt);
  return { ok: true, text: L.textSet({ ...user, prompt }) };
}

// Next message after ⚙️ Settings → ✏️ Invitation text. Errors keep the editor open.
async function onPromptMessage(msg, L) {
  await drop(msg.chat.id, msg.message_id);
  const user = await getOrCreateUser(msg.from);
  if (msg.text === undefined) return screen(msg, L.textNotText, withCancel(L));
  const result = await savePrompt(user, msg.text, L);
  if (!result.ok) return screen(msg, result.text, withCancel(L));
  await setState(user.id, 'idle');
  return screen(msg, result.text, { reply_markup: { inline_keyboard: [[{ text: L.btnBack, callback_data: 'st:home' }]] } });
}

// Messages after ⚙️ Settings → 🔤 Hidden words add words, until ⬅️ Back.
async function onWordsMessage(msg, L) {
  await drop(msg.chat.id, msg.message_id);
  const user = await getOrCreateUser(msg.from);
  await setState(user.id, 'setting_words'); // keeps the editor open
  if (msg.text === undefined) return showScreen(msg.chat.id, wordsView(user, L, L.wordsNotText));
  const existing = ownerWords(user);
  const added = parseWords(msg.text, existing, WORD_MAX_LEN);
  const room = Math.max(0, WORDS_MAX - existing.length);
  const words = [...existing, ...added.slice(0, room)];
  if (words.length > existing.length) await setWords(user.id, words);
  const note = added.length > room ? L.wordsFull(WORDS_MAX)
    : added.length ? L.wordsAdded(added.length) : L.wordsNoneAdded(WORD_MAX_LEN);
  return showScreen(msg.chat.id, wordsView({ ...user, words }, L, note));
}

// --- admin (ADMIN_IDS) commands; to everyone else they don't exist -------------

const ADMIN_COMMANDS = ['admin', 'reports', 'bans', 'ban', 'unban', 'broadcast'];

async function adminCommand(msg, { cmd, arg }, L) {
  const chatId = msg.chat.id;
  const sendView = ({ text, reply_markup }) => reply(msg, text, reply_markup ? { reply_markup } : {});
  switch (cmd) {
    case 'admin':   return sendView(await dashboardView(L));
    case 'reports': return sendOpenReports(chatId, L);
    case 'bans':    return sendView(await bansView(L));
    case 'ban':
    case 'unban': {
      const id = /^\d+$/.test(arg) ? Number(arg) : null;
      if (!id) return reply(msg, L.adminBanUsage(cmd));
      if (cmd === 'ban') return reply(msg, (await ban(id)) ? L.adminBanned(id) : L.adminAlreadyBanned(id));
      return reply(msg, (await unban(id)) ? L.adminUnbanned(id) : L.adminNotBanned(id));
    }
    case 'broadcast':
      await setState(chatId, 'broadcasting');
      return screen(msg, L.broadcastPrompt(await recipientCount(chatId)), withCancel(L));
  }
}

// Next message after /broadcast: confirm before it goes to everyone.
async function onBroadcastMessage(msg, L) {
  await setState(msg.from.id, 'idle');
  if (!isAdmin(msg.from.id)) return;
  await closeScreen(msg.chat.id);
  return reply(msg, L.broadcastConfirm(await recipientCount(msg.from.id)), {
    reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
    reply_markup: {
      inline_keyboard: [[
        { text: L.btnBroadcastSend, callback_data: `bc:${msg.message_id}` },
        { text: L.btnNo, callback_data: 'bc:no' },
      ]],
    },
  });
}

async function command(msg, parsed, L) {
  if (ADMIN_COMMANDS.includes(parsed.cmd) && isAdmin(msg.from.id)) return adminCommand(msg, parsed, L);
  if (parsed.cmd === 'start') return start(msg, parsed.arg, L);
  // Anything else (old commands included): tidy up and point at the buttons.
  await drop(msg.chat.id, msg.message_id);
  return screen(msg, L.help);
}

// A native (swipe) reply to a relayed message goes to the other side, whatever
// state the user is in — and leaves that state as it was, unless it was waiting
// for this very message. Returns false when `msg` doesn't reply to a relayed message.
async function nativeReply(msg) {
  const target = msg.reply_to_message?.message_id;
  if (!target) return false;
  const chatId = msg.chat.id;
  const state = await getState(msg.from.id);
  const pending = (kind, id) => state.kind === kind && state.id === id;

  // Owner → the copy of an anonymous message they received.
  const received = await findOwnerCopy(chatId, target);
  if (received?.status === 'delivered') {
    await deliverReply(msg, received.id, { keepState: !pending('replying_to', received.id) });
    return true;
  }

  // Sender → the copy of the owner's reply: a new anonymous message, threaded.
  const answer = await findReplyCopy(chatId, target);
  if (answer) {
    await deliverAnonymous(msg, answer.ownerId, {
      replyToMsgId: answer.ownerMsgId,
      keepState: !pending('sending_to', answer.ownerId),
    });
    return true;
  }
  return false;
}

export default async function (msg, ctx) {
  if (msg.chat?.type !== 'private' || !msg.from || msg.from.is_bot) return;
  try {
    const L = await textsFor(msg.from);
    // A ⭐ tip from the About screen (lib/tips.js), never an anonymous message.
    if (msg.successful_payment) return await thankTip(msg, L.locale, ADMIN_IDS);
    await markSeen(msg.from.id);
    const button = matchButton(msg.text);
    const parsed = button ? null : parseCommand(msg.text);

    // A button or command (except /start, which sets its own state) abandons a
    // pending send/reply/edit.
    if (button || (parsed && parsed.cmd !== 'start')) {
      const state = await getState(msg.from.id);
      if (state.kind !== 'idle' || state.expired) await setState(msg.from.id, 'idle');
    }
    if (button) return await onButton(msg, button, L);
    if (parsed) return await command(msg, parsed, L);

    if (await nativeReply(msg)) return;

    const state = await getState(msg.from.id);
    if (state.kind === 'sending_to') return await deliverAnonymous(msg, state.id);
    if (state.kind === 'replying_to') return await deliverReply(msg, state.id);
    if (state.kind === 'setting_prompt') return await onPromptMessage(msg, L);
    if (state.kind === 'setting_words') return await onWordsMessage(msg, L);
    if (state.kind === 'broadcasting') return await onBroadcastMessage(msg, L);

    // Idle: later items of an album arrive as separate updates, after the first
    // one ended send mode — they follow it to the same owner.
    if (msg.media_group_id) {
      const first = await findAlbumStart(msg.from.id, msg.media_group_id);
      if (first) return await deliverAnonymous(msg, first.ownerId, { keepState: true });
    }

    // A send / reply / invitation-text edit that timed out (see STATE_TTL_SEC).
    const expired = {
      sending_to: L.sendExpired, replying_to: L.replyExpired, setting_prompt: L.textExpired,
      setting_words: L.wordsExpired, broadcasting: L.broadcastExpired,
    }[state.expired];
    if (expired) {
      await setState(msg.from.id, 'idle');
      return await screen(msg, expired);
    }

    if (msg.media_group_id) return; // the rest of an album nobody is waiting for
    await drop(msg.chat.id, msg.message_id);
    return await screen(msg, L.help);
  } catch (e) {
    console.error('message handler failed', e);
  } finally {
    await maybePrune();
  }
}
