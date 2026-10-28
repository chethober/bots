// /admin commands, for ADMIN_IDS only. Called from handlers/message.js before game commands.

import { api, db, BotApiError } from 'sdk';
import { eq, desc, gt, sql } from 'sdk/db';
import { players, sessions, purchases } from '../schema.js';
import { refundPurchase } from './shop.js';
import { playerLocale } from './i18n.js';
import { t } from './strings.js';
import { sendHtml } from './engine.js';
import { esc, chips } from './ui.js';
import { ADMIN_IDS } from './config.js';

export const isAdmin = (id) => ADMIN_IDS.includes(id);

const HELP = [
  '<b>🛠 Admin</b>',
  '/stats — players, chips in circulation, activity',
  '/user &lt;id&gt; — player details (or reply to their message)',
  '/grant &lt;id&gt; &lt;amount&gt; — add chips (negative removes)',
  '/setchips &lt;id&gt; &lt;amount&gt; — set balance',
  '/resetdaily &lt;id&gt; — make /daily claimable now',
  '/ban &lt;id&gt; · /unban &lt;id&gt; — block from all games',
  '/broadcast &lt;text&gt; — DM every player (40 per run; add from=&lt;id&gt; to continue)',
  '/payments [id] — latest Stars purchases (all, or one player\'s)',
  '/refund &lt;charge id&gt; — return the Stars and take the chips back',
].join('\n');

export const ADMIN_COMMANDS = [
  ['admin', 'Admin help'], ['stats', 'Bot statistics'], ['user', 'Player details'],
  ['grant', 'Add/remove chips'], ['setchips', 'Set a balance'], ['resetdaily', 'Reset daily bonus'],
  ['ban', 'Ban a player'], ['unban', 'Unban a player'], ['broadcast', 'Message all players'],
  ['payments', 'Stars purchases'], ['refund', 'Refund a Stars purchase'],
];

