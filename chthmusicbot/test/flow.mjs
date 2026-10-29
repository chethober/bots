// End-to-end flows against the in-memory SDK (sdk-fake.mjs) and a fake
// Spotify / iTunes / YouTube: the ➕ New sync wizard, chat → playlist on a
// post, repost detection, 🔄 Sync now, 🔎 Find music, the group player and
// /playlist, /top, /random in groups and channels.
import assert from 'node:assert/strict';
import { state } from './sdk-fake.mjs';
import message from '../tgcloud/handlers/message.js';
import callback from '../tgcloud/handlers/callback_query.js';
import inline from '../tgcloud/handlers/inline_query.js';
import { saveAccount } from '../tgcloud/lib/accounts.js';

const USER = { id: 42, is_bot: false, first_name: 'Omid', language_code: 'en' };
const NEW_FAN = { id: 43, is_bot: false, first_name: 'Nima', language_code: 'en' };
const GROUP = { id: -100500, type: 'supergroup', title: 'Music Club' };
const PL = 'P'.repeat(22);
const T = (n) => `${n}`.repeat(22).slice(0, 22);
const track = (id, name) => ({ type: 'track', id, name, artists: [{ name: 'Artist' }], uri: `spotify:track:${id}` });
const playlist = [track(T('a'), 'Old One'), track(T('b'), 'Old Two')];
const queued = [];
const liked = [];

