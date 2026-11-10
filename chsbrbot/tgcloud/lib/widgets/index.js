// Message widgets (Bot API 10.4): sending, editing and the queries widgets send
// back. Copied from chthapibot/tgcloud/lib/widgets/index.js without the shared
// widgets (this bot has no `shared_widgets` table).
//
// A card may carry `widget: { kind, data, height? }` next to its text:
//   kind    — a template in ./html.js
//   data    — the JSON payload (≤1024 bytes once encoded; see fit())
// lib/screen.js and the scheduler send the widget in private chats (widgets are
// private-only in production) and fall back to the card's text when sending fails.
//
// Widgets are sent without queries for now: tgcloud doesn't accept widget_query /
// shared_widget_query handlers, so they show the data the bot last sent or edited.
// The query side below is kept ready: hubs register a source per query prefix (`q`
// in each payload) with registerSource(), and once tgcloud delivers the updates,
// handlers that call onWidgetQuery() plus `allow_queries: true` on sendWidget turn
// it back on (the templates' range picker and tap-to-open rows are in git history).
import { api, BotApiError } from 'sdk';
import { TEMPLATES } from './html.js';

const MAX_DATA = 1024;

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
    return await api.sendWidget({ ...common, html: TEMPLATES[w.kind], height: w.height, chat_data: json });
  } catch (e) {
    if (isUnsupported(e)) disabled = true;
    console.warn(`sendWidget ${w.kind} failed: ${e.description ?? e.message}`);
    return null;
  }
}

// Re-renders a widget message in place: new chat data and the new keyboard.
export async function editWidgetCard(message, card) {
  const target = { chat_id: message.chat.id, message_id: message.message_id };
  const w = card.widget;
  if (w) await api.editMessageWidgetData({ ...target, chat_data: JSON.stringify(w.data) }).catch(ignoreNotModified);
  await api.editMessageReplyMarkup({ ...target, reply_markup: markupOf(card.widgetKeyboard ?? card.keyboard) ?? { inline_keyboard: [] } })
    .catch(ignoreNotModified);
}

function ignoreNotModified(e) {
  if (!(e instanceof BotApiError && e.code === 400 && /not modified/i.test(e.description))) throw e;
}

// ── queries from widgets ──────────────────────────────────────────────────

// registerSource('c', async (args, q) => ({ data }) | null)
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
    }
  } catch (e) {
    console.error(`widget query ${q.data} failed`, e);
  } finally {
    await api.answerWidgetQuery({ widget_query_id: q.id, ...(answer ? { data: answer } : {}) }).catch(() => {});
  }
}
