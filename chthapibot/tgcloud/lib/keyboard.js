// The private chat's persistent reply keyboard, in the chat's language. A tap
// is matched against every language's label, so a keyboard sent before a
// language change still works. Each key opens what its callback data names
// (routed by hubs/index.js); `about` and `language` are handled by the
// message handler.

import { t } from './strings.js';
import { LOCALES } from './i18n.js';

const KEYS = [
  ['btn_crypto', 'btn_sports'],
  ['btn_food', 'btn_random'],
  ['btn_daily', 'btn_notifications'],
  ['btn_settings', 'btn_language'],
  ['btn_about'],
];

// Key → what it opens: callback data, or a name the message handler knows.
export const KEY_ACTIONS = {
  btn_crypto: 'm:crypto',
  btn_sports: 'm:sports',
  btn_food: 'm:food',
  btn_random: 'm:random',
  btn_daily: 'm:daily',
  btn_notifications: 'n:l:*:0',
  btn_settings: 'st:home',
  btn_language: 'language',
  btn_about: 'about',
};

export function mainKeyboard(locale) {
  return {
    keyboard: KEYS.map((row) => row.map((k) => ({ text: t(locale, k) }))),
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: t(locale, 'placeholder'),
  };
}

// A tapped label, in any language → its action, or null.
export function matchButton(text) {
  const s = (text ?? '').trim();
  if (!s) return null;
  for (const k of KEYS.flat()) {
    if (LOCALES.some((l) => t(l, k) === s)) return KEY_ACTIONS[k];
  }
  // 🔗 Source code, on keyboards sent before it moved into ℹ️ About.
  if (LOCALES.some((l) => t(l, 'source') === s)) return 'about';
  return null;
}
