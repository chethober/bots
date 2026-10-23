// handlers/message.js — every private-chat message: reply-keyboard buttons,
// /start (plain or with an invite code), what a prompt waits for (add a VPN,
// edits, a password, an announcement) and the admin commands. The only slash
// commands are /start and the admin ones; everything else is a button.

import { dashboardText, isAdmin, sendOpenReports } from '../lib/admin.js';
import { drop, matchButton, showScreen, textsFor } from '../lib/chats.js';
import { onAddName, onAddPassword, onAddSource, onEdit, onPassword, openVpn, startAdd } from '../lib/flows.js';
import { languageKeyboard } from '../lib/i18n.js';
import { onAddServer, onServerInput } from '../lib/servers.js';
import { getState, getVpnByCode, setState } from '../lib/store.js';
import { safeApi } from '../lib/util.js';
import { aboutView, directoryView, joinedView, ownedView, sendHome } from '../lib/views.js';

// "/start@MyBot abc" → { cmd: 'start', arg: 'abc' }
function parseCommand(text) {
  const m = /^\/([a-zA-Z0-9_]+)(?:@\S+)?(?:\s+([\s\S]*))?$/.exec(text ?? '');
  return m ? { cmd: m[1].toLowerCase(), arg: (m[2] ?? '').trim() } : null;
}

async function onButton(msg, key, L) {
  const chatId = msg.chat.id;
  await drop(chatId, msg.message_id);
  switch (key) {
    case 'directory': return showScreen(chatId, await directoryView(0, L));
    case 'joined':    return showScreen(chatId, await joinedView(msg.from.id, L));
    case 'add':       return startAdd(msg.from, L);
    case 'mine':      return showScreen(chatId, await ownedView(msg.from.id, L));
    case 'language':  return showScreen(chatId, { text: L.chooseLanguage, reply_markup: languageKeyboard() });
    case 'about':     return showScreen(chatId, aboutView(L));
  }
}

async function command(msg, { cmd, arg }, L) {
  const chatId = msg.chat.id;
  if (isAdmin(msg.from.id) && cmd === 'admin') return safeApi('sendMessage', { chat_id: chatId, text: await dashboardText(L) });
  if (isAdmin(msg.from.id) && cmd === 'reports') return sendOpenReports(chatId, L);
  await drop(chatId, msg.message_id);
  if (cmd !== 'start') return showScreen(chatId, { text: L.help });
  await setState(msg.from.id, 'idle');
  if (!arg) return sendHome(msg.from, L);
  // An invite: make sure the keyboard is there, then the VPN.
  const vpn = /^[A-Za-z0-9]{4,16}$/.test(arg) ? await getVpnByCode(arg) : null;
  await sendHome(msg.from, L);
  return openVpn(msg.from, vpn, L);
}

export default async function (msg) {
  if (msg.chat?.type !== 'private' || !msg.from || msg.from.is_bot) return;
  try {
    const L = await textsFor(msg.from);
    const button = matchButton(msg.text);
    const parsed = button ? null : parseCommand(msg.text);

    // A button or command abandons whatever a prompt was waiting for.
    if (button || parsed) {
      const state = await getState(msg.from.id);
      if (state.mode !== 'idle' || state.expired) await setState(msg.from.id, 'idle');
    }
    if (button) return await onButton(msg, button, L);
    if (parsed) return await command(msg, parsed, L);

    const { mode, data, expired } = await getState(msg.from.id);
    switch (mode) {
      case 'add_source':   return await onAddSource(msg, L);
      case 'add_name':
        await drop(msg.chat.id, msg.message_id);
        return await onAddName(msg.chat.id, msg.from.id, data, msg.text, L);
      case 'add_password': return await onAddPassword(msg, data, L);
      case 'password':     return await onPassword(msg, data, L);
      case 'add_server':   return await onAddServer(msg, L);
    }
    if (mode.startsWith('edit_')) return await onEdit(msg, mode, data, L);
    if (mode.startsWith('srv_')) return await onServerInput(msg, mode, data, L);

    await drop(msg.chat.id, msg.message_id);
    if (expired) {
      await setState(msg.from.id, 'idle');
      return await showScreen(msg.chat.id, { text: L.expired });
    }
    return await showScreen(msg.chat.id, { text: L.help });
  } catch (e) {
    console.error('message handler failed', e);
  }
}
