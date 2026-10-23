// Minimal i18n layer. Core user-facing strings in English + Persian, Arabic,
// Russian and Spanish; anything missing falls back to English.
//
// Users are auto-detected from their Telegram `language_code` and can override
// with the 🌐 Language button. The chosen locale is stored per user in the settings table
// under the key `lang:<userId>`.

import { getSetting, saveSetting } from './settings.js';

export const LOCALES = ['en', 'fa', 'ar', 'ru', 'es'];
export const RTL = new Set(['fa', 'ar']);
export const LOCALE_NAMES = {
  en: 'English', fa: 'فارسی', ar: 'العربية', ru: 'Русский', es: 'Español',
};
export const LOCALE_FLAGS = { en: '🇬🇧', fa: '🇮🇷', ar: '🇸🇦', ru: '🇷🇺', es: '🇪🇸' };

// Normalize a Telegram language_code (e.g. "en-US", "fa") to a supported locale.
export function normalizeLocale(code) {
  const base = String(code ?? '').toLowerCase().split(/[-_]/)[0];
  return LOCALES.includes(base) ? base : 'en';
}

// Resolve a user's locale: their saved choice, else their Telegram language.
export async function localeFor(from) {
  if (from?.id != null) {
    const saved = await getSetting(`lang:${from.id}`);
    if (saved && LOCALES.includes(saved)) return saved;
  }
  return normalizeLocale(from?.language_code);
}

export async function setLocale(userId, locale) {
  await saveSetting(`lang:${userId}`, normalizeLocale(locale));
}

// Build a translator bound to a string table: t(locale, key, vars?).
export function makeT(strings) {
  return (locale, key, vars) => {
    const entry = strings[key];
    let s = entry ? (entry[locale] ?? entry.en) : key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

// Inline keyboard of language choices; callback data is `lang:<code>`.
export function languageKeyboard() {
  return {
    inline_keyboard: LOCALES.map((c) => [{ text: `${LOCALE_FLAGS[c]} ${LOCALE_NAMES[c]}`, callback_data: `lang:${c}` }]),
  };
}

// --- Unified interface: the persistent reply keyboard ------------------------
// Labels are translated; a tap is matched against every locale's label, so a
// keyboard sent before a language change still works.
export const BUTTONS = {
  about:    { en: 'ℹ️ About', fa: 'ℹ️ درباره', ar: 'ℹ️ حول البوت', ru: 'ℹ️ О боте', es: 'ℹ️ Acerca de' },
  language: { en: '🌐 Language', fa: '🌐 زبان', ar: '🌐 اللغة', ru: '🌐 Язык', es: '🌐 Idioma' },
  source:   { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },
};

const label = (key, locale) => BUTTONS[key][locale] ?? BUTTONS[key].en;

export function mainKeyboard(locale) {
  return {
    keyboard: [[{ text: label('about', locale) }, { text: label('language', locale) }], [{ text: label('source', locale) }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

// Map a tapped reply-keyboard label (in any locale) to its key, or null.
export function matchButton(text) {
  const t = (text || '').trim();
  for (const [key, labels] of Object.entries(BUTTONS)) {
    if (Object.values(labels).includes(t)) return key;
  }
  return null;
}
