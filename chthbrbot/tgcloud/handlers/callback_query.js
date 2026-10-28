// handlers/callback_query.js — inline buttons:
//   owner, under a received message: Reply / Block / Report  r:/b:/p:<messageId>,
//                                    Answer publicly a:<messageId>
//   sender, under "delivered":       Unsend u:<messageId>, Send another s:<code>
//   any prompt:                      Cancel c:x
//   ⚙️ Settings st:<op> (st:home = back to it), message types k:<kind>,
//   invitation reset x:reset, hidden words w:<index>|all, options o:<option>,
//   unblock ub:<rowid>, new link n:yes|no,
//   delete d:yes|no, QR code q:me, language lang:<code>, ℹ️ About's ⭐ Tip tip|tip:back
//   admin, under a report:           Ban / Dismiss / Unban  ab:/ad:/au:<reportId>
//   admin, /admin dashboard am:refresh|reports|bans, /bans unban bu:<createdAt>.<rank>,
//   /broadcast send bc:<adminMsgId>|no

import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { messages, blocks, reports } from '../schema.js';
import { KINDS, SOURCE_URL, UNSEND_WINDOW_SEC } from '../lib/config.js';
import { aboutKeyboard, isTipCallback, onTipCallback } from '../lib/tips.js';
import {
  ban, bansView, dashboardView, isAdmin, maybeAutoBan, reportKeyboard, runBroadcast, sendOpenReports, sendReport, unban,
  unbanAt,
} from '../lib/admin.js';
import { answerQuery } from '../lib/answer.js';
import { cancelRow, closeScreen, drop, isScreen, setLocale, showScreen, textsFor } from '../lib/chats.js';
import { toggleKind } from '../lib/content.js';
import { ownerWords } from '../lib/filter.js';
import { unsend } from '../lib/delivery.js';
import { LOCALE_NAMES } from '../lib/i18n.js';
import {
  blockedView, confirmView, optionsView, sendHome, sendQr, settingsView, textView, typesView, unblock, wordsView,
} from '../lib/manage.js';
import { markAllSeenQuietly, markSeen, showTyping } from '../lib/receipts.js';
import {
  deleteUserData, getOrCreateUser, getUser, getUserByCode, OPTIONS, resetCode, setAccepts, setOption, setPaused,
  setPrompt, setState, setWords,
} from '../lib/users.js';
import { now, personalLink, safeApi, supportsInline } from '../lib/util.js';

// Replaces the text (and buttons) of the message the button was on.
async function editButtonMessage(q, text, reply_markup) {
  if (!q.message) return safeApi('sendMessage', { chat_id: q.from.id, text, ...(reply_markup && { reply_markup }) });
  return safeApi('editMessageText', {
    chat_id: q.message.chat.id,
    message_id: q.message.message_id,
    text,
    link_preview_options: { is_disabled: true },
    ...(reply_markup && { reply_markup }),
  });
}

// A screen opened from a button: edits the button's message in place when that
// message is the open screen, otherwise opens a new screen.
async function openScreen(q, { text, reply_markup }) {
  if (q.message && await isScreen(q.from.id, q.message.message_id)) {
    const edited = await editButtonMessage(q, text, reply_markup);
    if (edited) return edited;
  }
  return showScreen(q.from.id, { text, ...(reply_markup && { reply_markup }) });
}

// lang:<code> — save it, then re-send home so the reply keyboard is relabelled
// (that also removes the picker).
async function onLanguage(q, value) {
  await setLocale(q.from.id, value);
  const L = await textsFor(q.from);
  await sendHome(q.from, L);
  return { text: L.languageSet(LOCALE_NAMES[value] ?? value) };
}

// c:x — a prompt's ✖️ Cancel: back to idle, and the prompt goes away.
async function onCancel(q, L) {
  await setState(q.from.id, 'idle');
  if (q.message && !(await isScreen(q.from.id, q.message.message_id))) await drop(q.from.id, q.message.message_id);
  await closeScreen(q.from.id);
  return { text: L.cancelled };
}

// --- owner: buttons under a received message ------------------------------------

