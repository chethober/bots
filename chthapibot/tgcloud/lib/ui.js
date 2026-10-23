// Interaction context + UI helpers shared by every hub.
//
// A ctx is built by the handlers:
//   { chatId, chatType, userId, userName, message, answer(text?) }
// `message` is set only for button presses; show() then edits that message in place
// (hub menus), while send() always posts a new message (content cards).
import { api } from 'sdk';
import { sendCard, editCard } from './telegram.js';
import { setPending } from './store.js';
import { screenId, showScreen } from './screen.js';
import { t } from './strings.js';
import { esc } from './format.js';

export const btn = (text, data) => ({ text, callback_data: data });

export function show(ctx, card) {
  return ctx.message ? editCard(ctx.message, card) : sendCard(ctx.chatId, card);
}

// Navigation menus are inline buttons on a screen. In a private chat the screen
// follows clean chat (lib/screen.js): a button on the current screen edits it in
// place, anything else replaces it with a new one, and content cards are never
// overwritten. Groups have no screen: a menu edits the message it was opened
// from, or posts a new one. A notice shown earlier in the same interaction is
// kept at the top of the menu that replaces it.
export async function menu(ctx, card) {
  card = { ...card, keyboard: card.keyboard?.map((r) => r.filter((b) => b?.callback_data !== 'kb:close')).filter((r) => r.length) };
  if (ctx.chatType !== 'private') return show(ctx, card);
  if (ctx.notes?.length) {
    card = { ...card, text: `${ctx.notes.join('\n')}\n\n${card.text}` };
    ctx.notes = [];
  }
  if (ctx.message && ctx.message.message_id === (await screenId(ctx.chatId))) {
    return editCard(ctx.message, card);
  }
  return showScreen(ctx.chatId, () => sendCard(ctx.chatId, card));
}

export function send(ctx, card) {
  return sendCard(ctx.chatId, card);
}

// A short confirmation or error. In a private chat it becomes the screen.
export async function notice(ctx, html) {
  if (ctx.chatType !== 'private') return sendCard(ctx.chatId, { text: html });
  (ctx.notes ??= []).push(html);
  return showScreen(ctx.chatId, () => sendCard(ctx.chatId, { text: html }));
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

// Asks for free text: remembers `action` for this user for 10 min. In a private
// chat the prompt is a screen with a Cancel button; in groups it's a reply
// prompt addressed to the user (privacy mode only delivers replies).
export async function ask(ctx, action, promptHtml, { data = null, placeholder } = {}) {
  await setPending(ctx.chatId, ctx.userId, action, data);
  if (ctx.chatType === 'private') {
    const card = {
      text: `${promptHtml}\n<i>${t(ctx.locale, 'prompt_hint')}</i>`,
      keyboard: [[btn(t(ctx.locale, 'btn_cancel'), 'x')]],
    };
    ctx.notes = [];
    if (ctx.message && ctx.message.message_id === (await screenId(ctx.chatId))) return editCard(ctx.message, card);
    return showScreen(ctx.chatId, () => sendCard(ctx.chatId, card));
  }
  const mention = `<a href="tg://user?id=${ctx.userId}">${esc(ctx.userName ?? 'you')}</a>, `;
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
