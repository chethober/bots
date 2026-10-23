// The `chats` table: who receives alerts. Private chats subscribe on /start,
// groups and channels when the bot is added (handlers/my_chat_member.js).

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { chats } from '../schema.js';

const nowSec = () => Math.floor(Date.now() / 1000);

// Insert or refresh a chat from a Telegram Chat object. `active` (if given)
// turns its alerts on or off; a new chat starts active.
export async function upsertChat(chat, { active } = {}) {
  const now = nowSec();
  const info = {
    type: chat.type ?? 'private',
    title: chat.title ?? ([chat.first_name, chat.last_name].filter(Boolean).join(' ') || null),
    username: chat.username ?? null,
  };
  await db.insert(chats).values({ id: chat.id, ...info, active: active ?? true, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: chats.id, set: { ...info, ...(active == null ? {} : { active }), updatedAt: now } }).run();
}

export function getChat(id) {
  return db.select().from(chats).where(eq(chats.id, id)).get();
}

export async function setActive(id, active) {
  await db.update(chats).set({ active, updatedAt: nowSec() }).where(eq(chats.id, id)).run();
}

// A send failed because the chat is gone for good: the bot was blocked, kicked
// or the chat deleted. Such chats are switched off.
export function isGone(e) {
  if (e?.code === 403) return true;
  return e?.code === 400 && /chat not found|user is deactivated|PEER_ID_INVALID|have no rights/i.test(e.description ?? '');
}

// A group became a supergroup: carry its row over to the new id.
export async function migrate(oldId, newId) {
  const row = await getChat(oldId);
  if (!row) return;
  const { id, ...rest } = row;
  await db.insert(chats).values({ ...rest, id: newId, type: 'supergroup', updatedAt: nowSec() })
    .onConflictDoNothing().run();
  await setActive(oldId, false);
}
