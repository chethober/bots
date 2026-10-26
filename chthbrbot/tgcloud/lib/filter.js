// Keyword filters for anonymous messages. Apply to text and captions only —
// voice messages and stickers can't be checked.
//   BLOCKED_WORDS — bot-wide; the sender is told their message wasn't sent.
//   an owner's own hidden words (users.words) — the message is dropped silently.

// Edit this list. Matching is case-insensitive and on whole words/phrases,
// so "ass" won't match "class".
export const BLOCKED_WORDS = [
  'kill yourself',
  'kys',
  'go die',
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Lower case, runs of whitespace as one space.
export const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const compile = (w) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(normalize(w))}(?![\\p{L}\\p{N}])`, 'u');

const patterns = BLOCKED_WORDS.map(compile);

// True if `text` contains any of `words` (each a word or phrase).
export function containsWord(text, words) {
  if (!text || !words?.length) return false;
  const normalized = normalize(text);
  return words.some((w) => normalize(w) && compile(w).test(normalized));
}

// The bot-wide filter.
export function isFiltered(text) {
  if (!text) return false;
  const normalized = normalize(text);
  return patterns.some((re) => re.test(normalized));
}

// An owner's hidden words (users.words; null = none).
export const ownerWords = (owner) => (Array.isArray(owner?.words) ? owner.words : []);

// What the owner typed in the 🔤 Hidden words editor → the words to add: one per
// line or comma-separated, trimmed, without empty ones, too long ones (`maxLen`)
// or ones already in `existing`.
export function parseWords(raw, existing, maxLen) {
  const seen = new Set(existing.map(normalize));
  const out = [];
  for (const part of String(raw ?? '').split(/[\n,،]/)) {
    const w = part.trim().replace(/\s+/g, ' ');
    const key = normalize(w);
    if (!key || [...w].length > maxLen || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}
