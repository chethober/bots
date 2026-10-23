import { DEFAULT_KINDS, KINDS } from './config.js';
import { KIND_LABELS } from './texts.js';

// The kind of a Telegram message, or null if it's none of KINDS.
// A GIF also carries `document`, so `animation` must be checked first.
export function kindOf(msg) {
  if (msg.text !== undefined) return 'text';
  if (msg.animation) return 'animation';
  for (const k of KINDS) if (msg[k] !== undefined) return k;
  return null;
}

// What this owner accepts, in KINDS order. `owner.accepts` null = defaults.
export function acceptedKinds(owner) {
  const list = Array.isArray(owner.accepts) ? owner.accepts : DEFAULT_KINDS;
  return KINDS.filter((k) => list.includes(k));
}

// Toggle one kind; refuses to turn off the last one (returns null).
export function toggleKind(owner, kind) {
  const current = acceptedKinds(owner);
  const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind];
  return next.length ? KINDS.filter((k) => next.includes(k)) : null;
}

// /types menu, two toggles per row; callback data is k:<kind>.
export function typesKeyboard(owner) {
  const on = acceptedKinds(owner);
  const buttons = KINDS.map((k) => ({
    text: `${on.includes(k) ? '✅' : '⬜️'} ${KIND_LABELS[k]}`,
    callback_data: `k:${k}`,
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { inline_keyboard: rows };
}
