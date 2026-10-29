// ⏮ Add old songs: tracks posted in a chat before its sync existed. A bot can't
// read a chat's history, so the user brings it to the private chat:
//   - forwarded posts (up to 100 at a time), each added as it arrives, or
//   - the chat's history export (Telegram Desktop → Export chat history → JSON,
//     result.json), queued and added BATCH posts per ⏩ Continue.
// In a forum export each post's topic is worked out from its reply chain
// (see exportItems): an "every topic" sync sends each post to its topic's
// playlist (found by name or created, like live posts), and a one-topic sync
// takes only that topic's posts. Forwards don't say their topic, so they only
// work for one-topic and whole-chat syncs.
// Posts are kept in backfill_items; the sync's link_tracks skip tracks the
// playlist already has. The active backfill is the setting `bf:<userId>`.
//
//   ln:<id>:bf  start (🔗 My syncs)    bf:go  continue / refresh    bf:done  finish

import { api, db } from 'sdk';
import { and, asc, eq } from 'sdk/db';
import { backfillItems } from '../schema.js';
import { providerOf } from './providers/index.js';
import { getAccount } from './accounts.js';
import { getLink, addOldTracks, topicChild } from './sync.js';
import { audioQuery, extractRefs, refOfUrl, resolveRef } from './tracks.js';
import { LookupLimit } from './lookup.js';
import { getSetting, saveSetting } from './settings.js';
import { localeFor } from './i18n.js';
import { drop, showScreen } from './screen.js';
import { linkView } from './views.js';
import { errorText } from './errors.js';
import { t } from './strings.js';
import { esc, now, unique } from './util.js';

const BATCH = 25; // posts per ⏩ Continue
const SCREEN_EVERY = 3; // seconds between progress updates while forwards pour in

const activeKey = (userId) => `bf:${userId}`;

async function activeLink(userId) {
  const id = Number(await getSetting(activeKey(userId)));
  const link = id && await getLink(id);
  return link && link.ownerId === userId ? link : null;
}

const count = (userId, linkId, status) =>
  db.$count(backfillItems, and(eq(backfillItems.userId, userId), eq(backfillItems.linkId, linkId), eq(backfillItems.status, status)));

async function progressView(link, locale, note = '') {
  const n = {};
  for (const s of ['added', 'known', 'missed', 'retry', 'wait']) n[s] = await count(link.ownerId, link.id, s);
  const text = [
    t(locale, 'bf_title', { playlist: esc(link.threadId === -1 ? t(locale, 'per_topic_playlists') : link.playlistName ?? '—') }),
    t(locale, link.threadId > 0 ? 'bf_how_topic' : link.threadId === -1 ? 'bf_how_topics' : 'bf_how'),
    t(locale, 'bf_stats', { added: n.added, known: n.known, missed: n.missed, failed: n.retry, waiting: n.wait }),
    note,
  ].filter(Boolean).join('\n\n');
  const go = { text: t(locale, n.wait ? 'bf_continue' : 'bf_refresh'), callback_data: 'bf:go' };
  return { text, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[go, { text: t(locale, 'bf_done'), callback_data: 'bf:done' }]] } };
}

/** Edit the open screen in place (no new message per forward), else open one. */
async function showProgress(link, locale, note, messageId) {
  const view = await progressView(link, locale, note);
  const id = messageId ?? Number(await getSetting(`screen:${link.ownerId}`));
  if (id) {
    try {
      await api.editMessageText({ chat_id: link.ownerId, message_id: id, link_preview_options: { is_disabled: true }, ...view });
      return;
    } catch (e) {
      if (/not modified/.test(e.description ?? '')) return;
    }
  }
  await showScreen(link.ownerId, view);
}

/** ⏮ in a sync's screen: start (or resume) adding old songs to it. */
export async function startBackfill(link, locale, messageId) {
  await saveSetting(activeKey(link.ownerId), String(link.id));
  return showProgress(link, locale, '', messageId);
}

