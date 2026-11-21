// The chat Mini App (endpoints/chatApp) against the in-memory SDK: /app, who
// may do what, the shared queue played into the chat and onto the group
// player's Spotify, the sleep timer firing on the next update, ✨ picks from
// Deezer, and linking a playlist.
import assert from 'node:assert/strict';
import { state } from './sdk-fake.mjs';
import message from '../tgcloud/handlers/message.js';
import chatApp from '../tgcloud/endpoints/chatApp.js';
import { saveAccount } from '../tgcloud/lib/accounts.js';
import { upsertChat } from '../tgcloud/lib/chats.js';
import { createLink } from '../tgcloud/lib/sync.js';
import { appLink, appParam, parseAppParam } from '../tgcloud/lib/applink.js';
import { mainArtist, songKey, topArtists } from '../tgcloud/lib/recs.js';

const HOST = { id: 42, is_bot: false, first_name: 'Omid', language_code: 'en' };
const FAN = { id: 43, is_bot: false, first_name: 'Nima', language_code: 'en' };
const STRANGER = { id: 44, is_bot: false, first_name: 'Eve', language_code: 'en' };
const GROUP = { id: -100500, type: 'supergroup', title: 'Music Club' };
const PL = 'P'.repeat(22);
const T = (n) => `${n}`.repeat(22).slice(0, 22);
const track = (id, name, artist = 'Radiohead') => ({ type: 'track', id, name, artists: [{ name: artist }] });
const playlist = [track(T('a'), 'Creep'), track(T('b'), 'Karma Police'), track(T('c'), 'Yellow', 'Coldplay')];
const spotifyQueue = [];
let paused = 0;

const dzTrack = (id, title, artist) => ({ id, title, title_short: title, link: `https://www.deezer.com/track/${id}`, preview: `https://cdn.example/p${id}.mp3`, artist: { name: artist }, album: { cover_medium: `https://cdn.example/c${id}.jpg` } });
state.routes.push(
  [/api\.spotify\.com\/v1\/me\/player\/queue\?uri=/, (url) => { spotifyQueue.push(decodeURIComponent(url.split('uri=')[1])); return null; }],
  [/api\.spotify\.com\/v1\/me\/player\/queue$/, () => ({ queue: [] })],
  [/api\.spotify\.com\/v1\/me\/player\/pause/, () => { paused++; return null; }],
  [/api\.spotify\.com\/v1\/me\/player/, () => ({ is_playing: true, item: track(T('a'), 'Creep'), device: { name: 'Phone' } })],
  [/api\.spotify\.com\/v1\/me\/playlists$/, (url, init) => (init.method === 'POST' ? { id: 'N'.repeat(22), name: JSON.parse(init.body).name } : { items: [{ id: PL, name: 'Club Hits', owner: { id: 'u1' }, items: { total: 3 } }], next: null })],
  [/api\.spotify\.com\/v1\/me\/playlists\?/, () => ({ items: [{ id: PL, name: 'Club Hits', owner: { id: 'u1' }, items: { total: 3 } }], next: null })],
  [/api\.spotify\.com\/v1\/playlists\/P+\?fields/, () => ({ id: PL, name: 'Club Hits', owner: { id: 'u1' } })],
  [/api\.spotify\.com\/v1\/playlists\/P+\/items/, () => ({ items: playlist.map((item) => ({ item })), next: null })],
  [/api\.spotify\.com\/v1\/playlists\/N+\/items/, () => ({ items: [], next: null })],
  [/api\.spotify\.com\/v1\/search/, (url) => ({ tracks: { items: [track(url.includes('Nude') ? T('n') : T('z'), 'Hit')] } })],
  [/itunes\.apple\.com\/search/, () => ({ results: [{ trackId: 7, trackName: 'Nude', artistName: 'Radiohead', artworkUrl100: 'https://is1.example/a.jpg', previewUrl: 'https://audio.example/nude.m4a' }] })],
  [/api\.deezer\.com\/search\/artist\?limit=1&q=Radiohead/, () => ({ data: [{ id: 399, name: 'Radiohead' }] })],
  [/api\.deezer\.com\/search\/artist\?limit=1&q=Coldplay/, () => ({ data: [{ id: 892, name: 'Coldplay' }] })],
  [/api\.deezer\.com\/artist\/399\/related/, () => ({ data: [{ id: 1, name: 'Muse' }, { id: 892, name: 'Coldplay' }, { id: 2, name: 'Portishead' }] })],
  [/api\.deezer\.com\/artist\/892\/related/, () => ({ data: [{ id: 1, name: 'Muse' }, { id: 3, name: 'Keane' }] })],
  [/api\.deezer\.com\/artist\/1\/top/, () => ({ data: [dzTrack(11, 'Uprising', 'Muse'), dzTrack(12, 'Starlight', 'Muse'), dzTrack(13, 'Hysteria', 'Muse')] })],
  [/api\.deezer\.com\/artist\/2\/top/, () => ({ data: [dzTrack(21, 'Glory Box', 'Portishead')] })],
  [/api\.deezer\.com\/artist\/3\/top/, () => ({ data: [dzTrack(31, 'Somewhere Only We Know', 'Keane')] })],
  [/api\.deezer\.com\/artist\/399\/top/, () => ({ data: [dzTrack(41, 'Creep', 'Radiohead'), dzTrack(42, 'No Surprises', 'Radiohead')] })],
  [/api\.deezer\.com\/artist\/892\/top/, () => ({ data: [dzTrack(51, 'Yellow', 'Coldplay'), dzTrack(52, 'Clocks', 'Coldplay')] })],
  [/api\.deezer\.com\/chart/, () => ({ data: [dzTrack(91, 'Chart Song', 'Someone')] })],
);

