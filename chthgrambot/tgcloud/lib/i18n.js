// Minimal i18n layer (English + Persian, Arabic, Russian, Spanish). Pure helpers:
// the strings are in strings.js; each owner's language is their uiLocale setting,
// or (when 'auto') the language Telegram reports, kept in the ui table (screen.js).

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

// Inline keyboard of language choices; callback data is `lang:<code>`.
export function languageKeyboard() {
  return {
    inline_keyboard: LOCALES.map((c) => [{ text: `${LOCALE_FLAGS[c]} ${LOCALE_NAMES[c]}`, callback_data: `lang:${c}` }]),
  };
}
