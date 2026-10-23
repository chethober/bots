// Admin (ADMIN_IDS) tools shared by commands and buttons: reports, bans, the
// bot-wide dashboard and broadcasts. Everything here checks isAdmin() itself or is
// only reached after the caller did.

import { api, db, BotApiError } from 'sdk';
import { and, desc, eq, ne, sql } from 'sdk/db';
import { messages, reports, bans, broadcasts } from '../schema.js';
import { ADMIN_IDS } from './config.js';
import { T } from './texts.js';
import { getUser } from './users.js';
import { isUnreachable, now, safeApi } from './util.js';

export const isAdmin = (userId) => ADMIN_IDS.includes(userId);

// --- reports ---------------------------------------------------------------------

export function reportKeyboard(report) {
  const id = report.id;
  if (report.status === 'banned') return { inline_keyboard: [[{ text: T.btnBanned, callback_data: `au:${id}` }]] };
  if (report.status === 'dismissed') return { inline_keyboard: [[{ text: T.btnDismissed, callback_data: `ab:${id}` }]] };
  return {
    inline_keyboard: [[
      { text: T.btnBan, callback_data: `ab:${id}` },
      { text: T.btnDismiss, callback_data: `ad:${id}` },
    ]],
  };
}

// Copies the reported message to the admins (all, or `adminIds`) with Ban /
// Dismiss buttons. copyMessage (not forward), so the sender's identity isn't
// attached. `msg` is the messages row the report is about.
export async function sendReport(report, msg, adminIds = ADMIN_IDS) {
  if (!adminIds.length) return;
  const owner = await getUser(report.ownerId);
  const prior = await db.$count(reports, and(eq(reports.senderId, report.senderId), ne(reports.id, report.id)));
  const text = T.adminReport(report, owner, prior);
  const reply_markup = reportKeyboard(report);
  for (const chat_id of adminIds) {
    if (!(await safeApi('sendMessage', { chat_id, text }))) continue;
    const copy = await safeApi('copyMessage', {
      chat_id, from_chat_id: msg.senderChatId, message_id: msg.senderMsgId, reply_markup,
    }) ?? (msg.ownerMsgId && await safeApi('copyMessage', {
      chat_id, from_chat_id: msg.ownerId, message_id: msg.ownerMsgId, reply_markup,
    }));
    if (!copy) await safeApi('sendMessage', { chat_id, text: T.adminMessageGone, reply_markup });
  }
}

const REPORTS_LIMIT = 5;

// /reports: re-sends the oldest open reports to the admin `chatId`, so none get lost.
export async function sendOpenReports(chatId) {
  const open = await db.select().from(reports).where(eq(reports.status, 'open'))
    .orderBy(reports.id).limit(REPORTS_LIMIT + 1).all();
  if (!open.length) return safeApi('sendMessage', { chat_id: chatId, text: T.adminNoReports });
  const total = await db.$count(reports, eq(reports.status, 'open'));
  await safeApi('sendMessage', { chat_id: chatId, text: T.adminReportsHeader(Math.min(open.length, REPORTS_LIMIT), total) });
  for (const report of open.slice(0, REPORTS_LIMIT)) {
    const msg = await db.select().from(messages).where(eq(messages.id, report.messageId)).get();
    if (msg) await sendReport(report, msg, [chatId]);
  }
}

// --- bans ------------------------------------------------------------------------

// → true if the sender wasn't banned yet.
export async function ban(senderId, reportId = null) {
  const [row] = await db.insert(bans).values({ senderId, reportId, createdAt: now() })
    .onConflictDoNothing().returning();
  return Boolean(row);
}

// → true if a ban was lifted. Reports that led to a ban read as dismissed afterwards.
export async function unban(senderId) {
  const res = await db.run(sql`DELETE FROM bans WHERE sender_id = ${senderId}`);
  await db.update(reports).set({ status: 'dismissed' })
    .where(and(eq(reports.senderId, senderId), eq(reports.status, 'banned')));
  return res.rowsAffected > 0;
}

