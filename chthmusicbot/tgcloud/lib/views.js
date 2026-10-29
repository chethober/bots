// The private-chat screens: home, 🎧 Accounts, 🔗 My syncs and one sync.
// Each view returns { text, reply_markup } (HTML).

import { MINIAPP_URL } from './config.js';
import { PROVIDERS, PROVIDER_IDS, providerOf } from './providers/index.js';
import { listAccounts } from './accounts.js';
import { getChat, topicName } from './chats.js';
import { linksOfOwner, childrenOf, countTracks, countPending } from './sync.js';
import { localeFor, mainKeyboard } from './i18n.js';
import { showHome } from './screen.js';
import { relayAvailable } from './relay.js';
import { t } from './strings.js';
import { esc } from './util.js';

export const ARROWS = { in: '→', out: '←', both: '⇄' };

export async function sendHome(from) {
  const locale = await localeFor(from);
  const accts = await listAccounts(from.id);
  const status = accts.length
    ? accts.map((a) => `${PROVIDERS[a.provider]?.icon ?? '🎵'} ${esc(a.name ?? PROVIDERS[a.provider]?.name)}`).join('\n')
    : t(locale, 'home_no_accounts');
  const text = `${t(locale, 'welcome', { name: esc(from.first_name ?? '') })}\n\n${t(locale, 'home')}\n\n${status}`;
  return showHome(from.id, { text, parse_mode: 'HTML', reply_markup: mainKeyboard(locale) });
}

// --- 🎧 Accounts ----------------------------------------------------------------

function connectButton(locale, provider) {
  const text = t(locale, 'connect', { service: `${provider.icon} ${provider.name}` });
  if (provider.id === 'youtube') return { text, callback_data: 'ac:yt' };
  return { text, web_app: { url: `${MINIAPP_URL}/?p=${provider.id}` } };
}

export async function accountsView(userId, locale, note = '') {
  const accts = Object.fromEntries((await listAccounts(userId)).map((a) => [a.provider, a]));
  const lines = [];
  const rows = [];
  for (const id of PROVIDER_IDS) {
    const p = PROVIDERS[id];
    const a = accts[id];
    if (a) {
      lines.push(`${p.icon} <b>${p.name}</b>: ✅ ${esc(a.name ?? '')}`);
      rows.push([{ text: t(locale, 'disconnect', { service: p.name }), callback_data: `ac:off:${id}` }]);
    } else if (p.available()) {
      lines.push(`${p.icon} <b>${p.name}</b>: ${t(locale, 'not_connected')}`);
      rows.push([connectButton(locale, p)]);
    } else {
      lines.push(`${p.icon} <b>${p.name}</b>: ${t(locale, 'unavailable')}`);
    }
  }
  const text = [note, t(locale, 'accounts_title'), lines.join('\n'), t(locale, 'accounts_hint')].filter(Boolean).join('\n\n');
  return { text, parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } };
}

// --- 🔗 My syncs ------------------------------------------------------------------

async function placeOf(link, locale) {
  const chat = await getChat(link.chatId);
  let place = esc(chat?.title ?? String(link.chatId));
  if (link.threadId === -1) place += ` › ${t(locale, 'every_topic')}`;
  else if (link.threadId > 0) place += ` › ${esc(await topicName(link.chatId, link.threadId) ?? `#${link.threadId}`)}`;
  return { place, active: chat?.active !== 0 };
}

const playlistOf = (link, locale) => (link.threadId === -1 ? t(locale, 'per_topic_playlists') : link.playlistName ?? '—');

export async function linksView(userId, locale, note = '') {
  const all = await linksOfOwner(userId);
  if (!all.length) {
    return { text: [note, t(locale, 'syncs_empty')].filter(Boolean).join('\n\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: t(locale, 'new_sync_button'), callback_data: 'nw' }]] } };
  }
  const rows = [];
  for (const link of all) {
    const { place, active } = await placeOf(link, locale);
    const p = providerOf(link.provider);
    rows.push([{ text: `${active ? '' : '⚠️ '}${p.icon} ${playlistOf(link, locale)} ${ARROWS[link.direction]} ${place}`.slice(0, 120), callback_data: `ln:${link.id}` }]);
  }
  return { text: [note, t(locale, 'syncs_title')].filter(Boolean).join('\n\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } };
}

export async function linkView(link, locale, note = '') {
  const p = providerOf(link.provider);
  const { place, active } = await placeOf(link, locale);
  const kids = link.threadId === -1 ? await childrenOf(link.id) : [link];
  let tracks = 0;
  let pending = 0;
  for (const k of kids) {
    tracks += await countTracks(k.id);
    pending += await countPending(k.id);
  }
  const lines = [
    `${p.icon} <b>${esc(playlistOf(link, locale))}</b> · ${p.name}`,
    `💬 ${place}${active ? '' : ` — ${t(locale, 'bot_not_in_chat')}`}`,
    `${ARROWS[link.direction]} ${t(locale, `dir_${link.direction}`)}`,
    t(locale, 'link_stats', { tracks, pending }),
  ];
  if (link.threadId === -1) lines.push(t(locale, 'link_topics', { n: kids.length }));
  if (link.direction !== 'in') lines.push('', t(locale, 'sync_hint'));
  const rows = [
    [{ text: t(locale, 'sync_now'), callback_data: `ln:${link.id}:sync` }, { text: t(locale, 'change_direction'), callback_data: `ln:${link.id}:dir` }],
    [
      { text: t(locale, link.reaction ? 'reaction_on' : 'reaction_off'), callback_data: `ln:${link.id}:react` },
      { text: t(locale, link.dedupe ? 'dedupe_on' : 'dedupe_off'), callback_data: `ln:${link.id}:dedupe` },
    ],
  ];
  if (link.direction !== 'in' && relayAvailable()) {
    rows.push([{ text: t(locale, link.audio ? 'audio_on' : 'audio_off'), callback_data: `ln:${link.id}:audio` }]);
  }
  if (link.direction !== 'out' && link.threadId !== -1) rows.push([{ text: t(locale, 'bf_button'), callback_data: `ln:${link.id}:bf` }]);
  if (link.playlistId) rows.push([{ text: t(locale, 'open_playlist'), url: p.playlistUrl(link.playlistId) }]);
  rows.push([{ text: t(locale, 'remove_sync'), callback_data: `ln:${link.id}:del` }, { text: t(locale, 'back'), callback_data: 'ln' }]);
  return { text: [note, lines.join('\n')].filter(Boolean).join('\n\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } };
}
