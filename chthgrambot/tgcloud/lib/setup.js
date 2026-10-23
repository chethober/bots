// Interactive in-chat wizard for connecting Cloudflare Workers AI credentials.
import { db } from 'sdk';
import { settings } from '../schema.js';
import { DEFAULTS, sanitize, saveCredentials, now } from './settings.js';
import { generate } from './ai.js';
import { panelKeyboard } from './ui.js';
import { closeScreen, drop, showScreen, updateScreen } from './screen.js';
import { t } from './strings.js';

export const CF_LINKS = {
  workersAi: 'https://dash.cloudflare.com/?to=/:account/ai/workers-ai',
  apiTokens: 'https://dash.cloudflare.com/profile/api-tokens',
  signUp: 'https://dash.cloudflare.com/sign-up',
};

// `locale` is the owner's UI language; every step replaces the open screen.
const linkRow = (locale) => [{ text: t(locale, 'btn_dashboard'), url: CF_LINKS.workersAi }];
const cancelRow = (locale) => [{ text: t(locale, 'btn_cancel'), callback_data: 'setup_cancel' }];
const retryRows = (locale) => [linkRow(locale), [{ text: t(locale, 'btn_change_account'), callback_data: 'setup' }, ...cancelRow(locale)]];

async function setWizard(userId, wizardStep, wizardAccount) {
  const set = { wizardStep, wizardAccount, updatedAt: now() };
  await db.insert(settings).values({ userId, data: DEFAULTS, ...set })
    .onConflictDoUpdate({ target: settings.userId, set }).run();
}

export async function startSetup(chat_id, userId, locale) {
  await setWizard(userId, 'account', null);
  await showScreen(chat_id, {
    text: t(locale, 'setup_step1'),
    reply_markup: { inline_keyboard: [linkRow(locale), [{ text: t(locale, 'btn_signup'), url: CF_LINKS.signUp }], cancelRow(locale)] },
  });
}

// Ends the wizard and removes its screen; the caller confirms with a toast.
export async function cancelSetup(chat_id, userId) {
  await setWizard(userId, null, null);
  await closeScreen(chat_id);
}

async function askToken(chat_id, locale) {
  await showScreen(chat_id, {
    text: t(locale, 'setup_step2'),
    reply_markup: {
      inline_keyboard: [
        linkRow(locale),
        [{ text: t(locale, 'btn_all_tokens'), url: CF_LINKS.apiTokens }],
        [{ text: t(locale, 'btn_change_account'), callback_data: 'setup' }, ...cancelRow(locale)],
      ],
    },
  });
}

// Handles a plain-text message while the wizard is active. Returns true if consumed.
// The message itself is deleted: the Account ID for tidiness, the token for safety.
export async function handleSetupInput(message, row, locale) {
  const step = row?.wizardStep;
  if (!step) return false;
  const chat_id = message.chat.id;
  const userId = message.from.id;
  const text = (message.text ?? '').trim();
  await drop(chat_id, message.message_id);

  if (step === 'account') {
    const id = text.match(/\b[a-f0-9]{32}\b/i)?.[0];
    if (!id) {
      await showScreen(chat_id, {
        text: t(locale, 'setup_bad_account'),
        reply_markup: { inline_keyboard: [linkRow(locale), cancelRow(locale)] },
      });
      return true;
    }
    await setWizard(userId, 'token', id.toLowerCase());
    await askToken(chat_id, locale);
    return true;
  }

  // step === 'token'
  if (!/^[A-Za-z0-9_\-]{30,200}$/.test(text)) {
    await showScreen(chat_id, { text: t(locale, 'setup_bad_token'), reply_markup: { inline_keyboard: retryRows(locale) } });
    return true;
  }

  const status = await showScreen(chat_id, { text: t(locale, 'setup_testing') });
  const edit = (text, reply_markup) => updateScreen(chat_id, status.message_id, { text, reply_markup });
  const creds = { accountId: row.wizardAccount, apiToken: text };
  const probe = sanitize({ ...DEFAULTS, model: '@cf/meta/llama-3.1-8b-instruct-fast', maxTokens: 32 });

  let note = '';
  try {
    await generate(probe, creds, [{ role: 'user', content: 'Reply with: ok' }]);
  } catch (e) {
    if (e.kind === 'auth' || e.kind === 'model') {
      await edit(t(locale, 'setup_rejected', { error: e.message }), { inline_keyboard: retryRows(locale) });
      return true;
    }
    // Quota or network problems don't mean the credentials are wrong.
    note = t(locale, e.kind === 'quota' ? 'setup_quota_note' : 'setup_network_note');
  }

  await saveCredentials(userId, creds.accountId, creds.apiToken);
  await setWizard(userId, null, null);
  await edit(t(locale, 'setup_done', { note }), panelKeyboard(locale));
  return true;
}
