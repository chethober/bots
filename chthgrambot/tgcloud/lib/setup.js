// Interactive in-chat wizard for connecting Cloudflare Workers AI credentials.
import { db, api } from 'sdk';
import { settings } from '../schema.js';
import { DEFAULTS, sanitize, saveCredentials, now } from './settings.js';
import { generate } from './ai.js';
import { panelKeyboard } from './ui.js';

export const CF_LINKS = {
  workersAi: 'https://dash.cloudflare.com/?to=/:account/ai/workers-ai',
  apiTokens: 'https://dash.cloudflare.com/profile/api-tokens',
  signUp: 'https://dash.cloudflare.com/sign-up',
};

const STEP1 = `🔑 Connect Cloudflare Workers AI (free) — step 1 of 2

1. Open the Workers AI dashboard below. Sign up for free if you have no account; no card is needed.
2. Click "Use REST API".
3. Copy your Account ID and paste it here.

Tip: you can also paste any dashboard link. I'll pick the ID out of it.`;

const STEP2 = `✅ Account ID saved — step 2 of 2

1. On the same "Use REST API" page, click "Create a Workers AI API Token".
2. Review it and click "Create API Token".
3. Copy the token and paste it here. Cloudflare only shows it once.

I'll delete your message right away and test the token.`;

const linkRow = () => [{ text: '🌐 Open Workers AI dashboard', url: CF_LINKS.workersAi }];
const cancelRow = () => [{ text: '✖️ Cancel', callback_data: 'setup_cancel' }];

async function setWizard(userId, wizardStep, wizardAccount) {
  const set = { wizardStep, wizardAccount, updatedAt: now() };
  await db.insert(settings).values({ userId, data: DEFAULTS, ...set })
    .onConflictDoUpdate({ target: settings.userId, set }).run();
}

export async function startSetup(chat_id, userId) {
  await setWizard(userId, 'account', null);
  await api.sendMessage({
    chat_id, text: STEP1, link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [linkRow(), [{ text: '🆕 Create a free account', url: CF_LINKS.signUp }], cancelRow()] },
  });
}

export async function cancelSetup(chat_id, userId) {
  await setWizard(userId, null, null);
  await api.sendMessage({ chat_id, text: 'Setup cancelled. Send /setup to start again.' });
}

async function askToken(chat_id) {
  await api.sendMessage({
    chat_id, text: STEP2, link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: [
        linkRow(),
        [{ text: '🗝 All API tokens (alternative)', url: CF_LINKS.apiTokens }],
        [{ text: '↩️ Change Account ID', callback_data: 'setup' }, ...cancelRow()],
      ],
    },
  });
}

// Handles a plain-text message while the wizard is active. Returns true if consumed.
export async function handleSetupInput(message, row) {
  const step = row?.wizardStep;
  if (!step) return false;
  const chat_id = message.chat.id;
  const userId = message.from.id;
  const text = (message.text ?? '').trim();

  if (step === 'account') {
    const id = text.match(/\b[a-f0-9]{32}\b/i)?.[0];
    if (!id) {
      await api.sendMessage({
        chat_id, text: 'That doesn\'t look like an Account ID. It is 32 characters long, using only 0–9 and a–f. Try again:',
        reply_markup: { inline_keyboard: [linkRow(), cancelRow()] },
      });
      return true;
    }
    await setWizard(userId, 'token', id.toLowerCase());
    await askToken(chat_id);
    return true;
  }

  // step === 'token': never leave the secret sitting in the chat history.
  await api.deleteMessage({ chat_id, message_id: message.message_id }).catch(() => {});
  if (!/^[A-Za-z0-9_\-]{30,200}$/.test(text)) {
    await api.sendMessage({
      chat_id, text: 'That doesn\'t look like an API token. A token is about 40 letters, digits, "-" or "_", with no spaces. Paste it again:',
      reply_markup: { inline_keyboard: [linkRow(), [{ text: '↩️ Change Account ID', callback_data: 'setup' }, ...cancelRow()]] },
    });
    return true;
  }

  const status = await api.sendMessage({ chat_id, text: '⏳ Testing your credentials…' });
  const edit = (t, reply_markup) => api.editMessageText({ chat_id, message_id: status.message_id, text: t, reply_markup });
  const creds = { accountId: row.wizardAccount, apiToken: text };
  const probe = sanitize({ ...DEFAULTS, model: '@cf/meta/llama-3.1-8b-instruct-fast', maxTokens: 32 });

  let note = '';
  try {
    await generate(probe, creds, [{ role: 'user', content: 'Reply with: ok' }]);
  } catch (e) {
    if (e.kind === 'auth' || e.kind === 'model') {
      await edit(`❌ Cloudflare rejected these credentials (${e.message}).\n\nCheck that the token has the "Workers AI: Read" permission and belongs to the same account. Paste the token again, or change the Account ID.`,
        { inline_keyboard: [linkRow(), [{ text: '↩️ Change Account ID', callback_data: 'setup' }, ...cancelRow()]] });
      return true;
    }
    // Quota or network problems don't mean the credentials are wrong.
    note = e.kind === 'quota'
      ? '\n\nℹ️ Today\'s free AI quota is already used up. Replies start after 00:00 UTC.'
      : '\n\nℹ️ I couldn\'t reach Cloudflare to test the token, but I saved it anyway.';
  }

  await saveCredentials(userId, creds.accountId, creds.apiToken);
  await setWizard(userId, null, null);
  await edit(`🎉 Cloudflare Workers AI connected!${note}\n\nSend me any message to preview a reply, or open the panel to tune mood, emoji and creativity.`,
    panelKeyboard());
  return true;
}
