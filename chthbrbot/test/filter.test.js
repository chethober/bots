import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsWord, isFiltered, normalize, parseWords } from '../tgcloud/lib/filter.js';

test('isFiltered matches whole words and phrases, case-insensitively', () => {
  assert.equal(isFiltered('just KYS already'), true);
  assert.equal(isFiltered('you should   kill\nyourself'), true);
  assert.equal(isFiltered('kyst'), false);
  assert.equal(isFiltered('go dies'), false);
  assert.equal(isFiltered(''), false);
  assert.equal(isFiltered(undefined), false);
});

test('containsWord: owner words, any script, whole words only', () => {
  assert.equal(containsWord('Hello there', ['hello']), true);
  assert.equal(containsWord('class', ['ass']), false);
  assert.equal(containsWord('سلام خوبی؟', ['خوبی']), true);
  assert.equal(containsWord('Привет, Мир', ['мир']), true);
  assert.equal(containsWord('a.b', ['a.b']), true); // regex characters are literal
  assert.equal(containsWord('axb', ['a.b']), false);
  assert.equal(containsWord('anything', []), false);
  assert.equal(containsWord(null, ['x']), false);
});

test('parseWords splits, trims, dedupes and drops too-long words', () => {
  assert.deepEqual(parseWords('foo, Bar\n baz ،qux,,FOO', ['bar'], 10), ['foo', 'baz', 'qux']);
  assert.deepEqual(parseWords('two  words', [], 20), ['two words']);
  assert.deepEqual(parseWords('x'.repeat(11), [], 10), []);
  assert.equal(normalize('  A\tB  '), 'a b');
});