const routes = [
  [/api\.spotify\.com\/v1\/me\/library\?uris=/, (url) => { liked.push(decodeURIComponent(url.split('uris=')[1])); return null; }],
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
  [/itunes\.apple\.com\/lookup\?id=111/, () => ({ results: [{ trackId: 111, trackName: 'Never Gonna Give You Up', artistName: 'Rick Astley' }] })],
  [/api\.spotify\.com\/v1\/search\?type=track&limit=1&q=track%3ANever%20Gonna/, () => ({ tracks: { items: [track(T('r'), 'Never Gonna Give You Up')] } })],
  [/api\.spotify\.com\/v1\/search/, () => ({ tracks: { items: [] } })],
  [/youtube\.com\/oembed/, (url) => (url.includes('NOTMUSIC000')
    ? { title: 'My cat compilation', author_name: 'Cats Daily' }
    : { title: 'Never Gonna Give You Up', author_name: 'Rick Astley - Topic' })],
  [/itunes\.apple\.com\/search/, () => ({ results: [{ trackId: 111, trackName: 'Never Gonna Give You Up', artistName: 'Rick Astley', collectionName: 'Whenever' }] })],
];
// Playlists the bot creates (per-topic syncs).
const created = new Map();
state.routes.push(
  [/api\.spotify\.com\/v1\/me\/playlists$/, (url, init) => {
    const { name } = JSON.parse(init.body);
    const id = `N${created.size}`.padEnd(22, 'n');
    created.set(id, { name, tracks: [] });
    return { id, name };
  }],
  [/api\.spotify\.com\/v1\/playlists\/N\w+\/items/, (url, init) => {
    const pl = created.get(/playlists\/(N\w+)\//.exec(url)[1]);
    if (init.method === 'POST') pl.tracks.push(...JSON.parse(init.body).uris.map((u) => u.split(':')[2]));
    return init.method === 'POST' ? { snapshot_id: 'x' } : { items: [], next: null };
  }],
);
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

// A YouTube music link is found on Spotify by name; a non-music video isn't.
reset();
await post('https://youtu.be/NOTMUSIC000', 53);
assert.equal(calls('setMessageReaction').length, 0, 'a cat video is not a song');
await post('https://music.youtube.com/watch?v=lYBUbBu4W08', 54);
assert.ok(playlist.some((x) => x.id === T('r')), 'found on Spotify by title and artist');
playlist.splice(playlist.findIndex((x) => x.id === T('r')), 1);
state.tables.get('link_tracks').rows = state.tables.get('link_tracks').rows.filter((r) => r.trackId !== T('r'));

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
const to = buttons(last('editMessageText').reply_markup).find((b) => b.callback_data === `fd:${result.callback_data.split(':')[1]}:pl:spotify:${PL}`);
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
assert.match(calls('sendMessage').find((c) => c.params.chat_id === GROUP.id).params.text, /random pick from <b>Club Hits/);
assert.ok(calls('sendMessage').some((c) => c.params.chat_id === '@chethoberbot'), 'and its audio is asked for');
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

// A synced post carries ❤️ ➕ 🎵 and its audio is asked from @chethoberbot.
const relayed = () => calls('sendMessage').filter((c) => c.params.chat_id === '@chethoberbot');
playlist.push(track(T('e'), 'With Audio'));
reset();
await cb(`ln:${link.id}:sync`);
const syncPost = calls('sendMessage').find((c) => c.params.chat_id === GROUP.id);
const songBtns = buttons(syncPost.params.reply_markup);
assert.deepEqual(songBtns.slice(0, 3).map((b) => b.callback_data.split(':')[2]), ['like', 'add', 'aud']);
assert.equal(relayed().at(-1).params.text, 'Artist - With Audio');
const songId = songBtns[0].callback_data.split(':')[1];

// ❤️ in the group likes it on the tapper's own Spotify; ➕ sends them to the private chat.
reset();
await cb(`sg:${songId}:like`, GROUP.id);
assert.deepEqual(liked, [`spotify:track:${T('e')}`]);
assert.match(last('answerCallbackQuery').text, /Liked on Spotify/);
await callback({ id: 'q', from: NEW_FAN, data: `sg:${songId}:like`, message: { message_id: 7, chat: GROUP } });
assert.match(last('answerCallbackQuery').url, /start=accounts/, 'no accounts: open the bot');
await cb(`sg:${songId}:add`, GROUP.id);
assert.match(last('answerCallbackQuery').url, new RegExp(`start=sg${songId}$`));
reset();
await priv({ text: `/start sg${songId}` });
assert.match(last('sendMessage').text, /With Audio/);

// /song posts the song in the group; @chethoberbot's file arrives as a reply with ❤️ ➕.
reset();
await message({ message_id: 90, from: USER, chat: GROUP, date: 0, text: '/song never gonna' });
const songPost = calls('sendMessage').find((c) => c.params.chat_id === GROUP.id);
assert.match(songPost.params.text, /Never Gonna Give You Up/);
assert.equal(relayed().at(-1).params.text, 'Rick Astley - Never Gonna Give You Up');
const request = state.tables.get('relays').rows.at(-1);
const RELAY_BOT = { id: 555, is_bot: true, first_name: 'Joozi', username: 'chethoberbot' };
reset();
await message({ message_id: 901, from: RELAY_BOT, chat: { id: 555, type: 'private' }, date: 0, text: 'Searching…', reply_to_message: { message_id: request.sentMessageId } });
assert.equal(calls('copyMessage').length, 0, 'groups only get the file');
await message({ message_id: 902, from: RELAY_BOT, chat: { id: 555, type: 'private' }, date: 0, audio: { title: 'Never Gonna Give You Up' }, reply_to_message: { message_id: request.sentMessageId } });
const copied = last('copyMessage');
assert.equal(copied.chat_id, GROUP.id);
assert.equal(copied.reply_parameters.message_id, request.replyTo);
assert.deepEqual(buttons(copied.reply_markup).map((b) => b.callback_data.split(':')[2]), ['like', 'add']);

// Without a reply_to, a file goes to the open request with its title.
reset();
await message({ message_id: 903, from: RELAY_BOT, chat: { id: 555, type: 'private' }, date: 0, audio: { title: 'With Audio' } });
assert.equal(last('copyMessage').chat_id, GROUP.id);
assert.equal(last('copyMessage').reply_parameters.message_id, state.tables.get('relays').rows.find((r) => /With Audio/.test(r.query) && r.chatId).replyTo);

// ⏮ Add old songs: forwarded posts are added as they come, known ones skipped.
const bfRows = () => state.tables.get('backfill_items').rows;
reset();
await cb(`ln:${link.id}:bf`);
assert.match(last('editMessageText').text, /Adding old songs to Club Hits/);
const fwd = (url, id) => priv({ message_id: id, forward_origin: { type: 'user', sender_user: { id: 50, first_name: 'Ali' }, date: 0 }, text: url, entities: [{ type: 'url', offset: 0, length: url.length }] });
await fwd(`https://open.spotify.com/track/${T('f')}`, 100);
await fwd(`https://open.spotify.com/track/${T('c')}`, 101);
assert.ok(playlist.some((x) => x.id === T('f')));
assert.deepEqual(bfRows().map((r) => r.status), ['added', 'known']);
assert.ok(calls('deleteMessage').some((c) => c.params.message_id === 100), 'forwards are cleaned up');
assert.ok(state.tables.get('link_tracks').rows.some((r) => r.trackId === T('f') && r.posterName === 'Ali'), 'and count for /top');

// A chat export: its music posts are queued and added; an export of another chat is refused.
state.files.F1 = JSON.stringify({ id: 100500, name: 'Music Club', messages: [
  { id: 5, type: 'message', from: 'Sara', from_id: 'user77', text_entities: [{ type: 'plain', text: 'old: ' }, { type: 'link', text: `https://open.spotify.com/track/${T('g')}` }] },
  { id: 6, type: 'message', from: 'Sara', from_id: 'user77', text_entities: [{ type: 'plain', text: 'no music' }] },
  { id: 7, type: 'service', action: 'pin_message' },
] });
state.files.F2 = JSON.stringify({ id: 999, name: 'Elsewhere', messages: [] });
reset();
await priv({ message_id: 102, document: { file_id: 'F2', file_name: 'result.json' } });
assert.match(last('editMessageText').text, /from another chat \(Elsewhere\)/);
await priv({ message_id: 103, document: { file_id: 'F1', file_name: 'result.json' } });
assert.ok(playlist.some((x) => x.id === T('g')));
assert.match(last('editMessageText').text, /Added: 2[\s\S]*Posts with music in the export: 1/);
await cb('bf:done');
assert.equal(bfRows().length, 0);
reset();
await fwd(`https://open.spotify.com/track/${T('h')}`, 104);
assert.ok(!playlist.some((x) => x.id === T('h')), 'after ✅ Done, forwards go to 🔎 Find music again');

// A big export goes through in one go (as many posts as fit in the time budget, not 25).
state.files.F4 = JSON.stringify({ id: 100500, name: 'Music Club', messages: Array.from({ length: 60 }, (_, n) => (
  { id: 1000 + n, type: 'message', from: 'Ali', from_id: 'user50', text_entities: [{ type: 'link', text: `https://open.spotify.com/track/${`X${n}`.padEnd(22, 'x')}` }] })) });
await cb(`ln:${link.id}:bf`);
reset();
await priv({ message_id: 105, document: { file_id: 'F4', file_name: 'result.json' } });
assert.match(last('editMessageText').text, /Added: 60[\s\S]*Waiting: 0/);
await cb('bf:done');

// An "every topic" sync takes a forum export: each topic's songs go to its own playlist.
const { createLink } = await import('../tgcloud/lib/sync.js');
const FORUM = { id: -100900, type: 'supergroup', title: 'Music Forum', is_forum: true };
const forumLink = await createLink({ ownerId: USER.id, chatId: FORUM.id, threadId: -1, provider: 'spotify', direction: 'in' });
const spLink = (c) => [{ type: 'link', text: `https://open.spotify.com/track/${T(c)}` }];
state.files.F3 = JSON.stringify({ id: 100900, name: 'Music Forum', messages: [
  { id: 10, type: 'service', action: 'topic_created', title: 'Rock' },
  { id: 11, type: 'message', from: 'Ali', from_id: 'user50', reply_to_message_id: 10, text_entities: spLink('i') },
  { id: 12, type: 'message', from: 'Sara', from_id: 'user77', reply_to_message_id: 11, text_entities: spLink('j') },
  { id: 13, type: 'service', action: 'topic_created', title: 'Jazz' },
  { id: 14, type: 'message', from: 'Ali', from_id: 'user50', reply_to_message_id: 13, text_entities: spLink('k') },
  { id: 15, type: 'message', from: 'Ali', from_id: 'user50', text_entities: spLink('l') },
  { id: 16, type: 'service', action: 'topic_edit', new_title: 'Classic Rock', reply_to_message_id: 10 },
] });
reset();
await cb(`ln:${forumLink.id}:bf`);
assert.match(last('editMessageText').text, /send me its export/);
await fwd(`https://open.spotify.com/track/${T('m')}`, 110);
assert.match(last('editMessageText').text, /don't say which topic/, 'forwards are refused for every topic');
await priv({ message_id: 111, document: { file_id: 'F3', file_name: 'result.json' } });
const byName = Object.fromEntries([...created.values()].map((p) => [p.name, p.tracks]));
assert.deepEqual(byName['Classic Rock'], [T('i'), T('j')], 'a reply inside a topic stays in it; the renamed topic keeps its new name');
assert.deepEqual(byName.Jazz, [T('k')]);
assert.ok(![...created.values()].some((p) => p.tracks.includes(T('l'))), 'General is skipped');
assert.match(last('editMessageText').text, /3, in 2 topics/);
const children = state.tables.get('links').rows.filter((l) => l.parentId === forumLink.id);
assert.deepEqual(children.map((l) => l.threadId).sort(), [10, 13]);
await cb('bf:done');
await cb(`ln:${forumLink.id}:del!`);

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

console.log('ok: flows (wizard, chat → playlist, reposts, sync now, find, inline, player, group and channel commands, song buttons, audio relay, backfill, every-topic backfill, logins)');
