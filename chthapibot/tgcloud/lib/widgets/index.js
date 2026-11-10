// Message widgets (Bot API 10.4): sending, editing, shared widgets and the
// queries widgets send back.
//
// A card may carry `widget: { kind, data, height?, shared? }` next to its text:
//   kind    — a template in ./html.js
//   data    — the JSON payload (≤1024 bytes once encoded; see fit())
//   shared  — a key like 'g:epl:401234'. Shared widgets are created once per key
//             and re-sent with sendSharedWidget, so one editSharedWidgetData
//             updates every copy in every chat.
// lib/telegram.js sends the widget in private chats (widgets are private-only in
// production) and falls back to the card's text when sending fails.
//
// Widgets are sent without queries for now: tgcloud doesn't accept widget_query /
// shared_widget_query handlers, so they show the data the bot last sent or edited.
// The query side below is kept ready: hubs register a source per query prefix (`q`
// in each payload) with registerSource(), and once tgcloud delivers the updates,
// handlers that call onWidgetQuery() plus `allow_queries: true` on sendWidget turn
// it back on (the templates' range picker and tap-to-open rows are in git history).
import { api, db, BotApiError } from 'sdk';
import { eq, lt } from 'sdk/db';
import { sharedWidgets } from '../../schema.js';
import { TEMPLATES, templateVersion } from './html.js';

const MAX_DATA = 1024;
const SHARED_EDIT_MS = 1100; // editSharedWidgetData: at most once per second

// Set when the Bot API rejects widgets outright (e.g. not available for this bot):
// the isolate then stops trying and sends text cards.
let disabled = false;

export const widgetsOn = () => !disabled;

// Private chats have positive ids (the user's id); groups and channels are negative.
export const isPrivateChat = (chatId) => Number(chatId) > 0;

// ── encoding helpers ──────────────────────────────────────────────────────

export function bytes(s) {
  return typeof TextEncoder === 'function' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length;
}

// Downsamples `values` to `n` points and packs them as base36, `k` chars each,
// scaled to their own min..max. → { lo, hi, v } or null.
export function pack(values, n, k = 2) {
  const src = (values ?? []).filter((x) => Number.isFinite(x));
  if (src.length < 2) return null;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(src[Math.round((i * (src.length - 1)) / (n - 1))]);
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const max = 36 ** k - 1;
  const v = pts.map((x) => Math.round(((x - lo) / (hi - lo || 1)) * max).toString(36).padStart(k, '0')).join('');
  return { lo, hi, v };
}

// Rounds a price to 4 significant digits (keeps payloads small).
export const sig = (n) => (n == null || !Number.isFinite(n) ? null : Number(n.toPrecision(n >= 1000 ? 6 : 4)));
export const r2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);

// Calls build(level) with level 0, 1, 2… until the JSON fits the 1024-byte data
// limit; build returns null when it can't shrink any further.
export function fit(build) {
  for (let level = 0; level < 16; level++) {
    const data = build(level);
    if (!data) break;
    const json = JSON.stringify(data);
    if (bytes(json) <= MAX_DATA) return data;
  }
  return null;
}

// ── sending and editing ───────────────────────────────────────────────────

