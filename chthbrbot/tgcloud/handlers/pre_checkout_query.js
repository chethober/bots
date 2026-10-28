// handlers/pre_checkout_query.js — the last check before Telegram takes the Stars for a
// ⭐ tip (lib/tips.js). Telegram needs an answer within 10 seconds.

import { answerTipCheckout } from '../lib/tips.js';

export default async function (q) {
  try {
    await answerTipCheckout(q);
  } catch (e) {
    console.error(e);
  }
}
