// Minimal i18n layer (English + Persian, Arabic, Russian, Spanish). Pure helpers.
// A player's language is their choice (players.locale), else their Telegram
// language (players.lang). Two kinds of tables:
//   strings.js  — keyed messages for the menus, t(locale, key, vars);
//   dict.js     — game text keyed by its English wording, tr(locale, text, vars),
//                 so the game modules read as plain English.

import DICT from './dict.js';

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

// Build a translator bound to a string table: t(locale, key, vars?).
export function makeT(strings) {
  return (locale, key, vars) => {
    const entry = strings[key];
    let s = entry ? (entry[locale] ?? entry.en) : key;
    if (typeof s === 'function') s = s(vars ?? {}, locale);
    else if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

const fill = (s, vars) => {
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
};

// Translates English game text; unknown text (or English) comes back as is.
export function tr(locale, text, vars) {
  const row = locale && locale !== 'en' ? DICT[text] : null;
  return fill(row?.[LOCALES.indexOf(locale) - 1] ?? text, vars);
}

export const playerLocale = (p, fallback) => p?.locale || p?.lang || fallback || 'en';

// Inline keyboard of language choices; callback data is `lang:<code>`.
export function languageKeyboard() {
  return {
    inline_keyboard: LOCALES.map((c) => [{ text: `${LOCALE_FLAGS[c]} ${LOCALE_NAMES[c]}`, callback_data: `lang:${c}` }]),
  };
}