/** Add queued posts (oldest first). Returns a note for the progress screen. */
async function processItems(link, locale, items) {
  const provider = providerOf(link.provider);
  const acct = await getAccount(link.ownerId, link.provider);
  if (!acct) return t(locale, 'err_not_connected', { service: provider.name });
  const memo = new Map();
  const entries = [];
  let note = '';
  for (const item of items) {
    try {
      const ids = [];
      for (const ref of item.refs ?? []) {
        const hit = await resolveRef(ref, provider, acct, memo, { strict: true });
        if (hit?.id) ids.push(hit.id);
      }
      entries.push({ item, ids: unique(ids), messageId: item.messageId, posterId: item.posterId, posterName: item.posterName });
    } catch (e) {
      if (!(e instanceof LookupLimit)) throw e;
      note = t(locale, 'bf_limit');
      break;
    }
  }
  const found = entries.filter((e) => e.ids.length);
  // An "every topic" sync: each topic's posts go to that topic's playlist.
  const groups = new Map();
  for (const e of found) {
    const key = link.threadId === -1 ? e.item.threadId : link.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const [threadId, group] of groups) {
    let counts;
    let failed = false;
    try {
      const target = link.threadId === -1 ? await topicChild(link, threadId, group[0].item.topicName) : link;
      counts = await addOldTracks(target, group);
    } catch (e) {
      if (!e.fresh) throw e;
      counts = e.fresh;
      failed = true;
      note = t(locale, 'failed', { error: errorText(locale, e) });
    }
    for (const [i, e] of group.entries()) {
      const status = counts[i] ? (failed ? 'retry' : 'added') : 'known';
      await db.update(backfillItems).set({ status }).where(eq(backfillItems.id, e.item.id)).run();
    }
  }
  for (const e of entries.filter((x) => !x.ids.length)) {
    await db.update(backfillItems).set({ status: 'missed' }).where(eq(backfillItems.id, e.item.id)).run();
  }
  return note;
}

async function queue(userId, link, items) {
  const rows = items.map((i) => ({
    userId, linkId: link.id, refs: i.refs, messageId: i.messageId ?? null,
    posterId: i.posterId ?? null, posterName: i.posterName ?? null,
    threadId: i.threadId ?? null, topicName: i.topicName ?? null, createdAt: now(),
  }));
  const out = [];
  for (let i = 0; i < rows.length; i += 100) out.push(...await db.insert(backfillItems).values(rows.slice(i, i + 100)).returning().run());
  return out;
}

const waiting = (link) => db.select().from(backfillItems)
  .where(and(eq(backfillItems.userId, link.ownerId), eq(backfillItems.linkId, link.id), eq(backfillItems.status, 'wait')))
  .orderBy(asc(backfillItems.id)).limit(BATCH).all();

// --- what the user sends ---------------------------------------------------------

/** Who posted a forwarded message, and its id in the chat when Telegram says. */
function forwardMeta(message) {
  const o = message.forward_origin ?? {};
  return {
    messageId: o.message_id ?? null,
    posterId: o.sender_user?.id ?? null,
    posterName: o.sender_user?.first_name ?? o.sender_user_name ?? o.author_signature ?? null,
  };
}

/**
 * Each export message's forum topic (0 = General, or not a forum) and the
 * topics' names. A topic is its "topic_created" service message's id; a post
 * in a topic replies to that id, and a reply inside a topic replies to a post
 * of it, so the topic follows the reply chain (messages are oldest first). A
 * reply to a message missing from the export is taken as a reply to a topic
 * whose start isn't in it.
 */
export function exportTopics(messages) {
  const names = new Map();
  const topicOf = new Map();
  const seen = new Set(messages.map((m) => m.id));
  for (const m of messages) {
    if (m.type === 'service' && m.action === 'topic_created') {
      names.set(m.id, m.title ?? null);
      topicOf.set(m.id, m.id);
      continue;
    }
    const r = m.reply_to_message_id;
    const topic = m.reply_to_top_id ?? (r == null ? 0 : names.has(r) ? r : topicOf.get(r) ?? (seen.has(r) ? 0 : r));
    topicOf.set(m.id, topic);
    if (m.type === 'service' && m.action === 'topic_edit' && m.new_title && topic) names.set(topic, m.new_title);
  }
  return { topicOf, names };
}

