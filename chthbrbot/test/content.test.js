import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_KINDS } from '../tgcloud/lib/config.js';
import { acceptedKinds, kindOf, toggleKind } from '../tgcloud/lib/content.js';

test('kindOf: a GIF is an animation, not a document', () => {
  assert.equal(kindOf({ text: '' }), 'text');
  assert.equal(kindOf({ animation: {}, document: {} }), 'animation');
  assert.equal(kindOf({ photo: [] }), 'photo');
  assert.equal(kindOf({ poll: {} }), null);
});

test('toggleKind keeps at least one kind', () => {
  assert.deepEqual(acceptedKinds({ accepts: null }), DEFAULT_KINDS);
  assert.equal(toggleKind({ accepts: ['text'] }, 'text'), null);
  assert.deepEqual(toggleKind({ accepts: ['photo'] }, 'text'), ['text', 'photo']);
});