const calls = (method) => state.calls.filter((c) => c.method === method);
const reset = () => { state.calls.length = 0; };
const chat = appParam(GROUP.id);
const as = (user, op, input = {}) => chatApp({ op, chat, ...input }, { initData: { user } });
const code = (re) => (e) => { assert.equal(e.parameters?.code, re); return true; };

await saveAccount(HOST.id, 'spotify', { accessToken: 'tok', refreshToken: 'ref', expiresAt: Date.now() + 3600e3, name: 'Omid', extra: { id: 'u1' } });
await upsertChat(GROUP);
await createLink({ ownerId: HOST.id, chatId: GROUP.id, threadId: 0, provider: 'spotify', playlistId: PL, playlistName: 'Club Hits', direction: 'both' });
state.members = { [FAN.id]: { status: 'member' }, [STRANGER.id]: { status: 'left' } };

// The start param round-trips, and /app posts the button that opens it.
assert.deepEqual(parseAppParam('c100500t12'), { chatId: -100500, threadId: 12 });
assert.equal(parseAppParam('c-1; drop'), null);
assert.equal(appLink(-100500, 7), 'https://t.me/chthmusicbot?startapp=c100500t7');
reset();
await message({ message_id: 5, from: FAN, chat: GROUP, date: 0, text: '/app' });
const appPost = calls('sendMessage').at(-1).params;
assert.equal(appPost.reply_markup.inline_keyboard[0][0].url, 'https://t.me/chthmusicbot?startapp=c100500');
assert.ok(calls('deleteMessage').some((c) => c.params.message_id === 5), 'the /app command is cleaned up');

// Members only; members see the chat's playlists.
await assert.rejects(as(STRANGER, 'state'), code('NOT_MEMBER'));
await assert.rejects(chatApp({ op: 'state', chat: 'c999' }, { initData: { user: FAN } }), code('NO_CHAT'));
let s = await as(FAN, 'state');
assert.equal(s.chat.title, 'Music Club');
assert.equal(s.playlists[0].name, 'Club Hits');
assert.equal(s.me.control, false);
assert.equal(s.player, null);
assert.equal((await as(FAN, 'tracks', { linkId: s.playlists[0].id })).tracks[0].title, 'Yellow', 'newest first');

// Search gives previews; anyone queues, nobody twice; only controllers play.
const [nude] = (await as(FAN, 'search', { q: 'nude' })).results;
assert.equal(nude.preview, 'https://audio.example/nude.m4a');
s = await as(FAN, 'queueAdd', { song: nude });
assert.equal(s.queue.length, 1);
assert.equal(s.queue[0].by, 'Nima');
await assert.rejects(as(FAN, 'queueAdd', { song: nude }), code('DUPLICATE'));
await assert.rejects(as(FAN, 'queueAdd', { song: { title: '', url: 'javascript:alert(1)' } }), code('BAD_INPUT'));
await assert.rejects(as(FAN, 'play'), code('CONTROL_ONLY'));
s = await as(FAN, 'queueAdd', { song: { title: 'Bad link', artist: 'X', url: 'javascript:alert(1)' } });
assert.equal(s.queue[1].url, null, 'only https links are kept');
assert.equal((await as(HOST, 'queueMove', { id: 999, dir: 1 })).queue.length, 2, 'an unknown song is ignored');
s = await as(HOST, 'queueMove', { id: s.queue[1].id, dir: 'top' });
assert.equal(s.queue[0].title, 'Bad link', 'moved to the top');
s = await as(FAN, 'queueRemove', { id: s.queue[0].id });
assert.equal(s.queue.length, 1, 'members remove their own songs');

