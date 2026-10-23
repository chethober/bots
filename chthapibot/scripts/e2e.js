// End-to-end harness: drives the real handlers ON THE PLATFORM, against the real
// database, with Bot API calls stubbed (nothing is sent to Telegram). It checks every
// outgoing message's HTML and callback data, runs the scheduler, and deletes its own rows
// (it uses the fake chat ids 990000001 and -990000002).
//
// Usage:
//   cp scripts/e2e.js tgcloud/endpoints/zz_e2e.js          (not deployed: .gitignore + delete it)
//   npx tgcloud run endpoints/zz_e2e '{ part: 1 }' > /tmp/e2e1.txt
//   node scripts/show-e2e.cjs /tmp/e2e1.txt                 (pretty-print; add `full` for whole texts)
//   rm tgcloud/endpoints/zz_e2e.js                          (before `tgcloud push`!)
//
// Parts: 1 crypto · 2 settings/notifications/scheduler · 3 saved/legacy buttons/groups
//        4 sports · 5 live match alerts (real NBA games) · 6 food & drinks
//        7–11 random (tools, discover, more discover, fun, trivia/picks) · 12 daily sections · 13 keyboard and clean chat
// Optional `range: [from, to]` runs a slice of a part's steps. Keep parts short: a run has
// ~30 s of wall time, and cold caches make the first run of a part slower.
import { api, db } from 'sdk';
import { eq, sql } from 'sdk/db';
import onMessage from '../handlers/message.js';
import onCallback from '../handlers/callback_query.js';
import { runTick } from '../lib/scheduler.js';
import { leagueGames, leagueFixtures } from '../lib/apis/espn.js';
import { notifications, savedItems, follows, prefs, portfolio, pendingInput, shoppingList, brewLog, triviaScores } from '../schema.js';
import onPollAnswer from '../handlers/poll_answer.js';

const CHAT = 990000001;
const GROUP = -990000002;
let out = [];
let memberStatus = 'administrator';
let lastPoll = null;

const ALLOWED = new Set(['b', 'i', 'a', 'code', 'pre', 'u', 's', 'blockquote', 'tg-spoiler']);
function htmlProblems(t) {
  const stack = [];
  const re = /<\/?([a-z-]+)[^>]*>/g;
  let m;
  while ((m = re.exec(t))) {
    if (!ALLOWED.has(m[1])) return `bad tag <${m[1]}>`;
    if (m[0][1] === '/') { if (stack.pop() !== m[1]) return `unbalanced </${m[1]}>`; } else stack.push(m[1]);
  }
  if (stack.length) return `unclosed <${stack.join(',')}>`;
  const stripped = t.replace(re, '');
  if (/<|>/.test(stripped)) return 'raw < or >';
  if (/&(?!(amp|lt|gt|quot);)/.test(stripped)) return 'raw &';
  if (t.length > 4096) return `too long ${t.length}`;
  return null;
}

function stub() {
  const rec = (method) => async (p) => {
    const rows = p.reply_markup?.inline_keyboard;
    const badShape = rows && (!Array.isArray(rows) || rows.some((r) => !Array.isArray(r) || !r.length || r.some((b) => !b?.text || !(b.callback_data || b.url))));
    const reply = p.reply_markup?.keyboard;
    const badReply = reply && (!Array.isArray(reply) || reply.some((r) => !Array.isArray(r) || !r.length || r.some((b) => !b?.text)));
    const kb = rows?.flat?.().map((b) => b?.callback_data ?? b?.url) ?? reply?.flat?.().map((b) => `K:${b.text}`) ?? [];
    const bad = kb.filter((d) => d && d.length > 64);
    const text = p.text ?? p.caption ?? (p.question ? `[POLL] ${p.question} | ${p.options.map((o) => o.text).join(' / ')} | correct=${p.correct_option_id} | ${p.explanation}` : '') ?? '';
    const prob = text && !p.question ? htmlProblems(text) : null;
    if (badReply) out.push({ method, text: '', kb: [], KEYBOARD: JSON.stringify(reply).slice(0, 200) });
    if (badShape) out.push({ method, text: '', kb: [], KEYBOARD: JSON.stringify(rows).slice(0, 200) });
    if (['sendMessage', 'editMessageText'].includes(method) && !p.text) out.push({ method, text: '', kb: [], EMPTYTEXT: true });
    out.push({ method, text: text.slice(0, 260), kb, img: p.link_preview_options?.url, ...(prob ? { HTML: prob } : {}), ...(bad.length ? { LONGCB: bad } : {}), ...(p.text_answer ? {} : {}), ...(method === 'answerCallbackQuery' && p.text ? { toast: p.text } : {}) });
    if (method === 'sendPoll') { lastPoll = { id: `p${Date.now()}${out.length}`, correct: p.correct_option_id }; return { message_id: 100 + out.length, poll: { id: lastPoll.id } }; }
    return { message_id: 100 + out.length };
  };
  for (const m of ['sendMessage', 'editMessageText', 'editMessageReplyMarkup', 'answerCallbackQuery', 'sendChatAction', 'setMyCommands', 'deleteMessage', 'sendPoll', 'sendDice']) api[m] = rec(m);
  api.getChatMember = async () => ({ status: memberStatus });
  api.getMe = async () => ({ id: 1, username: 'chthapibot' });
}

