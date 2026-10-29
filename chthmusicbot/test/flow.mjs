// End-to-end flows against the in-memory SDK (sdk-fake.mjs) and a fake
// Spotify / song.link / iTunes: the ➕ New sync wizard, chat → playlist on a
// post, repost detection, 🔄 Sync now, 🔎 Find music, the group player and
// /playlist, /top, /random in groups and channels.
import assert from 'node:assert/strict';
import { state } from './sdk-fake.mjs';
import message from '../tgcloud/handlers/message.js';
import callback from '../tgcloud/handlers/callback_query.js';
import inline from '../tgcloud/handlers/inline_query.js';
import { saveAccount } from '../tgcloud/lib/accounts.js';

const USER = { id: 42, is_bot: false, first_name: 'Omid', language_code: 'en' };
const GROUP = { id: -100500, type: 'supergroup', title: 'Music Club' };
const PL = 'P'.repeat(22);
const T = (n) => `${n}`.repeat(22).slice(0, 22);
const track = (id, name) => ({ type: 'track', id, name, artists: [{ name: 'Artist' }], uri: `spotify:track:${id}` });
const playlist = [track(T('a'), 'Old One'), track(T('b'), 'Old Two')];
const queued = [];

const routes = [
  [/api\.spotify\.com\/v1\/me\/playlists/, () => ({ items: [{ id: PL, name: 'Club Hits', owner: { id: 'u1' }, items: { total: playlist.length } }], next: null })],
  [/api\.spotify\.com\/v1\/me\/player\/queue\?uri=/, (url) => { queued.push(decodeURIComponent(url.split('uri=')[1])); return null; }],
  [/api\.spotify\.com\/v1\/me\/player\/queue$/, () => ({ queue: queued.map((u) => track(u.split(':')[2], 'Queued')) })],
  [/api\.spotify\.com\/v1\/me\/player/, () => ({ is_playing: true, item: track(T('a'), 'Old One'), device: { name: 'Phone' } })],
  [/api\.spotify\.com\/v1\/me$/, () => ({ id: 'u1', display_name: 'Omid' })],
  [/api\.spotify\.com\/v1\/playlists\/P+\?fields/, () => ({ id: PL, name: 'Club Hits', owner: { id: 'u1' } })],
  [/api\.spotify\.com\/v1\/playlists\/P+\/items/, (url, init) => {
    if (init.method === 'POST') {
      for (const uri of JSON.parse(init.body).uris) playlist.push(track(uri.split(':')[2], 'Added'));
      return { snapshot_id: 'x' };
    }
    return { items: playlist.map((item) => ({ item })), next: null };
  }],
  [/itunes\.apple\.com\/search/, () => ({ results: [{ trackId: 111, trackName: 'Never Gonna Give You Up', artistName: 'Rick Astley', collectionName: 'Whenever' }] })],
  [/api\.song\.link/, () => ({
    entityUniqueId: 'ITUNES_SONG::111',
    entitiesByUniqueId: { 'ITUNES_SONG::111': { id: '111', type: 'song', title: 'Never Gonna Give You Up', artistName: 'Rick Astley' }, 'SPOTIFY_SONG::RICK': { id: T('r'), type: 'song' } },
    linksByPlatform: { spotify: { entityUniqueId: 'SPOTIFY_SONG::RICK' } },
  })],
];
state.routes.push(...routes);

const calls = (method) => state.calls.filter((c) => c.method === method);
const last = (method) => calls(method).at(-1)?.params;
const reset = () => { state.calls.length = 0; };
const buttons = (markup) => (markup?.inline_keyboard ?? []).flat();
const cb = (data, msgChat = USER.id) => callback({ id: 'q', from: USER, data, message: { message_id: 7, chat: { id: msgChat, type: msgChat > 0 ? 'private' : 'supergroup' } } });
const priv = (extra) => message({ message_id: 1, from: USER, chat: { id: USER.id, type: 'private' }, date: 0, ...extra });
const post = (text, id) => message({ message_id: id, from: USER, chat: GROUP, date: 0, text, entities: [{ type: 'url', offset: 0, length: text.length }] });

await saveAccount(USER.id, 'spotify', { accessToken: 'tok', refreshToken: 'ref', expiresAt: Date.now() + 3600e3, name: 'Omid', extra: { id: 'u1' } });

// /start → home with the reply keyboard.
await priv({ text: '/start' });
assert.match(last('sendMessage').text, /Hi Omid/);
assert.ok(last('sendMessage').reply_markup.keyboard);

// ➕ New sync → the chat picker.
reset();
await priv({ text: '➕ New sync' });
assert.ok(last('sendMessage').reply_markup.keyboard[0][0].request_chat);

