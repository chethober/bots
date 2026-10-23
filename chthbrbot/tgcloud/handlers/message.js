// handlers/message.js — every private-chat message: commands, anonymous sends and replies.

import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { messages, replies, blocks } from '../schema.js';
import { PROMPT_MAX } from '../lib/config.js';
import { ban, bansView, dashboardView, isAdmin, recipientCount, sendOpenReports, unban } from '../lib/admin.js';
import { acceptedKinds, typesKeyboard } from '../lib/content.js';
import { deliverAnonymous, deliverReply, findAlbumStart, findOwnerCopy, findReplyCopy } from '../lib/delivery.js';
import { isFiltered } from '../lib/filter.js';
import { blockedView, confirmKeyboard, sendQr, settingsView } from '../lib/manage.js';
import { T, invitation } from '../lib/texts.js';
import {
  getOrCreateUser, getUser, getUserByCode, getState, setState, setPaused, setPrompt,
} from '../lib/users.js';
import { personalLink, safeApi } from '../lib/util.js';
import { normalizeLocale, languageKeyboard, mainKeyboard, matchButton } from '../lib/i18n.js';
import { t } from '../lib/strings.js';
import { SOURCE_URL } from '../lib/config.js';

// The owner's chosen locale, or auto-detect from their Telegram client.
const localeOf = (from, user) => user?.locale || normalizeLocale(from?.language_code);

// A tapped reply-keyboard button (⚙️ Settings · 🌐 Language · 🔗 Source code).
async function handleButton(msg, button) {
  const user = await getUser(msg.from.id);
  const locale = localeOf(msg.from, user);
  if (button === 'language') return reply(msg, t(locale, 'choose_language'), { reply_markup: languageKeyboard() });
  if (button === 'source') {
    return reply(msg, t(locale, 'source_here'), { reply_markup: { inline_keyboard: [[{ text: t(locale, 'source'), url: SOURCE_URL }]] } });
  }
  // ⚙️ Settings — the owner's link settings (see settingsView).
  const { text, reply_markup } = settingsView(await getOrCreateUser(msg.from), locale);
  return reply(msg, text, { reply_markup });
}

const reply = (msg, text, extra = {}) => safeApi('sendMessage', { chat_id: msg.chat.id, text, ...extra });

// "/start@MyBot abc" → { cmd: 'start', arg: 'abc' }
function parseCommand(text) {
  const m = /^\/([a-zA-Z0-9_]+)(?:@\S+)?(?:\s+([\s\S]*))?$/.exec(text ?? '');
  return m ? { cmd: m[1].toLowerCase(), arg: (m[2] ?? '').trim() } : null;
}

async function start(msg, code) {
  const userId = msg.from.id;
  if (!code) {
    await setState(userId, 'idle');
    const user = await getOrCreateUser(msg.from);
    const locale = localeOf(msg.from, user);
    const text = t(locale, 'welcome', { name: user.name, link: await personalLink(user.code), invitation: invitation(user) });
    return reply(msg, text, { reply_markup: mainKeyboard() });
  }
  const owner = await getUserByCode(code);
  if (!owner) return reply(msg, T.invalidLink);
  if (owner.id === userId) return reply(msg, T.selfLink(owner));
  if (owner.paused) return reply(msg, T.ownerPaused(owner));
  await setState(userId, 'sending_to', owner.id);
  return reply(msg, T.sendPrompt(owner));
}

async function cancel(msg) {
  const state = await getState(msg.from.id);
  if (state.kind === 'idle') return reply(msg, T.nothingToCancel);
  await setState(msg.from.id, 'idle');
  return reply(msg, T.cancelled);
}

// Validates and saves a new invitation text → { ok, text } (text = reply to send).
async function savePrompt(user, raw) {
  const prompt = raw.trim();
  if ([...prompt].length > PROMPT_MAX) return { ok: false, text: T.textTooLong(PROMPT_MAX) };
  if (isFiltered(prompt)) return { ok: false, text: T.textFiltered };
  await setPrompt(user.id, prompt);
  return { ok: true, text: T.textSet({ ...user, prompt }) };
}

