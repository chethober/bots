// Conversation state encoding (the states.mode column). Pure, so it can be tested
// without the platform; lib/users.js reads and writes the table.
//
// 'idle' | 'sending_to:<ownerId>' | 'replying_to:<messageId>' | 'setting_prompt'
// | 'setting_words' | 'broadcasting'

const WITH_ID = ['sending_to', 'replying_to'];
const PLAIN = ['setting_prompt', 'setting_words', 'broadcasting'];

// A states row (or null) → { kind: 'idle' } | { kind, id } | { kind }.
// A state last touched more than `ttl` seconds before `now` reads as
// { kind: 'idle', expired: <old kind> }.
export function parseState(row, now, ttl) {
  const [kind, id] = (row?.mode ?? 'idle').split(':');
  if (kind !== 'idle' && row.updatedAt < now - ttl) return { kind: 'idle', expired: kind };
  if (WITH_ID.includes(kind) && id !== '' && Number.isSafeInteger(Number(id))) {
    return { kind, id: Number(id) };
  }
  if (PLAIN.includes(kind)) return { kind };
  return { kind: 'idle' };
}

export function encodeState(kind, id) {
  return WITH_ID.includes(kind) ? `${kind}:${id}` : kind;
}
