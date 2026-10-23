import { PANEL_URL } from './config.js';
import { MOODS, EMOJI_STYLES, LENGTHS, FORMALITY, VOICES } from './settings.js';

export function panelKeyboard(extraRows = []) {
  const rows = PANEL_URL ? [[{ text: '⚙️ Open panel', web_app: { url: PANEL_URL } }]] : [];
  return { inline_keyboard: [...rows, ...extraRows] };
}

export const setupButton = () => ({ text: '🔑 Connect Cloudflare AI', callback_data: 'setup' });

export function statusKeyboard(enabled) {
  return panelKeyboard([[enabled
    ? { text: '⏸ Pause auto-replies', callback_data: 'pause' }
    : { text: '▶️ Resume auto-replies', callback_data: 'resume' }]]);
}

// --- ⚙️ Settings screen: the everyday settings, changed with one tap ---------
// st:<key> flips a boolean or steps to the next choice; the panel has the rest.

const NON_TEXT = { relay: '📨 Forward to me', ai: '🤖 AI answers', ignore: '🙈 Ignore' };
const TOGGLES = ['enabled', 'learnStyle', 'aiLabel'];
// "custom" mood / emoji need text, so they are set in the panel and skipped here.
const CYCLES = {
  voice: Object.keys(VOICES),
  mood: Object.keys(MOODS).filter((k) => k !== 'custom'),
  emojiStyle: Object.keys(EMOJI_STYLES).filter((k) => k !== 'custom'),
  length: Object.keys(LENGTHS),
  formality: Object.keys(FORMALITY),
  nonText: Object.keys(NON_TEXT),
};

// The settings patch for tapping st:<key>, or null for an unknown key.
export function nextSetting(s, key) {
  if (TOGGLES.includes(key)) return { [key]: !s[key] };
  const options = CYCLES[key];
  if (!options) return null;
  return { [key]: options[(options.indexOf(s[key]) + 1) % options.length] };
}

export function settingsKeyboard(s, hasCreds) {
  const b = (text, key) => ({ text, callback_data: `st:${key}` });
  const onOff = (v) => (v ? 'on' : 'off');
  return panelKeyboard([
    ...(hasCreds ? [] : [[setupButton()]]),
    [b(s.enabled ? '▶️ Auto-replies: on' : '⏸ Auto-replies: paused', 'enabled')],
    [b(`Voice: ${VOICES[s.voice].label}`, 'voice'), b(`Mood: ${MOODS[s.mood].label}`, 'mood')],
    [b(`Emoji: ${EMOJI_STYLES[s.emojiStyle].label}`, 'emojiStyle'), b(`Length: ${LENGTHS[s.length].label}`, 'length')],
    [b(`Tone: ${FORMALITY[s.formality].label}`, 'formality'), b(`Media: ${NON_TEXT[s.nonText]}`, 'nonText')],
    [b(`🪞 Learn my style: ${onOff(s.learnStyle)}`, 'learnStyle'), b(`🤖 AI label: ${onOff(s.aiLabel)}`, 'aiLabel')],
  ]);
}
