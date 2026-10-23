// handlers/message.js — the private chat's reply keyboard, /start, the group
// welcome and the admin commands. Games themselves run on inline keyboards
// (handlers/callback_query.js) and in the Mini App (endpoints/). The only slash
// commands are /start and the admin ones.

import { api, db } from 'sdk';
import { desc } from 'sdk/db';
import { players } from '../schema.js';
import { ensurePlayer, claimDaily, sendHtml } from '../lib/engine.js';
import { menuText, menuMarkup, sendHome } from '../lib/menu.js';
import { adminCommand, ADMIN_COMMANDS, isAdmin } from '../lib/admin.js';
import { esc, chips } from '../lib/ui.js';
import { BOT_USERNAME, WEBAPP_URL, DAILY_CHIPS, DAILY_COOLDOWN, SOURCE_URL } from '../lib/config.js';
import { t } from '../lib/strings.js';
import { languageKeyboard, playerLocale } from '../lib/i18n.js';
import { drop, matchButton, showScreen } from '../lib/screen.js';

// Never throws (see handlers/callback_query.js) — errors are logged.
export default async function (message) {
  try {
    await handle(message);
  } catch (e) {
    console.error(e);
  }
}

async function handle(message) {
  const text = message.text ?? '';
  if (!message.from) return;
  const chatId = message.chat.id;
  const chatType = message.chat.type;

  // Added to a group: say hello with the games menu.
  if (message.new_chat_members?.some((u) => u.username?.toLowerCase() === BOT_USERNAME.toLowerCase())) {
    const locale = playerLocale(await ensurePlayer(message.from));
    return sendHtml(chatId, menuText(chatType, locale), menuMarkup(chatType, locale));
  }

  const button = chatType === 'private' ? matchButton(text) : null;
  if (!button && !text.startsWith('/')) return;

  const me = await ensurePlayer(message.from);
  const locale = playerLocale(me);

  if (button) {
    await drop(chatId, message.message_id);
    if (me.banned) return showScreen(chatId, t(locale, 'banned'));
    return onButton(me, button, locale);
  }

  const [head, ...rest] = text.split(/\s+/);
  const [cmd, at] = head.slice(1).toLowerCase().split('@');
  if (at && at !== BOT_USERNAME.toLowerCase()) return; // addressed to another bot

  if (await adminCommand(message, cmd, rest, text)) return;
  if (cmd !== 'start') {
    // Old game commands: in private, tidy up and point at the buttons; elsewhere stay quiet.
    if (chatType === 'private') {
      await drop(chatId, message.message_id);
      return showScreen(chatId, t(locale, 'use_buttons'));
    }
    return;
  }
  if (me.banned) {
    if (chatType === 'private') await sendHtml(chatId, t(locale, 'banned'));
    return;
  }

  if (chatType !== 'private') return sendHtml(chatId, menuText(chatType, locale), menuMarkup(chatType, locale));

  await drop(chatId, message.message_id);
  if (rest[0]?.startsWith('join_')) return showScreen(chatId, t(locale, 'old_invite'));
  if (/^room_[a-z0-9]{8}$/.test(rest[0] ?? '')) {
    return showScreen(chatId, t(locale, 'room_invite'), {
      inline_keyboard: [[{ text: t(locale, 'open_room'), web_app: { url: `${WEBAPP_URL}?room=${rest[0].slice(5)}` } }]],
    });
  }
  // Users have the reply keyboard instead of a command menu; admins get theirs.
  await api.deleteMyCommands({}).catch(() => {});
  if (isAdmin(me.id)) {
    await api.setMyCommands({
      commands: ADMIN_COMMANDS.map(([command, description]) => ({ command, description })),
      scope: { type: 'chat', chat_id: me.id },
    }).catch(() => {});
  }
  await sendHome(me, locale);
  if (rest[0] === 'hub') return openHub(chatId, locale);
}

// A tapped reply-keyboard button (private chat); each answer replaces the last screen.
async function onButton(me, button, locale) {
  const chatId = me.id;
  switch (button) {
    case 'games':
      return showScreen(chatId, menuText('private', locale), menuMarkup('private', locale));
    case 'hub':
      return openHub(chatId, locale);
    case 'balance':
      return showScreen(chatId, t(locale, 'wallet', {
        name: esc(me.name), chips: chips(me.chips), played: me.played, wins: me.wins,
        wagered: chips(me.wagered), best: chips(me.bestWin),
      }));
    case 'daily': {
      const after = await claimDaily(me.id);
      if (after) return showScreen(chatId, t(locale, 'daily_got', { daily: chips(DAILY_CHIPS), chips: chips(after.chips) }));
      const wait = me.lastDaily + DAILY_COOLDOWN - Math.floor(Date.now() / 1000);
      return showScreen(chatId, t(locale, 'daily_wait', { h: Math.ceil(wait / 3600), chips: chips(me.chips) }));
    }
    case 'top':
      return showScreen(chatId, await leaderboard(locale));
    case 'language':
      return showScreen(chatId, t(locale, 'choose_language'), languageKeyboard());
    case 'source':
      return showScreen(chatId, t(locale, 'source_here'), { inline_keyboard: [[{ text: t(locale, 'kb_source'), url: SOURCE_URL }]] });
  }
}

async function leaderboard(locale) {
  const rows = await db.select().from(players).orderBy(desc(players.chips)).limit(10);
  const medals = ['🥇', '🥈', '🥉'];
  return [`<b>${t(locale, 'top_title')}</b>`, '', ...rows.map((p, i) => `${medals[i] ?? `${i + 1}.`} ${esc(p.name)} — ${chips(p.chips)}`)].join('\n');
}

function openHub(chatId, locale) {
  return showScreen(chatId, t(locale, 'hub_private'), {
    inline_keyboard: [[{ text: t(locale, 'open_hub'), web_app: { url: WEBAPP_URL } }]],
  });
}
