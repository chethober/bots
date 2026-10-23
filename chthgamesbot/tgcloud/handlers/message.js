// handlers/message.js — commands. Games themselves run on inline keyboards
// (handlers/callback_query.js) and in the Mini App (endpoints/).

import { api, db } from 'sdk';
import { desc } from 'sdk/db';
import { players } from '../schema.js';
import { ensurePlayer, claimDaily, sendHtml } from '../lib/engine.js';
import { BY_CMD } from '../lib/games/index.js';
import { menuText, menuMarkup, postLobby } from '../lib/menu.js';
import { adminCommand } from '../lib/admin.js';
import { esc, chips, nameOf, parseBet } from '../lib/ui.js';
import { BOT_USERNAME, WEBAPP_URL, DAILY_CHIPS, DAILY_COOLDOWN, START_CHIPS } from '../lib/config.js';
import { t } from '../lib/strings.js';
import { SOURCE_URL } from '../lib/config.js';
import { normalizeLocale, languageKeyboard, mainKeyboard, matchButton } from '../lib/i18n.js';

// Slash commands shown in the menu (bot-specific features; simple English).
const GAME_COMMANDS = [
  { command: 'games', description: 'List all games' },
  { command: 'balance', description: 'Your chips and stats' },
  { command: 'daily', description: 'Claim daily chips' },
  { command: 'top', description: 'Richest players' },
  { command: 'hub', description: 'Open the game hub' },
];

// A tapped reply-keyboard button (🌐 Language · 🔗 Source code).
function handleButton(chatId, button, locale) {
  if (button === 'language') return sendHtml(chatId, t(locale, 'choose_language'), languageKeyboard());
  return sendHtml(chatId, t(locale, 'source_here'), { inline_keyboard: [[{ text: t(locale, 'source'), url: SOURCE_URL }]] });
}

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

  // Unified reply-keyboard buttons (non-slash text).
  const button = matchButton(text);
  if (button) {
    const me = await ensurePlayer(message.from);
    if (me.banned) return;
    return handleButton(message.chat.id, button, me.locale || normalizeLocale(message.from.language_code));
  }

  if (!text.startsWith('/')) return;

  const [head, ...rest] = text.split(/\s+/);
  const [cmd, at] = head.slice(1).toLowerCase().split('@');
  if (at && at !== BOT_USERNAME.toLowerCase()) return; // addressed to another bot

  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const me = await ensurePlayer(message.from);
  const user = { id: message.from.id, name: nameOf(message.from) };
  const locale = me.locale || normalizeLocale(message.from.language_code);

  if (await adminCommand(message, cmd, rest, text)) return;
  if (me.banned) {
    if (chatType === 'private') await sendHtml(chatId, '🚫 You are banned from playing.');
    return;
  }

  switch (cmd) {
    case 'start':
      if (rest[0]?.startsWith('join_')) return sendHtml(chatId, 'That old invite has expired — start a new game with /tictactoe or open the 🎮 hub.');
      if (/^room_[a-z0-9]{8}$/.test(rest[0] ?? '')) {
        return sendHtml(chatId, "🎮 You're invited to a game room:", {
          inline_keyboard: [[{ text: '▶️ Open the room', web_app: { url: `${WEBAPP_URL}?room=${rest[0].slice(5)}` } }]],
        });
      }
      await api.setMyCommands({ commands: GAME_COMMANDS }).catch(() => {});
      if (chatType === 'private') {
        await sendHtml(chatId, welcome(me, locale), mainKeyboard());
        return sendHtml(chatId, menuText(chatType, locale), menuMarkup(chatType, locale));
      }
      return sendHtml(chatId, welcome(me, locale), menuMarkup(chatType, locale));
    case 'help':
    case 'games':
      return sendHtml(chatId, menuText(chatType, locale), menuMarkup(chatType, locale));
    case 'language':
    case 'lang':
      return sendHtml(chatId, t(locale, 'choose_language'), languageKeyboard());
    case 'balance':
    case 'bal':
    case 'me':
      return sendHtml(chatId, wallet(me), undefined, replyTo(message));
    case 'daily': {
      const after = await claimDaily(user.id);
      if (after) return sendHtml(chatId, `🎁 +${chips(DAILY_CHIPS)}! Balance: <b>${chips(after.chips)}</b>`, undefined, replyTo(message));
      const wait = me.lastDaily + DAILY_COOLDOWN - Math.floor(Date.now() / 1000);
      return sendHtml(chatId, `⏳ Next bonus in ${Math.ceil(wait / 3600)}h. Balance: ${chips(me.chips)}`, undefined, replyTo(message));
    }
    case 'top':
      return sendHtml(chatId, await leaderboard(), undefined, replyTo(message));
    case 'hub':
    case 'crash':
    case 'plinko':
    case 'app':
      return openHub(chatId, chatType, message);
  }

  const game = BY_CMD[cmd];
  if (!game) return;
  const bet = game.defaultBet ? parseBet(rest[0], game.defaultBet) : 0;
  if (chatType === 'private' && (game.group === 'duel' || game.group === 'party')) {
    // Nobody else can join a lobby in a DM — send it to a chat via inline mode instead.
    return sendHtml(chatId, `${game.title} needs other players. Pick a chat to send it to:`, {
      inline_keyboard: [[{ text: `📤 Send ${game.title}`, switch_inline_query: bet ? `${game.cmd} ${bet}` : game.cmd }]],
    });
  }
  return postLobby(chatId, game, user, bet);
}

const replyTo = (m) => (m.chat.type === 'private' ? {} : { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } });

function welcome(me, locale = 'en') {
  return t(locale, 'welcome', {
    name: esc(me.name),
    chips: chips(me.chips),
    start: START_CHIPS,
    daily: DAILY_CHIPS,
    bot: BOT_USERNAME,
  });
}

function wallet(p) {
  return [
    `<b>${esc(p.name)}</b>`,
    `💰 Balance: <b>${chips(p.chips)}</b>`,
    `🎮 Games: ${p.played} · 🏆 Wins: ${p.wins}`,
    `🎲 Wagered: ${chips(p.wagered)} · 🌟 Best win: ${chips(p.bestWin)}`,
  ].join('\n');
}

async function leaderboard() {
  const rows = await db.select().from(players).orderBy(desc(players.chips)).limit(10);
  const medals = ['🥇', '🥈', '🥉'];
  return ['<b>🏆 Richest players</b>', '', ...rows.map((p, i) => `${medals[i] ?? `${i + 1}.`} ${esc(p.name)} — ${chips(p.chips)}`)].join('\n');
}

async function openHub(chatId, chatType, message) {
  if (chatType === 'private') {
    return sendHtml(chatId, 'Every game, with full graphics, lives in the game hub:', {
      inline_keyboard: [[{ text: '🎮 Open game hub', web_app: { url: WEBAPP_URL } }]],
    });
  }
  // web_app buttons only work in private chats — send people to the DM.
  return sendHtml(chatId, 'The game hub opens in our private chat:', {
    inline_keyboard: [[{ text: '🎮 Open game hub', url: `https://t.me/${BOT_USERNAME}?start=hub` }]],
  }, replyTo(message));
}