// Returns true if the command was an admin command (handled), false otherwise.
export async function adminCommand(message, cmd, args, rawText) {
  if (!isAdmin(message.from.id) || !ADMIN_COMMANDS.some(([c]) => c === cmd)) return false;
  const chatId = message.chat.id;
  const reply = (text) => sendHtml(chatId, text);
  const target = () => {
    const id = Number(args[0]) || message.reply_to_message?.from?.id;
    if (!Number.isSafeInteger(id)) throw new Error('Give a user id (or reply to their message).');
    return id;
  };
  const amountArg = (i) => {
    const n = Number(args[i]);
    if (!Number.isSafeInteger(n)) throw new Error('Amount must be a whole number.');
    return n;
  };

  try {
    switch (cmd) {
      case 'admin':
        return await reply(HELP), true;

      case 'stats': {
        const day = Math.floor(Date.now() / 1000) - 86400;
        const p = await db.get(sql`SELECT count(*) AS n, coalesce(sum(chips),0) AS chips, coalesce(sum(wagered),0) AS wagered,
          coalesce(sum(played),0) AS played, sum(banned) AS banned, sum(created_at > ${day}) AS fresh FROM players`);
        const s = await db.get(sql`SELECT count(*) AS n, sum(updated_at > ${day}) AS active FROM sessions WHERE kind != 'room'`);
        const kinds = await db.all(sql`SELECT kind, count(*) AS n FROM sessions WHERE updated_at > ${day} AND kind != 'room' GROUP BY kind ORDER BY n DESC LIMIT 8`);
        const top = await db.select().from(players).orderBy(desc(players.wagered)).limit(5);
        const pay = await db.get(sql`SELECT count(*) AS n, coalesce(sum(stars),0) AS stars, coalesce(sum(chips),0) AS chips,
          sum(created_at > ${day}) AS fresh, sum(credited = 0) AS stuck FROM purchases WHERE refunded = 0`);
        await reply([
          '<b>📊 Stats</b>',
          `Players: <b>${p.n}</b> (${p.fresh ?? 0} new today, ${p.banned ?? 0} banned)`,
          `Chips held: ${chips(p.chips)} · wagered all-time: ${chips(p.wagered)}`,
          `Bets placed: ${p.played}`,
          `Stars: ⭐ ${pay.stars} from ${pay.n} purchases (${pay.fresh ?? 0} today) · ${chips(pay.chips)} sold`
            + (pay.stuck ? ` · ⚠️ ${pay.stuck} not credited (/payments)` : ''),
          `Games: ${s.n} total, ${s.active ?? 0} active in 24h`,
          kinds.length ? `Last 24h: ${kinds.map((k) => `${k.kind} ${k.n}`).join(' · ')}` : '',
          '',
          '<b>Top wagered</b>',
          ...top.map((x) => `${esc(x.name)} (<code>${x.id}</code>) — ${chips(x.wagered)}`),
        ].join('\n'));
        return true;
      }

      case 'user': {
        const id = target();
        const x = await db.select().from(players).where(eq(players.id, id)).get();
        if (!x) return await reply('No such player.'), true;
        await reply([
          `<b>${esc(x.name)}</b> <code>${x.id}</code>${x.banned ? ' · 🚫 BANNED' : ''}`,
          `Balance ${chips(x.chips)} · played ${x.played} · wins ${x.wins}`,
          `Wagered ${chips(x.wagered)} · best win ${chips(x.bestWin)}`,
          `Joined ${new Date(x.created * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
          `Last daily ${x.lastDaily ? new Date(x.lastDaily * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'never'}`,
        ].join('\n'));
        return true;
      }

      case 'grant':
      case 'setchips': {
        const id = target();
        const n = amountArg(1);
        const set = cmd === 'grant' ? { chips: sql`max(${players.chips} + ${n}, 0)` } : { chips: Math.max(n, 0) };
        const [x] = await db.update(players).set(set).where(eq(players.id, id)).returning();
        if (!x) return await reply('No such player (they must have used the bot once).'), true;
        await reply(`✅ ${esc(x.name)} now has ${chips(x.chips)}.`);
        return true;
      }

      case 'resetdaily': {
        const [x] = await db.update(players).set({ lastDaily: 0 }).where(eq(players.id, target())).returning();
        await reply(x ? `✅ ${esc(x.name)} can claim /daily now.` : 'No such player.');
        return true;
      }

      case 'ban':
      case 'unban': {
        const id = target();
        if (isAdmin(id)) return await reply("Admins can't be banned."), true;
        const [x] = await db.update(players).set({ banned: cmd === 'ban' }).where(eq(players.id, id)).returning();
        await reply(x ? `${cmd === 'ban' ? '🚫 Banned' : '✅ Unbanned'} ${esc(x.name)}.` : 'No such player.');
        return true;
      }

      case 'payments': {
        const id = Number(args[0]) || message.reply_to_message?.from?.id;
        const q = db.select().from(purchases);
        const rows = await (Number.isSafeInteger(id) ? q.where(eq(purchases.userId, id)) : q).orderBy(desc(purchases.created)).limit(15);
        if (!rows.length) return await reply('No purchases.'), true;
        await reply(['<b>⭐ Purchases</b>', ...rows.map((x) => [
          `${new Date(x.created * 1000).toISOString().slice(0, 16).replace('T', ' ')} · <code>${x.userId}</code> · ⭐ ${x.stars} → ${chips(x.chips)}`
            + (x.refunded ? ' · ↩️ refunded' : x.credited ? '' : ' · ⚠️ not credited'),
          `<code>${esc(x.charge)}</code>`,
        ].join('\n'))].join('\n'));
        return true;
      }

      case 'refund': {
        if (!args[0]) return await reply('Usage: /refund &lt;charge id&gt; (see /payments)'), true;
        const res = await refundPurchase(args[0]);
        if (!res) return await reply('Already refunded.'), true;
        const locale = playerLocale(res.player);
        await sendHtml(res.purchase.userId, t(locale, 'pay_refunded', {
          stars: res.purchase.stars, n: chips(res.purchase.chips), chips: chips(res.player?.chips ?? 0),
        })).catch(() => {});
        await reply(`↩️ Refunded ⭐ ${res.purchase.stars} to <code>${res.purchase.userId}</code>; they now have ${chips(res.player?.chips ?? 0)}.`);
        return true;
      }

      case 'broadcast': {
        const text = rawText.replace(/^\/broadcast(@\w+)?\s*/i, '').trim();
        if (!text) return await reply('Usage: /broadcast your message'), true;
        const after = Number(args.find((a) => /^from=\d+$/.test(a))?.slice(5) ?? 0);
        const body = text.replace(/\s*from=\d+\s*/, ' ').trim();
        const rows = await db.select({ id: players.id }).from(players)
          .where(gt(players.id, after)).orderBy(players.id).limit(40);
        let sent = 0, failed = 0;
        for (const { id } of rows) {
          try {
            await api.sendMessage({ chat_id: id, text: body });
            sent++;
          } catch (e) {
            if (!(e instanceof BotApiError)) throw e;
            failed++;
          }
        }
        const last = rows.at(-1)?.id;
        await reply(`📣 Sent ${sent}, failed ${failed}.` + (rows.length === 40 ? `\nMore players left — run again with <code>from=${last}</code> at the end.` : ''));
        return true;
      }
    }
  } catch (e) {
    await reply(`⚠️ ${esc(e.message)}`);
    return true;
  }
  return false;
}
