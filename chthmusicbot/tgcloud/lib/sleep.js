// 😴 The sleep timer of a chat: at its time the Spotify it's for is paused —
// the group player's host's (the chat is told), or, in a chat without a player,
// that of whoever set it (they're told in private).
//
// tgcloud has no cron, so nothing runs at a time on its own. Due timers fire
// (fireDueTimers) at the start of every update the bot handles and every Mini
// App call, and an open Mini App calls in when its own clock reaches the time.
// On a quiet bot with the Mini App closed, a timer can be late.

import { api, db } from 'sdk';
import { and, eq, lt } from 'sdk/db';
import { sleepTimers } from '../schema.js';
import { providerOf } from './providers/index.js';
import { getAccount } from './accounts.js';
import { getPlayer, refreshCard } from './player.js';
import { localeFor } from './i18n.js';
import { t } from './strings.js';
import { now } from './util.js';

export const SLEEP_MINUTES = [5, 15, 30, 45, 60, 90, 120];

const spotify = providerOf('spotify');

export const getTimer = (chatId) => db.select().from(sleepTimers).where(eq(sleepTimers.chatId, chatId)).get();

export async function setTimer(chatId, threadId, { userId, setBy, minutes }) {
  const row = { chatId, threadId, userId, setBy, at: now() + minutes * 60, createdAt: now() };
  await db.insert(sleepTimers).values(row).onConflictDoUpdate({ target: sleepTimers.chatId, set: row }).run();
  return row;
}

export const clearTimer = (chatId) => db.delete(sleepTimers).where(eq(sleepTimers.chatId, chatId)).run();

async function fire(row) {
  const acct = await getAccount(row.userId, 'spotify');
  if (acct) await spotify.pause(acct).catch((e) => console.warn('sleep pause failed', row.chatId, e.message));
  const player = await getPlayer(row.chatId);
  const locale = await localeFor({ id: row.setBy ?? row.userId });
  if (player && player.hostId === row.userId) {
    await api.sendMessage({ chat_id: row.chatId, message_thread_id: row.threadId || undefined, text: t(locale, 'sleep_done') })
      .catch((e) => console.warn('sleep note failed', row.chatId, e.description ?? e.message));
    await refreshCard(player);
  } else {
    await api.sendMessage({ chat_id: row.userId, text: t(locale, 'sleep_done_private') }).catch(() => {});
  }
}

/** Fire every timer whose time has come. Never throws. */
export async function fireDueTimers() {
  try {
    const due = await db.select().from(sleepTimers).where(lt(sleepTimers.at, now() + 1)).all();
    for (const row of due) {
      // Claim it first: two updates at once mustn't both fire it.
      const res = await db.delete(sleepTimers).where(and(eq(sleepTimers.chatId, row.chatId), eq(sleepTimers.at, row.at))).run();
      if (!res?.rowsAffected) continue;
      await fire(row);
    }
  } catch (e) {
    console.warn('sleep timers failed', e.message);
  }
}
