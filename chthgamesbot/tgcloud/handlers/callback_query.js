// handlers/callback_query.js — every inline-keyboard press, in chats and inline messages.
// Data is `<game key>:<args…>`; the game module does the rest through `ctx`.

import { callbackCtx, ensurePlayer } from '../lib/engine.js';
import { GameError } from '../lib/ui.js';
import { BY_KEY } from '../lib/games/index.js';
import { menuPress, languagePress } from '../lib/menu.js';
import { playerLocale, tr } from '../lib/i18n.js';
import { t } from '../lib/strings.js';

// Never throws: a failed update could be redelivered, and replaying a press that already
// moved chips must not happen. Errors are logged instead.
export default async function (cb) {
  const [key, ...args] = (cb.data ?? '').split(':');
  let ctx = callbackCtx(cb, key);
  try {
    const me = await ensurePlayer(cb.from);
    ctx = callbackCtx(cb, key, playerLocale(me));
    if (me.banned) throw new GameError('🚫 You are banned from playing.');
    if (key === 'menu') await menuPress(ctx, cb, args);
    else if (key === 'lang') await languagePress(ctx, cb, args);
    else if (BY_KEY[key]) await BY_KEY[key].handle(ctx, args);
    else throw new GameError('This button no longer works.');
    if (!ctx.answered) await ctx.answer();
  } catch (e) {
    const known = e instanceof GameError;
    if (!known) console.error(e);
    if (!ctx.answered) {
      await ctx.answer(known ? tr(ctx.locale, e.message, e.vars) : t(ctx.locale, 'something_wrong'), true);
    }
  }
}