/** A chat export's posts with music in them, with their topic. */
export function exportItems(data) {
  const messages = data?.messages ?? [];
  const { topicOf, names } = exportTopics(messages);
  const out = [];
  for (const m of messages) {
    if (m.type !== 'message') continue;
    const urls = [];
    let plain = '';
    for (const e of m.text_entities ?? []) {
      plain += e.text ?? '';
      if (e.type === 'link') urls.push(e.text);
      if (e.type === 'text_link') urls.push(e.href);
    }
    for (const x of plain.matchAll(/spotify:track:[A-Za-z0-9]{22}/g)) urls.push(x[0]);
    const refs = unique(urls).map(refOfUrl).filter(Boolean);
    if (m.media_type === 'audio_file') {
      const query = audioQuery({ title: m.title, performer: m.performer, file_name: m.file_name });
      if (query) refs.push({ query });
    }
    if (!refs.length) continue;
    const userId = /^user(\d+)$/.exec(m.from_id ?? '')?.[1];
    const threadId = topicOf.get(m.id) ?? 0;
    out.push({
      refs, messageId: m.id ?? null, posterId: userId ? Number(userId) : null, posterName: m.from ?? null,
      threadId, topicName: names.get(threadId) ?? null,
    });
  }
  return out;
}

/** An export's chat id (as Telegram Desktop writes it) is the sync's chat. */
const sameChat = (exportId, chatId) => exportId == null
  || [exportId, -exportId, -(1e12 + exportId)].includes(chatId);

async function readExport(message, link, locale) {
  let data;
  try {
    const bytes = await api.getFileContent(message.document.file_id);
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    console.warn('backfill export unreadable', e.description ?? e.message);
    return { note: t(locale, 'bf_bad_file') };
  }
  if (!Array.isArray(data?.messages)) return { note: t(locale, 'bf_bad_file') };
  if (!sameChat(data.id, link.chatId)) return { note: t(locale, 'bf_wrong_chat', { chat: esc(data.name ?? data.id) }) };
  const all = exportItems(data);
  // A whole-chat sync takes every post; a topic's, only that topic's; "every
  // topic" the posts of every topic but General, like live posts.
  const items = link.threadId === 0 ? all
    : all.filter((i) => (link.threadId > 0 ? i.threadId === link.threadId : i.threadId > 0));
  if (all.length && !items.length) return { note: t(locale, 'bf_no_topic_posts') };
  return { items, topics: new Set(items.map((i) => i.threadId)).size };
}

const isExport = (doc) => doc && (/\.json$/i.test(doc.file_name ?? '') || doc.mime_type === 'application/json');

/**
 * A forwarded post or a chat export while ⏮ is open. False when there's no
 * backfill, or the message is neither (it goes to 🔎 Find music as usual).
 */
export async function onBackfillMessage(message) {
  if (!message.forward_origin && !isExport(message.document)) return false;
  const link = await activeLink(message.from.id);
  if (!link) return false;
  const locale = await localeFor(message.from);
  await drop(message.chat.id, message.message_id);

  if (message.forward_origin) {
    if (link.threadId === -1) {
      await showProgress(link, locale, t(locale, 'bf_forward_topics'));
      return true;
    }
    const refs = extractRefs(message);
    if (!refs.length) return true;
    const items = await queue(message.from.id, link, [{ refs, ...forwardMeta(message) }]);
    const note = await processItems(link, locale, items);
    // Many forwards arrive at once: refresh the screen at most every few seconds.
    const last = Number(await getSetting(`bfshow:${link.ownerId}`)) || 0;
    if (note || now() - last >= SCREEN_EVERY) {
      await saveSetting(`bfshow:${link.ownerId}`, String(now()));
      await showProgress(link, locale, note);
    }
    return true;
  }

  const { items, topics, note } = await readExport(message, link, locale);
  if (!items) {
    await showProgress(link, locale, note);
    return true;
  }
  await queue(message.from.id, link, items);
  const more = await processItems(link, locale, await waiting(link));
  const read = link.threadId === -1 ? t(locale, 'bf_queued_topics', { n: items.length, topics }) : t(locale, 'bf_queued', { n: items.length });
  await showProgress(link, locale, more || read);
  return true;
}

/** bf:go and bf:done. */
export async function onBackfillCallback(q, op) {
  const locale = await localeFor(q.from);
  const link = await activeLink(q.from.id);
  await api.answerCallbackQuery({ callback_query_id: q.id }).catch(() => {});
  if (!link || op === 'done') {
    await saveSetting(activeKey(q.from.id), '');
    if (link) await db.delete(backfillItems).where(eq(backfillItems.userId, q.from.id)).run();
    const view = link ? await linkView(link, locale) : { text: t(locale, 'expired') };
    return api.editMessageText({ chat_id: q.message.chat.id, message_id: q.message.message_id, link_preview_options: { is_disabled: true }, ...view }).catch(() => {});
  }
  const note = await processItems(link, locale, await waiting(link));
  return showProgress(link, locale, note, q.message.message_id);
}
