// 🏆 Top players: the richest players in the private chat. A message widget (medals,
// a bar per player, the viewer's own row and rank) with the text list as fallback,
// and a 🔄 button under it:
//   top:r — refresh the board in place
// Widgets can't ask the bot for anything, so the numbers change only through it.

import { db, BotApiError } from 'sdk';
import { desc, gt } from 'sdk/db';
import { players } from '../schema.js';
import { editMessage, getPlayer } from './engine.js';
import { showCard } from './screen.js';
import { GameError, btn, esc, chips } from './ui.js';
import { t } from './strings.js';
import { topWidget, TOP_ROWS } from './widgets/payloads.js';
import { editWidgetCard } from './widgets/index.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export async function topCard(me, locale) {
  const rows = await db.select().from(players).orderBy(desc(players.chips)).limit(TOP_ROWS);
  // The viewer's place: players with more chips, plus one.
  const rank = me ? (await db.$count(players, gt(players.chips, me.chips))) + 1 : 0;
  return {
    text: [`<b>${t(locale, 'top_title')}</b>`, '', ...rows.map((p, i) => `${MEDALS[i] ?? `${i + 1}.`} ${esc(p.name)} — ${chips(p.chips)}`)].join('\n'),
    keyboard: [[btn(t(locale, 'w_refresh'), 'top:r')]],
    widget: topWidget(rows, me, rank, locale),
  };
}

export const showTop = async (me, locale) => showCard(me.id, await topCard(me, locale));

// Callback data: top:r (private chat only). Redraws the board the button sits
// under: widget data or text, whichever it is.
export async function topPress(ctx, cb, [act]) {
  if (ctx.inline || !cb.message || cb.message.chat.type !== 'private') throw new GameError('This button no longer works.');
  if (act !== 'r') throw new GameError('Unknown action.');
  await ctx.answer();
  const card = await topCard(await getPlayer(ctx.user.id), ctx.locale);
  const message = cb.message;
  try {
    if (message.widget) return await editWidgetCard(message, card);
  } catch (e) {
    if (!(e instanceof BotApiError)) throw e;
    console.warn('top widget edit failed', e.description);
    return;
  }
  return editMessage({ chat_id: message.chat.id, message_id: message.message_id }, card.text, { inline_keyboard: card.keyboard });
}
