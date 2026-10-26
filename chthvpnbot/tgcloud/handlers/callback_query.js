// handlers/callback_query.js — inline buttons:
//   anyone:  directory page dir:<page>, card v:<id>:<page>, join j:<invite code>, report rp:<id> → rr:<id>:<reason>,
//            My VPNs joined, a membership my:<mid>, details again sh:<mid>, leave lv:<mid> → lvy:<mid>,
//            how to connect g:<id|0>[:<page>], prompt cancel c:x, language lang:<code>
//   adding:  add, name an:keep, country ac:<CC|none>, visibility av:pub|priv, no password ap:none
//   owners:  My servers mine, panel m:<id>, edit prompt me:<id>:<field>, remove description mdr:<id>,
//            country mc:<id> → mcs:<id>:<CC|none>, public/private mv:<id>, pause mp:<id>,
//            remove password mpr:<id>, check now mk:<id>, new invite mn:<id> → mny:<id>,
//            members mm:<id>:<page>, kick k:<mid> → ky:<mid>, delete md:<id> → mdy:<id>
//   servers: add srvadd, panel s:<id>, users su:<id>:<page>, add user sa:<id>, plans sp:<id> → add spa:<id>,
//            delete spd:<id>:<index>, remove from the bot sd:<id> → sdy:<id>; a user u:<id>:<name> and its
//            actions ul/ue/ur/ut/uz/uk→ukk/us→uss/ux→uxx:<id>:<name>, renew with a plan urp:<id>:<index>:<name>
//   admins:  under a report: unlist au:, delete ad:, ban owner ab:, dismiss ax:<reportId>

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { reports } from '../schema.js';
import { isAdmin, sendReport } from '../lib/admin.js';
import { closeScreen, drop, isScreen, setLocale, showScreen, textsFor, textsOf } from '../lib/chats.js';
import { checkVpn } from '../lib/check.js';
import {
  createFromDraft, onAddCountry, onAddName, onAddVisibility, openVpn, requestJoin, startAdd, startEdit,
} from '../lib/flows.js';
import { LOCALE_NAMES } from '../lib/i18n.js';
import {
  deletePlan, deleteServer, getServer, plansView, renewWithPlan, serverView, startAddServer, userAction, usersView,
} from '../lib/servers.js';
import { join, notifyMembers, removeMember, sendDetails } from '../lib/members.js';
import {
  addReport, banOwner, closeReports, deleteVpn, getMember, getReport, getState, getVpn, getVpnByCode, membership,
  newCode, ownedVpns, setState, updateVpn,
} from '../lib/store.js';
import { safeApi } from '../lib/util.js';
import {
  confirmView, countryView, directoryView, guideView, joinedView, manageView, memberView, membersView, ownedView,
  reportReasonsView, sendHome,
} from '../lib/views.js';

// A screen opened from a button: edits the button's message in place when that
// message is the open screen, otherwise opens a new screen.
async function openScreen(q, { text, reply_markup }) {
  if (q.message && await isScreen(q.from.id, q.message.message_id)) {
    const edited = await safeApi('editMessageText', {
      chat_id: q.message.chat.id, message_id: q.message.message_id, text,
      link_preview_options: { is_disabled: true }, ...(reply_markup && { reply_markup }),
    });
    if (edited) return edited;
  }
  return showScreen(q.from.id, { text, ...(reply_markup && { reply_markup }) });
}

const num = (s) => (/^\d+$/.test(s ?? '') ? Number(s) : null);

// --- owners ---------------------------------------------------------------------------

