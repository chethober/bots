// handlers/callback_query.js — inline buttons:
//   owner, under a received message: Reply / Block / Report  r:/b:/p:<messageId>
//   sender, under "delivered":       Unsend u:<messageId>, Send another s:<code>
//   /types toggles k:<kind>, /text reset x:reset, /blocked unblock ub:<rowid>,
//   /newlink n:yes|no, /delete d:yes|no, QR code q:me, ⚙️ Settings st:<op>
//   admin, under a report:           Ban / Dismiss / Unban  ab:/ad:/au:<reportId>
//   admin, /admin dashboard am:refresh|reports|bans, /bans unban bu:<createdAt>.<rank>,
//   /broadcast send bc:<adminMsgId>|no

import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { messages, blocks, reports } from '../schema.js';
import { KINDS, UNSEND_WINDOW_SEC } from '../lib/config.js';
import {
  ban, bansView, dashboardView, isAdmin, reportKeyboard, runBroadcast, sendOpenReports, sendReport, unban, unbanAt,
} from '../lib/admin.js';
import { acceptedKinds, toggleKind, typesKeyboard } from '../lib/content.js';
import { unsend } from '../lib/delivery.js';
import { blockedView, sendQr, settingsView, unblock } from '../lib/manage.js';
import { T } from '../lib/texts.js';
import {
  deleteUserData, getOrCreateUser, getUser, getUserByCode, resetCode, setAccepts, setPaused, setPrompt, setState, setUserLocale,
} from '../lib/users.js';
import { now, personalLink, safeApi } from '../lib/util.js';
import { normalizeLocale, LOCALE_NAMES, LOCALES } from '../lib/i18n.js';
import { t } from '../lib/strings.js';
import { command } from './message.js';

// /language — save the chosen locale and confirm in that language.
async function onLanguage(q, value) {
  const locale = LOCALES.includes(value) ? value : normalizeLocale(value);
  await getOrCreateUser(q.from);
  await setUserLocale(q.from.id, locale);
  const text = t(locale, 'language_set', { name: LOCALE_NAMES[locale] ?? locale });
  if (q.message) await editButtonMessage(q, text);
  else await safeApi('sendMessage', { chat_id: q.from.id, text });
  return {};
}

// Replaces the text (and buttons) of the message the button was on.
async function editButtonMessage(q, text, reply_markup) {
  if (!q.message) return safeApi('sendMessage', { chat_id: q.from.id, text, ...(reply_markup && { reply_markup }) });
  return safeApi('editMessageText', {
    chat_id: q.message.chat.id,
    message_id: q.message.message_id,
    text,
    ...(reply_markup && { reply_markup }),
  });
}

// --- owner: buttons under a received message ------------------------------------

async function onMessageButton(q, action, messageId) {
  const userId = q.from.id;
  const msg = await db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!msg || msg.ownerId !== userId) return { text: T.notYourMessage };

  if (action === 'r') {
    await setState(userId, 'replying_to', msg.id);
    await safeApi('sendMessage', {
      chat_id: userId,
      text: T.replyPrompt,
      ...(q.message && { reply_parameters: { message_id: q.message.message_id, allow_sending_without_reply: true } }),
    });
    return {};
  }

  if (action === 'b') {
    await db.insert(blocks)
      .values({ ownerId: userId, senderId: msg.senderId, createdAt: now() })
      .onConflictDoNothing();
    await safeApi('sendMessage', { chat_id: userId, text: T.blocked });
    return { text: T.blockedToast };
  }

  if (action === 'p') {
    const [report] = await db.insert(reports)
      .values({ messageId: msg.id, ownerId: userId, senderId: msg.senderId, status: 'open', createdAt: now() })
      .onConflictDoNothing({ target: reports.messageId })
      .returning();
    if (!report) return { text: T.alreadyReported };
    await safeApi('sendMessage', { chat_id: userId, text: T.reported });
    await sendReport(report, msg);
    return { text: T.reportedToast };
  }

  return {};
}

// --- sender: buttons under "delivered" ----------------------------------------

