// handlers/callback_query.js — every inline button:
//   lang:<code>   language          tip…        ⭐ Tip (lib/tips.js)
//   ac[:…]        🎧 Accounts        nw[:…]      ➕ New sync wizard
//   ln[:<id>[:op]] 🔗 My syncs        fd:<id>…    🔎 Find music
//   pl:<action>   the group player   sg:<id>:op  ❤️ ➕ 🎵 under a posted song
//   bf:<op>       ⏮ Add old songs (lib/backfill.js)

import { api } from 'sdk';
import { SOURCE_URL } from '../lib/config.js';
import { setLocale, LOCALE_NAMES, localeFor } from '../lib/i18n.js';
import { aboutKeyboard, isTipCallback, onTipCallback } from '../lib/tips.js';
import { accountsView, linksView, linkView, sendHome } from '../lib/views.js';
import { onWizardCallback } from '../lib/wizard.js';
import { onFindCallback, onSongCallback } from '../lib/find.js';
import { onPlayerCallback } from '../lib/player.js';
import { onBackfillCallback, startBackfill } from '../lib/backfill.js';
import { deleteAccount } from '../lib/accounts.js';
import { youtubeStart, youtubePoll } from '../lib/login.js';
import { getLink, updateLink, deleteLink, syncNow } from '../lib/sync.js';
import { PROVIDERS } from '../lib/providers/index.js';
import { errorText } from '../lib/errors.js';
import { t } from '../lib/strings.js';
import { esc } from '../lib/util.js';

const answer = (q, text, alert = false) => api.answerCallbackQuery({ callback_query_id: q.id, text, show_alert: alert }).catch(() => {});

function edit(q, view) {
  return api.editMessageText({ chat_id: q.message.chat.id, message_id: q.message.message_id, link_preview_options: { is_disabled: true }, ...view })
    .catch((e) => { if (!/not modified/.test(e.description ?? '')) console.warn('edit failed', e.description); });
}

async function onAccounts(q, locale, arg) {
  if (!arg) {
    await answer(q);
    return edit(q, await accountsView(q.from.id, locale));
  }
  const [op, value] = arg.split(':');
  if (op === 'off') {
    if (value?.endsWith('!')) {
      await deleteAccount(q.from.id, value.slice(0, -1));
      await answer(q);
      return edit(q, await accountsView(q.from.id, locale));
    }
    await answer(q);
    return edit(q, {
      text: t(locale, 'disconnect_confirm', { service: PROVIDERS[value]?.name ?? value }),
      reply_markup: { inline_keyboard: [[{ text: t(locale, 'yes_disconnect'), callback_data: `ac:off:${value}!` }, { text: t(locale, 'back'), callback_data: 'ac' }]] },
    });
  }
  if (op === 'yt') {
    const { state, userCode, url } = await youtubeStart(q.from.id);
    await answer(q);
    return edit(q, {
      text: t(locale, 'youtube_code', { code: userCode, url }),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: t(locale, 'youtube_open'), url }],
          [{ text: t(locale, 'youtube_done'), callback_data: `ac:ytok:${state}` }],
          [{ text: t(locale, 'back'), callback_data: 'ac' }],
        ],
      },
    });
  }
  if (op === 'ytok') {
    const done = await youtubePoll(q.from.id, value);
    if (!done) return answer(q, t(locale, 'youtube_pending'), true);
    await answer(q);
    return edit(q, await accountsView(q.from.id, locale, t(locale, 'connected', { service: 'YouTube Music', name: esc(done.name) })));
  }
  return answer(q);
}

async function onLinks(q, locale, arg) {
  if (!arg) {
    await answer(q);
    return edit(q, await linksView(q.from.id, locale));
  }
  const [idStr, op] = arg.split(':');
  const link = await getLink(Number(idStr));
  if (!link || link.ownerId !== q.from.id) return answer(q, t(locale, 'expired'), true);
  if (!op) {
    await answer(q);
    return edit(q, await linkView(link, locale));
  }
  if (op === 'sync') {
    await answer(q, t(locale, 'syncing'));
    let note;
    try {
      const r = await syncNow(link);
      note = r.remaining
        ? t(locale, 'synced_more', { posted: r.posted, remaining: r.remaining })
        : t(locale, 'synced', { posted: r.posted, retried: r.retried });
    } catch (e) {
      console.error(e);
      note = t(locale, 'failed', { error: errorText(locale, e) });
    }
    return edit(q, await linkView(link, locale, note));
  }
  if (op === 'dir') {
    const order = ['both', 'in', 'out'];
    const next = order[(order.indexOf(link.direction) + 1) % order.length];
    await updateLink(link, { direction: next });
    await answer(q, t(locale, `dir_${next}`));
    return edit(q, await linkView({ ...link, direction: next }, locale));
  }
  if (op === 'react' || op === 'dedupe' || op === 'audio') {
    const key = op === 'react' ? 'reaction' : op;
    const value = link[key] ? 0 : 1;
    await updateLink(link, { [key]: value });
    await answer(q);
    return edit(q, await linkView({ ...link, [key]: value }, locale));
  }
  if (op === 'bf') {
    await answer(q);
    return startBackfill(link, locale, q.message.message_id);
  }
  if (op === 'del') {
    await answer(q);
    return edit(q, {
      text: t(locale, 'remove_confirm', { playlist: link.playlistName ?? '—' }),
      reply_markup: { inline_keyboard: [[{ text: t(locale, 'yes_remove'), callback_data: `ln:${link.id}:del!` }, { text: t(locale, 'back'), callback_data: `ln:${link.id}` }]] },
    });
  }
  if (op === 'del!') {
    await deleteLink(link);
    await answer(q, t(locale, 'removed'));
    return edit(q, await linksView(q.from.id, locale));
  }
  return answer(q);
}

export default async function (q) {
  const data = q.data ?? '';
  const locale = await localeFor(q.from);
  const [head, ...rest] = data.split(':');
  const arg = rest.join(':');

  // A language pick: confirm in the new language, then re-send home so the
  // reply keyboard is relabelled (that also removes the picker).
  if (head === 'lang') {
    await setLocale(q.from.id, arg);
    const next = await localeFor(q.from);
    await answer(q, t(next, 'language_set', { name: LOCALE_NAMES[next] ?? next }));
    return sendHome(q.from);
  }
  if (isTipCallback(data)) return onTipCallback(q, locale, aboutKeyboard(locale, SOURCE_URL));
  if (head === 'pl') return onPlayerCallback(q, arg);

  try {
    if (head === 'ac') return await onAccounts(q, locale, arg);
    if (head === 'ln') return await onLinks(q, locale, arg);
    if (head === 'nw') {
      await answer(q);
      return await onWizardCallback(q, arg);
    }
    if (head === 'fd') return await onFindCallback(q, arg);
    if (head === 'sg') return await onSongCallback(q, arg);
    if (head === 'bf') return await onBackfillCallback(q, arg);
  } catch (e) {
    console.error(e);
    return answer(q, errorText(locale, e).slice(0, 190), true);
  }
  return answer(q);
}