// "/text" opens the editor; "/text <words>" sets it directly.
async function textCommand(msg, arg) {
  const user = await getOrCreateUser(msg.from);
  if (arg) return reply(msg, (await savePrompt(user, arg)).text);
  await setState(user.id, 'setting_prompt');
  const extra = user.prompt
    ? { reply_markup: { inline_keyboard: [[{ text: T.btnTextReset, callback_data: 'x:reset' }]] } }
    : {};
  return reply(msg, T.textMenu(user, PROMPT_MAX), extra);
}

// Next message after "/text": the new invitation. Errors keep the editor open.
async function onPromptMessage(msg) {
  const user = await getOrCreateUser(msg.from);
  if (msg.text === undefined) return reply(msg, T.textNotText);
  const result = await savePrompt(user, msg.text);
  if (result.ok) await setState(user.id, 'idle');
  return reply(msg, result.text);
}

async function types(msg) {
  const user = await getOrCreateUser(msg.from);
  return reply(msg, T.typesMenu(acceptedKinds(user)), { reply_markup: typesKeyboard(user) });
}

async function pauseResume(msg, paused) {
  const user = await getUser(msg.from.id);
  if (!user) return reply(msg, T.needLink);
  if (user.paused === paused) return reply(msg, paused ? T.alreadyPaused : T.alreadyResumed);
  await setPaused(user.id, paused);
  return reply(msg, paused ? T.paused : T.resumed);
}

async function stats(msg) {
  const user = await getUser(msg.from.id);
  if (!user) return reply(msg, T.needLink);
  const byStatus = (status) => db.$count(messages, and(eq(messages.ownerId, user.id), eq(messages.status, status)));
  const [received, filtered, replyCount, blocked] = await Promise.all([
    byStatus('delivered'),
    byStatus('filtered'),
    db.$count(replies, eq(replies.ownerId, user.id)),
    db.$count(blocks, eq(blocks.ownerId, user.id)),
  ]);
  return reply(msg, T.stats(user, { received, filtered, replies: replyCount, blocked }));
}

async function blockedCommand(msg) {
  const user = await getUser(msg.from.id);
  if (!user) return reply(msg, T.needLink);
  const { text, reply_markup } = await blockedView(user.id);
  return reply(msg, text, reply_markup ? { reply_markup } : {});
}

async function qr(msg) {
  return sendQr(await getOrCreateUser(msg.from));
}

// /newlink and /delete only ask; the buttons (callback_query) do it.
async function confirmCommand(msg, text, prefix, yesText) {
  if (!(await getUser(msg.from.id))) return reply(msg, T.needLink);
  return reply(msg, text, { reply_markup: confirmKeyboard(prefix, yesText) });
}

// --- admin (ADMIN_IDS) commands; to everyone else they don't exist -------------

async function adminCommand(msg, { cmd, arg }) {
  const chatId = msg.chat.id;
  const sendView = ({ text, reply_markup }) => reply(msg, text, reply_markup ? { reply_markup } : {});
  switch (cmd) {
    case 'admin':   return sendView(await dashboardView());
    case 'reports': return sendOpenReports(chatId);
    case 'bans':    return sendView(await bansView());
    case 'ban':
    case 'unban': {
      const id = /^\d+$/.test(arg) ? Number(arg) : null;
      if (!id) return reply(msg, T.adminBanUsage(cmd));
      if (cmd === 'ban') return reply(msg, (await ban(id)) ? T.adminBanned(id) : T.adminAlreadyBanned(id));
      return reply(msg, (await unban(id)) ? T.adminUnbanned(id) : T.adminNotBanned(id));
    }
    case 'broadcast':
      await setState(chatId, 'broadcasting');
      return reply(msg, T.broadcastPrompt(await recipientCount(chatId)));
  }
}

