// A user's unfinished step (the ➕ New sync wizard, or text the bot waits for).

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { drafts } from '../schema.js';

export async function getDraft(userId) {
  return (await db.select().from(drafts).where(eq(drafts.userId, userId)).get())?.data ?? null;
}

export async function setDraft(userId, data) {
  await db.insert(drafts).values({ userId, data })
    .onConflictDoUpdate({ target: drafts.userId, set: { data } }).run();
}

/** Merge `patch` into the draft and return the result. */
export async function patchDraft(userId, patch) {
  const data = { ...(await getDraft(userId)), ...patch };
  await setDraft(userId, data);
  return data;
}

export async function clearDraft(userId) {
  await db.delete(drafts).where(eq(drafts.userId, userId)).run();
}
