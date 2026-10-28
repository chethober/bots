// A question on the screen that the user answers with their next message:
//   watch  words for a chat's watchlist (➕ Add), with the chat being edited
//   link   a group or channel to manage (📢 → ➕ Add)
// Kept in settings as input:<userId> = "<ms>|<kind>|<chatId>"; any button
// cancels it, and it expires after INPUT_MS.

import { getSetting, saveSetting, deleteSetting } from './settings.js';

const INPUT_MS = 15 * 60_000;

export function askFor(userId, kind, chatId = '') {
  return saveSetting(`input:${userId}`, `${Date.now()}|${kind}|${chatId}`);
}

export function cancelInput(userId) {
  return deleteSetting(`input:${userId}`);
}

// The pending question ({ kind, chatId }) or null; either way it's cleared.
export async function takeInput(userId) {
  const value = await getSetting(`input:${userId}`);
  if (!value) return null;
  await cancelInput(userId);
  const [at, kind, chatId] = value.split('|');
  if (Date.now() - Number(at) > INPUT_MS) return null;
  return { kind, chatId: Number(chatId) || null };
}
