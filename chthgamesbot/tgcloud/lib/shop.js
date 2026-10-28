// 💎 Buy chips with Telegram Stars. One way only: chips can be bought, never sold, cashed
// out or transferred. Flow: invoice link (chat screen or Mini App) → pre_checkout_query
// (handlers/pre_checkout_query.js checks the pack) → message.successful_payment (credited
// here, once per charge id) → optional refund by an admin, or Telegram's refunded_payment.

import { api, db } from 'sdk';
import { eq, and, sql, desc } from 'sdk/db';
import { players, purchases } from '../schema.js';
import { PACKS } from './config.js';
import { chips } from './ui.js';
import { t } from './strings.js';

// Invoice payload: `chips:<pack>:<stars>:<chips>`, so a pack edited after the invoice was
// issued is refused instead of paying out the new amount.
const payloadOf = (i) => `chips:${i}:${PACKS[i].stars}:${PACKS[i].chips}`;

// The pack a payload names, or null if it no longer matches PACKS.
export function packOf(payload) {
  const [tag, i, stars, n] = String(payload ?? '').split(':');
  const pack = PACKS[Number(i)];
  if (tag !== 'chips' || !pack || pack.stars !== Number(stars) || pack.chips !== Number(n)) return null;
  return { index: Number(i), ...pack };
}

// Checks the currency and amount, as the payment arrives (pre-checkout and after).
export function validPayment(p) {
  const pack = packOf(p?.invoice_payload);
  return pack && p.currency === 'XTR' && p.total_amount === pack.stars ? pack : null;
}

// One reusable invoice link per pack. Works from a chat button (url) and from the Mini App
// (Telegram.WebApp.openInvoice).
export async function invoiceLinks(locale) {
  return Promise.all(PACKS.map((p, i) => api.createInvoiceLink({
    title: t(locale, 'pack_title', { chips: chips(p.chips) }),
    description: t(locale, 'pack_desc', { chips: chips(p.chips) }),
    payload: payloadOf(i),
    currency: 'XTR',
    prices: [{ label: t(locale, 'pack_title', { chips: chips(p.chips) }), amount: p.stars }],
  })));
}

// Records a successful payment and credits the chips, once per charge id.
// Returns the updated player, or null if this charge was already recorded.
export async function creditPayment(userId, payment) {
  const pack = validPayment(payment);
  if (!pack) throw new Error('payment for an unknown pack');
  const charge = payment.telegram_payment_charge_id;
  const [row] = await db.insert(purchases)
    .values({ charge, userId, pack: pack.index, stars: pack.stars, chips: pack.chips })
    .onConflictDoNothing({ target: purchases.charge })
    .returning();
  if (!row) return null;
  const [me] = await db.update(players)
    .set({ chips: sql`${players.chips} + ${pack.chips}` })
    .where(eq(players.id, userId))
    .returning();
  if (!me) throw new Error(`no player ${userId}`);
  await db.update(purchases).set({ credited: true }).where(eq(purchases.charge, charge)).run();
  return me;
}

// Marks a purchase refunded and takes its chips back (down to zero, never below).
// Returns { purchase, player } or null if it's unknown or already refunded.
export async function revokePurchase(charge) {
  const [row] = await db.update(purchases)
    .set({ refunded: true })
    .where(and(eq(purchases.charge, charge), eq(purchases.refunded, false)))
    .returning();
  if (!row) return null;
  const take = row.credited ? row.chips : 0;
  const [player] = await db.update(players)
    .set({ chips: sql`max(${players.chips} - ${take}, 0)` })
    .where(eq(players.id, row.userId))
    .returning();
  return { purchase: row, player };
}

// Admin /refund: returns the Stars through Telegram, then takes the chips back.
export async function refundPurchase(charge) {
  const row = await db.select().from(purchases).where(eq(purchases.charge, charge)).get();
  if (!row) throw new Error('No such payment.');
  if (row.refunded) throw new Error('Already refunded.');
  await api.refundStarPayment({ user_id: row.userId, telegram_payment_charge_id: charge });
  return revokePurchase(charge);
}

export function recentPurchases(userId, limit = 5) {
  return db.select().from(purchases).where(eq(purchases.userId, userId)).orderBy(desc(purchases.created)).limit(limit);
}