async function onOwner(q, op, vpn, arg, L) {
  const id = vpn.id;
  const panel = async (toast, v = vpn) => {
    await openScreen(q, await manageView(v, L));
    return toast ? { text: toast } : {};
  };
  switch (op) {
    case 'm':   return panel();
    case 'me': {
      if (!['name', 'desc', 'pass', 'source', 'announce'].includes(arg)) return {};
      const r = await startEdit(q.from, vpn, arg, L);
      return r.toast ? { text: r.toast, show_alert: true } : {};
    }
    case 'mdr':
      await setState(q.from.id, 'idle');
      await updateVpn(id, { description: null });
      return panel(L.saved, { ...vpn, description: null });
    case 'mc': {
      const v = countryView(`mcs:${id}`, L);
      v.reply_markup.inline_keyboard.push([{ text: L.btnBack, callback_data: `m:${id}` }]);
      await openScreen(q, v);
      return {};
    }
    case 'mcs': {
      const country = arg === 'none' ? null : arg;
      await updateVpn(id, { country });
      return panel(L.saved, { ...vpn, country });
    }
    case 'mv':
      await updateVpn(id, { public: !vpn.public });
      return panel(vpn.public ? L.nowPrivate : L.nowPublic, { ...vpn, public: !vpn.public });
    case 'mp':
      await updateVpn(id, { paused: !vpn.paused });
      return panel(vpn.paused ? L.resumed : L.paused, { ...vpn, paused: !vpn.paused });
    case 'mpr':
      await updateVpn(id, { password: null });
      return panel(L.passwordRemoved, { ...vpn, password: null });
    case 'mk': {
      const v = await checkVpn(vpn);
      return panel(v.status === 'ok' && !v.error ? L.checkOk : L.checkFailed(v.error), v);
    }
    case 'mn':
      await openScreen(q, confirmView(L.newLinkConfirm, `mny:${id}`, `m:${id}`, L));
      return {};
    case 'mny': {
      const code = await newCode(id);
      return panel(L.newLinkDone, { ...vpn, code });
    }
    case 'mm':
      await openScreen(q, await membersView(vpn, num(arg) ?? 0, L));
      return {};
    case 'md':
      await openScreen(q, confirmView(L.deleteConfirm(vpn), `mdy:${id}`, `m:${id}`, L));
      return {};
    case 'mdy':
      await notifyMembers(vpn, (ML) => ({ text: ML.vpnRemoved(vpn) }));
      await deleteVpn(id);
      await openScreen(q, await ownedView(q.from.id, L));
      return { text: L.deleted };
  }
  return {};
}

// k:<mid> / ky:<mid> — the owner kicks a member.
async function onKick(q, op, member, L) {
  const vpn = member && await getVpn(member.vpnId);
  if (!vpn || vpn.ownerId !== q.from.id) return { text: L.notYours };
  if (op === 'k') {
    await openScreen(q, confirmView(L.kickConfirm(member.label, vpn.kind), `ky:${member.id}`, `mm:${vpn.id}:0`, L));
    return {};
  }
  if (member.status === 'active') {
    await removeMember(vpn, member, 'kicked');
    const ML = await textsOf(member.userId);
    await safeApi('sendMessage', { chat_id: member.userId, text: ML.youWereKicked(vpn) });
  }
  await openScreen(q, await membersView(await getVpn(vpn.id), 0, L));
  return { text: L.kickedDone };
}

// --- members ---------------------------------------------------------------------------

async function onMember(q, op, member, L) {
  if (!member || member.userId !== q.from.id) return { text: L.notYours };
  const vpn = await getVpn(member.vpnId);
  if (!vpn) return { text: L.invalidLink };
  if (member.status !== 'active') return { text: L.notMember };
  switch (op) {
    case 'my':
      await openScreen(q, memberView(vpn, member, L));
      return {};
    case 'sh': {
      // xtune: asks the server again, which renews a member whose time ran out.
      const res = await join(vpn, q.from.id, member);
      if (!res.ok) return { text: L.joinError(res.error), show_alert: true };
      await sendDetails(q.from.id, vpn, res.member, L, res.details);
      return {};
    }
    case 'lv':
      await openScreen(q, confirmView(L.leaveConfirm(vpn), `lvy:${member.id}`, `my:${member.id}`, L));
      return {};
    case 'lvy':
      await removeMember(vpn, member, 'left');
      await openScreen(q, await joinedView(q.from.id, L));
      return { text: L.left(vpn) };
  }
  return {};
}

