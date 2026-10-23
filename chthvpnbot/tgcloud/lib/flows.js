// The multi-step flows both handlers drive: opening an invite, joining (with a
// password), adding a VPN, the owner's edits and announcements.

import { ANNOUNCE_EVERY_SEC, DESC_MAX, MAX_VPNS_PER_OWNER, NAME_MAX, PASSWORD_MAX } from './config.js';
import { cancelRow, closeScreen, drop, showScreen } from './chats.js';
import { probe } from './check.js';
import { checkPassword, hashPassword } from './hash.js';
import { join, notifyMembers, sendDetails } from './members.js';
import { detectSource } from './sources.js';
import {
  clearTries, countOwned, createVpn, findBySource, getVpn, isBanned, lockedFor, membership, setState, updateVpn,
  wrongPassword,
} from './store.js';
import { inviteLink, now, randomBytes, safeApi } from './util.js';
import { cardView, countryView, manageView } from './views.js';

const withCancel = (L, kb = []) => ({ reply_markup: { inline_keyboard: [...kb, cancelRow(L)] } });
const prompt = (chatId, text, L, kb) => showScreen(chatId, { text, ...withCancel(L, kb) });

// --- opening and joining -------------------------------------------------------------

// t.me/<bot>?start=<code>: the VPN's card (the owner gets their panel).
export async function openVpn(from, vpn, L, opts = {}) {
  if (!vpn) return showScreen(from.id, { text: L.invalidLink });
  if (vpn.ownerId === from.id) return showScreen(from.id, await manageView(vpn, L));
  const m = await membership(vpn.id, from.id);
  return showScreen(from.id, cardView(vpn, L, { ...opts, member: m?.status === 'active' ? m : null }));
}

// 🔑 Join: checks, then the password prompt or the join itself.
export async function requestJoin(from, vpn, L) {
  const chatId = from.id;
  if (!vpn) return showScreen(chatId, { text: L.invalidLink });
  if (vpn.ownerId === from.id) return showScreen(chatId, { text: L.ownVpn });
  const existing = await membership(vpn.id, from.id);
  if (existing?.status === 'kicked') return showScreen(chatId, { text: L.kicked(vpn) });
  if (existing?.status === 'active') return doJoin(from, vpn, L, existing);
  if (vpn.paused || vpn.status === 'down') return showScreen(chatId, { text: L.unavailable(vpn) });
  if (vpn.max > 0 && vpn.active >= vpn.max) return showScreen(chatId, { text: L.joinError('full') });
  if (vpn.password) {
    const wait = await lockedFor(vpn.id, from.id);
    if (wait) return showScreen(chatId, { text: L.locked(Math.ceil(wait / 60)) });
    await setState(from.id, 'password', { vpnId: vpn.id });
    return prompt(chatId, L.passwordPrompt(vpn), L);
  }
  return doJoin(from, vpn, L, existing);
}

async function doJoin(from, vpn, L, existing) {
  const res = await join(vpn, from.id, existing);
  if (!res.ok) return showScreen(from.id, { text: L.joinError(res.error) });
  await closeScreen(from.id);
  if (!existing || existing.status !== 'active') await safeApi('sendMessage', { chat_id: from.id, text: L.joined(vpn) });
  return sendDetails(from.id, vpn, res.member, L, res.details);
}

// The message after the password prompt. It is deleted at once.
export async function onPassword(msg, data, L) {
  const chatId = msg.chat.id;
  await drop(chatId, msg.message_id);
  const vpn = await getVpn(data.vpnId);
  if (!vpn?.password) {
    await setState(msg.from.id, 'idle');
    return requestJoin(msg.from, vpn, L);
  }
  const wait = await lockedFor(vpn.id, msg.from.id);
  if (wait) {
    await setState(msg.from.id, 'idle');
    return showScreen(chatId, { text: L.locked(Math.ceil(wait / 60)) });
  }
  if (!checkPassword(String(msg.text ?? ''), vpn.password)) {
    const left = await wrongPassword(vpn.id, msg.from.id);
    if (left <= 0) {
      await setState(msg.from.id, 'idle');
      return showScreen(chatId, { text: L.locked(60) });
    }
    return prompt(chatId, L.wrongPassword(left), L);
  }
  await clearTries(vpn.id, msg.from.id);
  await setState(msg.from.id, 'idle');
  return doJoin(msg.from, vpn, L, await membership(vpn.id, msg.from.id));
}

