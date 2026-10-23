// Interaction context + UI helpers shared by every hub.
//
// A ctx is built by the handlers:
//   { chatId, chatType, userId, userName, message, answer(text?) }
// `message` is set only for button presses; show() then edits that message in place
// (hub menus), while send() always posts a new message (content cards).
import { api } from 'sdk';
import { sendCard, editCard } from './telegram.js';
import { setPending, putCache, getCache } from './store.js';
import { esc } from './format.js';

export const btn = (text, data) => ({ text, callback_data: data });

export function show(ctx, card) {
  return ctx.message ? editCard(ctx.message, card) : sendCard(ctx.chatId, card);
}

// Navigation menus. In private chats they use the reply keyboard (buttons under the text
// field); each label's action is remembered per chat so a tap can be routed like a button
// press. Groups keep inline buttons: with privacy mode on, Telegram doesn't deliver reply
// keyboard taps from groups to the bot.
const MENU_TTL = 90 * 86400;
const ALWAYS = { '🏠 Main menu': 'm:home', '✖️ Hide menu': 'kb:close' };

export async function menu(ctx, card) {
  if (ctx.chatType !== 'private') {
    // Inline menus in groups: there is no reply keyboard to hide.
    return show(ctx, { ...card, keyboard: card.keyboard?.map((r) => r.filter((b) => b?.callback_data !== 'kb:close')).filter((r) => r.length) });
  }
  const rows = (card.keyboard ?? [])
    .map((row) => row.filter((b) => b?.callback_data && b.callback_data !== 'noop'))
    .filter((row) => row.length);
  const actions = {};
  for (const b of rows.flat()) actions[b.text] = b.callback_data;
  await putCache(`menu:${ctx.chatId}`, actions, MENU_TTL);
  return api.sendMessage({
    chat_id: ctx.chatId,
    text: card.text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: {
      keyboard: rows.map((row) => row.map((b) => ({ text: b.text }))),
      resize_keyboard: true,
      // Not persistent: the ⌨️ toggle can collapse it, and ✖️ Hide menu removes it.
      input_field_placeholder: 'Pick an option or type a command',
    },
  });
}

// The action behind a reply-keyboard label from the chat's current menu, or null.
export async function menuAction(ctx, text) {
  if (ctx.chatType !== 'private') return null;
  const actions = await getCache(`menu:${ctx.chatId}`);
  return actions?.[text] ?? ALWAYS[text] ?? null;
}

export function send(ctx, card) {
  return sendCard(ctx.chatId, card);
}

export function notice(ctx, html) {
  return sendCard(ctx.chatId, { text: html });
}

// Private chats: always. Groups: only creator/administrators.
export async function canManage(ctx) {
  if (ctx.chatType === 'private') return true;
  if (ctx._canManage == null) {
    try {
      const m = await api.getChatMember({ chat_id: ctx.chatId, user_id: ctx.userId });
      ctx._canManage = m.status === 'creator' || m.status === 'administrator';
    } catch {
      ctx._canManage = false;
    }
  }
  return ctx._canManage;
}

// Guard for anything that changes chat state. Tells the user why when refused.
export async function requireManage(ctx) {
  if (await canManage(ctx)) return true;
  if (ctx.message && !ctx.answered) await ctx.answer('Only group admins can change this.');
  else await notice(ctx, 'Only group admins can change this.');
  return false;
}

// Asks for free text: remembers `action` for this user for 10 min and shows a reply prompt.
export async function ask(ctx, action, promptHtml, { data = null, placeholder } = {}) {
  await setPending(ctx.chatId, ctx.userId, action, data);
  const mention = ctx.chatType === 'private' ? '' : `<a href="tg://user?id=${ctx.userId}">${esc(ctx.userName ?? 'you')}</a>, `;
  await api.sendMessage({
    chat_id: ctx.chatId,
    text: `${mention}${promptHtml}\n<i>Reply to this message, or send /cancel.</i>`,
    parse_mode: 'HTML',
    reply_markup: { force_reply: true, selective: true, ...(placeholder ? { input_field_placeholder: placeholder.slice(0, 64) } : {}) },
  });
}

// ◀ 2/5 ▶ row; `make(page)` builds the callback data for a page.
export function pagerRow(page, pages, make) {
  if (pages <= 1) return [];
  return [[
    btn(page > 0 ? '◀' : ' ', page > 0 ? make(page - 1) : 'noop'),
    btn(`${page + 1}/${pages}`, 'noop'),
    btn(page < pages - 1 ? '▶' : ' ', page < pages - 1 ? make(page + 1) : 'noop'),
  ]];
}

export const homeRow = () => [btn('🏠 Main menu', 'm:home')];

// Bottom row of every sub-menu: ⬅️ <parent> · 🏠 Main menu.
export const navRow = (label, data) => [btn(label, data), btn('🏠 Main menu', 'm:home')];

// Keeps callback_data within Telegram's 64-byte limit (refs are ASCII ids).
export function fits(data) {
  return data.length <= 64;
}