function markupOf(keyboard) {
  const rows = (keyboard ?? []).map((r) => r.filter((b) => b?.text)).filter((r) => r.length);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

function isUnsupported(e) {
  return e instanceof BotApiError && (e.code === 404 || /method not found|not supported|WIDGET.*(DISABLED|NOT_ALLOWED)/i.test(e.description ?? ''));
}

// Sends `card.widget` to a private chat. → the sent Message, or null when the
// caller should fall back to the text card.
export async function sendWidgetCard(chatId, card, extra = {}) {
  const w = card.widget;
  if (disabled || !w || !isPrivateChat(chatId) || !TEMPLATES[w.kind]) return null;
  const json = JSON.stringify(w.data);
  if (bytes(json) > MAX_DATA) {
    console.warn(`widget ${w.kind}: payload over ${MAX_DATA} bytes`);
    return null;
  }
  const common = { chat_id: chatId, reply_markup: markupOf(card.widgetKeyboard ?? card.keyboard), ...extra };
  try {
    if (w.shared) return await sendShared(w, json, common);
    return await api.sendWidget({ ...common, html: TEMPLATES[w.kind], height: w.height, chat_data: json });
  } catch (e) {
    if (isUnsupported(e)) disabled = true;
    console.warn(`sendWidget ${w.kind} failed: ${e.description ?? e.message}`);
    return null;
  }
}

async function sendShared(w, json, common) {
  const ver = templateVersion(w.kind);
  const row = await db.select().from(sharedWidgets).where(eq(sharedWidgets.key, w.shared)).get();
  if (row && row.ver === ver) {
    await pushShared(row, json);
    try {
      return await api.sendSharedWidget({ ...common, widget_id: row.widgetId });
    } catch (e) {
      // An unknown or expired shared widget is replaced below; anything else is a real error.
      if (!(e instanceof BotApiError && e.code === 400)) throw e;
    }
  }
  const msg = await api.sendWidget({ ...common, html: TEMPLATES[w.kind], height: w.height, public_data: json, is_shared: true });
  const widgetId = msg.widget?.id;
  if (widgetId) {
    const values = { key: w.shared, widgetId: String(widgetId), ver, data: json, updatedAt: Date.now() };
    await db.insert(sharedWidgets).values(values)
      .onConflictDoUpdate({ target: sharedWidgets.key, set: values }).run();
  }
  return msg;
}

// Pushes new public data to a shared widget if it changed (and the 1/s limit allows).
async function pushShared(row, json) {
  if (row.data === json || Date.now() - (row.updatedAt ?? 0) < SHARED_EDIT_MS) return false;
  try {
    await api.editSharedWidgetData({ widget_id: row.widgetId, public_data: json });
  } catch (e) {
    console.warn(`editSharedWidgetData ${row.key}: ${e.description ?? e.message}`);
    return false;
  }
  await db.update(sharedWidgets).set({ data: json, updatedAt: Date.now() }).where(eq(sharedWidgets.key, row.key)).run();
  return true;
}

export async function updateShared(key, data) {
  const row = await db.select().from(sharedWidgets).where(eq(sharedWidgets.key, key)).get();
  return row ? pushShared(row, JSON.stringify(data)) : false;
}

// Re-renders a widget message in place: new chat data for a per-message widget,
// fresh public data for a shared one, and the new keyboard either way.
export async function editWidgetCard(message, card) {
  const target = { chat_id: message.chat.id, message_id: message.message_id };
  const w = card.widget;
  if (w?.shared) await updateShared(w.shared, w.data);
  else if (w) await api.editMessageWidgetData({ ...target, chat_data: JSON.stringify(w.data) }).catch(ignoreNotModified);
  await api.editMessageReplyMarkup({ ...target, reply_markup: markupOf(card.widgetKeyboard ?? card.keyboard) ?? { inline_keyboard: [] } })
    .catch(ignoreNotModified);
}

function ignoreNotModified(e) {
  if (!(e instanceof BotApiError && e.code === 400 && /not modified/i.test(e.description))) throw e;
}

// Shared widgets nobody refreshed for a week are forgotten (a new one is made on next use).
export async function sweepWidgets() {
  await db.delete(sharedWidgets).where(lt(sharedWidgets.updatedAt, Date.now() - 7 * 86400e3)).run();
}

// ── queries from widgets ──────────────────────────────────────────────────

// registerSource('c', async (args, q) => ({ data, shared? }) | null)
// `args` is the query split on ':' after the prefix; `q` the WidgetQuery.
const sources = new Map();

export function registerSource(prefix, fn) {
  sources.set(prefix, fn);
}

export async function onWidgetQuery(q) {
  let answer = null;
  try {
    const [prefix, ...args] = String(q.data ?? '').split(':');
    const res = await sources.get(prefix)?.(args, q);
    if (res?.data) {
      answer = JSON.stringify(res.data);
      if (bytes(answer) > MAX_DATA) answer = null;
      else if (res.shared) await updateShared(res.shared, res.data);
    }
  } catch (e) {
    console.error(`widget query ${q.data} failed`, e);
  } finally {
    await api.answerWidgetQuery({ widget_query_id: q.id, ...(answer ? { data: answer } : {}) }).catch(() => {});
  }
}
