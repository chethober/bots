// The ⚙️ Settings screen: forum-wide settings, so only forum admins see or change them.
// Stored in the `settings` table; config.js holds the defaults.

import { api } from 'sdk';
import { FORUM_ID, ADMIN_IDS, DELETE_DUPLICATES, ADDED_REACTION } from './config.js';
import { getSetting, saveSetting } from './settings.js';
import { isConfigured } from './spotify.js';
import { t } from './strings.js';

// The reaction is stored as `reaction_emoji` + `reaction_enabled` ('1'/'0').
export async function getReaction() {
  const enabled = (await getSetting('reaction_enabled')) !== '0';
  return { enabled, emoji: (await getSetting('reaction_emoji')) || ADDED_REACTION };
}

// `delete_duplicates` ('1'/'0'), falling back to DELETE_DUPLICATES.
export async function getDeleteDuplicates() {
  const v = await getSetting('delete_duplicates');
  return v === null ? DELETE_DUPLICATES : v === '1';
}

export async function isAdminId(userId) {
  if (ADMIN_IDS.includes(userId)) return true;
  try {
    const member = await api.getChatMember({ chat_id: FORUM_ID, user_id: userId });
    return member.status === 'creator' || member.status === 'administrator';
  } catch {
    return false;
  }
}

export async function settingsView(locale) {
  const [{ enabled, emoji }, dedupe, connected] = await Promise.all([getReaction(), getDeleteDuplicates(), isConfigured()]);
  return {
    text: `${t(locale, 'settings_title')}\n\n${t(locale, connected ? 'spotify_connected' : 'spotify_not')}${connected ? '' : ' — /spotify'}`,
    reply_markup: {
      inline_keyboard: [
        [{ text: enabled ? t(locale, 'reaction_on', { emoji }) : t(locale, 'reaction_off'), callback_data: 'st:reaction' }],
        [{ text: t(locale, dedupe ? 'dedupe_on' : 'dedupe_off'), callback_data: 'st:dedupe' }],
      ],
    },
  };
}

// st:reaction / st:dedupe → flip the setting.
export async function toggleSetting(op) {
  if (op === 'reaction') {
    const { enabled } = await getReaction();
    await saveSetting('reaction_enabled', enabled ? '0' : '1');
  } else if (op === 'dedupe') {
    await saveSetting('delete_duplicates', (await getDeleteDuplicates()) ? '0' : '1');
  }
}
