// Friendly text for the errors users can do something about.

import { BotApiError } from 'sdk';
import { ProviderError } from './http.js';
import { t } from './strings.js';

const NAMES = { spotify: 'Spotify', youtube: 'YouTube Music', apple: 'Apple Music' };

export function errorText(locale, e) {
  if (e instanceof ProviderError) {
    const service = NAMES[e.provider] ?? e.provider;
    if (e.reason === 'EXPIRED') return t(locale, 'err_expired', { service });
    if (e.reason === 'NO_ACTIVE_DEVICE' || (e.status === 404 && e.provider === 'spotify' && /device/i.test(e.message))) return t(locale, 'err_no_device');
    if (e.reason === 'PREMIUM_REQUIRED') return t(locale, 'err_premium');
    if (e.reason === 'quotaExceeded') return t(locale, 'err_quota');
    if (e.reason === 'invalid_grant') return t(locale, 'err_expired', { service });
    if (e.status === 403 && /scope/i.test(e.message)) return t(locale, 'err_scope', { service });
    if (e.status === 403) return t(locale, 'err_forbidden');
    if (e.status === 429) return t(locale, 'err_rate');
    return e.message;
  }
  if (e instanceof BotApiError) {
    if (e.code === 403) return t(locale, 'err_bot_removed');
    return e.description ?? e.message;
  }
  return e?.message ?? String(e);
}
