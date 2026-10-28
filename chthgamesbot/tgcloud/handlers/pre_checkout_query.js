// handlers/pre_checkout_query.js — the last check before Telegram takes the Stars for a
// 💎 chips pack (lib/shop.js). Telegram needs an answer within 10 seconds.

import { api } from 'sdk';
import { getPlayer } from '../lib/engine.js';
import { validPayment } from '../lib/shop.js';
import { normalizeLocale, playerLocale } from '../lib/i18n.js';
import { t } from '../lib/strings.js';

// Never throws (see handlers/callback_query.js); an unanswered query just fails the payment.
export default async function (q) {
  try {
    const me = await getPlayer(q.from.id);
    const locale = playerLocale(me, normalizeLocale(q.from.language_code));
    const refuse = (key) => api.answerPreCheckoutQuery({ pre_checkout_query_id: q.id, ok: false, error_message: t(locale, key) });
    if (!me) return await refuse('pay_start_first');
    if (me.banned) return await refuse('banned');
    if (!validPayment(q)) return await refuse('pay_stale');
    await api.answerPreCheckoutQuery({ pre_checkout_query_id: q.id, ok: true });
  } catch (e) {
    console.error(e);
  }
}
