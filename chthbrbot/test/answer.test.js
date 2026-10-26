import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerQuery, parseAnswerQuery, QUESTION_MAX } from '../tgcloud/lib/answer.js';

test('answer query round-trips the question', () => {
  const q = answerQuery('What is your\nfavourite colour?');
  assert.deepEqual(parseAnswerQuery(q), { question: 'What is your favourite colour?', answer: '' });
  assert.deepEqual(parseAnswerQuery(`${q}Blue, obviously`), { question: 'What is your favourite colour?', answer: 'Blue, obviously' });
});

test('long questions are cut, leaving room in the 256-character query', () => {
  const q = answerQuery('ك'.repeat(500));
  const parsed = parseAnswerQuery(q);
  assert.equal([...parsed.question].length, QUESTION_MAX);
  assert.ok(parsed.question.endsWith('…'));
  assert.ok(q.length < 256 - 100);
});

test('a 💬 inside the question does not split it', () => {
  assert.deepEqual(parseAnswerQuery(answerQuery('a 💬 b') + 'c'), { question: 'a 🗨 b', answer: 'c' });
});

test('other inline queries are not answer queries', () => {
  assert.equal(parseAnswerQuery('Ask me anything'), null);
  assert.equal(parseAnswerQuery(''), null);
  assert.equal(parseAnswerQuery('❓ 💬 x'), null);
});
