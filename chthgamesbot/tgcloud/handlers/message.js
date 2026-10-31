// handlers/message.js — the private chat's reply keyboard, /start, the group
// welcome and the admin commands. Games themselves run on inline keyboards
// (handlers/callback_query.js) and in the Mini App (endpoints/). The only slash
// commands are /start and the admin ones.

import { api, db } from 'sdk';
import { desc } from 'sdk/db';
import { players } from '../schema.js';
import { ensurePlayer, claimDaily, sendHtml } from '../lib/engine.js';
import { aboutKeyboard, isTipPayment, thankTip } from '../lib/tips.js';
import { invoiceLinks, creditPayment, revokePurchase, recentPurchases, validPayment } from '../lib/shop.js';
import { menuText, menuMarkup, sendHome } from '../lib/menu.js';
import { adminCommand, ADMIN_COMMANDS, isAdmin } from '../lib/admin.js';
import { esc, chips } from '../lib/ui.js';
import { BOT_USERNAME, WEBAPP_URL, DAILY_CHIPS, DAILY_COOLDOWN, SOURCE_URL, PACKS, ADMIN_IDS } from '../lib/config.js';
import { t } from '../lib/strings.js';
import { languageKeyboard, playerLocale } from '../lib/i18n.js';
import { drop, matchButton, showScreen } from '../lib/screen.js';
import { reportStart, reportError } from '../lib/report.js';

// Never throws (see handlers/callback_query.js) — errors are logged.
export default async function (message) {
  // A /start reaches the hub with the CHTH link that brought the user (src_ tags are
  // stripped here, so the rest of the bot sees a plain /start).
  await reportStart(message);
  try {
    await handle(message);
  } catch (e) {
    await reportError('handlers/message', e);
    console.error(e);
  }
}

async function handle(message) {
  const text = message.text ?? '';
  if (!message.from) return;
  const chatId = message.chat.id;
  const chatType = message.chat.type;

  // Telegram Stars: a paid (or refunded) 💎 chips pack, or a ⭐ tip (lib/tips.js).
  // Payments arrive in the private chat.
  if (isTipPayment(message.successful_payment)) {
    return thankTip(message, playerLocale(await ensurePlayer(message.from)), ADMIN_IDS);
  }
  if (message.successful_payment) return onPayment(message);
  if (message.refunded_payment) return onRefund(message);

  // Added to a group: say hello with the games menu.
  if (message.new_chat_members?.some((u) => u.username?.toLowerCase() === BOT_USERNAME.toLowerCase())) {
    const locale = playerLocale(await ensurePlayer(message.from));
    return sendHtml(chatId, menuText(chatType, locale), menuMarkup(chatType, locale));
  }

  const button = chatType === 'private' ? matchButton(text) : null;
  if (!button && !text.startsWith('/')) return;

  const me = await ensurePlayer(message.from);
  const locale = playerLocale(me);

  if (button) {
    await drop(chatId, message.message_id);
    if (me.banned) return showScreen(chatId, t(locale, 'banned'));
    return onButton(me, button, locale);
  }

  const [head, ...rest] = text.split(/\s+/);
  const [cmd, at] = head.slice(1).toLowerCase().split('@');
  if (at && at !== BOT_USERNAME.toLowerCase()) return; // addressed to another bot

  if (await adminCommand(message, cmd, rest, text)) return;
  // Telegram asks every bot that takes payments to answer /paysupport.
  if (cmd === 'paysupport' && chatType === 'private') return paySupport(me, locale, message);
  if (cmd !== 'start') {
    // Old game commands: in private, tidy up and point at the buttons; elsewhere stay quiet.
    if (chatType === 'private') {
      await drop(chatId, message.message_id);
      return showScreen(chatId, t(locale, 'use_buttons'));
    }
    return;
  }
  if (me.banned) {
    if (chatType === 'private') await sendHtml(chatId, t(locale, 'banned'));
    return;
  }

  if (chatType !== 'private') return sendHtml(chatId, menuText(chatType, locale), menuMarkup(chatType, locale));

  await drop(chatId, message.message_id);
  if (rest[0]?.startsWith('join_')) return showScreen(chatId, t(locale, 'old_invite'));
  if (/^room_[a-z0-9]{8}$/.test(rest[0] ?? '')) {
    return showScreen(chatId, t(locale, 'room_invite'), {
      inline_keyboard: [[{ text: t(locale, 'open_room'), web_app: { url: `${WEBAPP_URL}?room=${rest[0].slice(5)}` } }]],
    });
  }
  // Users have the reply keyboard instead of a command menu; admins get theirs.
  await api.deleteMyCommands({}).catch(() => {});
  if (isAdmin(me.id)) {
    await api.setMyCommands({
      commands: ADMIN_COMMANDS.map(([command, description]) => ({ command, description })),
      scope: { type: 'chat', chat_id: me.id },
    }).catch(() => {});
  }
  await sendHome(me, locale);
  if (rest[0] === 'hub') return openHub(chatId, locale);
}