// bu:<createdAt>.<rank> → lifts that ban; true if there was one.
export async function unbanAt(ref) {
  const [createdAt, rank] = ref.split('.').map(Number);
  if (!Number.isSafeInteger(createdAt) || !Number.isSafeInteger(rank)) return false;
  const row = await db.get(sql`
    SELECT sender_id AS senderId FROM bans WHERE created_at = ${createdAt}
    ORDER BY sender_id LIMIT 1 OFFSET ${rank}`);
  return row ? unban(row.senderId) : false;
}

const BANS_LIMIT = 30;

// The /bans message → { text, reply_markup? }. Like /blocked, the sender's id never
// reaches the client: a ban is addressed by when it was made and its rank among
// bans made that same second (bu:<createdAt>.<rank>, see unbanAt).
export async function bansView() {
  const rows = await db.select().from(bans).orderBy(desc(bans.createdAt), bans.senderId).limit(BANS_LIMIT + 1).all();
  if (!rows.length) return { text: T.adminNoBans };
  const shown = rows.slice(0, BANS_LIMIT);
  const rank = (r, i) => shown.slice(0, i).filter((o) => o.createdAt === r.createdAt).length;
  const buttons = shown.map((r, i) => ({ text: T.btnUnblock(i + 1), callback_data: `bu:${r.createdAt}.${rank(r, i)}` }));
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 5) keyboard.push(buttons.slice(i, i + 5));
  return { text: T.adminBansList(shown, rows.length > BANS_LIMIT), reply_markup: { inline_keyboard: keyboard } };
}

// --- dashboard -------------------------------------------------------------------

export async function dashboardView() {
  const dayAgo = now() - 86400;
  const weekAgo = now() - 7 * 86400;
  const [counts, byStatus, today] = await Promise.all([
    db.get(sql`SELECT
      (SELECT COUNT(*) FROM users)                                  AS users,
      (SELECT COUNT(*) FROM users WHERE paused = 1)                 AS paused,
      (SELECT COUNT(*) FROM users WHERE created_at >= ${dayAgo})    AS newDay,
      (SELECT COUNT(*) FROM users WHERE created_at >= ${weekAgo})   AS newWeek,
      (SELECT COUNT(*) FROM (SELECT user_id FROM states UNION SELECT id FROM users)) AS reach,
      (SELECT COUNT(DISTINCT sender_id) FROM messages)              AS senders,
      (SELECT COUNT(*) FROM replies)                                AS replies,
      (SELECT COUNT(*) FROM blocks)                                 AS blocks,
      (SELECT COUNT(*) FROM reports WHERE status = 'open')          AS openReports,
      (SELECT COUNT(*) FROM reports)                                AS reports,
      (SELECT COUNT(*) FROM bans)                                   AS bans`),
    db.all(sql`SELECT status, COUNT(*) AS n FROM messages GROUP BY status`),
    db.get(sql`SELECT COUNT(*) AS n FROM messages WHERE status = 'delivered' AND created_at >= ${dayAgo}`),
  ]);
  const messagesBy = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
  return {
    text: T.adminDashboard({ ...counts, messages: messagesBy, deliveredDay: today.n }),
    reply_markup: {
      inline_keyboard: [
        [{ text: T.btnAdminRefresh, callback_data: 'am:refresh' }],
        [
          { text: T.btnAdminReports(counts.openReports), callback_data: 'am:reports' },
          { text: T.btnAdminBans(counts.bans), callback_data: 'am:bans' },
        ],
      ],
    },
  };
}

// --- broadcast -------------------------------------------------------------------
// Recipients are everyone who ever talked to the bot and hasn't /delete'd: link
// owners (users) and people who opened a link (states) — except the admin sending it. Progress lives in the
// broadcasts table, so a run that is cut off (or a retried update) resumes from
// the cursor instead of sending twice.

