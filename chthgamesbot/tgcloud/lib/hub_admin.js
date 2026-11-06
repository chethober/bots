// What the CHTH hub can ask of this bot (see hub_command.js). The hub holds the admin screens and
// checks who is asking; this only touches the bot's own data. Results are English, in HTML.

import { api, db, BotApiError } from 'sdk';
import { eq, desc, gt, lt, sql } from 'sdk/db';
import { players, sessions, purchases, hubCommands } from '../schema.js';
import { refundPurchase } from './shop.js';
import { playerLocale } from './i18n.js';
import { t } from './strings.js';
import { sendHtml } from './engine.js';
import { esc, chips } from './ui.js';
import { ADMIN_IDS } from './config.js';

const CLAIM_KEEP_SEC = 600; // commands older than 5 minutes are refused before they get here

// True the first time this command id is seen.
export async function claim(id) {
  const at = Math.floor(Date.now() / 1000);
  await db.delete(hubCommands).where(lt(hubCommands.at, at - CLAIM_KEEP_SEC));
  const [row] = await db.insert(hubCommands).values({ id, at }).onConflictDoNothing().returning();
  return Boolean(row);
}

const html = (text, extra = {}) => ({ text, html: true, ...extra });
const words = (args) => String(args.input ?? '').trim().split(/\s+/).filter(Boolean);
const when = (sec) => new Date(sec * 1000).toISOString().slice(0, 16).replace('T', ' ');

function playerId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Give a player id.');
  return id;
}

function amount(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Amount must be a whole number.');
  return n;
}

const BROADCAST_BATCH = 40;
const BROADCAST_MAX = 3000; // the hub's Continue button carries the text back

async function setBalance(args, grant) {
  const [idArg, amountArg] = words(args);
  const id = playerId(idArg);
  const n = amount(amountArg);
  const set = grant ? { chips: sql`max(${players.chips} + ${n}, 0)` } : { chips: Math.max(n, 0) };
  const [x] = await db.update(players).set(set).where(eq(players.id, id)).returning();
  return html(x ? `✅ ${esc(x.name)} now has ${chips(x.chips)}.` : 'No such player (they must have used the bot once).');
}

async function setBanned(args, banned) {
  const id = playerId(words(args)[0]);
  if (banned && ADMIN_IDS.includes(id)) return html("Admins can't be banned.");
  const [x] = await db.update(players).set({ banned }).where(eq(players.id, id)).returning();
  return html(x ? `${banned ? '🚫 Banned' : '✅ Unbanned'} ${esc(x.name)}.` : 'No such player.');
}

