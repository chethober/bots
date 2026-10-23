// The games menu and the private chat's home: lists every game and posts a lobby
// into the chat on tap. In private chats, multiplayer games are offered as "send to
// a chat" (inline mode) instead, since a lobby nobody else can see is useless.

import { GAMES, GROUPS, BY_KEY } from './games/index.js';
import { GameError, btn, kb, esc, chips, BETS } from './ui.js';
import { sendHtml, getPlayer, setPlayerLocale } from './engine.js';
import { BOT_USERNAME, WEBAPP_URL, DAILY_CHIPS, START_CHIPS } from './config.js';
import { t } from './strings.js';
import { normalizeLocale, LOCALES, LOCALE_NAMES, tr } from './i18n.js';
import { closeScreen, mainKeyboard, showHome } from './screen.js';

const MULTI = new Set(['duel', 'party']);

export function menuText(chatType, locale = 'en') {
  const lines = [`<b>${t(locale, 'menu_header')}</b>`];
  for (const [group, label] of GROUPS) {
    lines.push('', `<b>${tr(locale, label)}</b>`);
    for (const g of GAMES.filter((x) => x.group === group)) lines.push(`${tr(locale, g.title)} — ${esc(tr(locale, g.about))}`);
  }
  lines.push('', chatType === 'private' ? t(locale, 'hub_line') : t(locale, 'group_hello', { bot: BOT_USERNAME }));
  return lines.join('\n');
}

export function menuMarkup(chatType, locale = 'en') {
  const rows = [];
  for (let i = 0; i < GAMES.length; i += 2) {
    rows.push(GAMES.slice(i, i + 2).map((g) => {
      const title = tr(locale, g.title);
      if (chatType === 'private' && MULTI.has(g.group)) {
        return { text: title, switch_inline_query: g.defaultBet ? `${g.cmd} ${g.defaultBet}` : g.cmd };
      }
      return btn(title, g.defaultBet ? `menu:b:${g.key}` : `menu:p:${g.key}:0`);
    }));
  }
  if (chatType === 'private') rows.unshift([{ text: t(locale, 'open_hub'), web_app: { url: WEBAPP_URL } }]);
  return kb(...rows);
}

// Home: the welcome message with the reply keyboard (private chat).
export async function sendHome(player, locale) {
  const text = t(locale, 'welcome', {
    name: esc(player.name), chips: chips(player.chips), start: START_CHIPS, daily: DAILY_CHIPS, bot: BOT_USERNAME,
  });
  return showHome(player.id, text, mainKeyboard(locale));
}

// `lang:<code>` — save the player's locale; in the private chat, re-send home so the
// reply keyboard is relabelled (that also removes the picker).
export async function languagePress(ctx, cb, [code]) {
  const locale = LOCALES.includes(code) ? code : normalizeLocale(code);
  await setPlayerLocale(ctx.user.id, locale);
  await ctx.answer(t(locale, 'language_set', { name: LOCALE_NAMES[locale] ?? locale }));
  if (cb.message?.chat.type === 'private') return sendHome(await getPlayer(ctx.user.id), locale);
  return ctx.edit(t(locale, 'language_set', { name: LOCALE_NAMES[locale] ?? locale }));
}

export async function postLobby(chatId, game, user, bet, locale) {
  const lobby = await game.lobby({ creator: user, bet, locale });
  return sendHtml(chatId, lobby.text, lobby.markup);
}

// Callback data: menu:b:<key> → choose stake · menu:p:<key>:<bet> → post lobby · menu:back
export async function menuPress(ctx, cb, [act, key, bet]) {
  if (ctx.inline) throw new GameError('Open the games menu in a chat with me.');
  const chatType = cb.message.chat.type;
  const locale = ctx.locale;
  if (act === 'back') {
    await ctx.answer();
    return ctx.edit(menuText(chatType, locale), menuMarkup(chatType, locale));
  }
  const game = BY_KEY[key];
  if (!game) throw new GameError('Unknown game.');
  if (act === 'b') {
    const me = await getPlayer(ctx.user.id);
    await ctx.answer();
    return ctx.edit(
      t(locale, 'choose_stake', { title: tr(locale, game.title), about: esc(tr(locale, game.about)), chips: chips(me?.chips ?? 0) }),
      kb(BETS.map((b) => btn(String(b), `menu:p:${key}:${b}`)), [btn(t(locale, 'back'), 'menu:back')]),
    );
  }
  if (act === 'p') {
    const stake = Number(bet);
    if (!(stake === 0 || BETS.includes(stake))) throw new GameError('Unknown stake.');
    await ctx.answer();
    // Private chat: the game replaces the menu (the game itself is content and stays).
    if (chatType === 'private') await closeScreen(ctx.user.id);
    return postLobby(cb.message.chat.id, game, ctx.user, stake || game.defaultBet, locale);
  }
  throw new GameError('Unknown action.');
}