const msg = (text, chatId = CHAT, type = 'private') => onMessage({ message_id: 1, chat: { id: chatId, type }, from: { id: 4242, first_name: 'Tester', is_bot: false }, text });
const cb = (data, chatId = CHAT, type = 'private') => onCallback({ id: 'q', data, from: { id: 4242, first_name: 'Tester' }, message: { message_id: 50, chat: { id: chatId, type } } });

async function step(label, fn) {
  out = [];
  let error = null;
  try { await fn(); } catch (e) { error = e.message; }
  const calls = out.filter((c) => c.method !== 'answerCallbackQuery' || c.toast);
  return { label, ...(error ? { ERROR: error } : {}), calls };
}

async function cleanup() {
  await db.run(sql`DELETE FROM cache WHERE key LIKE 'menu:%990000%'`);
  for (const t of [notifications, savedItems, follows, prefs, portfolio, pendingInput, shoppingList, brewLog, triviaScores]) {
    await db.delete(t).where(sql`chat_id IN (${CHAT}, ${GROUP})`).run();
  }
}

export default async function (input) {
  stub();
  await cleanup();
  const R = [];
  let idx = 0;
  const range = input?.range;
  const S = (l, f) => {
    const i = idx++;
    if (range && (i < range[0] || i >= range[1])) return Promise.resolve();
    return step(l, f).then((r) => R.push(r));
  };
  const only = input?.part ?? 1;

  if (only === 1) {
    await S('/start', () => msg('/start'));
    await S('/crypto', () => msg('/crypto'));
    await S('markets', () => cb('cr:mk'));
    await S('watchlist empty', () => cb('cr:wl'));
    await S('add defaults', () => cb('cr:wd'));
    await S('trending', () => cb('cr:tr'));
    await S('movers', () => cb('cr:mv'));
    await S('global', () => cb('cr:gl'));
    await S('coin card btc', () => cb('cr:c:bitcoin'));
    await S('unfollow btc', () => cb('cr:f:bitcoin'));
    await S('follow btc', () => cb('cr:f:bitcoin'));
    await S('/crypto pepe', () => msg('/crypto pepe'));
    await S('/crypto nonsense', () => msg('/crypto zzqqxxnotacoin'));
    await S('search ask', () => cb('cr:s'));
    await S('search answer', () => msg('dogecoin'));
    await S('watchlist add via ask', async () => { await cb('cr:wa'); await msg('ton'); });
    await S('watchlist edit', () => cb('cr:we'));
    await S('watchlist remove ton', () => cb('cr:wx:the-open-network'));
    await S('alert above $1 btc', async () => { await cb('cr:ab:bitcoin'); await msg('1'); });
    await S('alert below bad input', async () => { await cb('cr:be:bitcoin'); await msg('abc'); });
    await S('pct alert eth 0.01', async () => { await cb('cr:pm:ethereum'); await msg('0.01'); });
    await S('fng above 0', async () => { await cb('cr:fga'); await msg('0'); });
    await S('/alert crypto sol below 1m', () => msg('/alert crypto sol below 1m'));
    await S('/alert fng below 101 (invalid)', () => msg('/alert fng below 101'));
    await S('portfolio add', async () => { await cb('cr:pa'); await msg('btc 0.5 @ 60000'); });
    await S('portfolio add eth from card', async () => { await cb('cr:pa:ethereum'); await msg('2'); });
    await S('portfolio remove', async () => { await cb('cr:pr'); await msg('btc 0.1'); });
    await S('/portfolio', () => msg('/portfolio'));
    await S('/price btc', () => msg('/price btc'));
    await S('summary set', async () => { await cb('cr:sumset'); await msg('08:00 weekdays'); });
    await S('summary menu', () => cb('cr:sum'));
    await S('alerts hub', () => cb('cr:al'));
    await S('/cancel nothing', () => msg('/cancel'));
  }
  if (only === 2) {
    await S('setup follows', () => cb('cr:wd'));
    await S('/timezone europe/berlin', () => msg('/timezone europe/berlin'));
    await S('/timezone bad', () => msg('/timezone Mars/Base'));
    await S('/remind 1m test', () => msg('/remind 1m stretch now'));
    await S('/remind 18:00', () => msg('/remind 18:00 standup <b>meeting</b> & co'));
    await S('/digest 07:30', () => msg('/digest 07:30'));
    await S('quiet set', async () => { await cb('st:quiet'); await msg('23:00-07:00'); });
    await S('mute crypto', () => cb('st:mute:crypto'));
    await S('unmute crypto', () => cb('st:mute:crypto'));
    await S('/quiet off', () => msg('/quiet off'));
    await S('/settings', () => msg('/settings'));
    await S('alerts for later', async () => { await msg('/alert crypto btc above 1'); await msg('/alert crypto eth move 0.01'); await msg('/alert fng above 0'); });
    await S('summary', async () => { await cb('cr:sumset'); await msg('08:00'); });
    await S('/notifications', () => msg('/notifications'));
    const ns = await db.select().from(notifications).where(eq(notifications.chatId, CHAT)).all();
    await S('pause first', () => cb(`n:t:${ns[0].id}:*:0`));
    await S('resume first', () => cb(`n:t:${ns[0].id}:*:0`));
    await S('crypto notif list', () => cb('n:l:crypto:0'));
    // make schedules and reminders due now
    await db.run(sql`UPDATE notifications SET next_at = unixepoch() - 5 WHERE chat_id = ${CHAT} AND next_at IS NOT NULL AND (kind = 'schedule' OR params LIKE '%stretch%')`);
    await S('tick 1', async () => { R.push({ tick1: await runTick() }); });
    await S('tick 2 (no repeats)', async () => { R.push({ tick2: await runTick() }); });
    const after = await db.select().from(notifications).where(eq(notifications.chatId, CHAT)).all();
    R.push({ state: after.map((n) => `${n.id} ${n.kind} active=${n.active} next=${n.nextAt ? new Date(n.nextAt * 1000).toISOString().slice(5, 16) : '-'} fired=${n.lastFiredAt ? 'y' : 'n'}`) });
    const price = after.find((n) => n.kind === 'price');
    await S('re-arm price', () => cb(`n:re:${price.id}`));
    R.push({ rearmed: (await db.select().from(notifications).where(eq(notifications.id, price.id)).get()).active });
    await S('quiet now holds alerts', async () => {
      await db.run(sql`UPDATE prefs SET quiet_start = '00:00', quiet_end = '23:59' WHERE chat_id = ${CHAT}`);
      R.push({ tickQuiet: await runTick() });
    });
  }
  if (only === 3) {
    await S('go:recipe', () => cb('go:recipe'));
    const recipeId = R[0].calls.find((c) => c.method === 'sendMessage')?.kb.find((d) => d.startsWith('sv:a:'));
    await S(`save ${recipeId}`, () => cb(recipeId));
    await S('save again', () => cb(recipeId));
    await S('go:cocktail', () => cb('go:cocktail'));
    await S('go:book', () => cb('go:book'));
    const bookSave = R.at(-1).calls.find((c) => c.method === 'sendMessage')?.kb.find((d) => d.startsWith('sv:a:'));
    await S(`save ${bookSave}`, () => cb(bookSave));
    await S('saved food list', () => cb('sv:l:food:0'));
    const sv = await db.select().from(savedItems).where(eq(savedItems.chatId, CHAT)).all();
    await S('reopen saved', () => cb(`sv:o:${sv[0].id}`));
    await S('remove saved', () => cb(`sv:x:${sv[0].id}:food:0`));
    await S('/daily', () => msg('/daily'));
    await S('m:sports', () => cb('m:sports'));
    await S('m:food', () => cb('m:food'));
    await S('m:random', () => cb('m:random'));
    await S('go:scores', () => cb('go:scores'));
    await S('go:f1', () => cb('go:f1'));
    await S('/brew aeropress 18g', () => msg('/brew aeropress 18g'));
    await S('/help', () => msg('/help'));
    await S('plain text no pending', () => msg('hello'));
    memberStatus = 'member';
    await S('group: member cannot add defaults', () => cb('cr:wd', GROUP, 'supergroup'));
    await S('group: member browses markets', () => cb('cr:mk', GROUP, 'supergroup'));
    await S('group: /crypto@chthapibot', () => msg('/crypto@chthapibot', GROUP, 'supergroup'));
    await S('group: /crypto@otherbot ignored', () => msg('/crypto@otherbot', GROUP, 'supergroup'));
    memberStatus = 'administrator';
    await S('group: admin quiet', async () => { await cb('st:quiet', GROUP, 'supergroup'); await msg('22:00-06:00', GROUP, 'supergroup'); });
  }

  if (only === 4) {
    await S('/sports', () => msg('/sports'));
    await S('group soccer', () => cb('sp:g:soccer'));
    await S('league epl', () => cb('sp:l:epl'));
    await S('epl scores', () => cb('sp:sc:epl'));
    await S('epl fixtures', () => cb('sp:fx:epl'));
    await S('epl standings', () => cb('sp:st:epl'));
    await S('epl news', () => cb('sp:nw:epl'));
    await S('epl teams', () => cb('sp:tm:epl:0'));
    await S('arsenal card', () => cb('sp:t:epl:359'));
    await S('follow arsenal', () => cb('sp:f:epl:359'));
    await S('arsenal alerts', () => cb('sp:ta:epl:359'));
    await S('cycle lead', () => cb('sp:tl:epl:359'));
    await S('toggle half', () => cb('sp:tt:epl:359:half'));
    await S('find team', async () => { await cb('sp:ft'); await msg('lakers'); });
    await S('/sports real madrid', () => msg('/sports real madrid'));
    await S('nba standings', () => cb('sp:st:nba'));
    await S('nba standings p2', () => cb('sp:st:nba:1'));
    await S('nfl scores', () => cb('sp:sc:nfl'));
    await S('nhl scores', () => cb('sp:sc:nhl'));
    await S('mlb scores', () => cb('sp:sc:mlb'));
    await S('six nations', () => cb('sp:sc:6n'));
    await S('top14 standings', () => cb('sp:st:top14'));
    await S('cricket', () => cb('sp:sc:cricket'));
    await S('atp', () => cb('sp:sc:atp'));
    await S('pga', () => cb('sp:sc:pga'));
    await S('ufc', () => cb('sp:sc:ufc'));
    await S('nascar', () => cb('sp:sc:nascar'));
    await S('f1 menu', () => cb('sp:l:f1'));
    await S('f1 last race', () => cb('sp:sc:f1'));
    await S('f1 weekend', () => cb('sp:f1:n'));
    await S('f1 drivers', () => cb('sp:f1:d'));
    await S('f1 constructors', () => cb('sp:f1:c'));
    await S('f1 calendar', () => cb('sp:f1:k'));
    await S('follow f1', () => cb('sp:fl:f1'));
    await S('f1 alerts', () => cb('sp:la:f1'));
    await S('follow ufc', () => cb('sp:fl:ufc'));
    await S('follow laliga (team league)', () => cb('sp:fl:laliga'));
    await S('/scores laliga', () => msg('/scores laliga'));
    await S('/f1', () => msg('/f1'));
    await S('my teams', () => cb('sp:my'));
    await S('/daily', () => msg('/daily'));
    await S('/notifications', () => msg('/notifications'));
    await S('unfollow arsenal', () => cb('sp:f:epl:359'));
  }
  if (only === 5) {
    // Real NBA games: one finished in the last 6 h (final alert), one starting within 24 h (kickoff).
    const now = Date.now();
    const recent = ((await leagueGames('nba', 1)) ?? []).filter((g) => g.state === 'post' && now - g.date < 6 * 3600e3);
    const upcoming = ((await leagueFixtures('nba', 2)) ?? []).filter((g) => g.date - now < 23 * 3600e3);
    R.push({ recent: recent.map((g) => `${g.home.name}-${g.away.name} ${g.home.id}`), upcoming: upcoming.slice(0, 2).map((g) => `${g.home.name}-${g.away.name} ${g.home.id} ${g.date.toISOString()}`) });
    if (recent[0]) await S('follow finished team', () => cb(`sp:f:nba:${recent[0].home.id}`));
    if (upcoming[0]) {
      await S('follow upcoming team', () => cb(`sp:f:nba:${upcoming[0].home.id}`));
      const n = (await db.select().from(notifications).where(eq(notifications.chatId, CHAT)).all()).find((x) => x.params.team === upcoming[0].home.id);
      await db.update(notifications).set({ params: { ...n.params, lead: 1440 } }).where(eq(notifications.id, n.id)).run();
    }
    await S('follow ufc', () => cb('sp:fl:ufc'));
    await S('tick priming (expect no sends)', async () => { R.push({ prime: await runTick() }); });
    // Forget what priming recorded for the finished game so the final alert fires.
    for (const n of await db.select().from(notifications).where(eq(notifications.chatId, CHAT)).all()) {
      if (n.kind === 'team') await db.update(notifications).set({ params: { ...n.params, sent: {} } }).where(eq(notifications.id, n.id)).run();
    }
    await S('tick (expect FT + kickoff)', async () => { R.push({ tick: await runTick() }); });
    await S('tick again (no repeats)', async () => { R.push({ again: await runTick() }); });
    const rows = await db.select().from(notifications).where(eq(notifications.chatId, CHAT)).all();
    R.push({ state: rows.map((n) => `${n.kind} ${n.params.label} primed=${n.params.primed} sent=${JSON.stringify(n.params.sent)}`) });
  }

  if (only === 6) {
    const t0 = Date.now();
    await S('/food', () => msg('/food'));
    await S('recipes menu', () => cb('fd:r'));
    await S('random recipe', () => cb('fd:rr'));
    await S('cuisines (builds index)', () => cb('fd:ra'));
    R.push({ indexBuildMs: Date.now() - t0 });
    await S('italian', () => cb('fd:rA:Italian'));
    await S('shuffle', () => cb('fd:rq'));
    await S('categories', () => cb('fd:rc'));
    await S('seafood', () => cb('fd:rC:Seafood'));
    await S('search pasta', async () => { await cb('fd:rs'); await msg('pasta'); });
    await S('fridge chicken garlic', async () => { await cb('fd:rf'); await msg('chicken, garlic'); });
    await S('fridge nonsense', () => { return (async () => { await cb('fd:rf'); await msg('unobtainium'); })(); });
    await S('/recipe salmon', () => msg('/recipe salmon'));
    await S('open recipe 52772', () => cb('fd:ro:52772'));
    await S('add to shopping', () => cb('fd:sl:52772'));
    await S('add again (dupe)', () => cb('fd:sl:52772'));
    await S('save recipe', () => cb('sv:a:recipe:52772'));
    await S('shopping list', () => cb('fd:s'));
    const items = await db.select().from(shoppingList).where(eq(shoppingList.chatId, CHAT)).all();
    await S('tick item', () => cb(`fd:st:${items[0].id}:0`));
    await S('add items', async () => { await cb('fd:sa'); await msg('milk, eggs, 2 lemons'); });
    await S('clear ticked', () => cb('fd:sx'));
    await S('clear all confirm', () => cb('fd:sX'));
    await S('clear all', () => cb('fd:sXy'));
    await S('cocktails', () => cb('fd:c'));
    await S('random drink', () => cb('fd:cr'));
    await S('spirits', () => cb('fd:cb'));
    await S('with gin', () => cb('fd:cB:Gin'));
    await S('non-alcoholic', () => cb('fd:cn'));
    await S('search mint', async () => { await cb('fd:cs'); await msg('mint'); });
    await S('/cocktail margarita', () => msg('/cocktail margarita'));
    await S('open drink 11007', () => cb('fd:co:11007'));
    await S('save drink', () => cb('sv:a:cocktail:11007'));
    await S('coffee', () => cb('fd:k'));
    await S('calc menu', () => cb('fd:kc'));
    await S('calc v60 ask', async () => { await cb('fd:kc:v60'); await msg('20g 1:15'); });
    await S('/brew aeropress 18g', () => msg('/brew aeropress 18g'));
    await S('/coldbrew 1000', () => msg('/coldbrew 1000'));
    await S('cold reminder', () => cb('fd:kT:14'));
    await S('save brew', () => cb('sv:a:brew:v60-20-300'));
    await S('log from calc', async () => { await cb('fd:ka:v60:20:300'); await msg('Kenya AA — Square Mile'); });
    await S('rate 5', () => cb('fd:kR:5'));
    await S('log manual', async () => { await cb('fd:ka'); await msg('Brazil Santos'); });
    await S('method', () => cb('fd:kM:aeropress'));
    await S('dose', () => msg('15 230 grind 18, chocolatey'));
    await S('rate 3', () => cb('fd:kR:3'));
    await S('brew log', () => cb('fd:kl'));
    await S('best', () => cb('fd:kb'));
    await S('photo', () => cb('fd:kp'));
    await S('saved food', () => cb('sv:l:food:0'));
    await S('breweries no location', () => cb('fd:b'));
    await S('breweries by city', async () => { await cb('fd:bc'); await msg('Portland'); });
    await db.insert(prefs).values({ chatId: CHAT, lat: 52.52, lon: 13.4 }).onConflictDoUpdate({ target: prefs.chatId, set: { lat: 52.52, lon: 13.4 } }).run();
    await S('breweries near', () => cb('fd:b'));
    await S('barcode ask', async () => { await cb('fd:o'); await msg('3017624010701'); });
    await S('barcode plain digits', () => msg('5449000000996'));
    await S('barcode unknown', () => msg('/barcode 0000000000017'));
    await S('dinner menu', () => cb('fd:dn'));
    await S('dinner set', async () => { await cb('fd:dnset'); await msg('17:30 weekdays'); });
    await db.run(sql`UPDATE notifications SET next_at = unixepoch() - 5 WHERE chat_id = ${CHAT} AND kind = 'schedule'`);
    await S('tick dinner', async () => { R.push({ tick: await runTick() }); });
    await S('food notifications', () => cb('n:l:food:0'));
    await S('old more:recipe button', () => cb('more:recipe'));
  }

  if (only === 7) {
    await S('/random', () => msg('/random'));
    await S('tools', () => cb('rd:t'));
    await S('tg dice', () => cb('rd:td:1'));
    await S('coin', () => cb('rd:tc'));
    await S('roll ask 3d6+2', async () => { await cb('rd:tr'); await msg('3d6+2'); });
    await S('roll again', () => cb('rd:tR:3d6+2'));
    await S('/roll bad', () => msg('/roll 99d99999'));
    await S('number ask', async () => { await cb('rd:tn'); await msg('1 100'); });
    await S('/number 10', () => msg('/number 10'));
    await S('pick', async () => { await cb('rd:tp'); await msg('pizza, sushi, tacos <b>'); });
    await S('repick', () => cb('rd:tP'));
    await S('/shuffle', () => msg('/shuffle a, b, c, d'));
    await S('teams', async () => { await cb('rd:tt'); await msg('Ann, Bob, Cy, Dee, Eve / 2'); });
    await S('reteam', () => cb('rd:tT'));
    await S('8ball', async () => { await cb('rd:t8'); await msg('Will it work?'); });
    await S('cards menu', () => cb('rd:tk'));
    await S('cards 5', () => cb('rd:tk:5'));
  }
  if (only === 8) {
    await S('discover', () => cb('rd:d'));
    await S('book menu', () => cb('rd:m:b'));
    await S('book trending', () => cb('rd:x:b:trend'));
    await S('book fantasy', () => cb('rd:x:b:fantasy'));
    await S('book classic', () => cb('rd:x:b:gut'));
    await S('movie menu (limited)', () => cb('rd:m:m'));
    await S('movie any', () => cb('rd:x:m'));
    await S('movie comedy', () => cb('rd:x:m:35'));
    await S('series drama', () => cb('rd:x:s:Drama'));
    await S('series any', () => cb('rd:x:s'));
    await S('anime comedy', () => cb('rd:x:a:comedy'));
    await S('anime any', () => cb('rd:x:a'));
    await S('game menu', () => cb('rd:m:g'));
    await S('f2p shooter', () => cb('rd:x:g:f2p:shooter'));
    await S('deal', () => cb('rd:x:g:deal'));
    await S('giveaway', () => cb('rd:x:g:give'));
  }
  if (only === 9) {
    await S('album', () => cb('rd:x:l'));
    await S('album rock', () => cb('rd:x:l:Rock'));
    await S('radio jazz', () => cb('rd:x:r:jazz'));
    await S('art', () => cb('rd:x:A'));
    await S('pokemon', () => cb('rd:x:p'));
    await S('dog', () => cb('rd:x:d'));
    await S('cat', () => cb('rd:x:c'));
    await S('movie any', () => cb('rd:x:m'));
    await S('save movie', async () => { const k = R.find((r) => r.label === 'movie any').calls[0]?.kb.find((d) => d.startsWith('sv:a:')); if (k) await cb(k); });
    await S('save art', async () => { const k = R.find((r) => r.label === 'art').calls[0]?.kb.find((d) => d.startsWith('sv:a:')); if (k) await cb(k); });
  }
  if (only === 10) {
    await S('fun', () => cb('rd:f'));
    for (const k of ['fact', 'joke', 'quote', 'advice', 'wiki', 'otd', 'word', 'rword', 'xkcd', 'bored']) await S(`fun ${k}`, () => cb(`rd:f:${k}`));
    await S('/xkcd 353', () => msg('/xkcd 353'));
    await S('save word', async () => { const k = R.find((r) => r.label === 'fun word').calls[0]?.kb.find((d) => d.startsWith('sv:a:')); if (k) await cb(k); });
    await S('saved random', () => cb('sv:l:random:0'));
    const sv = await db.select().from(savedItems).where(eq(savedItems.chatId, CHAT)).all();
    for (const it of sv) await S(`reopen ${it.kind}`, () => cb(`sv:o:${it.id}`));
  }
  if (only === 11) {
    await S('trivia menu', () => cb('rd:q'));
    await S('trivia general', () => cb('rd:qq:9'));
    const p1 = lastPoll;
    await S('answer correct', () => onPollAnswer({ poll_id: p1?.id, user: { id: 4242, first_name: 'Tester' }, option_ids: [p1?.correct] }));
    await S('trivia again (rate limit?)', () => cb('rd:qq:0'));
    const p2 = lastPoll;
    if (p2 && p2 !== p1) await S('answer wrong', () => onPollAnswer({ poll_id: p2.id, user: { id: 4242, first_name: 'Tester' }, option_ids: [(p2.correct + 1) % 4] }));
    await S('other user correct', () => onPollAnswer({ poll_id: p1?.id, user: { id: 777, first_name: 'Other', last_name: 'Person' }, option_ids: [p1?.correct] }));
    await S('unknown poll ignored', () => onPollAnswer({ poll_id: 'nope', user: { id: 1 }, option_ids: [0] }));
    await S('leaderboard', () => cb('rd:qt'));
    R.push({ scores: await db.select().from(triviaScores).where(eq(triviaScores.chatId, CHAT)).all() });
    await S('picks menu', () => cb('rd:sch'));
    await S('pick movie menu', () => cb('rd:sc:movie'));
    await S('set movie fri', async () => { await cb('rd:scs:movie'); await msg('20:00 fri'); });
    await S('set word daily', async () => { await cb('rd:scs:word'); await msg('08:00'); });
    await db.run(sql`UPDATE notifications SET next_at = unixepoch() - 5 WHERE chat_id = ${CHAT} AND kind = 'schedule'`);
    await S('tick picks', async () => { R.push({ tick: await runTick() }); });
    await S('random notifications', () => cb('n:l:random:0'));
    await S('old go:book', () => cb('go:book'));
    await S('old more:fact', () => cb('more:fact'));
    await S('/movie horror', () => msg('/movie horror'));
    await S('/book sci', () => msg('/book sci'));
    await S('/8ball', () => msg('/8ball'));
    await S('/trivia top', () => msg('/trivia top'));
    await S('/help', () => msg('/help'));
  }

  if (only === 12) {
    await S('/daily defaults', () => msg('/daily'));
    await S('/settings', () => msg('/settings'));
    await S('sections', () => cb('st:dsec'));
    for (const k of ['f1', 'movie', 'quote', 'fact', 'word', 'book']) await S(`toggle ${k}`, () => cb(`st:dsec:${k}`));
    await S('/daily all extras', () => msg('/daily'));
    await S('refresh', () => cb('dl:r'));
    for (const k of ['weather', 'crypto', 'teams', 'f1', 'movie', 'recipe', 'quote', 'fact', 'word']) await S(`off ${k}`, () => cb(`st:dsec:${k}`));
    await S('/daily empty', () => msg('/daily'));
    memberStatus = 'member';
    await S('group member toggle refused', () => cb('st:dsec:book', GROUP, 'supergroup'));
    memberStatus = 'administrator';
    await S('schedule daily', async () => { await msg('/digest 07:00'); });
    await S('turn sections back on', async () => { await cb('st:dsec:crypto'); await cb('st:dsec:quote'); });
    await db.run(sql`UPDATE notifications SET next_at = unixepoch() - 5 WHERE chat_id = ${CHAT} AND kind = 'schedule'`);
    await S('tick daily', async () => { R.push({ tick: await runTick() }); });
  }

  if (only === 13) {
    // The shared interface in a private chat: the persistent reply keyboard opens
    // screens, inline buttons on the current screen edit it, typed text answers
    // prompts, and the user's messages are deleted (clean chat).
    const tap = (label) => msg(label);
    const screen = async () => (await db.select({ id: prefs.screenMsg }).from(prefs).where(eq(prefs.chatId, CHAT)).get())?.id;
    const press = async (data) => onCallback({ id: 'q', data, from: { id: 4242, first_name: 'Tester' }, message: { message_id: await screen(), chat: { id: CHAT, type: 'private' } } });
    await S('/start', () => msg('/start'));
    await S('/start again replaces home', () => msg('/start'));
    await S('tap 🍽 Food & drinks', () => tap('🍽 Food & drinks'));
    await S('press recipes (edits screen)', () => press('fd:r'));
    await S('tap 💰 Crypto (replaces screen)', () => tap('💰 Crypto'));
    await S('press search → prompt', () => press('cr:s'));
    await S('answer prompt', () => msg('dogecoin'));
    await S('prompt then cancel', async () => { await press('cr:s'); await press('x'); });
    await S('tap 🏆 Sports', () => tap('🏆 Sports'));
    await S('tap 🎲 Random', () => tap('🎲 Random'));
    await S('tap ☀️ Daily briefing', () => tap('☀️ Daily briefing'));
    await S('tap 🔔 Notifications', () => tap('🔔 Notifications'));
    await S('tap ⚙️ Settings', () => tap('⚙️ Settings'));
    await S('press sections, toggle fact', async () => { await press('st:dsec'); await press('st:dsec:fact'); });
    await S('press location → location keyboard', async () => { await tap('⚙️ Settings'); await press('st:loc'); });
    await S('tap ⬅️ Settings restores keyboard', () => tap('⬅️ Settings'));
    await S('share a location', () => onMessage({ message_id: 2, chat: { id: CHAT, type: 'private' }, from: { id: 4242, first_name: 'Tester', is_bot: false }, location: { latitude: 52.52, longitude: 13.4 } }));
    await S('tap 🔗 Source code', () => tap('🔗 Source code'));
    await S('tap 🌐 Language → fa', async () => { await tap('🌐 Language'); await press('lang:fa'); });
    await S('Persian label opens crypto', () => tap('💰 کریپتو'));
    await S('English label still works', () => tap('🏆 Sports'));
    await S('back to English', async () => { await tap('🌐 زبان'); await press('lang:en'); });
    await S('old ✖️ Hide menu button', () => cb('kb:close'));
    await S('unknown text → home', () => msg('blah blah'));
    await S('/menu → home', () => msg('/menu'));
    await S('/crypto command still works', () => msg('/crypto'));
    memberStatus = 'administrator';
    await S('group /crypto stays inline', () => msg('/crypto', GROUP, 'supergroup'));
    await S('group text label ignored', () => msg('🍲 Recipes', GROUP, 'supergroup'));
    await S('group /start', () => msg('/start', GROUP, 'supergroup'));
  }

  await cleanup();
  return R;
}
