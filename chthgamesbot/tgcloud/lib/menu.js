// The games menu: lists every game and posts a lobby into the chat on tap.
// In private chats, multiplayer games are offered as "send to a chat" (inline mode) instead,
// since a lobby nobody else can see is useless.

import { GAMES, GROUPS, BY_KEY } from './games/index.js';
import { GameError, btn, kb, esc, chips, BETS } from './ui.js';
import { sendHtml, getPlayer, setPlayerLocale } from './engine.js';
import { WEBAPP_URL, SOURCE_URL } from './config.js';
import { t } from './strings.js';
import { normalizeLocale, LOCALES, LOCALE_NAMES } from './i18n.js';

const MULTI = new Set(['duel', 'party']);

export function menuText(chatType, locale = 'en') {
  const lines = [`<b>${t(locale, 'menu_header')}</b>`];
  for (const [group, label] of GROUPS) {
    lines.push('', `<b>${label}</b>`);
    for (const g of GAMES.filter((x) => x.group === group)) lines.push(`${g.title} — ${esc(g.about)} · /${g.cmd}`);
  }
  lines.push('', t(locale, 'wallet_line'));
  if (chatType === 'private') lines.push(t(locale, 'hub_line'));
  return lines.join('\n');
}

export function menuMarkup(chatType, locale = 'en') {
  const rows = [];
  for (let i = 0; i < GAMES.length; i += 2) {
    rows.push(GAMES.slice(i, i + 2).map((g) => {
      if (chatType === 'private' && MULTI.has(g.group)) {
        return { text: g.title, switch_inline_query: g.defaultBet ? `${g.cmd} ${g.defaultBet}` : g.cmd };
      }
      return btn(g.title, g.defaultBet ? `menu:b:${g.key}` : `menu:p:${g.key}:0`);
    }));
  }
  if (chatType === 'private') rows.unshift([{ text: '🎮 Open game hub', web_app: { url: WEBAPP_URL } }]);
  rows.push([{ text: t(locale, 'source'), url: SOURCE_URL }]);
  return kb(...rows);
}

// `lang:<code>` — save the player's locale and confirm in that language.
export async function languagePress(ctx, cb, [code]) {
  const locale = LOCALES.includes(code) ? code : normalizeLocale(code);
  await setPlayerLocale(ctx.user.id, locale);
  await ctx.answer();
  return ctx.edit(t(locale, 'language_set', { name: LOCALE_NAMES[locale] ?? locale }));
}

export async function postLobby(chatId, game, user, bet) {
  const lobby = await game.lobby({ creator: user, bet });
  return sendHtml(chatId, lobby.text, lobby.markup);
}

// Callback data: menu:b:<key> → choose stake · menu:p:<key>:<bet> → post lobby · menu:back
export async function menuPress(ctx, cb, [act, key, bet]) {
  if (ctx.inline) throw new GameError('Use /games in a chat with me.');
  const chatType = cb.message.chat.type;
  if (act === 'back') {
    const me = await getPlayer(ctx.user.id);
    const locale = me?.locale || normalizeLocale(cb.from.language_code);
    await ctx.answer();
    return ctx.edit(menuText(chatType, locale), menuMarkup(chatType, locale));
  }
  const game = BY_KEY[key];
  if (!game) throw new GameError('Unknown game.');
  if (act === 'b') {
    const me = await getPlayer(ctx.user.id);
    await ctx.answer();
    return ctx.edit(
      `<b>${game.title}</b>\n${esc(game.about)}\n\nYour balance: ${chips(me?.chips ?? 0)}\nChoose a stake:`,
      kb(BETS.map((b) => btn(String(b), `menu:p:${key}:${b}`)), [btn('« Back', 'menu:back')]),
    );
  }
  if (act === 'p') {
    const stake = Number(bet);
    if (!(stake === 0 || BETS.includes(stake))) throw new GameError('Unknown stake.');
    await ctx.answer();
    return postLobby(cb.message.chat.id, game, ctx.user, stake || game.defaultBet);
  }
  throw new GameError('Unknown action.');
}