// The picker returns the group → pick a service.
reset();
await priv({ chat_shared: { request_id: 1, chat_id: GROUP.id, title: GROUP.title } });
assert.ok(buttons(last('sendMessage').reply_markup).some((b) => b.callback_data === 'nw:prov:spotify'));

reset();
await cb('nw:prov:spotify');
assert.ok(buttons(last('editMessageText').reply_markup).some((b) => b.callback_data === `nw:pl:${PL}`));

reset();
await cb(`nw:pl:${PL}`);
assert.ok(buttons(last('editMessageText').reply_markup).some((b) => b.callback_data === 'nw:dir:both'));

reset();
await cb('nw:dir:both');
assert.ok(buttons(last('editMessageText').reply_markup).some((b) => b.callback_data === 'nw:base:new'));

reset();
await cb('nw:base:new');
const link = state.tables.get('links').rows[0];
assert.equal(link.direction, 'both');
assert.equal(link.chatId, GROUP.id);
assert.match(last('editMessageText').text, /Sync created/);
assert.equal(state.tables.get('link_tracks').rows.length, 2, 'existing tracks are the baseline');

// A new track posted in the group is added to the playlist, with a reaction.
reset();
await post(`https://open.spotify.com/track/${T('c')}`, 50);
assert.ok(playlist.some((x) => x.id === T('c')));
assert.equal(last('setMessageReaction').reaction[0].emoji, '👌');

// The same track again is recognized as a repost (deleting reposts is off).
reset();
const before = playlist.length;
await post(`https://open.spotify.com/track/${T('c')}`, 51);
assert.equal(playlist.length, before);
assert.equal(calls('deleteMessage').length, 0);

// With deleting reposts on, the repost is removed and the original pointed to.
await cb(`ln:${link.id}:dedupe`);
reset();
await post(`spotify:track:${T('c')}`, 52);
assert.equal(last('deleteMessage').message_id, 52);
assert.equal(last('sendMessage').reply_parameters.message_id, 50);

// A track added in Spotify is posted by 🔄 Sync now; a second sync posts nothing.
playlist.push(track(T('d'), 'Fresh From Spotify'));
reset();
await cb(`ln:${link.id}:sync`);
const posted = calls('sendMessage').filter((c) => c.params.chat_id === GROUP.id);
assert.equal(posted.length, 1);
assert.match(posted[0].params.text, /Fresh From Spotify/);
assert.match(last('editMessageText').text, /1 posted/);
reset();
await cb(`ln:${link.id}:sync`);
assert.equal(calls('sendMessage').filter((c) => c.params.chat_id === GROUP.id).length, 0);

// 🔎 Find music: search by name, open the card, add it to the synced playlist.
reset();
await priv({ text: 'never gonna' });
const result = buttons(last('sendMessage').reply_markup)[0];
assert.match(result.text, /Rick Astley/);
reset();
await cb(result.callback_data);
const card = buttons(last('editMessageText').reply_markup);
const add = card.find((b) => b.callback_data?.endsWith(':add'));
assert.ok(add && card.some((b) => b.callback_data?.endsWith(':q')) && card.some((b) => b.callback_data?.endsWith(':aud')));
await cb(add.callback_data);
const to = buttons(last('editMessageText').reply_markup).find((b) => b.callback_data?.includes(':to:'));
reset();
await cb(to.callback_data);
assert.ok(playlist.some((x) => x.id === T('r')), 'found song added to the playlist');
assert.ok(calls('sendMessage').some((c) => c.params.chat_id === GROUP.id && /Never Gonna/.test(c.params.text)), 'and posted in the both-ways chat');

// Inline mode returns songs as links.
reset();
await inline({ id: 'iq', from: USER, query: 'never gonna' });
assert.match(last('answerInlineQuery').results[0].input_message_content.message_text, /song\.link\/i\/111/);

// The group player: /player posts the card; a posted link is queued on the host's Spotify.
reset();
await message({ message_id: 60, from: USER, chat: GROUP, date: 0, text: '/player' });
assert.match(last('sendMessage').text, /Group player/);
reset();
await post('https://song.link/i/111', 61);
assert.deepEqual(queued, [`spotify:track:${T('r')}`]);
assert.ok(calls('setMessageReaction').some((c) => c.params.reaction[0].emoji === '⚡'));

// /playlist, /top and /random in the group answer there and delete the command.
const groupCmd = (text, id) => message({ message_id: id, from: USER, chat: GROUP, date: 0, text });
reset();
await groupCmd('/playlist', 70);
assert.ok(calls('deleteMessage').some((c) => c.params.message_id === 70));
assert.match(last('sendMessage').text, /Club Hits/);
assert.equal(buttons(last('sendMessage').reply_markup)[0].url, `https://open.spotify.com/playlist/${PL}`);
reset();
await groupCmd('/top@chthmusicbot', 71);
assert.match(last('sendMessage').text, /🥇 Omid · 🎵 1/);
reset();
await groupCmd('/random', 72);
assert.match(last('sendMessage').text, /random pick from <b>Club Hits/);
reset();
await groupCmd('/random', 73);
assert.equal(calls('sendMessage').length, 0, '/random is throttled');

