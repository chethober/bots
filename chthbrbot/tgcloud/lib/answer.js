// 📣 Answer publicly. The question is never stored: the button under a received
// message reads it from that message (the callback carries it), and puts it in
// an inline query: "@bot ❓ <question> 💬 ". The owner types their answer after
// 💬 in whichever chat they picked, and handlers/inline_query.js turns the query
// into a question-and-answer card with a button to their link.
// Pure, so it can be tested without the platform.

const Q = '❓';
const A = '💬';

// Telegram caps an inline query at 256 characters; the question gets at most
// this many, leaving the rest for the answer.
export const QUESTION_MAX = 120;

// The question (a message's text or caption) → the inline query to prefill.
export function answerQuery(question) {
  const flat = String(question ?? '').replaceAll(A, '🗨').replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  const short = chars.length > QUESTION_MAX ? `${chars.slice(0, QUESTION_MAX - 1).join('').trimEnd()}…` : flat;
  return `${Q} ${short} ${A} `;
}

// An inline query → { question, answer } (answer may be ''), or null when it
// isn't one made by answerQuery.
export function parseAnswerQuery(query) {
  const m = new RegExp(`^${Q}\\s*([\\s\\S]*?)\\s*${A}\\s*([\\s\\S]*)$`, 'u').exec(String(query ?? '').trim());
  if (!m || !m[1]) return null;
  return { question: m[1], answer: m[2].trim() };
}
