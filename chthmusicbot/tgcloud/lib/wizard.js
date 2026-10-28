// ➕ New sync: pick a chat → (forum: whole forum, one playlist per topic) →
// pick a service → pick, create or paste a playlist → pick the direction →
// (playlist → chat: post the tracks already there, or only new ones).
//
// The chat is picked with Telegram's own chat picker (request_chat), which also
// adds the bot as an admin. A single forum topic is linked by posting /sync in
// it, which opens this wizard with that topic.
//
// The wizard's state is the user's draft: { chatId, threadId, chatTitle,
// provider, playlistId, playlistName, editable, direction, awaiting }.

import { api } from 'sdk';
import { PAGE_SIZE } from './config.js';
import { PROVIDERS, providerOf } from './providers/index.js';
import { getAccount, listAccounts } from './accounts.js';
import { getChat, isChatAdmin, topicName, upsertChat } from './chats.js';
import { getDraft, setDraft, patchDraft, clearDraft } from './drafts.js';
import { createLink, baseline } from './sync.js';
import { label, localeFor } from './i18n.js';
import { linkView, sendHome } from './views.js';
import { showScreen } from './screen.js';
import { errorText } from './errors.js';
import { t } from './strings.js';
import { esc } from './util.js';

const REQUEST_GROUP = 1;
const REQUEST_CHANNEL = 2;

// ChatAdministratorRights with every required field; the bot asks for what it uses.
const rights = (extra) => ({
  is_anonymous: false, can_manage_chat: false, can_delete_messages: false, can_manage_video_chats: false,
  can_restrict_members: false, can_promote_members: false, can_change_info: false, can_invite_users: false,
  can_post_stories: false, can_edit_stories: false, can_delete_stories: false, ...extra,
});
const GROUP_RIGHTS = rights({ can_delete_messages: true });
const CHANNEL_RIGHTS = rights({ can_post_messages: true, can_delete_messages: true });

/** Edit the message a button was tapped on, or open a new screen. */
async function render(ctx, view) {
  if (ctx.q) {
    try {
      return await api.editMessageText({ chat_id: ctx.q.message.chat.id, message_id: ctx.q.message.message_id, link_preview_options: { is_disabled: true }, ...view });
    } catch (e) {
      if (/not modified/.test(e.description ?? '')) return null;
    }
  }
  return showScreen(ctx.userId, view);
}

const cancelRow = (locale) => [{ text: t(locale, 'cancel'), callback_data: 'nw:x' }];

