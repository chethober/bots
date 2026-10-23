import { PANEL_URL } from './config.js';
import { MOODS, EMOJI_STYLES, LENGTHS, FORMALITY, VOICES, getSettings, loadSettingsRow, resolveCredentials } from './settings.js';
import { getUserConnection, countRepliesToday } from './store.js';
import { t } from './strings.js';

export function panelKeyboard(locale, extraRows = []) {
  const rows = PANEL_URL ? [[{ text: t(locale, 'btn_panel'), web_app: { url: PANEL_URL } }]] : [];
  return { inline_keyboard: [...rows, ...extraRows] };
}

export const setupButton = (locale) => ({ text: t(locale, 'btn_setup'), callback_data: 'setup' });

// Translated labels of a setting's options (the panel uses the English ones in settings.js).
const label = (locale, prefix, key) => t(locale, `${prefix}_${key}`);

// --- 📊 Status ----------------------------------------------------------------------

export async function statusView(userId, locale) {
  const [s, conn, row, today] = await Promise.all([
    getSettings(userId), getUserConnection(userId), loadSettingsRow(userId), countRepliesToday(userId),
  ]);
  const creds = resolveCredentials(row, userId);
  const text = [
    t(locale, !conn ? 'status_conn_none' : conn.isEnabled ? 'status_conn_ok' : 'status_conn_off'),
    conn?.isEnabled && !conn.canReply ? t(locale, 'status_no_reply') : '',
    t(locale, s.enabled ? 'status_auto_on' : 'status_auto_off')
      + (s.scheduleMode === 'window' ? t(locale, 'status_window', { from: s.scheduleFrom, to: s.scheduleTo }) : ''),
    t(locale, creds ? `status_creds_${creds.source}` : 'status_creds_none'),
    t(locale, 'status_style', { mood: label(locale, 'mood', s.mood), emoji: label(locale, 'emoji', s.emojiStyle), temp: s.temperature }),
    t(locale, 'status_today', { n: today }),
  ].filter(Boolean).join('\n');
  const toggle = s.enabled
    ? { text: t(locale, 'btn_pause'), callback_data: 'pause' }
    : { text: t(locale, 'btn_resume'), callback_data: 'resume' };
  return { text, reply_markup: panelKeyboard(locale, [[toggle], ...(creds ? [] : [[setupButton(locale)]])]) };
}

// --- ⚙️ Settings screen: the everyday settings, changed with one tap ---------
// st:<key> flips a boolean or steps to the next choice; the panel has the rest.

const NON_TEXT = ['relay', 'ai', 'ignore'];
const TOGGLES = ['enabled', 'learnStyle', 'aiLabel'];
// "custom" mood / emoji need text, so they are set in the panel and skipped here.
const CYCLES = {
  voice: Object.keys(VOICES),
  mood: Object.keys(MOODS).filter((k) => k !== 'custom'),
  emojiStyle: Object.keys(EMOJI_STYLES).filter((k) => k !== 'custom'),
  length: Object.keys(LENGTHS),
  formality: Object.keys(FORMALITY),
  nonText: NON_TEXT,
};

// The settings patch for tapping st:<key>, or null for an unknown key.
export function nextSetting(s, key) {
  if (TOGGLES.includes(key)) return { [key]: !s[key] };
  const options = CYCLES[key];
  if (!options) return null;
  return { [key]: options[(options.indexOf(s[key]) + 1) % options.length] };
}

export function settingsKeyboard(s, hasCreds, locale) {
  const b = (key, vars, data) => ({ text: t(locale, key, vars), callback_data: `st:${data}` });
  const onOff = (v) => t(locale, v ? 'on' : 'off');
  return panelKeyboard(locale, [
    ...(hasCreds ? [] : [[setupButton(locale)]]),
    [{ text: t(locale, s.enabled ? 'st_on' : 'st_off'), callback_data: 'st:enabled' }],
    [b('st_voice', { v: label(locale, 'voice', s.voice) }, 'voice'), b('st_mood', { v: label(locale, 'mood', s.mood) }, 'mood')],
    [b('st_emoji', { v: label(locale, 'emoji', s.emojiStyle) }, 'emojiStyle'), b('st_length', { v: label(locale, 'length', s.length) }, 'length')],
    [b('st_tone', { v: label(locale, 'formality', s.formality) }, 'formality'), b('st_media', { v: label(locale, 'media', s.nonText) }, 'nonText')],
    [b('st_learn', { v: onOff(s.learnStyle) }, 'learnStyle'), b('st_ailabel', { v: onOff(s.aiLabel) }, 'aiLabel')],
  ]);
}
