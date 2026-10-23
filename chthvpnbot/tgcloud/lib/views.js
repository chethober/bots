// Screens: each returns { text, reply_markup } for showScreen / an in-place edit.
// `L` is the viewer's texts table.

import { DIR_PAGE, MEMBERS_PAGE, SOURCE_URL, XTUNE_URL } from './config.js';
import { mainKeyboard, showHome } from './chats.js';
import { COUNTRIES, flag } from './sources.js';
import { activeMembers, directory, joinedVpns, ownedVpns } from './store.js';
import { inviteLink } from './util.js';
import { poolInfo } from './xtune.js';

const btn = (text, data) => ({ text, callback_data: data });
const rows = (buttons, n) => {
  const out = [];
  for (let i = 0; i < buttons.length; i += n) out.push(buttons.slice(i, i + n));
  return out;
};
const pager = (prefix, page, pages) => {
  const row = [];
  if (page > 0) row.push(btn('⬅️', `${prefix}:${page - 1}`));
  if (page < pages - 1) row.push(btn('➡️', `${prefix}:${page + 1}`));
  return row.length ? [row] : [];
};

// A VPN as one line / button label: 🇩🇪 Name · 3/100 🔒
export function vpnLabel(v) {
  const slots = v.max > 0 ? `${v.active}/${v.max}` : `${v.active}`;
  return `${flag(v.country)} ${v.name} · 👥 ${slots}${v.password ? ' 🔒' : ''}`;
}

export function sendHome(from, L) {
  return showHome(from.id, { text: L.welcome(from.first_name), reply_markup: mainKeyboard(L) });
}

export async function directoryView(page, L) {
  const all = await directory();
  if (!all.length) {
    return { text: L.dirEmpty, reply_markup: { inline_keyboard: [[btn(L.kb.add, 'add')]] } };
  }
  const pages = Math.ceil(all.length / DIR_PAGE);
  page = Math.min(Math.max(0, page), pages - 1);
  const shown = all.slice(page * DIR_PAGE, (page + 1) * DIR_PAGE);
  return {
    text: L.dirTitle(all.length, page + 1, pages),
    reply_markup: { inline_keyboard: [...shown.map((v) => [btn(vpnLabel(v), `v:${v.id}:${page}`)]), ...pager('dir', page, pages)] },
  };
}

// A VPN's card, as anyone sees it. from: the directory page it was opened from, or null.
export function cardView(vpn, L, { from = null, member = null } = {}) {
  const kb = [];
  if (member) kb.push([btn(L.btnShow, `sh:${member.id}`)]);
  // The invite code, not the id: a private VPN must not be joinable by guessing ids.
  else kb.push([btn(vpn.password ? L.btnJoinPassword : L.btnJoin, `j:${vpn.code}`)]);
  kb.push([btn(L.btnReport, `rp:${vpn.id}`)]);
  if (from !== null) kb.push([btn(L.btnBack, `dir:${from}`)]);
  return { text: L.card(vpn), reply_markup: { inline_keyboard: kb } };
}

export async function joinedView(userId, L) {
  const list = await joinedVpns(userId);
  if (!list.length) return { text: L.joinedEmpty, reply_markup: { inline_keyboard: [[btn(L.kb.directory, 'dir:0')]] } };
  return {
    text: L.joinedTitle(list.length),
    reply_markup: { inline_keyboard: list.map(({ member, vpn }) => [btn(vpnLabel(vpn), `my:${member.id}`)]) },
  };
}

export function memberView(vpn, member, L) {
  return {
    text: L.memberCard(vpn),
    reply_markup: {
      inline_keyboard: [
        [btn(L.btnShow, `sh:${member.id}`)],
        [btn(L.btnLeave, `lv:${member.id}`), btn(L.btnReport, `rp:${vpn.id}`)],
        [btn(L.btnBack, 'joined')],
      ],
    },
  };
}

// --- owners ------------------------------------------------------------------------

