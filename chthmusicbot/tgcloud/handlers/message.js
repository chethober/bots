// handlers/message.js — the private chat (buttons, wizard input, 🔎 Find music),
// groups and forums (music posts feed their syncs and the group player; /player,
// /sync) and replies from @chethoberbot.

import { api } from 'sdk';
import { ADMIN_IDS, BOT_USERNAME, SOURCE_URL } from '../lib/config.js';
import { aboutKeyboard, thankTip } from '../lib/tips.js';
import { localeFor, languageKeyboard, matchButton } from '../lib/i18n.js';
import { drop, showScreen } from '../lib/screen.js';
import { clearDraft } from '../lib/drafts.js';
import { accountsView, linksView, sendHome } from '../lib/views.js';
import { startNewSync, startTopicSync, onChatShared, onWizardText } from '../lib/wizard.js';
import { findFromMessage } from '../lib/find.js';
import { connectFromChat } from '../lib/login.js';
import { isRelayBot, onRelayMessage } from '../lib/relay.js';
import { extractRefs } from '../lib/tracks.js';
import { onChatPost } from '../lib/sync.js';
import { startPlayer, queueFromPost } from '../lib/player.js';
import { isChatAdmin, setTopicName, threadOf, upsertChat, getChat } from '../lib/chats.js';
import { errorText } from '../lib/errors.js';
import { PROVIDERS } from '../lib/providers/index.js';
import { t } from '../lib/strings.js';
import { esc } from '../lib/util.js';

function parseCommand(text) {
  const m = /^\/([a-z_]+)(?:@(\w+))?(?:\s+([\s\S]*))?$/i.exec(text ?? '');
  if (!m || (m[2] && m[2].toLowerCase() !== BOT_USERNAME.toLowerCase())) return null;
  return { cmd: m[1].toLowerCase(), args: (m[3] ?? '').trim() };
}

async function onButton(message, button) {
  const { from } = message;
  const chatId = message.chat.id;
  await drop(chatId, message.message_id);
  const locale = await localeFor(from);
  if (button === 'syncs') return showScreen(chatId, await linksView(from.id, locale));
  if (button === 'newsync') return startNewSync(from);
  if (button === 'find') return showScreen(chatId, { text: t(locale, 'find_prompt') });
  if (button === 'accounts') return showScreen(chatId, await accountsView(from.id, locale));
  if (button === 'about') return showScreen(chatId, { text: t(locale, 'about'), reply_markup: aboutKeyboard(locale, SOURCE_URL) });
  if (button === 'language') return showScreen(chatId, { text: t(locale, 'choose_language'), reply_markup: languageKeyboard() });
  await clearDraft(from.id); // ✖️ Cancel under the chat picker
  return sendHome(from);
}

async function onCommand(message, { cmd, args }) {
  const { from } = message;
  const locale = await localeFor(from);
  await drop(message.chat.id, message.message_id);
  if (cmd === 'connect') {
    const [state, ...rest] = args.split(/\s+/);
    try {
      const { provider, name } = await connectFromChat(from.id, state, rest.join(''));
      return showScreen(from.id, await accountsView(from.id, locale, t(locale, 'connected', { service: PROVIDERS[provider].name, name: esc(name) })));
    } catch (e) {
      return showScreen(from.id, { text: t(locale, 'failed', { error: errorText(locale, e) }) });
    }
  }
  if (cmd === 'start') {
    const topic = /^s(-?\d+)_(\d+)$/.exec(args);
    if (topic) return startTopicSync(from, Number(topic[1]), Number(topic[2]));
    if (args === 'accounts') return showScreen(from.id, await accountsView(from.id, locale));
    if (args === 'find') return showScreen(from.id, { text: t(locale, 'find_prompt') });
  }
  return sendHome(from);
}

async function onPrivate(message) {
  if (message.successful_payment) return thankTip(message, await localeFor(message.from), ADMIN_IDS);
  if (message.chat_shared) return onChatShared(message);
  const button = matchButton(message.text);
  if (button) return onButton(message, button);
  const command = parseCommand(message.text);
  if (command) return onCommand(message, command);
  if (message.text && await onWizardText(message)) return null;
  if (message.text) await drop(message.chat.id, message.message_id);
  if (message.text || message.audio || message.caption) return findFromMessage(message);
  return sendHome(message.from);
}

async function onGroup(message) {
  const chatId = message.chat.id;
  const threadId = threadOf(message);
  if (message.forum_topic_created && message.message_thread_id) return setTopicName(chatId, message.message_thread_id, message.forum_topic_created.name);
  if (message.forum_topic_edited?.name && message.message_thread_id) return setTopicName(chatId, message.message_thread_id, message.forum_topic_edited.name);
  if (message.from?.is_bot) return null;
  if (!(await getChat(chatId))) await upsertChat(message.chat);

  const command = parseCommand(message.text);
  if (command?.cmd === 'player') return startPlayer(message);
  if (command?.cmd === 'sync') {
    const locale = await localeFor(message.from);
    await api.deleteMessage({ chat_id: chatId, message_id: message.message_id }).catch(() => {});
    if (!message.from || !(await isChatAdmin(chatId, message.from.id))) return null;
    return api.sendMessage({
      chat_id: chatId, message_thread_id: threadId || undefined,
      text: t(locale, threadId ? 'sync_topic_here' : 'sync_chat_here'),
      reply_markup: { inline_keyboard: [[{ text: t(locale, 'open_bot'), url: `https://t.me/${BOT_USERNAME}?start=s${chatId}_${threadId}` }]] },
    });
  }
  if (command) return null;

  const refs = extractRefs(message);
  if (!refs.length) return null;
  await onChatPost(message, refs, threadId);
  return queueFromPost(message, refs);
}

export default async function (message) {
  if (message.chat.type === 'private' && isRelayBot(message.from)) return onRelayMessage(message);
  if (message.chat.type === 'private') return onPrivate(message);
  if (message.chat.type === 'group' || message.chat.type === 'supergroup') return onGroup(message);
  return null;
}