export async function startNewSync(from) {
  const locale = await localeFor(from);
  await clearDraft(from.id);
  return showScreen(from.id, {
    text: t(locale, 'new_pick_chat'),
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [
        [{ text: t(locale, 'pick_group'), request_chat: { request_id: REQUEST_GROUP, chat_is_channel: false, request_title: true, user_administrator_rights: GROUP_RIGHTS, bot_administrator_rights: GROUP_RIGHTS } }],
        [{ text: t(locale, 'pick_channel'), request_chat: { request_id: REQUEST_CHANNEL, chat_is_channel: true, request_title: true, user_administrator_rights: CHANNEL_RIGHTS, bot_administrator_rights: CHANNEL_RIGHTS } }],
        [{ text: label('cancel', locale) }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

/** The chat picker returned a chat. */
export async function onChatShared(message) {
  const from = message.from;
  const locale = await localeFor(from);
  const chatId = message.chat_shared.chat_id;
  await sendHome(from); // brings the main keyboard back
  let chat;
  try {
    chat = await api.getChat({ chat_id: chatId });
  } catch {
    return showScreen(from.id, { text: t(locale, 'err_bot_not_added') });
  }
  await upsertChat(chat);
  const draft = { chatId, threadId: 0, chatTitle: chat.title ?? message.chat_shared.title ?? String(chatId) };
  await setDraft(from.id, draft);
  if (chat.is_forum) return forumStep({ userId: from.id }, locale, draft);
  return serviceStep({ userId: from.id }, locale);
}

/** /sync in a forum topic opened the bot with `s<chatId>_<threadId>`. */
export async function startTopicSync(from, chatId, threadId) {
  const locale = await localeFor(from);
  if (!(await isChatAdmin(chatId, from.id))) return showScreen(from.id, { text: t(locale, 'admins_only') });
  const chat = await getChat(chatId);
  const topic = threadId > 0 ? (await topicName(chatId, threadId)) ?? `#${threadId}` : null;
  await setDraft(from.id, { chatId, threadId, chatTitle: [chat?.title ?? String(chatId), topic].filter(Boolean).join(' › '), topic });
  return serviceStep({ userId: from.id }, locale);
}

function forumStep(ctx, locale, draft) {
  return render(ctx, {
    text: t(locale, 'new_forum_mode', { chat: esc(draft.chatTitle) }),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: t(locale, 'mode_whole'), callback_data: 'nw:mode:whole' }],
        [{ text: t(locale, 'mode_topics'), callback_data: 'nw:mode:topics' }],
        cancelRow(locale),
      ],
    },
  });
}

async function serviceStep(ctx, locale) {
  const accts = await listAccounts(ctx.userId);
  if (!accts.length) {
    return render(ctx, {
      text: t(locale, 'new_no_accounts'),
      reply_markup: { inline_keyboard: [[{ text: label('accounts', locale), callback_data: 'ac' }], cancelRow(locale)] },
    });
  }
  return render(ctx, {
    text: t(locale, 'new_pick_service'),
    reply_markup: {
      inline_keyboard: [
        ...accts.map((a) => [{ text: `${PROVIDERS[a.provider].icon} ${PROVIDERS[a.provider].name} · ${a.name ?? ''}`, callback_data: `nw:prov:${a.provider}` }]),
        cancelRow(locale),
      ],
    },
  });
}

async function playlistStep(ctx, locale, draft, page = 0) {
  const provider = providerOf(draft.provider);
  const acct = await getAccount(ctx.userId, draft.provider);
  const all = await provider.listPlaylists(acct);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const rows = all.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE).map((pl) => [{
    text: `${pl.editable ? '' : '👁 '}${pl.name}${pl.total != null ? ` (${pl.total})` : ''}`.slice(0, 60),
    callback_data: `nw:pl:${pl.id}`,
  }]);
  if (pages > 1) {
    rows.push([
      { text: p > 0 ? '‹' : '·', callback_data: p > 0 ? `nw:pg:${p - 1}` : 'nw:noop' },
      { text: `${p + 1}/${pages}`, callback_data: 'nw:noop' },
      { text: p < pages - 1 ? '›' : '·', callback_data: p < pages - 1 ? `nw:pg:${p + 1}` : 'nw:noop' },
    ]);
  }
  rows.push([{ text: t(locale, 'new_playlist', { name: (draft.topic ?? draft.chatTitle).slice(0, 40) }), callback_data: 'nw:new' }]);
  rows.push([{ text: t(locale, 'paste_playlist'), callback_data: 'nw:paste' }]);
  rows.push(cancelRow(locale));
  return render(ctx, {
    text: t(locale, 'new_pick_playlist', { service: provider.name, chat: esc(draft.chatTitle) }),
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: rows },
  });
}

function directionStep(ctx, locale, draft) {
  const dirs = draft.threadId === -1 || draft.editable ? ['both', 'in', 'out'] : ['out'];
  const what = draft.threadId === -1 ? t(locale, 'per_topic_playlists') : draft.playlistName;
  return render(ctx, {
    text: [t(locale, 'new_pick_direction', { playlist: esc(what), chat: esc(draft.chatTitle) }), draft.editable === false ? t(locale, 'read_only_playlist') : '']
      .filter(Boolean).join('\n\n'),
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [...dirs.map((d) => [{ text: t(locale, `dir_${d}`), callback_data: `nw:dir:${d}` }]), cancelRow(locale)] },
  });
}

async function baselineStep(ctx, locale, draft) {
  return render(ctx, {
    text: t(locale, 'new_baseline', { playlist: esc(draft.playlistName) }),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: t(locale, 'base_all'), callback_data: 'nw:base:all' }],
        [{ text: t(locale, 'base_new'), callback_data: 'nw:base:new' }],
        cancelRow(locale),
      ],
    },
  });
}

