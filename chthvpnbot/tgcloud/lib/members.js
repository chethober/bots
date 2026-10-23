// Joining, getting the connection details again, leaving and being kicked.
// xtune VPNs give every member their own user on the server (through the
// connect link); subscription and share-link VPNs give everyone the same thing.

import { InputFile } from 'sdk';
import { textsOf } from './chats.js';
import { qrPng } from './qr.js';
import { activeMembers, countActive, freshLabel, saveMember, setMemberStatus, updateVpn } from './store.js';
import { safeApi } from './util.js';
import { joinPool, leavePool } from './xtune.js';

// → { ok: true, member, details } | { ok: false, error: 'full' | 'paused' | 'gone' | 'busy' | 'unreachable' }
// `existing` is the person's earlier row for this VPN (left, or active and asking again).
export async function join(vpn, userId, existing = null) {
  if (vpn.kind !== 'xtune') {
    const member = await saveMember(vpn.id, userId, existing?.label ?? await freshLabel(vpn.id), null);
    await updateVpn(vpn.id, { active: await countActive(vpn.id) });
    return { ok: true, member };
  }
  // Joining again with the same label returns the same user, so a retry is safe.
  // A member whose time ran out gets a fresh user instead.
  let label = existing?.label ?? await freshLabel(vpn.id);
  let res = await joinPool(vpn.source, label);
  if (res.ok && res.data.status !== 'active' && existing) {
    await leavePool(vpn.source, label);
    label = await freshLabel(vpn.id);
    res = await joinPool(vpn.source, label);
  }
  if (!res.ok) return res;
  const member = await saveMember(vpn.id, userId, label, res.data.sub);
  if (!existing || existing.status !== 'active') await updateVpn(vpn.id, { active: vpn.active + 1 });
  return { ok: true, member, details: res.data };
}

// Sends the connection details as content (kept in the chat): xtune and
// subscription VPNs as a QR code of the link, share links as text.
export async function sendDetails(chatId, vpn, member, L, details = null) {
  const leave = { inline_keyboard: [[{ text: L.btnLeave, callback_data: `lv:${member.id}` }]] };
  if (vpn.kind === 'links') {
    return safeApi('sendMessage', {
      chat_id: chatId, text: L.detailsLinks(vpn, vpn.source), reply_markup: leave,
      link_preview_options: { is_disabled: true },
    });
  }
  const link = vpn.kind === 'xtune' ? member.sub : vpn.source;
  const buttons = vpn.kind === 'xtune'
    ? { inline_keyboard: [[{ text: L.btnPage, url: link }], ...leave.inline_keyboard] }
    : leave;
  const caption = vpn.kind === 'xtune' ? L.detailsXtune(vpn, link, details) : L.detailsSub(vpn, link);
  if (link.length <= 200) {
    const sent = await safeApi('sendPhoto', {
      chat_id: chatId, photo: new InputFile(qrPng(link), 'vpn.png', { type: 'image/png' }), caption, reply_markup: buttons,
    });
    if (sent) return sent;
  }
  return safeApi('sendMessage', { chat_id: chatId, text: caption, reply_markup: buttons, link_preview_options: { is_disabled: true } });
}

// The member leaves, or is kicked (status 'kicked': they can't join this VPN again).
// On an xtune server their user is removed; with shared links they keep what they copied.
export async function removeMember(vpn, member, status = 'left') {
  if (vpn.kind === 'xtune' && member.status === 'active') {
    const res = await leavePool(vpn.source, member.label);
    if (!res.ok) console.warn(`leave ${vpn.id}/${member.label}: ${res.error}`);
  }
  await setMemberStatus(member.id, status);
  if (member.status === 'active') await updateVpn(vpn.id, { active: Math.max(0, vpn.active - 1) });
}

// Sends every active member a message, in their own language: text(L, member) →
// { text, reply_markup? }. Returns how many got it.
export async function notifyMembers(vpn, text) {
  let sent = 0;
  for (const m of await activeMembers(vpn.id)) {
    const L = await textsOf(m.userId);
    const { text: body, reply_markup } = text(L, m);
    if (await safeApi('sendMessage', { chat_id: m.userId, text: body, ...(reply_markup && { reply_markup }) })) sent++;
  }
  return sent;
}
