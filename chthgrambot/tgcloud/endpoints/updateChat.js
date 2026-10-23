// Mute/unmute a chat, lift a "you replied yourself" pause, or edit the contact note.
import { requireUser } from '../lib/auth.js';
import { updateChat } from '../lib/store.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  const set = {};
  if (typeof input.muted === 'boolean') set.muted = input.muted;
  if (input.unpause) set.pausedUntil = 0;
  if (typeof input.note === 'string') set.note = input.note.trim().slice(0, 300) || null;
  if (Object.keys(set).length) await updateChat(user.id, Number(input.chatId), set);
  return { ok: true };
}
