// The platform side of the chat games: wallet, session storage and message editing.
// Game modules (lib/games/*) stay pure and talk to all of this through `ctx`.

import { api, db, BotApiError } from 'sdk';
import { eq, and, gte, lte, sql } from 'sdk/db';
import { players, sessions } from '../schema.js';
import { GameError, nameOf } from './ui.js';
import { START_CHIPS, DAILY_CHIPS, DAILY_COOLDOWN } from './config.js';
import { normalizeLocale, playerLocale, tr } from './i18n.js';

const now = () => Math.floor(Date.now() / 1000);

// ---- wallet -----------------------------------------------------------------

// Creates or refreshes the player (name, and Telegram language when known).
export async function ensurePlayer(user) {
  const name = nameOf(user);
  const set = { name, ...(user.language_code && { lang: normalizeLocale(user.language_code) }) };
  const [row] = await db.insert(players)
    .values({ id: user.id, chips: START_CHIPS, ...set })
    .onConflictDoUpdate({ target: players.id, set })
    .returning();
  return row;
}

// Chosen UI language (🌐 Language). null = Telegram's.
export async function setPlayerLocale(id, locale) {
  await db.update(players).set({ locale }).where(eq(players.id, id));
}

export async function getPlayer(id) {
  return db.select().from(players).where(eq(players.id, id)).get();
}

// Takes a stake. Atomic: fails (null) rather than going negative.
export async function debit(userId, amount) {
  const [row] = await db.update(players)
    .set({
      chips: sql`${players.chips} - ${amount}`,
      played: sql`${players.played} + 1`,
      wagered: sql`${players.wagered} + ${amount}`,
    })
    .where(and(eq(players.id, userId), gte(players.chips, amount)))
    .returning();
  return row ?? null;
}

// Pays out. `stake` is what the player risked, so a win is recorded only on profit.
export async function credit(userId, amount, stake = 0) {
  if (amount <= 0) return null;
  const profit = amount - stake;
  const [row] = await db.update(players)
    .set({
      chips: sql`${players.chips} + ${amount}`,
      wins: sql`${players.wins} + ${profit > 0 ? 1 : 0}`,
      bestWin: sql`max(${players.bestWin}, ${profit})`,
    })
    .where(eq(players.id, userId))
    .returning();
  return row ?? null;
}

// Undoes a debit that never turned into a game (lost race, cancelled lobby).
export async function refund(userId, amount) {
  await db.update(players)
    .set({
      chips: sql`${players.chips} + ${amount}`,
      played: sql`max(${players.played} - 1, 0)`,
      wagered: sql`max(${players.wagered} - ${amount}, 0)`,
    })
    .where(eq(players.id, userId))
    .run();
}

// Returns the updated player, or null if the cooldown hasn't passed.
export async function claimDaily(userId) {
  const t = now();
  const [row] = await db.update(players)
    .set({ chips: sql`${players.chips} + ${DAILY_CHIPS}`, lastDaily: t })
    .where(and(eq(players.id, userId), lte(players.lastDaily, t - DAILY_COOLDOWN)))
    .returning();
  return row ?? null;
}

// ---- sessions ---------------------------------------------------------------

export async function loadSession(key) {
  return db.select().from(sessions).where(eq(sessions.key, key)).get();
}

// Creates a session if none exists for `key`; null means someone else got there first.
export async function createSession(key, kind, state) {
  const [row] = await db.insert(sessions)
    .values({ key, kind, state })
    .onConflictDoNothing({ target: sessions.key })
    .returning();
  return row ?? null;
}

// Saves only if nobody changed the session since `row` was read.
export async function saveSession(row, state) {
  const [saved] = await db.update(sessions)
    .set({ state, version: row.version + 1, updated: now() })
    .where(and(eq(sessions.id, row.id), eq(sessions.version, row.version)))
    .returning();
  return saved ?? null;
}

// Read-modify-write with retries. `fn(state)` returns the new state or throws GameError.
// Resolves to { state, prev } once saved.
export async function mutate(key, fn, kind) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await loadSession(key);
    if (!row) throw new GameError('This game has expired.');
    if (kind && row.kind !== kind) throw new GameError('This button belongs to another game.');
    const next = fn(JSON.parse(JSON.stringify(row.state)));
    // A game keeps the language it started in, even when a step builds a fresh state.
    if (next && typeof next === 'object' && next.lang == null && row.state?.lang) next.lang = row.state.lang;
    if (await saveSession(row, next)) return { state: next, prev: row.state };
  }
  throw new GameError('Busy — try again.');
}

// ---- messages ---------------------------------------------------------------

