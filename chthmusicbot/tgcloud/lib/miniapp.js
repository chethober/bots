// Shared by the Mini App's endpoints: the caller, error mapping, and the
// "connected" note in the chat after a login.

import { EndpointError } from 'sdk';
import { LoginError } from './login.js';
import { ProviderError } from './http.js';
import { accountsView } from './views.js';
import { localeFor } from './i18n.js';
import { showScreen } from './screen.js';
import { t } from './strings.js';
import { PROVIDERS } from './providers/index.js';
import { esc } from './util.js';

export function caller(ctx) {
  const user = ctx?.initData?.user;
  if (!user?.id) throw new EndpointError('Open this from the bot', { code: 'NO_USER' });
  return user;
}

/** Run `fn`, turning expected failures into EndpointErrors the page can show. */
export async function guarded(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof EndpointError) throw e;
    if (e instanceof LoginError) throw new EndpointError(e.message, { code: e.code });
    if (e instanceof ProviderError) throw new EndpointError(e.message, { code: 'PROVIDER', status: e.status });
    throw e;
  }
}

export async function announce(user, provider, name) {
  const locale = await localeFor(user);
  const note = t(locale, 'connected', { service: PROVIDERS[provider]?.name ?? provider, name: esc(name) });
  await showScreen(user.id, await accountsView(user.id, locale, note)).catch((e) => console.warn('announce failed', e.description ?? e.message));
}