// --- adding a VPN: source → name → country → public/private → (password) ------------

export async function startAdd(from, L) {
  if (await isBanned(from.id)) return showScreen(from.id, { text: L.bannedOwner });
  if (await countOwned(from.id) >= MAX_VPNS_PER_OWNER) return showScreen(from.id, { text: L.tooManyVpns(MAX_VPNS_PER_OWNER) });
  await setState(from.id, 'add_source');
  return prompt(from.id, L.addSource, L);
}

// What the owner sent: recognised, checked, and kept in the draft. Errors keep the prompt open.
async function readSource(msg, L, kind = null) {
  const found = detectSource(msg.text);
  if (found.error === 'port') return { error: L.portBlocked(found.port, found.xtune) };
  if (found.error) return { error: L.sourceError(found.error) };
  if (kind && found.kind !== kind) return { error: L.sourceKindChanged(kind) };
  const dup = await findBySource(found.source);
  if (dup) return { error: L.alreadyAdded };
  await showScreen(msg.chat.id, { text: L.checking });
  const res = await probe(found.kind, found.source);
  if (!res.ok) return { error: L.sourceFailed(found.kind, res.error) };
  return { kind: found.kind, source: found.source, fields: res.fields, name: res.name };
}

export async function onAddSource(msg, L) {
  await drop(msg.chat.id, msg.message_id); // it may be a secret link
  const src = await readSource(msg, L);
  if (src.error) return prompt(msg.chat.id, src.error, L);
  await setState(msg.from.id, 'add_name', src);
  const keep = src.name ? [[{ text: L.btnUseName(src.name), callback_data: 'an:keep' }]] : [];
  return prompt(msg.chat.id, L.addName(src.kind, NAME_MAX), L, keep);
}

const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// The name, typed or (an:keep) the xtune pool's own.
export async function onAddName(chatId, userId, data, raw, L) {
  const name = cleanName(raw);
  if (!name || [...name].length > NAME_MAX) return prompt(chatId, L.nameBad(NAME_MAX), L);
  await setState(userId, 'add_country', { ...data, name });
  const v = countryView('ac', L);
  return showScreen(chatId, { text: v.text, reply_markup: { inline_keyboard: [...v.reply_markup.inline_keyboard, cancelRow(L)] } });
}

export async function onAddCountry(chatId, userId, data, code, L) {
  await setState(userId, 'add_visibility', { ...data, country: code === 'none' ? null : code });
  return showScreen(chatId, {
    text: L.addVisibility,
    reply_markup: {
      inline_keyboard: [
        [{ text: L.btnPublic, callback_data: 'av:pub' }],
        [{ text: L.btnPrivate, callback_data: 'av:priv' }],
        cancelRow(L),
      ],
    },
  });
}

export async function onAddVisibility(from, data, isPublic, L) {
  if (isPublic) return createFromDraft(from, { ...data, public: true }, null, L);
  await setState(from.id, 'add_password', { ...data, public: false });
  return prompt(from.id, L.addPassword(PASSWORD_MAX), L, [[{ text: L.btnNoPassword, callback_data: 'ap:none' }]]);
}

const hashed = (pw) => hashPassword(pw, randomBytes(16));

export async function onAddPassword(msg, data, L) {
  await drop(msg.chat.id, msg.message_id);
  const pw = String(msg.text ?? '');
  if (!pw || [...pw].length > PASSWORD_MAX) return prompt(msg.chat.id, L.passwordBad(PASSWORD_MAX), L);
  return createFromDraft(msg.from, data, pw, L);
}