// Inline-mode buttons (switch_inline_query) are rejected while inline mode is off in
// @BotFather. Rather than fail the whole message, drop them and retry once.
const SWITCH = /switch_inline/;
function withoutSwitch(markup) {
  if (!markup?.inline_keyboard) return markup;
  return { inline_keyboard: markup.inline_keyboard.map((r) => r.filter((b) => !SWITCH.test(Object.keys(b).join()))).filter((r) => r.length) };
}
const hasSwitch = (markup) => SWITCH.test(JSON.stringify(markup ?? {}));

export async function editMessage(target, text, markup) {
  try {
    const params = {
      ...target,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: markup ?? { inline_keyboard: [] },
    };
    try {
      await api.editMessageText(params);
    } catch (e) {
      if (!(e instanceof BotApiError) || e.code !== 400 || !hasSwitch(markup)) throw e;
      await api.editMessageText({ ...params, reply_markup: withoutSwitch(markup) });
    }
  } catch (e) {
    if (!(e instanceof BotApiError)) throw e;
    // Unchanged text, a deleted message or a per-chat flood limit must never undo a
    // settled bet — the money is already moved, the message is just a view.
    if (!/not modified/i.test(e.description ?? '')) {
      console.warn('edit failed', { code: e.code, description: e.description });
    }
  }
}

export async function sendHtml(chatId, text, markup, extra = {}) {
  const params = { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: markup, ...extra };
  try {
    return await api.sendMessage(params);
  } catch (e) {
    if (!(e instanceof BotApiError) || e.code !== 400 || !hasSwitch(markup)) throw e;
    console.warn('switch_inline buttons rejected — is inline mode enabled in @BotFather?', e.description);
    const rest = withoutSwitch(markup);
    return api.sendMessage({ ...params, reply_markup: rest.inline_keyboard.length ? rest : undefined });
  }
}

// ---- callback context -------------------------------------------------------

// Everything a game's `handle(ctx, args)` may use. Built once per button press.
// `locale` is the presser's language (toasts, alerts); a new session gets it as
// `state.lang` — the language the game message is shown in — unless the game
// sets its own (e.g. the lobby creator's, via localeOf).
export function callbackCtx(cb, kind, locale = 'en') {
  const inline = Boolean(cb.inline_message_id);
  const key = inline ? `i:${cb.inline_message_id}` : `m:${cb.message.chat.id}:${cb.message.message_id}`;
  const target = inline
    ? { inline_message_id: cb.inline_message_id }
    : { chat_id: cb.message.chat.id, message_id: cb.message.message_id };

  let answered = false;
  const ctx = {
    user: { id: cb.from.id, name: nameOf(cb.from) },
    key,
    inline,
    chatType: cb.message?.chat.type ?? 'inline',
    locale,
    t: (text, vars) => tr(locale, text, vars),
    localeOf: async (id) => playerLocale(await getPlayer(id), locale),

    async session() {
      const row = await loadSession(key);
      return row && row.kind === kind ? row : null;
    },
    create: (k, state) => createSession(key, k, { lang: locale, ...state }),
    mutate: (fn) => mutate(key, fn, kind),

    debit, credit, refund, getPlayer,

    edit: (text, markup) => editMessage(target, text, markup),
    async answer(text = '', alert = false) {
      if (answered) return;
      answered = true;
      try {
        await api.answerCallbackQuery({
          callback_query_id: cb.id,
          text: text.length > 200 ? text.slice(0, 199) + '…' : text,
          show_alert: alert,
        });
      } catch (e) {
        // An expired query must not abort a game step that already moved chips.
        if (!(e instanceof BotApiError)) throw e;
        console.warn('answerCallbackQuery failed', e.description);
      }
    },
    get answered() { return answered; },
  };
  return ctx;
}

// ---- Mini App context -------------------------------------------------------

// Same `ctx` contract as callbackCtx, for a game driven by the Mini App: there is no
// message to edit (the app re-reads state), answers become toasts, and table games
// can `emit` a structured result for animation.
export function appCtx(user, key, kind) {
  const out = { toast: '', alert: false, result: null };
  let answered = false;
  const ctx = {
    user: { id: user.id, name: nameOf(user) },
    key,
    inline: false,
    chatType: 'app',
    locale: 'en', // the Mini App is English
    t: (text, vars) => tr('en', text, vars),
    localeOf: async () => 'en',
    async session() {
      const row = await loadSession(key);
      return row && row.kind === kind ? row : null;
    },
    create: (k, state) => createSession(key, k, state),
    mutate: (fn) => mutate(key, fn, kind),
    debit, credit, refund, getPlayer,
    async edit() {},
    async answer(text = '', alert = false) {
      if (answered) return;
      answered = true;
      out.toast = text;
      out.alert = alert;
    },
    emit(result) { out.result = result; },
    get answered() { return answered; },
    out,
  };
  return ctx;
}
