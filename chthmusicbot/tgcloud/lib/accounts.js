// Users' connected music accounts and their access tokens.

import { db } from 'sdk';
import { and, eq } from 'sdk/db';
import { accounts } from '../schema.js';

export async function getAccount(userId, provider) {
  return db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider))).get();
}

export async function listAccounts(userId) {
  return db.select().from(accounts).where(eq(accounts.userId, userId)).all();
}

export async function saveAccount(userId, provider, fields) {
  const existing = await getAccount(userId, provider);
  if (existing) await db.update(accounts).set(fields).where(eq(accounts.id, existing.id)).run();
  else await db.insert(accounts).values({ userId, provider, ...fields }).run();
}

export async function deleteAccount(userId, provider) {
  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider))).run();
}

async function bearer(acct, refresh, force) {
  const fresh = acct.accessToken && (!acct.expiresAt || acct.expiresAt > Date.now() + 60_000);
  if (fresh && !force) return acct.accessToken;
  if (!refresh || !acct.refreshToken) return acct.accessToken;
  const t = await refresh(acct);
  acct.accessToken = t.access_token;
  acct.expiresAt = t.expires_in ? Date.now() + t.expires_in * 1000 : null;
  if (t.refresh_token) acct.refreshToken = t.refresh_token;
  await db.update(accounts)
    .set({ accessToken: acct.accessToken, expiresAt: acct.expiresAt, refreshToken: acct.refreshToken })
    .where(eq(accounts.id, acct.id)).run();
  return acct.accessToken;
}

/**
 * Run `fn(accessToken)`, refreshing the token first when it's about to expire
 * and once more when the service answers 401. `refresh(acct)` returns the
 * token endpoint's JSON (access_token, expires_in, maybe refresh_token).
 */
export async function authed(acct, refresh, fn) {
  try {
    return await fn(await bearer(acct, refresh, false));
  } catch (e) {
    if (e.status !== 401 || !refresh || !acct.refreshToken) throw e;
    return fn(await bearer(acct, refresh, true));
  }
}