// u:<messageId>
async function onUnsend(q, messageId) {
  const msg = await db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!msg || msg.senderId !== q.from.id) return { text: T.notYourMessage };
  if (msg.status === 'unsent') return { text: T.alreadyUnsent };
  if (now() - msg.createdAt > UNSEND_WINDOW_SEC) {
    return { text: T.unsendTooLate(Math.round(UNSEND_WINDOW_SEC / 60)), show_alert: true };
  }
  await unsend(msg);
  // Keep "send another" if it was there.
  const another = q.message?.reply_markup?.inline_keyboard?.flat().find((b) => b.callback_data?.startsWith('s:'));
  await editButtonMessage(q, T.unsent(await getUser(msg.ownerId)),
    another ? { inline_keyboard: [[another]] } : undefined);
  return { text: T.unsentToast };
}

// s:<code> — same as opening the link again.
async function onSendAnother(q, code) {
  const owner = await getUserByCode(code);
  const chat_id = q.from.id;
  let text = T.invalidLink;
  if (owner?.paused) text = T.ownerPaused(owner);
  else if (owner) {
    await setState(chat_id, 'sending_to', owner.id);
    text = T.sendPrompt(owner);
  }
  await safeApi('sendMessage', { chat_id, text });
  return {};
}

// --- owner settings --------------------------------------------------------------

// /types toggle: k:<kind>
async function onKindButton(q, kind) {
  if (!KINDS.includes(kind)) return {};
  const user = await getOrCreateUser(q.from);
  const next = toggleKind(user, kind);
  if (!next) return { text: T.typesLastOne, show_alert: true };
  await setAccepts(user.id, next);
  const updated = { ...user, accepts: next };
  if (q.message) await editButtonMessage(q, T.typesMenu(acceptedKinds(updated)), typesKeyboard(updated));
  return {};
}

// /text "back to default" button: x:reset
async function onTextReset(q) {
  const user = await getOrCreateUser(q.from);
  await setPrompt(user.id, null);
  await setState(user.id, 'idle');
  await safeApi('sendMessage', { chat_id: user.id, text: T.textReset({ ...user, prompt: null }) });
  return { text: T.textResetToast };
}

// /blocked: ub:<rowid>
async function onUnblock(q, rowid) {
  await unblock(q.from.id, rowid);
  const { text, reply_markup } = await blockedView(q.from.id);
  await editButtonMessage(q, text, reply_markup);
  return { text: T.unblockedToast };
}

// /newlink: n:yes|no
async function onNewlink(q, answer) {
  const user = await getUser(q.from.id);
  if (!user) await editButtonMessage(q, T.needLink);
  else if (answer !== 'yes') await editButtonMessage(q, T.confirmCancelled);
  else await editButtonMessage(q, T.newlinkDone(await personalLink(await resetCode(user.id))));
  return {};
}

// /delete: d:yes|no
async function onDelete(q, answer) {
  if (answer !== 'yes') {
    await editButtonMessage(q, T.confirmCancelled);
    return {};
  }
  await deleteUserData(q.from.id);
  await editButtonMessage(q, T.deleted);
  return {};
}

// ⚙️ Settings: st:pause|resume toggle in place; the rest run their command.
const SETTINGS_OPS = ['text', 'types', 'qr', 'blocked', 'newlink', 'delete'];
async function onSettings(q, op) {
  const user = await getOrCreateUser(q.from);
  if (op === 'pause' || op === 'resume') {
    const paused = op === 'pause';
    await setPaused(user.id, paused);
    const locale = user.locale || normalizeLocale(q.from.language_code);
    const { text, reply_markup } = settingsView({ ...user, paused }, locale);
    await editButtonMessage(q, text, reply_markup);
    return { text: t(locale, paused ? 'settings_paused' : 'settings_receiving') };
  }
  if (!SETTINGS_OPS.includes(op)) return {};
  await setState(user.id, 'idle'); // like any command, abandons a pending send/reply/edit
  await command({ chat: { id: q.from.id }, from: q.from }, { cmd: op, arg: '' });
  return {};
}

// q:me
async function onQr(q) {
  await sendQr(await getOrCreateUser(q.from));
  return {};
}

// --- admin -----------------------------------------------------------------------