// --- admins -----------------------------------------------------------------------------

async function onAdmin(q, op, report, L) {
  if (!report) return { text: L.adminReportGone };
  const vpn = await getVpn(report.vpnId);
  const done = async (note) => {
    if (q.message) await safeApi('editMessageReplyMarkup', { chat_id: q.message.chat.id, message_id: q.message.message_id });
    if (q.message) await safeApi('sendMessage', { chat_id: q.from.id, text: note, reply_parameters: { message_id: q.message.message_id, allow_sending_without_reply: true } });
    return { text: note };
  };
  if (op === 'ax') {
    await db.update(reports).set({ status: 'done' }).where(eq(reports.id, report.id));
    return done(L.adminDismissed);
  }
  if (!vpn) return done(L.adminReportGone);
  const OL = await textsOf(vpn.ownerId);
  if (op === 'au') {
    await updateVpn(vpn.id, { unlisted: true });
    await closeReports(vpn.id);
    await safeApi('sendMessage', { chat_id: vpn.ownerId, text: OL.ownerUnlisted(vpn) });
    return done(L.adminUnlisted);
  }
  if (op === 'ad') {
    await notifyMembers(vpn, (ML) => ({ text: ML.vpnRemoved(vpn) }));
    await deleteVpn(vpn.id);
    await safeApi('sendMessage', { chat_id: vpn.ownerId, text: OL.ownerDeleted(vpn) });
    return done(L.adminDeleted);
  }
  if (op === 'ab') {
    for (const v of await ownedVpns(vpn.ownerId)) await notifyMembers(v, (ML) => ({ text: ML.vpnRemoved(v) }));
    const removed = await banOwner(vpn.ownerId);
    await safeApi('sendMessage', { chat_id: vpn.ownerId, text: OL.ownerBanned });
    return done(L.adminBannedOwner(removed.length));
  }
  return {};
}

// --- managed servers ----------------------------------------------------------------------

const SERVER_OPS = new Set(['s', 'su', 'sa', 'sp', 'spa', 'spd', 'sd', 'sdy']);
const USER_OPS = new Set(['u', 'ul', 'ue', 'ur', 'urp', 'ut', 'uz', 'uk', 'ukk', 'us', 'uss', 'ux', 'uxx']);

async function onServer(q, op, rest, L) {
  const srv = await getServer(num(rest[0]));
  if (!srv || srv.ownerId !== q.from.id) return { text: L.notYours };
  const show = async (r) => {
    if (r.screen) await openScreen(q, r.screen);
    return r.toast ? { text: r.toast, show_alert: !!r.alert } : {};
  };
  if (USER_OPS.has(op)) {
    if (op === 'urp') return show(await renewWithPlan(srv, Number(rest[1]), rest.slice(2).join(':'), L));
    return show(await userAction(q, srv, op, rest.slice(1).join(':'), L));
  }
  switch (op) {
    case 's':   return show({ screen: await serverView(srv, L) });
    case 'su':  return show({ screen: await usersView(srv, num(rest[1]) ?? 0, L) });
    case 'sa':
      await setState(q.from.id, 'srv_add', { serverId: srv.id });
      return show({ screen: { text: L.srv.addUserPrompt, reply_markup: { inline_keyboard: [[{ text: L.btnCancel, callback_data: 'c:x' }]] } } });
    case 'sp':  return show({ screen: await plansView(srv, L) });
    case 'spa':
      await setState(q.from.id, 'srv_plan', { serverId: srv.id });
      return show({ screen: { text: L.srv.planPrompt, reply_markup: { inline_keyboard: [[{ text: L.btnCancel, callback_data: 'c:x' }]] } } });
    case 'spd': return show(await deletePlan(srv, num(rest[1]) ?? -1, L));
    case 'sd':
      return show({ screen: confirmView(L.srv.removeConfirm(srv), `sdy:${srv.id}`, `s:${srv.id}`, L) });
    case 'sdy':
      await deleteServer(srv.id);
      return show({ screen: await ownedView(q.from.id, L), toast: L.srv.removed });
  }
  return {};
}

