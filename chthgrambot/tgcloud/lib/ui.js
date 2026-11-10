import { PANEL_URL } from './config.js';
import { MODELS, MOODS, EMOJI_STYLES, LENGTHS, FORMALITY, VOICES, getSettings, loadSettingsRow, resolveCredentials } from './settings.js';
import { getUserConnection, countRepliesToday, countRepliesSince, lastReplyAt } from './store.js';
import { RTL } from './i18n.js';
import { t } from './strings.js';

export function panelKeyboard(locale, extraRows = []) {
  const rows = PANEL_URL ? [[{ text: t(locale, 'btn_panel'), web_app: { url: PANEL_URL } }]] : [];
  return { inline_keyboard: [...rows, ...extraRows] };
}

export const setupButton = (locale) => ({ text: t(locale, 'btn_setup'), callback_data: 'setup' });

// Translated labels of a setting's options (the panel uses the English ones in settings.js).
const label = (locale, prefix, key) => t(locale, `${prefix}_${key}`);

// --- 📊 Status ----------------------------------------------------------------------

// The status screen: a widget in the owner's private chat (lib/screen.js), with
// `text` as its fallback. Both carry the same buttons.
export async function statusView(userId, locale) {
  const nowS = Math.floor(Date.now() / 1000);
  const [s, conn, row, today, week, last] = await Promise.all([
    getSettings(userId), getUserConnection(userId), loadSettingsRow(userId), countRepliesToday(userId),
    countRepliesSince(userId, nowS - 7 * 86400), lastReplyAt(userId),
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
  const refresh = { text: t(locale, 'btn_refresh'), callback_data: 'status' };
  const reply_markup = panelKeyboard(locale, [[toggle, refresh], ...(creds ? [] : [[setupButton(locale)]])]);

  const warning = !conn ? 'wg_no_conn' : !conn.isEnabled ? 'wg_conn_off' : !conn.canReply ? 'wg_no_reply' : !creds ? 'wg_no_ai' : null;
  const model = MODELS.find((m) => m.id === s.model)?.name.replace(/\s*\(.*\)$/, '') ?? s.model;
  const data = {
    ...(RTL.has(locale) ? { r: 1 } : {}),
    on: s.enabled ? 1 : 0,
    m: model,
    w: warning ? t(locale, warning) : '',
    // ⁦…⁩ keeps "18:00–09:00" in order inside right-to-left text.
    s: s.scheduleMode === 'window' ? t(locale, 'wg_window', { range: `⁦${s.scheduleFrom}–${s.scheduleTo}⁩` }) : '',
    rt: today,
    rw: week,
    lr: last,
    L: ['wg_title', s.enabled ? 'wg_on' : 'wg_off', 'wg_today', 'wg_week', 'wg_last', 'wg_reset'].map((k) => t(locale, k)),
    dw: t(locale, 'wg_days'),
    u: nowS,
  };
  // Heights measured in Chromium at 376 px (content + 4 px); the warning adds a line.
  return { text, reply_markup, widget: { kind: 'status', data, height: warning ? 192 : 172 } };
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