async function onMessageButton(q, action, messageId, L) {
  const userId = q.from.id;
  const msg = await db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!msg || msg.ownerId !== userId) return { text: L.notYourMessage };

  const underIt = q.message && { reply_parameters: { message_id: q.message.message_id, allow_sending_without_reply: true } };

  if (action === 'r') {
    await setState(userId, 'replying_to', msg.id);
    await showScreen(userId, {
      text: L.replyPrompt,
      reply_markup: { inline_keyboard: [cancelRow(L)] },
      ...underIt,
    });
    await showTyping(await getUser(userId), msg.senderChatId);
    return {};
  }

  if (action === 'a') return onAnswerPublicly(q, msg, underIt, L);

  if (action === 'b') {
    await db.insert(blocks)
      .values({ ownerId: userId, senderId: msg.senderId, createdAt: now() })
      .onConflictDoNothing();
    await showScreen(userId, { text: L.blocked });
    return { text: L.blockedToast };
  }

  if (action === 'p') {
    const [report] = await db.insert(reports)
      .values({ messageId: msg.id, ownerId: userId, senderId: msg.senderId, status: 'open', createdAt: now() })
      .onConflictDoNothing({ target: reports.messageId })
      .returning();
    if (!report) return { text: L.alreadyReported };
    await showScreen(userId, { text: L.reported });
    const autoBanned = await maybeAutoBan(report);
    await sendReport(autoBanned ? { ...report, status: 'banned' } : report, msg, { autoBanned });
    return { text: L.reportedToast };
  }

  return {};
}

// a:<messageId> — the question is the text or caption of the message the button
// is under (see lib/answer.js). With inline mode: a button that opens the chat
// picker with the question prefilled. Without: a card to forward, question only.
async function onAnswerPublicly(q, msg, underIt, L) {
  const question = (q.message?.text ?? q.message?.caption ?? '').trim();
  if (!question || msg.status !== 'delivered') return { text: L.answerUnavailable, show_alert: true };
  const owner = await getUser(q.from.id);
  if (await supportsInline()) {
    await showScreen(q.from.id, {
      text: L.answerHowTo,
      reply_markup: { inline_keyboard: [[{ text: L.btnAnswerPost, switch_inline_query: answerQuery(question) }], cancelRow(L)] },
      ...underIt,
    });
    return {};
  }
  await safeApi('sendMessage', {
    chat_id: q.from.id,
    text: L.answerCard(question, ''),
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: L.btnSendAnon(owner), url: await personalLink(owner.code) }]] },
  });
  return { text: L.answerForwardToast, show_alert: true };
}

// --- sender: buttons under "delivered" ----------------------------------------

// u:<messageId>
async function onUnsend(q, messageId, L) {
  const msg = await db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!msg || msg.senderId !== q.from.id) return { text: L.notYourMessage };
  if (msg.status === 'unsent') return { text: L.alreadyUnsent };
  if (now() - msg.createdAt > UNSEND_WINDOW_SEC) {
    return { text: L.unsendTooLate(Math.round(UNSEND_WINDOW_SEC / 60)), show_alert: true };
  }
  await unsend(msg);
  // Keep "send another" if it was there.
  const another = q.message?.reply_markup?.inline_keyboard?.flat().find((b) => b.callback_data?.startsWith('s:'));
  await editButtonMessage(q, L.unsent(await getUser(msg.ownerId)),
    another ? { inline_keyboard: [[another]] } : undefined);
  return { text: L.unsentToast };
}

// s:<code> — same as opening the link again.
async function onSendAnother(q, code, L) {
  const owner = await getUserByCode(code);
  const chat_id = q.from.id;
  if (!owner) return showScreen(chat_id, { text: L.invalidLink }).then(() => ({}));
  if (owner.paused) return showScreen(chat_id, { text: L.ownerPaused(owner) }).then(() => ({}));
  await setState(chat_id, 'sending_to', owner.id);
  await showScreen(chat_id, { text: L.sendPrompt(owner), reply_markup: { inline_keyboard: [cancelRow(L)] } });
  return {};
}

// --- owner settings --------------------------------------------------------------

// Message types toggle: k:<kind>
async function onKindButton(q, kind, L) {
  if (!KINDS.includes(kind)) return {};
  const user = await getOrCreateUser(q.from);
  const next = toggleKind(user, kind);
  if (!next) return { text: L.typesLastOne, show_alert: true };
  await setAccepts(user.id, next);
  if (q.message) await openScreen(q, typesView({ ...user, accepts: next }, L));
  return {};
}

