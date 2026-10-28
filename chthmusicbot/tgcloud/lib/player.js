// The group player: /player in a group shares the sender's Spotify with the
// group. The card shows what's playing and what's next, with ⏮ ⏯ ⏭ for the host
// and admins. Anyone adds songs by posting a link or audio file, or through
// inline mode (➕ Add opens "@bot <song>"), while 🔁 Queue posts is on.
// Spotify only plays on the host's own devices and needs Premium; a bot can't
// stream into a Telegram voice chat.

import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { players } from '../schema.js';
import { BOT_USERNAME, QUEUED_REACTION } from './config.js';
import { providerOf } from './providers/index.js';
import { getAccount } from './accounts.js';
import { isChatAdmin, threadOf } from './chats.js';
import { resolveRef } from './tracks.js';
import { localeFor } from './i18n.js';
import { errorText } from './errors.js';
import { t } from './strings.js';
import { esc, now, trackLabel } from './util.js';

const spotify = providerOf('spotify');

export const getPlayer = (chatId) => db.select().from(players).where(eq(players.chatId, chatId)).get();

async function cardView(row) {
  const locale = await localeFor({ id: row.hostId });
  const acct = await getAccount(row.hostId, 'spotify');
  const host = acct?.name ?? String(row.hostId);
  const lines = [t(locale, 'player_title', { host: esc(host) })];
  if (!acct) {
    lines.push('', t(locale, 'player_host_gone'));
  } else {
    try {
      const state = await spotify.playerState(acct);
      if (!state?.track) {
        lines.push('', t(locale, 'player_idle'));
      } else {
        lines.push('', `${state.playing ? '▶️' : '⏸'} <b>${esc(trackLabel(state.track))}</b>${state.device ? `\n📱 ${esc(state.device)}` : ''}`);
        if (state.next.length) lines.push('', t(locale, 'player_next'), ...state.next.map((x, i) => `${i + 1}. ${esc(trackLabel(x))}`));
      }
    } catch (e) {
      lines.push('', `⚠️ ${esc(errorText(locale, e))}`);
    }
  }
  lines.push('', t(locale, row.queuePosts ? 'player_how_add' : 'player_how_add_off', { bot: BOT_USERNAME }));
  return {
    text: lines.join('\n'),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: [
        [{ text: '⏮', callback_data: 'pl:prev' }, { text: '⏯', callback_data: 'pl:play' }, { text: '⏭', callback_data: 'pl:next' }, { text: '🔄', callback_data: 'pl:ref' }],
        [{ text: t(locale, 'player_add'), switch_inline_query_current_chat: '' }],
        [{ text: t(locale, row.queuePosts ? 'queue_posts_on' : 'queue_posts_off'), callback_data: 'pl:qp' }, { text: t(locale, 'player_end'), callback_data: 'pl:end' }],
      ],
    },
  };
}

async function refreshCard(row) {
  if (!row.messageId) return;
  await api.editMessageText({ chat_id: row.chatId, message_id: row.messageId, ...await cardView(row) })
    .catch((e) => { if (!/not modified/.test(e.description ?? '')) console.warn('card edit failed', e.description); });
}

/** /player in a group: post the card (again, at the bottom), the sender hosting if nobody does. */
export async function startPlayer(message) {
  const locale = await localeFor(message.from);
  const chatId = message.chat.id;
  let row = await getPlayer(chatId);
  const hostHasSpotify = row && await getAccount(row.hostId, 'spotify');
  if (!row || !hostHasSpotify) {
    if (!(await getAccount(message.from.id, 'spotify'))) {
      return api.sendMessage({
        chat_id: chatId, message_thread_id: threadOf(message) || undefined,
        text: t(locale, 'player_need_spotify'),
        reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true },
        reply_markup: { inline_keyboard: [[{ text: t(locale, 'open_bot'), url: `https://t.me/${BOT_USERNAME}?start=accounts` }]] },
      });
    }
    row = { chatId, threadId: threadOf(message), hostId: message.from.id, messageId: null, queuePosts: 1, createdAt: now() };
    await db.insert(players).values(row).onConflictDoUpdate({ target: players.chatId, set: row }).run();
  }
  const old = row.messageId;
  const sent = await api.sendMessage({ chat_id: chatId, message_thread_id: threadOf(message) || undefined, ...await cardView(row) });
  await db.update(players).set({ messageId: sent.message_id, threadId: threadOf(message) }).where(eq(players.chatId, chatId)).run();
  if (old) await api.deleteMessage({ chat_id: chatId, message_id: old }).catch(() => {});
  await api.deleteMessage({ chat_id: chatId, message_id: message.message_id }).catch(() => {});
}

/** pl:* buttons on the card. */
export async function onPlayerCallback(q, action) {
  const locale = await localeFor(q.from);
  const answer = (text, alert = false) => api.answerCallbackQuery({ callback_query_id: q.id, text, show_alert: alert }).catch(() => {});
  const chatId = q.message?.chat?.id;
  const row = chatId && await getPlayer(chatId);
  if (!row) return answer(t(locale, 'player_ended'), true);
  if (action !== 'ref' && q.from.id !== row.hostId && !(await isChatAdmin(chatId, q.from.id))) {
    return answer(t(locale, 'player_host_only'), true);
  }
  try {
    if (action === 'end') {
      await db.delete(players).where(eq(players.chatId, chatId)).run();
      await answer();
      return api.editMessageText({ chat_id: chatId, message_id: q.message.message_id, text: t(locale, 'player_ended') }).catch(() => {});
    }
    if (action === 'qp') {
      row.queuePosts = row.queuePosts ? 0 : 1;
      await db.update(players).set({ queuePosts: row.queuePosts }).where(eq(players.chatId, chatId)).run();
    } else if (['prev', 'play', 'next'].includes(action)) {
      const acct = await getAccount(row.hostId, 'spotify');
      if (acct) await spotify.control(acct, action);
    }
    await answer();
  } catch (e) {
    await answer(errorText(locale, e).slice(0, 190), true);
  }
  row.messageId = q.message.message_id;
  return refreshCard(row);
}

/** A music post in a group with a player: queue its tracks on the host's Spotify. */
export async function queueFromPost(message, refs) {
  const row = await getPlayer(message.chat.id);
  if (!row?.queuePosts) return;
  const acct = await getAccount(row.hostId, 'spotify');
  if (!acct) return;
  let queued = 0;
  const memo = new Map();
  try {
    for (const ref of refs) {
      const hit = await resolveRef(ref, spotify, acct, memo);
      if (hit?.id) {
        await spotify.queue(acct, hit.id);
        queued++;
      }
    }
  } catch (e) {
    const locale = await localeFor(message.from);
    await api.sendMessage({
      chat_id: message.chat.id, message_thread_id: threadOf(message) || undefined,
      text: `⚠️ ${errorText(locale, e)}`, reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true },
    }).catch(() => {});
  }
  if (!queued) return;
  await api.setMessageReaction({ chat_id: message.chat.id, message_id: message.message_id, reaction: [{ type: 'emoji', emoji: QUEUED_REACTION }] }).catch(() => {});
  await refreshCard(row);
}