export const handlers = {
  async stats() {
    const day = Math.floor(Date.now() / 1000) - 86400;
    const p = await db.get(sql`SELECT count(*) AS n, coalesce(sum(chips),0) AS chips, coalesce(sum(wagered),0) AS wagered,
      coalesce(sum(played),0) AS played, sum(banned) AS banned, sum(created_at > ${day}) AS fresh FROM players`);
    const s = await db.get(sql`SELECT count(*) AS n, sum(updated_at > ${day}) AS active FROM sessions WHERE kind != 'room'`);
    const kinds = await db.all(sql`SELECT kind, count(*) AS n FROM sessions WHERE updated_at > ${day} AND kind != 'room' GROUP BY kind ORDER BY n DESC`);
    const top = await db.select().from(players).orderBy(desc(players.wagered)).limit(5);
    const pay = await db.get(sql`SELECT count(*) AS n, coalesce(sum(stars),0) AS stars, coalesce(sum(chips),0) AS chips,
      sum(created_at > ${day}) AS fresh, sum(credited = 0) AS stuck FROM purchases WHERE refunded = 0`);
    return html([
      '<b>📊 Stats</b>',
      `Players: <b>${p.n}</b> (${p.fresh ?? 0} new today, ${p.banned ?? 0} banned)`,
      `Chips held: ${chips(p.chips)} · wagered all-time: ${chips(p.wagered)}`,
      `Bets placed: ${p.played}`,
      `Stars: ⭐ ${pay.stars} from ${pay.n} purchases (${pay.fresh ?? 0} today) · ${chips(pay.chips)} sold`
        + (pay.stuck ? ` · ⚠️ ${pay.stuck} not credited (see ⭐ Payments)` : ''),
      `Games: ${s.n} total, ${s.active ?? 0} active in 24h`,
      kinds.length ? `Last 24h: ${kinds.map((k) => `${k.kind} ${k.n}`).join(' · ')}` : '',
      '',
      '<b>Top wagered</b>',
      ...top.map((x) => `${esc(x.name)} (<code>${x.id}</code>) — ${chips(x.wagered)}`),
    ].join('\n'));
  },

  async user(args) {
    const id = playerId(words(args)[0]);
    const x = await db.select().from(players).where(eq(players.id, id)).get();
    if (!x) return html('No such player.');
    return html([
      `<b>${esc(x.name)}</b> <code>${x.id}</code>${x.banned ? ' · 🚫 BANNED' : ''}`,
      `Balance ${chips(x.chips)} · played ${x.played} · wins ${x.wins}`,
      `Wagered ${chips(x.wagered)} · best win ${chips(x.bestWin)}`,
      `Joined ${when(x.created)} UTC`,
      `Last daily ${x.lastDaily ? `${when(x.lastDaily)} UTC` : 'never'}`,
    ].join('\n'));
  },

  grant: (args) => setBalance(args, true),
  setchips: (args) => setBalance(args, false),

  async resetdaily(args) {
    const [x] = await db.update(players).set({ lastDaily: 0 }).where(eq(players.id, playerId(words(args)[0]))).returning();
    return html(x ? `✅ ${esc(x.name)} can claim the daily bonus now.` : 'No such player.');
  },

  ban: (args) => setBanned(args, true),
  unban: (args) => setBanned(args, false),

  async payments(args) {
    const id = Number(words(args)[0]) || 0;
    const q = db.select().from(purchases);
    const rows = await (id ? q.where(eq(purchases.userId, id)) : q).orderBy(desc(purchases.created)).limit(10);
    if (!rows.length) return html('No purchases.');
    return html(['<b>⭐ Purchases</b>', ...rows.map((x) => [
      `${when(x.created)} · <code>${x.userId}</code> · ⭐ ${x.stars} → ${chips(x.chips)}`
        + (x.refunded ? ' · ↩️ refunded' : x.credited ? '' : ' · ⚠️ not credited'),
      `<code>${esc(x.charge)}</code>`,
    ].join('\n'))].join('\n'));
  },

  async refund(args) {
    const charge = words(args)[0];
    if (!charge) throw new Error('Give a charge id (see ⭐ Payments).');
    const res = await refundPurchase(charge);
    if (!res) return html('Already refunded.');
    const locale = playerLocale(res.player);
    await sendHtml(res.purchase.userId, t(locale, 'pay_refunded', {
      stars: res.purchase.stars, n: chips(res.purchase.chips), chips: chips(res.player?.chips ?? 0),
    })).catch(() => {});
    return html(`↩️ Refunded ⭐ ${res.purchase.stars} to <code>${res.purchase.userId}</code>; they now have ${chips(res.player?.chips ?? 0)}.`);
  },

  async broadcast(args) {
    const body = String(args.input ?? '').trim();
    if (!body) throw new Error('The message is empty.');
    if (body.length > BROADCAST_MAX) throw new Error(`Keep it under ${BROADCAST_MAX} characters.`);
    const after = Number(args.after) || 0;
    const rows = await db.select({ id: players.id }).from(players)
      .where(gt(players.id, after)).orderBy(players.id).limit(BROADCAST_BATCH);
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
    const more = rows.length === BROADCAST_BATCH;
    return html(`📣 Sent ${sent}, failed ${failed}.${more ? '\nMore players left.' : ''}`, more
      ? { buttons: [{ text: '▶️ Continue', cmd: 'broadcast', args: { input: body, after: rows.at(-1).id } }] } : {});
  },
};
