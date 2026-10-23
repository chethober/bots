// 🖥 Manage a server: an xtune server's users and plans, through its management
// link (xtune manage link, xtune's manage.go). Everything is a POST <link> {op, …};
// xtune checks the link's role (admin, or a reseller who sees only their users).
// Callback data carries the server's row id and the user's name, never the link.

import { db, fetch, InputFile } from 'sdk';
import { and, desc, eq } from 'sdk/db';
import { servers } from '../schema.js';
import { cancelRow, showScreen } from './chats.js';
import { utf8 } from './hash.js';
import { qrPng } from './qr.js';
import { blockedPort } from './sources.js';
import { setState } from './store.js';
import { now, safeApi } from './util.js';

export const MANAGE_RE = /^https:\/\/[^\s/]+\/[^\s/]+\/adm\/[0-9a-f]{32}$/;
const USERS_PAGE = 15;

// → { ok: true, data } | { ok: false, error: 'gone' | 'unreachable' | 'invalid', message? }
export async function op(link, body) {
  const init = { method: 'POST', body: fetch.body.json(body) };
  let res;
  try {
    res = await fetch(link, init).catch(() => fetch(link, init));
  } catch {
    return { ok: false, error: 'unreachable' };
  }
  let data = null;
  try {
    data = await res.json();
  } catch { /* not xtune */ }
  if (res.ok && data) return { ok: true, data };
  if (res.status === 404) return { ok: false, error: 'gone' };
  // xtune's own message: no such user, quota left, name taken…
  if (res.status === 422 && data?.error) return { ok: false, error: 'invalid', message: data.error };
  return { ok: false, error: 'unreachable' };
}

export const getServer = (id) => db.select().from(servers).where(eq(servers.id, id)).get();
export const ownedServers = (ownerId) =>
  db.select().from(servers).where(eq(servers.ownerId, ownerId)).orderBy(desc(servers.createdAt)).all();
export const deleteServer = (id) => db.delete(servers).where(eq(servers.id, id));

const btn = (text, data) => ({ text, callback_data: data });
// A user's buttons carry their name; Telegram allows 64 bytes of callback data.
const fits = (data) => utf8(data).length <= 64;
const withCancel = (L, rows = []) => ({ inline_keyboard: [...rows, cancelRow(L)] });
const failText = (L, res) => (res.error === 'invalid' ? `⚠️ ${res.message}` : L.srv.errors[res.error] ?? L.srv.errors.unreachable);

// --- adding -------------------------------------------------------------------------

export async function startAddServer(from, L) {
  await setState(from.id, 'add_server');
  return showScreen(from.id, { text: L.srv.addPrompt, reply_markup: withCancel(L) });
}

export async function onAddServer(msg, L) {
  const chatId = msg.chat.id;
  await safeApi('deleteMessage', { chat_id: chatId, message_id: msg.message_id }); // it's a secret link
  const link = String(msg.text ?? '').trim();
  if (!MANAGE_RE.test(link)) return showScreen(chatId, { text: L.srv.notALink, reply_markup: withCancel(L) });
  if (blockedPort(link)) return showScreen(chatId, { text: L.portBlocked(blockedPort(link), true), reply_markup: withCancel(L) });
  const dup = await db.select().from(servers).where(and(eq(servers.ownerId, msg.from.id), eq(servers.link, link))).get();
  if (dup) {
    await setState(msg.from.id, 'idle');
    return showScreen(chatId, await serverView(dup, L));
  }
  await showScreen(chatId, { text: L.checking });
  const res = await op(link, { op: 'status' });
  if (!res.ok) return showScreen(chatId, { text: failText(L, res), reply_markup: withCancel(L) });
  const s = res.data;
  const [row] = await db.insert(servers).values({
    ownerId: msg.from.id, link, name: (s.role === 'reseller' ? s.reseller : s.addr) || '?', role: s.role, createdAt: now(),
  }).returning();
  await setState(msg.from.id, 'idle');
  return showScreen(chatId, await serverView(row, L, s));
}

// --- screens --------------------------------------------------------------------------

