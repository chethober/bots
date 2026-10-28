// Getting a song's audio from @chethoberbot over bot-to-bot messages: the bot
// sends it "Artist - Title", and whatever it replies is copied to the user who
// asked. Replies are matched by reply_to_message, else to the oldest open request.
// Bot-to-bot communication must be turned on for this bot in @BotFather.

import { api, db } from 'sdk';
import { and, asc, eq, gt } from 'sdk/db';
import { relays } from '../schema.js';
import { CHETHOBERBOT_ID, CHETHOBERBOT_USERNAME } from './config.js';
import { getSetting, saveSetting } from './settings.js';
import { now } from './util.js';

const WAIT = 5 * 60; // a request older than this is given up on

export const relayAvailable = () => Boolean(CHETHOBERBOT_USERNAME);

export const isRelayBot = (user) => Boolean(user?.is_bot && CHETHOBERBOT_USERNAME
  && user.username?.toLowerCase() === CHETHOBERBOT_USERNAME.toLowerCase());

async function relayBotId() {
  if (CHETHOBERBOT_ID) return CHETHOBERBOT_ID;
  const saved = Number(await getSetting('relay_bot_id'));
  if (saved) return saved;
  const chat = await api.getChat({ chat_id: `@${CHETHOBERBOT_USERNAME}` }).catch(() => null);
  if (chat?.id) await saveSetting('relay_bot_id', String(chat.id));
  return chat?.id ?? null;
}

/** Ask for a song; false if the other bot can't be reached. */
export async function requestAudio(userId, query) {
  const botId = await relayBotId();
  if (!botId) return false;
  try {
    const sent = await api.sendMessage({ chat_id: botId, text: query });
    await db.insert(relays).values({ userId, query, sentMessageId: sent.message_id, createdAt: now() }).run();
    return true;
  } catch (e) {
    console.warn('relay failed', e.description ?? e.message);
    return false;
  }
}

/** A message from @chethoberbot: pass it to whoever is waiting. */
export async function onRelayMessage(message) {
  await saveSetting('relay_bot_id', String(message.from.id));
  const replyTo = message.reply_to_message?.message_id;
  let row = replyTo ? await db.select().from(relays).where(eq(relays.sentMessageId, replyTo)).get() : null;
  row ??= await db.select().from(relays)
    .where(and(eq(relays.done, 0), gt(relays.createdAt, now() - WAIT)))
    .orderBy(asc(relays.id)).limit(1).get();
  if (!row) return;
  await api.copyMessage({ chat_id: row.userId, from_chat_id: message.chat.id, message_id: message.message_id })
    .catch((e) => console.warn('relay copy failed', e.description));
  if (message.audio || message.voice || message.document || message.video) {
    await db.update(relays).set({ done: 1 }).where(eq(relays.id, row.id)).run();
  }
}