// A tapped reply-keyboard button (private chat); each answer replaces the last screen.
async function onButton(me, button, locale) {
  const chatId = me.id;
  switch (button) {
    case 'games':
      return showScreen(chatId, menuText('private', locale), menuMarkup('private', locale));
    case 'hub':
      return openHub(chatId, locale);
    case 'balance':
      return showScreen(chatId, t(locale, 'wallet', {
        name: esc(me.name), chips: chips(me.chips), played: me.played, wins: me.wins,
        wagered: chips(me.wagered), best: chips(me.bestWin),
      }));
    case 'daily': {
      const after = await claimDaily(me.id);
      if (after) return showScreen(chatId, t(locale, 'daily_got', { daily: chips(DAILY_CHIPS), chips: chips(after.chips) }));
      const wait = me.lastDaily + DAILY_COOLDOWN - Math.floor(Date.now() / 1000);
      return showScreen(chatId, t(locale, 'daily_wait', { h: Math.ceil(wait / 3600), chips: chips(me.chips) }));
    }
    case 'shop':
      return showScreen(chatId, t(locale, 'shop', { chips: chips(me.chips) }), await shopMarkup(locale));
    case 'top':
      return showScreen(chatId, await leaderboard(locale));
    case 'language':
      return showScreen(chatId, t(locale, 'choose_language'), languageKeyboard());
    case 'about':
      return showScreen(chatId, t(locale, 'about'), aboutKeyboard(locale, SOURCE_URL));
  }
}

// One url button per pack, each opening that pack's Stars invoice.
async function shopMarkup(locale) {
  const links = await invoiceLinks(locale);
  return {
    inline_keyboard: PACKS.map((p, i) => [{ text: t(locale, 'pack_btn', { chips: chips(p.chips), stars: p.stars }), url: links[i] }]),
  };
}

async function onPayment(message) {
  const me = await ensurePlayer(message.from);
  const locale = playerLocale(me);
  const pay = message.successful_payment;
  const pack = validPayment(pay);
  const after = pack && await creditPayment(me.id, pay).catch((e) => { console.error('credit failed', pay, e); return false; });
  if (after === null) return; // already credited (a redelivered update)
  if (!after) {
    await notifyAdmins(`⚠️ Payment not credited: <code>${esc(pay.telegram_payment_charge_id)}</code> from ${esc(me.name)} (<code>${me.id}</code>), ⭐ ${pay.total_amount}. Check /stats, then /grant or /refund.`);
    return showScreen(me.id, t(locale, 'pay_failed'));
  }
  return showScreen(me.id, t(locale, 'paid', { n: chips(pack.chips), chips: chips(after.chips) }));
}

async function onRefund(message) {
  const me = await ensurePlayer(message.from);
  const res = await revokePurchase(message.refunded_payment.telegram_payment_charge_id);
  if (!res) return; // already handled (e.g. refunded with /refund)
  return showScreen(me.id, t(playerLocale(me), 'pay_refunded', {
    stars: res.purchase.stars, n: chips(res.purchase.chips), chips: chips(res.player?.chips ?? 0),
  }));
}

async function paySupport(me, locale, message) {
  const note = message.text.replace(/^\/paysupport(@\w+)?\s*/i, '').trim();
  const recent = await recentPurchases(me.id);
  const list = recent.length
    ? recent.map((p) => `• ${new Date(p.created * 1000).toISOString().slice(0, 10)} · ⭐ ${p.stars} → ${chips(p.chips)}${p.refunded ? ' ↩️' : ''}\n  <code>${esc(p.charge)}</code>`).join('\n')
    : t(locale, 'paysupport_none');
  if (!note) {
    await drop(me.id, message.message_id);
    return showScreen(me.id, t(locale, 'paysupport', { list }));
  }
  await notifyAdmins(`💬 <b>/paysupport</b> from ${esc(me.name)} (<code>${me.id}</code>):\n${esc(note.slice(0, 1500))}\n\n${list}`);
  return showScreen(me.id, t(locale, 'paysupport_sent'));
}

async function notifyAdmins(text) {
  for (const id of ADMIN_IDS) await sendHtml(id, text).catch((e) => console.warn('admin notify failed', id, e.description));
}

async function leaderboard(locale) {
  const rows = await db.select().from(players).orderBy(desc(players.chips)).limit(10);
  const medals = ['🥇', '🥈', '🥉'];
  return [`<b>${t(locale, 'top_title')}</b>`, '', ...rows.map((p, i) => `${medals[i] ?? `${i + 1}.`} ${esc(p.name)} — ${chips(p.chips)}`)].join('\n');
}

function openHub(chatId, locale) {
  return showScreen(chatId, t(locale, 'hub_private'), {
    inline_keyboard: [[{ text: t(locale, 'open_hub'), web_app: { url: WEBAPP_URL } }]],
  });
}