const ADMIN_COMMANDS = ['admin', 'reports', 'bans', 'ban', 'unban', 'broadcast'];

// Next message after /broadcast: confirm before it goes to everyone.
async function onBroadcastMessage(msg) {
  await setState(msg.from.id, 'idle');
  if (!isAdmin(msg.from.id)) return;
  return reply(msg, T.broadcastConfirm(await recipientCount(msg.from.id)), {
    reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
    reply_markup: {
      inline_keyboard: [[
        { text: T.btnBroadcastSend, callback_data: `bc:${msg.message_id}` },
        { text: T.btnNo, callback_data: 'bc:no' },
      ]],
    },
  });
}

export async function command(msg, { cmd, arg }) {
  if (ADMIN_COMMANDS.includes(cmd) && isAdmin(msg.from.id)) return adminCommand(msg, { cmd, arg });
  switch (cmd) {
    case 'start':   return start(msg, arg);
    case 'cancel':  return cancel(msg);
    case 'text':    return textCommand(msg, arg);
    case 'types':   return types(msg);
    case 'qr':      return qr(msg);
    case 'pause':   return pauseResume(msg, true);
    case 'resume':  return pauseResume(msg, false);
    case 'blocked': return blockedCommand(msg);
    case 'stats':   return stats(msg);
    case 'newlink': return confirmCommand(msg, T.newlinkConfirm, 'n', T.btnNewlinkYes);
    case 'delete':  return confirmCommand(msg, T.deleteConfirm, 'd', T.btnDeleteYes);
    case 'privacy': return reply(msg, T.privacy);
    case 'settings': return handleButton(msg, 'settings');
    case 'language':
    case 'lang': {
      const user = await getUser(msg.from.id);
      return reply(msg, t(localeOf(msg.from, user), 'choose_language'), { reply_markup: languageKeyboard() });
    }
    default: {
      const user = await getUser(msg.from.id);
      return reply(msg, t(localeOf(msg.from, user), 'help'));
    }
  }
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
    const button = matchButton(msg.text);
    if (button) return await handleButton(msg, button);

    const parsed = parseCommand(msg.text);
    if (parsed) {
      // Any command (except /start, which sets its own state) abandons a pending send/reply/edit.
      if (parsed.cmd !== 'start' && parsed.cmd !== 'cancel') {
        const state = await getState(msg.from.id);
        if (state.kind !== 'idle' || state.expired) await setState(msg.from.id, 'idle');
      }
      return await command(msg, parsed);
    }

    if (await nativeReply(msg)) return;

    const state = await getState(msg.from.id);
    if (state.kind === 'sending_to') return await deliverAnonymous(msg, state.id);
    if (state.kind === 'replying_to') return await deliverReply(msg, state.id);
    if (state.kind === 'setting_prompt') return await onPromptMessage(msg);
    if (state.kind === 'broadcasting') return await onBroadcastMessage(msg);

    // Idle: later items of an album arrive as separate updates, after the first
    // one ended send mode — they follow it to the same owner.
    if (msg.media_group_id) {
      const first = await findAlbumStart(msg.from.id, msg.media_group_id);
      if (first) return await deliverAnonymous(msg, first.ownerId, { keepState: true });
    }

    // A send / reply / /text edit that timed out (see STATE_TTL_SEC).
    const expired = {
      sending_to: T.sendExpired, replying_to: T.replyExpired, setting_prompt: T.textExpired,
      broadcasting: T.broadcastExpired,
    }[state.expired];
    if (expired) {
      await setState(msg.from.id, 'idle');
      return await reply(msg, expired);
    }

    if (msg.media_group_id) return; // the rest of an album nobody is waiting for
    return await reply(msg, t(localeOf(msg.from, await getUser(msg.from.id)), 'help'));
  } catch (e) {
    console.error('message handler failed', e);
  }
}