export async function createFromDraft(from, data, password, L) {
  await setState(from.id, 'idle');
  if (await countOwned(from.id) >= MAX_VPNS_PER_OWNER) return showScreen(from.id, { text: L.tooManyVpns(MAX_VPNS_PER_OWNER) });
  if (!data?.source) return showScreen(from.id, { text: L.expired });
  const vpn = await createVpn({
    ownerId: from.id, kind: data.kind, source: data.source, name: data.name, country: data.country ?? null,
    public: !!data.public, password: password ? hashed(password) : null, ...data.fields,
  });
  await closeScreen(from.id);
  await safeApi('sendMessage', {
    chat_id: from.id, text: L.added(vpn, await inviteLink(vpn.code)), link_preview_options: { is_disabled: true },
  });
  return showScreen(from.id, await manageView(vpn, L));
}

// --- owner edits ---------------------------------------------------------------------

// me:<id>:<field> opened one of these prompts (state edit_<field>, data { vpnId }).
export async function startEdit(from, vpn, field, L) {
  if (field === 'announce' && now() - vpn.announcedAt < ANNOUNCE_EVERY_SEC) {
    return { toast: L.announceWait(Math.ceil((vpn.announcedAt + ANNOUNCE_EVERY_SEC - now()) / 60)) };
  }
  await setState(from.id, `edit_${field}`, { vpnId: vpn.id });
  const extra = field === 'desc' && vpn.description
    ? [[{ text: L.btnDescRemove, callback_data: `mdr:${vpn.id}` }]] : [];
  const text = {
    name: L.editName(vpn, NAME_MAX), desc: L.editDesc(vpn, DESC_MAX), pass: L.editPassword(PASSWORD_MAX),
    source: L.editSource(vpn.kind), announce: L.announcePrompt(vpn),
  }[field];
  await prompt(from.id, text, L, extra);
  return {};
}

const back = (vpn, L) => ({ inline_keyboard: [[{ text: L.btnBack, callback_data: `m:${vpn.id}` }]] });

// The message after an edit prompt. Errors keep the prompt open.
export async function onEdit(msg, mode, data, L) {
  const chatId = msg.chat.id;
  const vpn = await getVpn(data.vpnId);
  if (!vpn || vpn.ownerId !== msg.from.id) {
    await setState(msg.from.id, 'idle');
    return showScreen(chatId, { text: L.notYours });
  }
  const field = mode.slice('edit_'.length);
  if (field !== 'announce') await drop(chatId, msg.message_id);
  const text = msg.text;
  if (text === undefined) return prompt(chatId, L.textOnly, L);
  const done = async (set, note) => {
    if (set) await updateVpn(vpn.id, set);
    await setState(msg.from.id, 'idle');
    const v = await manageView({ ...vpn, ...set }, L);
    return showScreen(chatId, { ...v, text: `${note}\n\n${v.text}` });
  };
  switch (field) {
    case 'name': {
      const name = cleanName(text);
      if (!name || [...name].length > NAME_MAX) return prompt(chatId, L.nameBad(NAME_MAX), L);
      return done({ name }, L.saved);
    }
    case 'desc': {
      const description = text.trim();
      if ([...description].length > DESC_MAX) return prompt(chatId, L.descBad(DESC_MAX), L);
      return done({ description: description || null }, L.saved);
    }
    case 'pass': {
      if (!text || [...text].length > PASSWORD_MAX) return prompt(chatId, L.passwordBad(PASSWORD_MAX), L);
      return done({ password: hashed(text) }, L.passwordSaved);
    }
    case 'source': {
      const src = await readSource(msg, L, vpn.kind);
      if (src.error) return prompt(chatId, src.error, L);
      await done({ source: src.source, ...src.fields, status: 'ok', fails: 0, checkedAt: now() }, L.sourceSaved);
      // xtune members keep their own users; everyone else gets the new links.
      if (vpn.kind !== 'xtune') {
        await notifyMembers(vpn, (ML, m) => ({
          text: ML.vpnUpdated(vpn),
          reply_markup: { inline_keyboard: [[{ text: ML.btnShow, callback_data: `sh:${m.id}` }]] },
        }));
      }
      return;
    }
    case 'announce': {
      const body = text.trim().slice(0, 3500);
      await updateVpn(vpn.id, { announcedAt: now() });
      await setState(msg.from.id, 'idle');
      const sent = await notifyMembers(vpn, (ML) => ({ text: ML.announcement(vpn, body) }));
      return showScreen(chatId, { text: L.announced(sent), reply_markup: back(vpn, L) });
    }
  }
}