const recipients = (adminId, after) => sql`
  SELECT id FROM (SELECT user_id AS id FROM states UNION SELECT id FROM users)
  WHERE id > ${after} AND id != ${adminId} ORDER BY id`;

export async function recipientCount(adminId) {
  const row = await db.get(sql`SELECT COUNT(*) AS n FROM (${recipients(adminId, 0)})`);
  return row.n;
}

// A run holds the broadcast for this long after its last progress; after that
// pressing the button again resumes it.
const LEASE_SEC = 60;
const BATCH = 50;
const PACE_MS = 40; // ≤ 25 messages/second, under Telegram's broadcast limit

const sleep = (ms) => typeof setTimeout === 'function'
  ? new Promise((resolve) => setTimeout(resolve, ms))
  : Promise.resolve();

// → true (delivered) / false (unreachable or failed). A flood-wait it can't sit
// out is thrown, which stops the run; the lease then lets the admin resume.
async function copyTo(chatId, adminId, sourceMsgId) {
  for (let attempt = 0; ; attempt++) {
    try {
      await api.copyMessage({ chat_id: chatId, from_chat_id: adminId, message_id: sourceMsgId });
      return true;
    } catch (e) {
      if (isUnreachable(e)) return false;
      const wait = e instanceof BotApiError && e.code === 429 ? e.parameters?.retry_after : null;
      if (wait && attempt < 3 && typeof setTimeout === 'function') {
        await sleep((wait + 1) * 1000);
        continue;
      }
      if (wait) throw e;
      console.warn(`broadcast to ${chatId} failed: ${e.code ?? ''} ${e.description ?? e.message}`);
      return false;
    }
  }
}

// Sends (or resumes) the broadcast of message `sourceMsgId` in admin `adminId`'s chat.
// `progress(text, done)` is called to show how it's going.
// → 'busy' (another run holds it) | 'done' (already finished) | 'finished'
export async function runBroadcast(adminId, sourceMsgId, progress) {
  const total = await recipientCount(adminId);
  const mine = and(eq(broadcasts.adminId, adminId), eq(broadcasts.sourceMsgId, sourceMsgId));
  await db.insert(broadcasts)
    .values({ adminId, sourceMsgId, cursor: 0, sent: 0, failed: 0, status: 'sending', lockedUntil: 0, createdAt: now() })
    .onConflictDoNothing({ target: [broadcasts.adminId, broadcasts.sourceMsgId] });
  const claim = await db.run(sql`
    UPDATE broadcasts SET locked_until = ${now() + LEASE_SEC}
    WHERE admin_id = ${adminId} AND source_msg_id = ${sourceMsgId} AND status = 'sending' AND locked_until < ${now()}`);
  if (!claim.rowsAffected) {
    const row = await db.select().from(broadcasts).where(mine).get();
    return row?.status === 'done' ? 'done' : 'busy';
  }
  let { id, cursor, sent, failed } = await db.select().from(broadcasts).where(mine).get();

  await progress(T.broadcastProgress(sent, failed, total), false);
  for (;;) {
    const batch = await db.all(sql`${recipients(adminId, cursor)} LIMIT ${BATCH}`);
    if (!batch.length) break;
    for (const { id: chatId } of batch) {
      (await copyTo(chatId, adminId, sourceMsgId)) ? sent++ : failed++;
      cursor = chatId;
      await db.update(broadcasts)
        .set({ cursor, sent, failed, lockedUntil: now() + LEASE_SEC })
        .where(eq(broadcasts.id, id));
      await sleep(PACE_MS);
    }
    await progress(T.broadcastProgress(sent, failed, total), false);
  }
  await db.update(broadcasts).set({ status: 'done', lockedUntil: 0 }).where(eq(broadcasts.id, id));
  await progress(T.broadcastDone(sent, failed), true);
  return 'finished';
}
