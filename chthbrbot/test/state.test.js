import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, parseState } from '../tgcloud/lib/state.js';

const row = (mode, updatedAt = 1000) => ({ mode, updatedAt });

test('parseState reads every kind', () => {
  assert.deepEqual(parseState(null, 1000, 60), { kind: 'idle' });
  assert.deepEqual(parseState(row('idle'), 1000, 60), { kind: 'idle' });
  assert.deepEqual(parseState(row('sending_to:42'), 1000, 60), { kind: 'sending_to', id: 42 });
  assert.deepEqual(parseState(row('replying_to:7'), 1000, 60), { kind: 'replying_to', id: 7 });
  assert.deepEqual(parseState(row('setting_prompt'), 1000, 60), { kind: 'setting_prompt' });
  assert.deepEqual(parseState(row('setting_words'), 1000, 60), { kind: 'setting_words' });
  assert.deepEqual(parseState(row('broadcasting'), 1000, 60), { kind: 'broadcasting' });
});

test('parseState: expiry and garbage', () => {
  assert.deepEqual(parseState(row('sending_to:42', 900), 1000, 60), { kind: 'idle', expired: 'sending_to' });
  assert.deepEqual(parseState(row('setting_words', 940), 1000, 60), { kind: 'setting_words' });
  assert.deepEqual(parseState(row('idle', 0), 1000, 60), { kind: 'idle' });
  assert.deepEqual(parseState(row('sending_to:abc'), 1000, 60), { kind: 'idle' });
  assert.deepEqual(parseState(row('sending_to:'), 1000, 60), { kind: 'idle' });
  assert.deepEqual(parseState(row('mode_from_the_future'), 1000, 60), { kind: 'idle' });
});

test('encodeState round-trips', () => {
  for (const [kind, id] of [['idle'], ['sending_to', 5], ['replying_to', 9], ['setting_prompt'], ['setting_words'], ['broadcasting']]) {
    const parsed = parseState({ mode: encodeState(kind, id), updatedAt: 1000 }, 1000, 60);
    assert.deepEqual(parsed, id === undefined ? { kind } : { kind, id });
  }
});