// Without a group player, ▶️ posts the song in the chat and asks for its audio.
reset();
s = await as(HOST, 'play');
assert.equal(s.result.to, 'chat');
assert.equal(s.queue.length, 0);
const posted = calls('sendMessage').find((c) => c.params.chat_id === GROUP.id).params;
assert.match(posted.text, /Nude.*Radiohead/s);
assert.match(posted.text, /queued by Nima/);
assert.ok(posted.reply_markup.inline_keyboard[0].some((b) => b.callback_data?.endsWith(':like')));
assert.ok(calls('sendMessage').some((c) => c.params.chat_id === '@chethoberbot' || c.params.text === 'Radiohead - Nude'), 'the audio is asked for');
await assert.rejects(as(HOST, 'play'), code('EMPTY'));

// With a group player, ▶️ queues on the host's Spotify; the card links the Mini App.
reset();
await message({ message_id: 6, from: HOST, chat: GROUP, date: 0, text: '/player' });
const card = calls('sendMessage').at(-1).params;
assert.ok(card.reply_markup.inline_keyboard.flat().some((b) => b.url === 'https://t.me/chthmusicbot?startapp=c100500'));
await as(FAN, 'queueAdd', { song: nude });
await as(FAN, 'queueAdd', { song: { title: 'Airbag', artist: 'Radiohead' } });
s = await as(FAN, 'state');
assert.equal(s.player.host, 'Omid');
assert.equal(s.player.track.title, 'Creep');
s = await as(HOST, 'play', { all: true });
assert.deepEqual(s.result, { played: 2, missed: 0, to: 'spotify' });
assert.equal(spotifyQueue.length, 2);
await assert.rejects(as(FAN, 'control', { action: 'next' }), code('CONTROL_ONLY'));

// 😴 Sleep: the host sets it, the chat is told; once due, the next update pauses Spotify.
await assert.rejects(as(FAN, 'sleep', { minutes: 15 }), code('CONTROL_ONLY'));
await assert.rejects(as(HOST, 'sleep', { minutes: 7 }), code('BAD_INPUT'));
reset();
s = await as(HOST, 'sleep', { minutes: 15 });
assert.ok(s.sleep.at > s.now + 14 * 60);
assert.match(calls('sendMessage').at(-1).params.text, /Omid set a sleep timer: the music stops in 15 min/);
state.tables.get('sleep_timers').rows[0].at = 1; // time's up
reset();
await message({ message_id: 9, from: FAN, chat: GROUP, date: 0, text: 'hello' });
assert.equal(paused, 1, 'the host\'s Spotify is paused');
assert.match(calls('sendMessage').find((c) => c.params.chat_id === GROUP.id).params.text, /Good night/);
assert.equal(state.tables.get('sleep_timers').rows.length, 0);
await message({ message_id: 10, from: FAN, chat: GROUP, date: 0, text: 'hello again' });
assert.equal(paused, 1, 'a timer fires once');

// ✨ Picks: related artists of the chat's artists, nothing it already has, two per artist.
assert.equal(mainArtist('Muse, Keane & Coldplay feat. X'), 'Muse');
assert.equal(songKey('Creep (Remastered)', 'Radiohead - Topic'), songKey('Creep', 'Radiohead'));
assert.deepEqual(topArtists([{ artist: 'A' }, { artist: 'B' }, { artist: 'B' }]).map((a) => a.name), ['B', 'A']);
const picks = await as(FAN, 'picks');
const titles = picks.items.map((x) => x.title);
assert.ok(titles.includes('Uprising') && titles.includes('Glory Box'), titles.join());
assert.ok(!titles.includes('Creep') && !titles.includes('Yellow'), 'songs the chat has are left out');
assert.ok(titles.includes('No Surprises') || titles.includes('Clocks'), 'deeper cuts from the chat\'s own artists');
assert.ok(picks.items.filter((x) => x.artist === 'Muse').length <= 2, 'two per artist at most');
assert.equal(picks.items.find((x) => x.title === 'Uprising').because, 'Radiohead');
const deezerCalls = calls('fetch').filter((c) => c.url.includes('deezer')).length;
await as(FAN, 'picks');
assert.equal(calls('fetch').filter((c) => c.url.includes('deezer')).length, deezerCalls, 'cached');
s = await as(FAN, 'queueAdd', { song: picks.items[0] });
assert.equal(s.queue[0].preview, picks.items[0].preview);