// --- routing ----------------------------------------------------------------------------

async function route(q, L) {
  const [op, a, b] = (q.data ?? '').split(':');
  const userId = q.from.id;
  if (SERVER_OPS.has(op) || USER_OPS.has(op)) return onServer(q, op, (q.data ?? '').split(':').slice(1), L);
  switch (op) {
    case 'srvadd':
      await startAddServer(q.from, L);
      return {};
    case 'lang': {
      await setLocale(userId, a);
      const NL = await textsFor(q.from);
      await sendHome(q.from, NL);
      return { text: NL.languageSet(LOCALE_NAMES[a] ?? a) };
    }
    case 'c':
      await setState(userId, 'idle');
      if (q.message && !(await isScreen(userId, q.message.message_id))) await drop(userId, q.message.message_id);
      await closeScreen(userId);
      return { text: L.cancelled };
    case 'dir':
      await openScreen(q, await directoryView(num(a) ?? 0, L));
      return {};
    case 'v': {
      const vpn = await getVpn(num(a));
      if (vpn && !vpn.public && vpn.ownerId !== userId) return { text: L.invalidLink };
      await openVpn(q.from, vpn, L, { from: num(b) ?? 0 });
      return {};
    }
    case 'j':
      await requestJoin(q.from, /^[A-Za-z0-9]{4,16}$/.test(a ?? '') ? await getVpnByCode(a) : null, L);
      return {};
    case 'rp':
      await openScreen(q, reportReasonsView(num(a), L));
      return {};
    case 'rr': {
      const vpn = await getVpn(num(a));
      if (!vpn || !['illegal', 'scam', 'dead'].includes(b)) return {};
      const report = await addReport(vpn.id, userId, b);
      await closeScreen(userId);
      if (!report) return { text: L.alreadyReported };
      await sendReport(report, vpn);
      return { text: L.reported };
    }
    case 'g': {
      // a private VPN's name and protocols only for its owner and members
      let vpn = num(a) ? await getVpn(num(a)) : null;
      if (vpn && !vpn.public && vpn.ownerId !== userId && (await membership(vpn.id, userId))?.status !== 'active') vpn = null;
      await openScreen(q, guideView(vpn, b ?? '', L));
      return {};
    }
    case 'joined':
      await openScreen(q, await joinedView(userId, L));
      return {};
    case 'my': case 'sh': case 'lv': case 'lvy':
      return onMember(q, op, await getMember(num(a)), L);
    case 'add':
      await startAdd(q.from, L);
      return {};
    case 'mine':
      await openScreen(q, await ownedView(userId, L));
      return {};
    case 'an': case 'ac': case 'av': case 'ap': {
      const { mode, data } = await getState(userId);
      const want = { an: 'add_name', ac: 'add_country', av: 'add_visibility', ap: 'add_password' }[op];
      if (mode !== want) return { text: L.expired };
      if (op === 'an') await onAddName(userId, userId, data, data.name, L);
      if (op === 'ac') await onAddCountry(userId, userId, data, a, L);
      if (op === 'av') await onAddVisibility(q.from, data, a === 'pub', L);
      if (op === 'ap') await createFromDraft(q.from, data, null, L);
      return {};
    }
    case 'k': case 'ky':
      return onKick(q, op, await getMember(num(a)), L);
    case 'au': case 'ad': case 'ab': case 'ax':
      if (!isAdmin(userId)) return {};
      return onAdmin(q, op, await getReport(num(a)), L);
  }
  if (op.startsWith('m')) {
    const vpn = await getVpn(num(a));
    if (!vpn || vpn.ownerId !== userId) return { text: L.notYours };
    return onOwner(q, op, vpn, b, L);
  }
  return {};
}

export default async function (q) {
  try {
    const L = await textsFor(q.from);
    const answer = await route(q, L);
    await safeApi('answerCallbackQuery', { callback_query_id: q.id, ...answer });
  } catch (e) {
    console.error('callback handler failed', e);
    await safeApi('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
  }
}
