// Minimal i18n layer: English, Persian, Arabic, Russian and Spanish; anything
// missing falls back to English.
//
// A chat's language is its saved choice (the 🌐 Language button) stored on its
// `chats` row, else the user's Telegram `language_code`. Channels and groups
// that never chose one get English.

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { chats } from '../schema.js';

export const LOCALES = ['en', 'fa', 'ar', 'ru', 'es'];
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
    const row = await db.select({ locale: chats.locale }).from(chats).where(eq(chats.id, from.id)).get();
    if (row?.locale && LOCALES.includes(row.locale)) return row.locale;
  }
  return normalizeLocale(from?.language_code);
}

export async function setLocale(userId, locale) {
  await db.update(chats).set({ locale: normalizeLocale(locale) }).where(eq(chats.id, userId)).run();
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
