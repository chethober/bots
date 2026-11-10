// 💰 Balance: the player card in the private chat. A message widget (balance, stats and
// a ticking daily-bonus timer) with the text card as fallback, and buttons under it:
//   wal:d — claim the daily bonus (the card updates in place)
//   wal:s — open 💎 Buy chips
//   wal:r — 🔄 refresh the card in place
// Widgets can't ask the bot for anything, so the numbers change only through these.

import { BotApiError } from 'sdk';
import { claimDaily, editMessage, getPlayer } from './engine.js';
import { shopMarkup } from './shop.js';
import { showCard, showScreen } from './screen.js';
import { GameError, btn, esc, chips } from './ui.js';
import { DAILY_CHIPS, DAILY_COOLDOWN } from './config.js';
import { t } from './strings.js';
import { walletWidget } from './widgets/payloads.js';
import { editWidgetCard } from './widgets/index.js';

export function walletCard(me, locale) {
  return {
    text: t(locale, 'wallet', {
      name: esc(me.name), chips: chips(me.chips), played: me.played, wins: me.wins,
      wagered: chips(me.wagered), best: chips(me.bestWin),
    }),
    keyboard: [
      [btn(t(locale, 'kb_daily'), 'wal:d'), btn(t(locale, 'kb_shop'), 'wal:s')],
      [btn(t(locale, 'w_refresh'), 'wal:r')],
    ],
    widget: walletWidget(me, locale),
  };
}

export const showWallet = (me, locale) => showCard(me.id, walletCard(me, locale));

// Redraws the card the button sits under: widget data or text, whichever it is.
async function redraw(message, me, locale) {
  const card = walletCard(me, locale);
  try {
    if (message.widget) return await editWidgetCard(message, card);
  } catch (e) {
    if (!(e instanceof BotApiError)) throw e;
    console.warn('wallet widget edit failed', e.description);
    return;
  }
  return editMessage({ chat_id: message.chat.id, message_id: message.message_id }, card.text, { inline_keyboard: card.keyboard });
}

// Callback data: wal:d | wal:s | wal:r (private chat only).
export async function walletPress(ctx, cb, [act]) {
  if (ctx.inline || !cb.message || cb.message.chat.type !== 'private') throw new GameError('This button no longer works.');
  const locale = ctx.locale;
  if (act === 's') {
    const me = await getPlayer(ctx.user.id);
    await ctx.answer();
    return showScreen(ctx.user.id, t(locale, 'shop', { chips: chips(me.chips) }), await shopMarkup(locale));
  }
  if (act === 'd') {
    const after = await claimDaily(ctx.user.id);
    const me = after ?? await getPlayer(ctx.user.id);
    if (after) await ctx.answer(t(locale, 'daily_got', { daily: chips(DAILY_CHIPS), chips: chips(after.chips) }).replace(/<\/?b>/g, ''));
    else {
      const wait = me.lastDaily + DAILY_COOLDOWN - Math.floor(Date.now() / 1000);
      await ctx.answer(t(locale, 'daily_wait', { h: Math.max(1, Math.ceil(wait / 3600)), chips: chips(me.chips) }));
    }
    return redraw(cb.message, me, locale);
  }
  if (act === 'r') {
    await ctx.answer();
    return redraw(cb.message, await getPlayer(ctx.user.id), locale);
  }
  throw new GameError('Unknown action.');
}