export async function ownedView(ownerId, L) {
  const list = await ownedVpns(ownerId);
  const kb = list.map((v) => [btn(`${v.status === 'down' ? '⚠️ ' : ''}${vpnLabel(v)}`, `m:${v.id}`)]);
  kb.push([btn(L.btnAddVpn, 'add')]);
  return { text: list.length ? L.ownedTitle(list.length) : L.ownedEmpty, reply_markup: { inline_keyboard: kb } };
}

export async function manageView(vpn, L) {
  const id = vpn.id;
  const link = await inviteLink(vpn.code);
  const kb = [
    [btn(L.btnName, `me:${id}:name`), btn(L.btnDesc, `me:${id}:desc`)],
    [btn(L.btnCountry, `mc:${id}`), btn(vpn.public ? L.btnMakePrivate : L.btnMakePublic, `mv:${id}`)],
    [btn(vpn.password ? L.btnPasswordChange : L.btnPasswordSet, `me:${id}:pass`),
      ...(vpn.password ? [btn(L.btnPasswordRemove, `mpr:${id}`)] : [])],
    [btn(L.btnMembers, `mm:${id}:0`), btn(L.btnAnnounce, `me:${id}:announce`)],
    [btn(L.btnSource(vpn.kind), `me:${id}:source`), btn(L.btnCheck, `mk:${id}`)],
    [btn(vpn.paused ? L.btnResume : L.btnPause, `mp:${id}`), btn(L.btnNewLink, `mn:${id}`)],
    [btn(L.btnDelete, `md:${id}`)],
    [btn(L.btnBack, 'mine')],
  ];
  return { text: L.manage(vpn, link), reply_markup: { inline_keyboard: kb } };
}

export function countryView(prefix, L) {
  const buttons = COUNTRIES.map((c) => btn(`${flag(c)} ${c}`, `${prefix}:${c}`));
  return {
    text: L.chooseCountry,
    reply_markup: { inline_keyboard: [...rows(buttons, 4), [btn(L.btnNoCountry, `${prefix}:none`)]] },
  };
}

// 👥 Members: labels only. xtune pools add each member's usage and expiry from the server.
export async function membersView(vpn, page, L) {
  const list = await activeMembers(vpn.id);
  const back = [btn(L.btnBack, `m:${vpn.id}`)];
  if (!list.length) return { text: L.membersEmpty(vpn), reply_markup: { inline_keyboard: [back] } };
  let usage = new Map();
  if (vpn.kind === 'xtune') {
    const res = await poolInfo(vpn.source);
    if (res.ok) usage = new Map(res.data.members.map((m) => [m.label, m]));
  }
  const pages = Math.ceil(list.length / MEMBERS_PAGE);
  page = Math.min(Math.max(0, page), pages - 1);
  const shown = list.slice(page * MEMBERS_PAGE, (page + 1) * MEMBERS_PAGE);
  return {
    text: L.membersList(vpn, shown.map((m) => ({ ...m, usage: usage.get(m.label) })), list.length, vpn.kind),
    reply_markup: {
      inline_keyboard: [
        ...rows(shown.map((m) => btn(`🚫 #${m.label}`, `k:${m.id}`)), 3),
        ...pager(`mm:${vpn.id}`, page, pages),
        back,
      ],
    },
  };
}

export function confirmView(text, yes, no, L) {
  return { text, reply_markup: { inline_keyboard: [[btn(L.btnYes, yes), btn(L.btnNo, no)]] } };
}

export function aboutView(L) {
  return {
    text: L.about,
    reply_markup: { inline_keyboard: [[{ text: L.btnXtune, url: XTUNE_URL }], [{ text: L.btnSourceCode, url: SOURCE_URL }]] },
  };
}

export function reportReasonsView(vpnId, L) {
  return {
    text: L.reportWhy,
    reply_markup: {
      inline_keyboard: [
        ...['illegal', 'scam', 'dead'].map((r) => [btn(L.reasons[r], `rr:${vpnId}:${r}`)]),
        [btn(L.btnCancel, 'c:x')],
      ],
    },
  };
}
