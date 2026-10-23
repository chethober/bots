// Stores the user's own Cloudflare Workers AI credentials (empty values remove them).
import { EndpointError } from 'sdk';
import { requireUser } from '../lib/auth.js';
import { saveCredentials, loadSettingsRow } from '../lib/settings.js';

export default async function (input, ctx) {
  const user = requireUser(ctx);
  const accountId = String(input.accountId ?? '').trim();
  let apiToken = String(input.apiToken ?? '').trim();

  if (accountId && !/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new EndpointError('Account ID should be 32 hex characters', { code: 'BAD_ACCOUNT' });
  }
  // Blank token while keeping the account ID = keep the saved token.
  if (accountId && !apiToken) apiToken = (await loadSettingsRow(user.id))?.cfApiToken ?? '';
  if (accountId && !apiToken) throw new EndpointError('API token is required', { code: 'NO_TOKEN' });
  if (apiToken.length > 200) throw new EndpointError('API token looks wrong', { code: 'BAD_TOKEN' });

  await saveCredentials(user.id, accountId, accountId ? apiToken : '');
  return { saved: true };
}