// The same commands work in a channel, answering in the sync owner's language.
const { default: channelPost } = await import('../tgcloud/handlers/channel_post.js');
const CHANNEL = { id: -100700, type: 'channel', title: 'Radio' };
state.tables.get('links').rows.push({ ...link, id: 99, chatId: CHANNEL.id });
reset();
await channelPost({ message_id: 80, chat: CHANNEL, date: 0, text: '/playlist' });
assert.equal(last('sendMessage').chat_id, CHANNEL.id);
assert.match(last('sendMessage').text, /Playlists synced/);
state.tables.get('links').rows.pop();

// 🔗 My syncs lists the sync; removing it clears its tracks.
reset();
await priv({ text: '🔗 My syncs' });
assert.ok(buttons(last('sendMessage').reply_markup).some((b) => b.callback_data === `ln:${link.id}`));
await cb(`ln:${link.id}:del!`);
assert.equal(state.tables.get('links').rows.length, 0);
assert.equal(state.tables.get('link_tracks').rows.length, 0);

// Logins: Spotify through the Mini App endpoints and the /connect fallback,
// YouTube Music with Google's device code.
const { default: spotifyStart } = await import('../tgcloud/endpoints/spotifyStart.js');
const { default: spotifyFinish } = await import('../tgcloud/endpoints/spotifyFinish.js');
const { getAccount } = await import('../tgcloud/lib/accounts.js');
const NEW = { id: 77, is_bot: false, first_name: 'Sara', language_code: 'fa' };
const ctx = { initData: { user: NEW } };
state.routes.unshift(
  [/accounts\.spotify\.com\/api\/token/, (url, init) => (init.body.includes('code=good')
    ? { access_token: 'new-tok', refresh_token: 'new-ref', expires_in: 3600 }
    : { __status: 400, __body: { error: 'invalid_grant', error_description: 'Invalid authorization code' } })],
  [/oauth2\.googleapis\.com\/device\/code/, () => ({ device_code: 'dev', user_code: 'ABCD-EFGH', verification_url: 'https://www.google.com/device' })],
  [/oauth2\.googleapis\.com\/token/, () => (state.googleAllowed
    ? { access_token: 'yt', refresh_token: 'yt-ref', expires_in: 3600 }
    : { __status: 428, __body: { error: 'authorization_pending' } })],
  [/youtube\/v3\/channels/, () => ({ items: [{ snippet: { title: 'Sara Music' } }] })],
);
const pkce = { clientId: 'a'.repeat(32), verifier: 'v'.repeat(64), challenge: 'c'.repeat(43), redirectUri: 'https://app1.tgcloud.ai/callback' };
await assert.rejects(spotifyStart({ ...pkce, clientId: 'nope' }, ctx), /client id/);
const { url } = await spotifyStart(pkce, ctx);
const loginState = new URL(url).searchParams.get('state');
assert.match(url, /code_challenge=c{43}/);
await assert.rejects(spotifyFinish({ state: loginState, code: 'bad' }, ctx), /Invalid authorization code/);
reset();
await message({ message_id: 3, from: NEW, chat: { id: NEW.id, type: 'private' }, date: 0, text: `/connect ${loginState} good` });
const sp = await getAccount(NEW.id, 'spotify');
assert.equal(sp.refreshToken, 'new-ref');
assert.equal(sp.clientId, 'a'.repeat(32), 'own app remembered for refreshes');
assert.ok(calls('deleteMessage').some((c) => c.params.message_id === 3), 'the /connect message is deleted');

const newCb = (data) => callback({ id: 'q', from: NEW, data, message: { message_id: 8, chat: { id: NEW.id, type: 'private' } } });
reset();
await newCb('ac:yt');
assert.match(last('editMessageText').text, /ABCD-EFGH/);
const ok = buttons(last('editMessageText').reply_markup).find((b) => b.callback_data?.startsWith('ac:ytok:'));
reset();
await newCb(ok.callback_data);
assert.equal(last('answerCallbackQuery').show_alert, true, 'still pending');
state.googleAllowed = true;
await newCb(ok.callback_data);
assert.equal((await getAccount(NEW.id, 'youtube')).name, 'Sara Music');

console.log('ok: flows (wizard, chat → playlist, reposts, sync now, find, inline, player, group and channel commands, logins)');