// Invitation text "back to default": x:reset
async function onTextReset(q, L) {
  const user = await getOrCreateUser(q.from);
  await setPrompt(user.id, null);
  await setState(user.id, 'idle');
  await openScreen(q, {
    text: L.textReset({ ...user, prompt: null }),
    reply_markup: { inline_keyboard: [[{ text: L.btnBack, callback_data: 'st:home' }]] },
  });
  return { text: L.textResetToast };
}

// Hidden words: w:<index> removes one, w:all all of them. The editor stays open.
async function onWordButton(q, value, L) {
  const user = await getOrCreateUser(q.from);
  const words = ownerWords(user);
  const next = value === 'all' ? [] : words.filter((_, i) => String(i) !== value);
  await setWords(user.id, next);
  await openScreen(q, wordsView({ ...user, words: next }, L));
  return { text: L.wordsRemovedToast };
}

// Options: o:<option> toggles it.
async function onOption(q, option, L) {
  if (!OPTIONS.includes(option)) return {};
  const user = await getOrCreateUser(q.from);
  const on = !user[option];
  await setOption(user.id, option, on);
  if (option === 'seenReceipts' && on) await markAllSeenQuietly(user.id);
  await openScreen(q, optionsView({ ...user, [option]: on }, L));
  return { text: on ? L.optionOn : L.optionOff };
}

// Unblock: ub:<rowid>
async function onUnblock(q, rowid, L) {
  await unblock(q.from.id, rowid);
  await openScreen(q, await blockedView(q.from.id, L));
  return { text: L.unblockedToast };
}

// New link: n:yes|no
async function onNewlink(q, answer, L) {
  const user = await getUser(q.from.id);
  if (!user) await openScreen(q, { text: L.needLink });
  else if (answer !== 'yes') await openScreen(q, settingsView(user, L));
  else await openScreen(q, { text: L.newlinkDone(await personalLink(await resetCode(user.id))) });
  return answer === 'yes' ? {} : { text: L.confirmCancelled };
}

// Delete: d:yes|no
async function onDelete(q, answer, L) {
  if (answer !== 'yes') {
    const user = await getUser(q.from.id);
    await openScreen(q, user ? settingsView(user, L) : { text: L.needLink });
    return { text: L.confirmCancelled };
  }
  await deleteUserData(q.from.id);
  await editButtonMessage(q, L.deleted);
  return {};
}

// ⚙️ Settings: st:pause|resume toggle in place; the rest open their sub-screen in
// the same message; st:home goes back to Settings.
async function onSettings(q, op, L) {
  const user = await getOrCreateUser(q.from);
  if (op === 'pause' || op === 'resume') {
    const paused = op === 'pause';
    await setPaused(user.id, paused);
    await openScreen(q, settingsView({ ...user, paused }, L));
    return { text: paused ? L.settingsPaused : L.settingsReceiving };
  }
  await setState(user.id, 'idle'); // abandons a pending send/reply/edit
  switch (op) {
    case 'home':    await openScreen(q, settingsView(user, L)); break;
    case 'types':   await openScreen(q, typesView(user, L)); break;
    case 'options': await openScreen(q, optionsView(user, L)); break;
    case 'blocked': await openScreen(q, await blockedView(user.id, L)); break;
    case 'qr':      await sendQr(user, L); break;
    case 'newlink': await openScreen(q, confirmView(L.newlinkConfirm, 'n', L.btnNewlinkYes, L)); break;
    case 'delete':  await openScreen(q, confirmView(L.deleteConfirm, 'd', L.btnDeleteYes, L)); break;
    case 'text':
      await setState(user.id, 'setting_prompt');
      await openScreen(q, textView(user, L));
      break;
    case 'words':
      await setState(user.id, 'setting_words');
      await openScreen(q, wordsView(user, L));
      break;
  }
  return {};
}

// --- admin -----------------------------------------------------------------------

// ab: ban, ad: dismiss, au: unban — <reportId>
async function onAdminButton(q, action, reportId, L) {
  if (!isAdmin(q.from.id)) return {};
  const report = await db.select().from(reports).where(eq(reports.id, reportId)).get();
  if (!report) return {};

  let status, toast;
  if (action === 'ab') {
    await ban(report.senderId, reportId);
    [status, toast] = ['banned', L.bannedToast];
  } else if (action === 'au') {
    await unban(report.senderId);
    [status, toast] = ['dismissed', L.unbannedToast];
  } else {
    [status, toast] = ['dismissed', L.dismissedToast];
  }
  await db.update(reports).set({ status }).where(eq(reports.id, reportId));
  if (q.message) {
    await safeApi('editMessageReplyMarkup', {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      reply_markup: reportKeyboard({ ...report, status }, L),
    });
  }
  return { text: toast };
}