// Linking a playlist: admins only, never twice.
await assert.rejects(as(FAN, 'myPlaylists'), code('ADMINS_ONLY'));
const mine = await as(HOST, 'myPlaylists');
assert.equal(mine.accounts[0].playlists[0].id, PL);
await assert.rejects(as(HOST, 'addPlaylist', { provider: 'spotify', playlistId: PL, direction: 'both' }), code('DUPLICATE'));
s = await as(HOST, 'addPlaylist', { provider: 'spotify', create: true, direction: 'in' });
assert.equal(s.playlists.length, 2);
assert.equal(s.playlists[1].name, 'Music Club');

// ⚙︎ Reactions: admins pick the emoji per chat, a topic can differ, a sync can opt out.
const post = (id, url, thread = 0) => message({ message_id: id, from: FAN, chat: GROUP, date: 0, text: url, entities: [{ type: 'url', offset: 0, length: url.length }], ...(thread ? { is_topic_message: true, message_thread_id: thread } : {}) });
const reactionOn = (id) => calls('setMessageReaction').filter((c) => c.params.message_id === id).map((c) => c.params.reaction[0].emoji);
await assert.rejects(as(FAN, 'reactions'), code('ADMINS_ONLY'));
let r = await as(HOST, 'reactions');
assert.deepEqual(r.effective, { added: '👌', queued: '⚡', repost: '' });
assert.ok(r.suggested.includes('🔥') && r.syncs.length >= 1);
reset();
await post(201, `https://open.spotify.com/track/${T('q')}`);
assert.deepEqual(reactionOn(201).slice(0, 1), ['👌'], 'the default 👌 on an added track');
r = await as(HOST, 'setReaction', { scope: 'chat', kind: 'added', emoji: '🔥' });
assert.equal(r.effective.added, '🔥');
await assert.rejects(as(HOST, 'setReaction', { scope: 'chat', kind: 'added', emoji: '🎸' }), code('BAD_INPUT'), 'only reactions bots may use');
await assert.rejects(as(HOST, 'setReaction', { scope: 'chat', kind: 'added', emoji: null }), code('BAD_INPUT'), 'a chat has nothing to inherit from');
await as(HOST, 'setReaction', { scope: 'chat', kind: 'repost', emoji: '🗿' });
await as(HOST, 'setReaction', { scope: 'chat', kind: 'queued', emoji: '' });
reset();
await post(202, `https://open.spotify.com/track/${T('s')}`);
assert.deepEqual(reactionOn(202), ['🔥'], 'the chat\'s emoji; queueing on the player reacts with nothing now');
await post(203, `https://open.spotify.com/track/${T('s')}`);
assert.deepEqual(reactionOn(203), ['🗿'], 'a repost gets the repost reaction');
// A topic overrides the chat; null goes back to the chat's.
const topicChat = appParam(GROUP.id, 5);
const inTopic = (op, input = {}) => chatApp({ op, chat: topicChat, ...input }, { initData: { user: HOST } });
await assert.rejects(as(HOST, 'setReaction', { scope: 'topic', kind: 'added', emoji: '' }), code('BAD_INPUT'), 'no topic outside one');
r = await inTopic('setReaction', { scope: 'topic', kind: 'added', emoji: '' });
assert.equal(r.effective.added, '');
assert.equal(r.chat.added, '🔥');
reset();
await post(204, `https://open.spotify.com/track/${T('t')}`, 5);
assert.deepEqual(reactionOn(204), [], 'off in topic 5');
await post(205, `https://open.spotify.com/track/${T('u')}`);
assert.deepEqual(reactionOn(205), ['🔥'], 'the rest of the chat keeps its emoji');
r = await inTopic('setReaction', { scope: 'topic', kind: 'added', emoji: null });
assert.equal(r.effective.added, '🔥');
// A chat that allows only some reactions.
state.allowedReactions = ['👍', '🔥'];
r = await as(HOST, 'reactions');
assert.ok(r.restricted && r.suggested.every((e) => ['👍', '🔥'].includes(e)));
await assert.rejects(as(HOST, 'setReaction', { scope: 'chat', kind: 'added', emoji: '🎉' }), code('NOT_ALLOWED'));
state.allowedReactions = undefined;
// A sync's own switch.
for (const sync of r.syncs) r = await as(HOST, 'syncReaction', { linkId: sync.id, on: false });
assert.ok(r.syncs.length === 2 && r.syncs.every((x) => !x.reaction));
reset();
await post(206, `https://open.spotify.com/track/${T('v')}`);
assert.deepEqual(reactionOn(206), [], 'no reactions from syncs with them off');

// From the bot's profile (no chat): the chats the user has syncs in.
const home = await chatApp({ op: 'home' }, { initData: { user: HOST } });
assert.deepEqual(home.chats.map((c) => c.param), ['c100500']);

console.log('ok: chat Mini App (/app, members, queue → chat and → Spotify, sleep timer, picks, linking, reactions)');