// ab: ban, ad: dismiss, au: unban — <reportId>
async function onAdminButton(q, action, reportId) {
  if (!isAdmin(q.from.id)) return {};
  const report = await db.select().from(reports).where(eq(reports.id, reportId)).get();
  if (!report) return {};

  let status, toast;
  if (action === 'ab') {
    await ban(report.senderId, reportId);
    [status, toast] = ['banned', T.bannedToast];
  } else if (action === 'au') {
    await unban(report.senderId);
    [status, toast] = ['dismissed', T.unbannedToast];
  } else {
    [status, toast] = ['dismissed', T.dismissedToast];
  }
  await db.update(reports).set({ status }).where(eq(reports.id, reportId));
  if (q.message) {
    await safeApi('editMessageReplyMarkup', {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      reply_markup: reportKeyboard({ ...report, status }),
    });
  }
  return { text: toast };
}

// am:refresh|reports|bans — the /admin dashboard's buttons.
async function onDashboardButton(q, value) {
  if (!isAdmin(q.from.id)) return {};
  if (value === 'refresh') {
    const { text, reply_markup } = await dashboardView();
    await editButtonMessage(q, text, reply_markup);
    return { text: T.adminRefreshedToast };
  }
  if (value === 'reports') await sendOpenReports(q.from.id);
  else if (value === 'bans') {
    const { text, reply_markup } = await bansView();
    await safeApi('sendMessage', { chat_id: q.from.id, text, ...(reply_markup && { reply_markup }) });
  }
  return {};
}

// bu:<createdAt>.<rank> — unban from the /bans list.
async function onBansUnban(q, ref) {
  if (!isAdmin(q.from.id)) return {};
  await unbanAt(ref);
  const { text, reply_markup } = await bansView();
  await editButtonMessage(q, text, reply_markup);
  return { text: T.unbannedToast };
}

// bc:<adminMsgId> sends (or resumes) a broadcast, bc:no drops it. A broadcast
// outlives the callback's answer window, so this answers the button itself
// (returns null) before it starts sending.
async function onBroadcastButton(q, value) {
  if (!isAdmin(q.from.id)) return {};
  if (value === 'no') {
    await editButtonMessage(q, T.broadcastCancelled);
    return {};
  }
  const sourceMsgId = Number(value);
  if (!Number.isSafeInteger(sourceMsgId)) return {};
  await api.answerCallbackQuery({ callback_query_id: q.id, text: T.broadcastStartedToast }).catch(() => {});
  const resume = { inline_keyboard: [[{ text: T.btnBroadcastResume, callback_data: `bc:${sourceMsgId}` }]] };
  const result = await runBroadcast(q.from.id, sourceMsgId, (text, done) => editButtonMessage(q, text, done ? undefined : resume));
  if (result === 'busy') await safeApi('sendMessage', { chat_id: q.from.id, text: T.broadcastBusy });
  if (result === 'done') await editButtonMessage(q, T.broadcastAlreadyDone);
  return null;
}

export default async function (q, ctx) {
  let answer = {};
  try {
    const [action, value = ''] = (q.data ?? '').split(':');
    const id = /^\d+$/.test(value) ? Number(value) : null;
    if (action === 'k') answer = await onKindButton(q, value);
    else if (action === 'x' && value === 'reset') answer = await onTextReset(q);
    else if (action === 's') answer = await onSendAnother(q, value);
    else if (action === 'n') answer = await onNewlink(q, value);
    else if (action === 'd') answer = await onDelete(q, value);
    else if (action === 'q') answer = await onQr(q);
    else if (action === 'am') answer = await onDashboardButton(q, value);
    else if (action === 'bc') answer = await onBroadcastButton(q, value);
    else if (action === 'bu') answer = await onBansUnban(q, value);
    else if (action === 'lang') answer = await onLanguage(q, value);
    else if (action === 'st') answer = await onSettings(q, value);
    else if (id === null) answer = {};
    else if (['r', 'b', 'p'].includes(action)) answer = await onMessageButton(q, action, id);
    else if (action === 'u') answer = await onUnsend(q, id);
    else if (action === 'ub') answer = await onUnblock(q, id);
    else if (['ab', 'ad', 'au'].includes(action)) answer = await onAdminButton(q, action, id);
  } catch (e) {
    console.error('callback_query handler failed', e);
  } finally {
    if (answer) {
      try {
        await api.answerCallbackQuery({ callback_query_id: q.id, ...answer });
      } catch (e) {
        console.warn(`answerCallbackQuery failed: ${e.code ?? ''} ${e.description ?? e.message}`);
      }
    }
  }
}