// am:refresh|reports|bans — the /admin dashboard's buttons.
async function onDashboardButton(q, value, L) {
  if (!isAdmin(q.from.id)) return {};
  if (value === 'refresh') {
    const { text, reply_markup } = await dashboardView(L);
    await editButtonMessage(q, text, reply_markup);
    return { text: L.adminRefreshedToast };
  }
  if (value === 'reports') await sendOpenReports(q.from.id, L);
  else if (value === 'bans') {
    const { text, reply_markup } = await bansView(L);
    await safeApi('sendMessage', { chat_id: q.from.id, text, ...(reply_markup && { reply_markup }) });
  }
  return {};
}

// bu:<createdAt>.<rank> — unban from the /bans list.
async function onBansUnban(q, ref, L) {
  if (!isAdmin(q.from.id)) return {};
  await unbanAt(ref);
  const { text, reply_markup } = await bansView(L);
  await editButtonMessage(q, text, reply_markup);
  return { text: L.unbannedToast };
}

// bc:<adminMsgId> sends (or resumes) a broadcast, bc:no drops it. A broadcast
// outlives the callback's answer window, so this answers the button itself
// (returns null) before it starts sending.
async function onBroadcastButton(q, value, L) {
  if (!isAdmin(q.from.id)) return {};
  if (value === 'no') {
    await editButtonMessage(q, L.broadcastCancelled);
    return {};
  }
  const sourceMsgId = Number(value);
  if (!Number.isSafeInteger(sourceMsgId)) return {};
  await api.answerCallbackQuery({ callback_query_id: q.id, text: L.broadcastStartedToast }).catch(() => {});
  const resume = { inline_keyboard: [[{ text: L.btnBroadcastResume, callback_data: `bc:${sourceMsgId}` }]] };
  const result = await runBroadcast(q.from.id, sourceMsgId, (text, done) => editButtonMessage(q, text, done ? undefined : resume), L);
  if (result === 'busy') await safeApi('sendMessage', { chat_id: q.from.id, text: L.broadcastBusy });
  if (result === 'done') await editButtonMessage(q, L.broadcastAlreadyDone);
  return null;
}

export default async function (q, ctx) {
  let answer = {};
  try {
    const [action, value = ''] = (q.data ?? '').split(':');
    const id = /^\d+$/.test(value) ? Number(value) : null;
    const L = await textsFor(q.from);
    await markSeen(q.from.id);
    if (action === 'k') answer = await onKindButton(q, value, L);
    else if (action === 'w') answer = await onWordButton(q, value, L);
    else if (action === 'o') answer = await onOption(q, value, L);
    else if (action === 'x' && value === 'reset') answer = await onTextReset(q, L);
    else if (action === 'c') answer = await onCancel(q, L);
    else if (action === 's') answer = await onSendAnother(q, value, L);
    else if (action === 'n') answer = await onNewlink(q, value, L);
    else if (action === 'd') answer = await onDelete(q, value, L);
    else if (action === 'q') answer = (await sendQr(await getOrCreateUser(q.from), L), {});
    else if (action === 'am') answer = await onDashboardButton(q, value, L);
    else if (action === 'bc') answer = await onBroadcastButton(q, value, L);
    else if (action === 'bu') answer = await onBansUnban(q, value, L);
    else if (action === 'lang') answer = await onLanguage(q, value);
    else if (action === 'st') answer = await onSettings(q, value, L);
    else if (isTipCallback(q.data)) answer = await onTipCallback(q, L.locale, aboutKeyboard(L.locale, SOURCE_URL)); // answers itself
    else if (id === null) answer = {};
    else if (['r', 'b', 'p', 'a'].includes(action)) answer = await onMessageButton(q, action, id, L);
    else if (action === 'u') answer = await onUnsend(q, id, L);
    else if (action === 'ub') answer = await onUnblock(q, id, L);
    else if (['ab', 'ad', 'au'].includes(action)) answer = await onAdminButton(q, action, id, L);
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