async function finish(ctx, locale, draft, onlyNew) {
  const link = await createLink({
    ownerId: ctx.userId, chatId: draft.chatId, threadId: draft.threadId, provider: draft.provider,
    playlistId: draft.playlistId ?? null, playlistName: draft.playlistName ?? null, direction: draft.direction,
  });
  await clearDraft(ctx.userId);
  if (onlyNew && link.playlistId) await baseline(link);
  return render(ctx, await linkView(link, locale, t(locale, 'new_done')));
}

async function choosePlaylist(ctx, locale, draft, playlist) {
  const next = await patchDraft(ctx.userId, { playlistId: playlist.id, playlistName: playlist.name, editable: playlist.editable !== false, awaiting: null });
  return directionStep(ctx, locale, next);
}

/** nw:* buttons. */
export async function onWizardCallback(q, arg) {
  const ctx = { q, userId: q.from.id };
  const locale = await localeFor(q.from);
  if (arg === '') return startNewSync(q.from);
  if (arg === 'noop') return null;
  const draft = await getDraft(q.from.id);
  if (arg === 'x' || !draft) {
    await clearDraft(q.from.id);
    return render(ctx, { text: t(locale, 'new_cancelled') });
  }
  const [op, ...rest] = arg.split(':');
  const value = rest.join(':');
  try {
    if (op === 'mode') {
      const next = await patchDraft(q.from.id, { threadId: value === 'topics' ? -1 : 0 });
      return serviceStep(ctx, locale, next);
    }
    if (op === 'prov') {
      const next = await patchDraft(q.from.id, { provider: value });
      if (next.threadId === -1) return directionStep(ctx, locale, { ...next, editable: true });
      return playlistStep(ctx, locale, next);
    }
    if (op === 'pg') return playlistStep(ctx, locale, draft, Number(value));
    if (op === 'pl') {
      const acct = await getAccount(q.from.id, draft.provider);
      return choosePlaylist(ctx, locale, draft, await providerOf(draft.provider).getPlaylist(acct, value));
    }
    if (op === 'new') {
      const acct = await getAccount(q.from.id, draft.provider);
      const name = draft.topic ?? draft.chatTitle;
      const me = await api.getMe();
      return choosePlaylist(ctx, locale, draft, { ...(await providerOf(draft.provider).createPlaylist(acct, name, `${name} · @${me.username}`)), editable: true });
    }
    if (op === 'paste') {
      await patchDraft(q.from.id, { awaiting: 'playlist_link' });
      return render(ctx, { text: t(locale, 'new_paste_link', { service: providerOf(draft.provider).name }), reply_markup: { inline_keyboard: [cancelRow(locale)] } });
    }
    if (op === 'dir') {
      const next = await patchDraft(q.from.id, { direction: value });
      if (value !== 'in' && next.threadId !== -1) return baselineStep(ctx, locale, next);
      return finish(ctx, locale, next, true);
    }
    if (op === 'base') return finish(ctx, locale, draft, value === 'new');
  } catch (e) {
    console.error(e);
    return render(ctx, { text: t(locale, 'failed', { error: errorText(locale, e) }), reply_markup: { inline_keyboard: [cancelRow(locale)] } });
  }
  return null;
}

/** Text while the wizard waits for a playlist link. Returns true if it was handled. */
export async function onWizardText(message) {
  const draft = await getDraft(message.from.id);
  if (draft?.awaiting !== 'playlist_link') return false;
  const locale = await localeFor(message.from);
  const ctx = { userId: message.from.id };
  const provider = providerOf(draft.provider);
  const id = provider.parsePlaylistLink(message.text ?? '');
  await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id }).catch(() => {});
  if (!id) {
    await showScreen(ctx.userId, { text: t(locale, 'bad_playlist_link', { service: provider.name }), reply_markup: { inline_keyboard: [cancelRow(locale)] } });
    return true;
  }
  try {
    const acct = await getAccount(ctx.userId, draft.provider);
    await choosePlaylist(ctx, locale, draft, await provider.getPlaylist(acct, id));
  } catch (e) {
    await showScreen(ctx.userId, { text: t(locale, 'failed', { error: errorText(locale, e) }), reply_markup: { inline_keyboard: [cancelRow(locale)] } });
  }
  return true;
}
