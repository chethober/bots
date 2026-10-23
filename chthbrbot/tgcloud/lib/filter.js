// Simple keyword filter for anonymous messages. Applies to text and captions only —
// voice messages and stickers can't be checked.

// Edit this list. Matching is case-insensitive and on whole words/phrases,
// so "ass" won't match "class".
export const BLOCKED_WORDS = [
  'kill yourself',
  'kys',
  'go die',
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const patterns = BLOCKED_WORDS.map(
  (w) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(w.toLowerCase())}(?![\\p{L}\\p{N}])`, 'u'),
);

export function isFiltered(text) {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  return patterns.some((re) => re.test(normalized));
}
