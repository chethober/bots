import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES } from '../tgcloud/lib/i18n.js';
import { texts } from '../tgcloud/lib/texts.js';

const owner = { id: 1, name: 'Ann', prompt: null, paused: false, seenReceipts: true };

test('every locale has the same keys', () => {
  const keys = Object.keys(texts('fa')).sort();
  for (const l of LOCALES) assert.deepEqual(Object.keys(texts(l)).sort(), keys, l);
});

test('every locale renders the new screens', () => {
  for (const l of LOCALES) {
    const L = texts(l);
    const stats = L.stats(owner, {
      received: 10, day: 1, week: 4, senders: 3, replied: 5, busiest: 5, filtered: 0, muted: 2,
      replies: 6, blocked: 1, retentionDays: 365,
    });
    assert.match(stats, new RegExp(L.weekdays[5]), l);
    assert.doesNotMatch(stats, /undefined|NaN/, l);
    assert.doesNotMatch(L.stats(owner, { received: 0, day: 0, week: 0, senders: 0, replied: 0, busiest: null,
      filtered: 0, muted: 0, replies: 0, blocked: 0, retentionDays: 0 }), /undefined|NaN/, l);
    assert.equal(L.weekdays.length, 7, l);
    for (const s of [
      L.wordsMenu(['a', 'b c'], 50, 40), L.wordsMenu([], 50, 40), L.optionsMenu(owner), L.privacy,
      L.delivered(owner), L.delivered({ ...owner, seenReceipts: false }), L.adminReport({ id: 1, ownerId: 1 }, owner, 2, 3),
      L.answerCard('q', 'a'), L.wordsAdded(2), L.wordsNoneAdded(40), L.wordsFull(50),
      L.adminDashboard({ messages: {}, users: 0, paused: 0, newDay: 0, newWeek: 0, reach: 0, senders: 0, replies: 0,
        blocks: 0, openReports: 0, reports: 0, bans: 0, deliveredDay: 0 }),
    ]) assert.doesNotMatch(s, /undefined|NaN|\[object/, l);
    for (const k of ['blurMedia', 'protectReplies', 'seenReceipts', 'typingIndicator']) assert.ok(L.options[k], `${l} ${k}`);
    assert.ok(L.delivered(owner).includes('👀'), l);
    assert.ok(L.adminReport({ id: 1, ownerId: 1 }, owner, 2, 3).includes('⛔️'), l);
    assert.ok(!L.adminReport({ id: 1, ownerId: 1 }, owner, 2).includes('⛔️'), l);
  }
});
