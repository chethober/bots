// endpoints/shop.js — the Mini App's 💎 Buy chips: every pack with its Stars invoice link,
// which the app opens with Telegram.WebApp.openInvoice. Chips are credited by the
// successful_payment message (handlers/message.js), not here.

import { caller } from '../lib/mini.js';
import { invoiceLinks } from '../lib/shop.js';
import { PACKS } from '../lib/config.js';

export default async function (input, ctx) {
  const me = await caller(ctx);
  const links = await invoiceLinks('en'); // the Mini App is English
  return { chips: me.chips, packs: PACKS.map((p, i) => ({ stars: p.stars, chips: p.chips, link: links[i] })) };
}