export async function serverView(srv, L, status = null) {
  const back = [btn(L.btnBack, 'mine')];
  if (!status) {
    const res = await op(srv.link, { op: 'status' });
    if (!res.ok) {
      return { text: `🖥 ${srv.name}\n\n${failText(L, res)}`, reply_markup: { inline_keyboard: [[btn(L.srv.btnRefresh, `s:${srv.id}`), btn(L.srv.btnRemove, `sd:${srv.id}`)], back] } };
    }
    status = res.data;
  }
  const kb = [[btn(L.srv.btnUsers, `su:${srv.id}:0`), btn(L.srv.btnAddUser, `sa:${srv.id}`)]];
  if (status.role === 'admin') kb.push([btn(L.srv.btnPlans, `sp:${srv.id}`)]);
  kb.push([btn(L.srv.btnRefresh, `s:${srv.id}`), btn(L.srv.btnRemove, `sd:${srv.id}`)], back);
  return { text: L.srv.status(srv, status), reply_markup: { inline_keyboard: kb } };
}

export async function usersView(srv, page, L) {
  const back = [btn(L.btnBack, `s:${srv.id}`)];
  const res = await op(srv.link, { op: 'users' });
  if (!res.ok) return { text: failText(L, res), reply_markup: { inline_keyboard: [back] } };
  const users = res.data.users;
  if (!users.length) return { text: L.srv.noUsers, reply_markup: { inline_keyboard: [[btn(L.srv.btnAddUser, `sa:${srv.id}`)], back] } };
  const pages = Math.ceil(users.length / USERS_PAGE);
  page = Math.min(Math.max(0, page), pages - 1);
  const shown = users.slice(page * USERS_PAGE, (page + 1) * USERS_PAGE);
  const buttons = shown.filter((u) => fits(`u:${srv.id}:${u.name}`)).map((u) => btn(`${L.srv.icon(u.status)} ${u.name}`, `u:${srv.id}:${u.name}`));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  const nav = [];
  if (page > 0) nav.push(btn('⬅️', `su:${srv.id}:${page - 1}`));
  if (page < pages - 1) nav.push(btn('➡️', `su:${srv.id}:${page + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([btn(L.srv.btnAddUser, `sa:${srv.id}`)], back);
  return { text: L.srv.usersList(srv, shown, users.length, page + 1, pages), reply_markup: { inline_keyboard: rows } };
}

export function userView(srv, u, L, note = '') {
  const id = srv.id;
  const b = (text, prefix) => btn(text, `${prefix}:${id}:${u.name}`);
  const kb = [
    [b(L.srv.btnLinks, 'ul'), b(L.srv.btnLimits, 'ue')],
    [b(L.srv.btnRenew, 'ur'), u.status === 'disabled' ? b(L.srv.btnEnable, 'ut') : b(L.srv.btnDisable, 'ut')],
    [b(L.srv.btnResetUsage, 'uz'), b(L.srv.btnRotate, 'uk')],
    [b(L.srv.btnResetSub, 'us'), b(L.srv.btnDelete, 'ux')],
    [btn(L.srv.btnUsers, `su:${id}:0`)],
  ].map((row) => row.filter((x) => fits(x.callback_data)));
  return { text: (note ? `${note}\n\n` : '') + L.srv.userCard(u), reply_markup: { inline_keyboard: kb } };
}

export async function plansView(srv, L) {
  const back = [btn(L.btnBack, `s:${srv.id}`)];
  const res = await op(srv.link, { op: 'plans' });
  if (!res.ok) return { text: failText(L, res), reply_markup: { inline_keyboard: [back] } };
  const plans = res.data.plans ?? {};
  const names = Object.keys(plans).sort();
  const rows = names.map((n, i) => [btn(`🗑 ${n}`, `spd:${srv.id}:${i}`)]).filter((r) => fits(r[0].callback_data));
  rows.push([btn(L.srv.btnAddPlan, `spa:${srv.id}`)], back);
  return { text: L.srv.plansList(names.map((n) => ({ name: n, ...plans[n] }))), reply_markup: { inline_keyboard: rows } };
}

// The user's links as content: a QR code of the subscription link, then every share link.
export async function sendLinks(chatId, u, L) {
  if (u.sub) {
    const caption = L.srv.subCaption(u);
    const sent = u.sub.length <= 200 && await safeApi('sendPhoto', {
      chat_id: chatId, photo: new InputFile(qrPng(u.sub), 'sub.png', { type: 'image/png' }), caption,
      reply_markup: { inline_keyboard: [[{ text: L.btnPage, url: u.sub }]] },
    });
    if (!sent) await safeApi('sendMessage', { chat_id: chatId, text: caption, link_preview_options: { is_disabled: true } });
  }
  if (u.links?.length) {
    let text = L.srv.linksHeader(u.name);
    for (const l of u.links) {
      const line = `\n\n${l.Name ?? l.name}\n${l.URL ?? l.url}`;
      if (text.length + line.length > 4000) break;
      text += line;
    }
    await safeApi('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
  }
}

// --- the things a user button does ------------------------------------------------------

// → { screen?, toast?, alert? } for the callback handler.
export async function userAction(q, srv, action, name, L) {
  const chatId = q.from.id;
  const card = async (res, note) => {
    if (!res.ok) return { toast: failText(L, res), alert: true };
    return { screen: userView(srv, res.data, L, note) };
  };
  const confirm = (text, yes) => ({
    screen: {
      text,
      reply_markup: { inline_keyboard: [[btn(L.btnYes, `${yes}:${srv.id}:${name}`), btn(L.btnNo, `u:${srv.id}:${name}`)]] },
    },
  });
  switch (action) {
    case 'u':  return card(await op(srv.link, { op: 'user', name }));
    case 'ul': {
      const res = await op(srv.link, { op: 'user', name });
      if (!res.ok) return { toast: failText(L, res), alert: true };
      await sendLinks(chatId, res.data, L);
      return {};
    }
    case 'ue':
      await setState(chatId, 'srv_limit', { serverId: srv.id, name });
      return { screen: { text: L.srv.limitPrompt(name), reply_markup: withCancel(L) } };
    case 'ur': {
      const st = await op(srv.link, { op: 'status' });
      const plans = st.ok ? st.data.plans : [];
      if (!plans.length) return card(await op(srv.link, { op: 'renew', name }), L.srv.renewed);
      const rows = [[btn(L.srv.btnRenewSame, `urp:${srv.id}:-1:${name}`)],
        ...plans.map((p, i) => [btn(`📋 ${p}`, `urp:${srv.id}:${i}:${name}`)])].filter((r) => fits(r[0].callback_data));
      rows.push([btn(L.btnBack, `u:${srv.id}:${name}`)]);
      return { screen: { text: L.srv.renewWhich(name), reply_markup: { inline_keyboard: rows } } };
    }
    case 'ut': {
      const cur = await op(srv.link, { op: 'user', name });
      if (!cur.ok) return { toast: failText(L, cur), alert: true };
      const enable = cur.data.status === 'disabled';
      return card(await op(srv.link, { op: enable ? 'enable' : 'disable', name }), enable ? L.srv.enabled : L.srv.disabled);
    }
    case 'uz':  return card(await op(srv.link, { op: 'resetUsage', name }), L.srv.usageReset);
    case 'uk':  return confirm(L.srv.rotateConfirm(name), 'ukk');
    case 'ukk': return card(await op(srv.link, { op: 'rotate', name }), L.srv.rotated);
    case 'us':  return confirm(L.srv.resetSubConfirm(name), 'uss');
    case 'uss': return card(await op(srv.link, { op: 'resetSub', name }), L.srv.subReset);
    case 'ux':  return confirm(L.srv.deleteConfirm(name), 'uxx');
    case 'uxx': {
      const res = await op(srv.link, { op: 'delete', name });
      if (!res.ok) return { toast: failText(L, res), alert: true };
      return { screen: await usersView(srv, 0, L), toast: L.srv.deleted(name) };
    }
  }
  return {};
}

// urp:<id>:<plan index, -1 = the user's own terms>:<name>
export async function renewWithPlan(srv, idx, name, L) {
  let plan;
  if (idx >= 0) {
    const st = await op(srv.link, { op: 'status' });
    plan = st.ok ? st.data.plans[idx] : undefined;
  }
  const res = await op(srv.link, { op: 'renew', name, ...(plan && { plan }) });
  if (!res.ok) return { toast: failText(L, res), alert: true };
  return { screen: userView(srv, res.data, L, L.srv.renewed) };
}

export async function deletePlan(srv, idx, L) {
  const res = await op(srv.link, { op: 'plans' });
  const name = res.ok ? Object.keys(res.data.plans ?? {}).sort()[idx] : null;
  if (name) await op(srv.link, { op: 'delPlan', name });
  return { screen: await plansView(srv, L), toast: name ? L.srv.planDeleted(name) : undefined };
}

// --- typed input ---------------------------------------------------------------------------

// "50" → 50, "-" → undefined (keep), anything else → NaN.
const numOrKeep = (s) => (s === undefined || s === '-' ? undefined : /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN);

function parseLimits(words) {
  const [quotaGB, days, devices] = words.map(numOrKeep);
  if ([quotaGB, days, devices].some((n) => Number.isNaN(n))) return null;
  const out = {};
  if (quotaGB !== undefined) out.quotaGB = quotaGB;
  if (days !== undefined) out.days = Math.round(days);
  if (devices !== undefined) out.devices = Math.round(devices);
  return out;
}

// The message after ➕ Add user, ✏️ Limits or ➕ Add plan.
export async function onServerInput(msg, mode, data, L) {
  const chatId = msg.chat.id;
  await safeApi('deleteMessage', { chat_id: chatId, message_id: msg.message_id });
  const srv = await getServer(data.serverId);
  if (!srv || srv.ownerId !== msg.from.id) {
    await setState(msg.from.id, 'idle');
    return showScreen(chatId, { text: L.notYours });
  }
  const words = String(msg.text ?? '').trim().split(/\s+/).filter(Boolean);
  const again = (text) => showScreen(chatId, { text, reply_markup: withCancel(L) });
  let res;
  if (mode === 'srv_add') {
    if (!words.length || words.length > 4) return again(L.srv.addUserPrompt);
    const [name, ...rest] = words;
    const st = await op(srv.link, { op: 'status' });
    const plans = st.ok ? st.data.plans : [];
    let body;
    if (rest.length === 1 && plans.includes(rest[0])) body = { op: 'add', name, plan: rest[0] };
    else {
      const l = parseLimits(rest);
      if (!l) return again(L.srv.addUserPrompt);
      body = { op: 'add', name, ...l };
    }
    res = await op(srv.link, body);
    if (!res.ok) return again(`${failText(L, res)}\n\n${L.srv.addUserPrompt}`);
    await setState(msg.from.id, 'idle');
    await showScreen(chatId, userView(srv, res.data, L, L.srv.added(name)));
    return sendLinks(chatId, res.data, L);
  }
  if (mode === 'srv_limit') {
    const l = words.length >= 1 && words.length <= 3 ? parseLimits(words) : null;
    if (!l || !Object.keys(l).length) return again(L.srv.limitPrompt(data.name));
    res = await op(srv.link, { op: 'limit', name: data.name, ...l });
    if (!res.ok) return again(`${failText(L, res)}\n\n${L.srv.limitPrompt(data.name)}`);
    await setState(msg.from.id, 'idle');
    return showScreen(chatId, userView(srv, res.data, L, L.srv.limitsSaved));
  }
  if (mode === 'srv_plan') {
    const [name, ...rest] = words;
    const l = name && rest.length >= 1 && rest.length <= 3 ? parseLimits(rest) : null;
    if (!l) return again(L.srv.planPrompt);
    res = await op(srv.link, { op: 'setPlan', name, ...l });
    if (!res.ok) return again(`${failText(L, res)}\n\n${L.srv.planPrompt}`);
    await setState(msg.from.id, 'idle');
    return showScreen(chatId, await plansView(srv, L));
  }
}
