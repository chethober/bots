// Every user-facing string, per locale: texts(locale) → the table for it.
// Each language gives its words (en, fa, ar, ru, es below, one for one); the
// screens built from several of them (a VPN's card, the owner's panel, the
// connection details) are composed once, in compose(). Admin-only screens are
// English. Messages are sent as plain text (no parse_mode), so no escaping.
//
// `v` arguments are rows of the vpns table.

import { GUIDE_DEVICES, GUIDE_OWN_APPS } from './guide.js';
import { flag } from './sources.js';

export const DEFAULT_LOCALE = 'en';

const DIGITS = { fa: '۰۱۲۳۴۵۶۷۸۹', ar: '٠١٢٣٤٥٦٧٨٩' };

function compose(locale, w) {
  const num = (n) => (DIGITS[locale] ? String(n).replace(/\d/g, (d) => DIGITS[locale][d]) : String(n));
  const ago = (ts) => {
    const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
    if (s < 60) return w.now;
    if (s < 3600) return w.minutes(num(Math.floor(s / 60)));
    if (s < 86400) return w.hours(num(Math.floor(s / 3600)));
    return w.days(num(Math.floor(s / 86400)));
  };
  const gb = (bytes) => num((bytes / (1 << 30)).toFixed(bytes < (1 << 30) * 10 ? 1 : 0));
  const title = (v) => `${flag(v.country)} ${v.name}`;
  const protocols = (v) => (v.protocols?.length ? v.protocols.join(' · ') : w.unknown);
  const members = (v) => (v.max > 0 ? w.membersOf(num(v.active), num(v.max)) : w.membersCount(num(v.active)));
  const limits = (v) => w.limits(v.quotaGb > 0 ? w.gb(num(v.quotaGb)) : w.unlimited, v.days > 0 ? w.daysN(num(v.days)) : w.noExpiry);
  const status = (v) => (v.kind === 'links' ? w.notChecked : v.status === 'down' ? w.downNote : w.reachable(ago(v.checkedAt)));
  const expiry = (ts) => (ts > 0 ? w.expiresIn(num(Math.max(0, Math.ceil((ts - Date.now() / 1000) / 86400)))) : w.noExpiry);

  return {
    ...w, locale, num,
    srv: composeSrv(locale, SRV[locale], num, ago),
    guide: composeGuide(num, GUIDE[locale]),

    card: (v) => [
      title(v),
      v.description ? `\n${v.description}` : null,
      '',
      w.kinds[v.kind],
      `🔌 ${protocols(v)}`,
      `👥 ${members(v)}`,
      v.kind === 'xtune' ? `📦 ${limits(v)}` : null,
      v.password ? `🔒 ${w.passwordNeeded}` : null,
      status(v),
      v.kind === 'xtune' ? `\n${w.xtuneNote}` : `\n${w.sharedNote}`,
    ].filter((l) => l !== null).join('\n'),

    memberCard: (v) => [title(v), '', w.kinds[v.kind], `🔌 ${protocols(v)}`, status(v)].join('\n'),

    manage: (v, link) => [
      `🛠 ${title(v)}`,
      `${v.public ? w.isPublic : w.isPrivate} · ${w.kinds[v.kind]}`,
      v.paused ? `⏸ ${w.pausedNote}` : null,
      v.unlisted ? `🚫 ${w.unlistedNote}` : null,
      v.status === 'down' ? w.downNote : null,
      '',
      `👥 ${members(v)}`,
      v.kind === 'xtune' ? `📦 ${limits(v)}` : null,
      `🔌 ${protocols(v)}`,
      `🔒 ${v.password ? w.passwordOn : w.passwordOff}`,
      v.description ? `📝 ${v.description}` : null,
      '',
      w.inviteLink,
      link,
    ].filter((l) => l !== null).join('\n'),

    membersList: (v, shown, total, kind) => [
      w.membersHeader(title(v), num(total)),
      '',
      ...shown.map((m) => {
        const u = m.usage;
        if (kind !== 'xtune' || !u) return `#${m.label} · ${w.joinedAgo(ago(m.joinedAt))}`;
        const quota = u.quota > 0 ? `${gb(u.used)}/${gb(u.quota)} GB` : `${gb(u.used)} GB`;
        return `#${m.label} · ${quota} · ${expiry(u.expires)}${u.status !== 'active' ? ` · ${w.memberInactive}` : ''}`;
      }),
      '',
      kind === 'xtune' ? w.kickHintXtune : w.kickHintShared,
    ].join('\n'),

    detailsXtune: (v, link, d) => [
      `✅ ${title(v)}`,
      '',
      w.yourLink,
      link,
      '',
      d ? `📦 ${d.quota > 0 ? w.gb(gb(d.quota)) : w.unlimited} · ${expiry(d.expires)}` : null,
      w.importHint,
    ].filter((l) => l !== null).join('\n'),

    detailsSub: (v, link) => [`✅ ${title(v)}`, '', w.sharedLink, link, '', w.importHint].join('\n'),

    detailsLinks: (v, links) => [`✅ ${title(v)}`, '', w.sharedLinks, '', links, '', w.importHintLinks].join('\n'),

    dirTitle: (n, page, pages) => w.dirTitle(num(n)) + (pages > 1 ? ` (${num(page)}/${num(pages)})` : ''),
    joinError: (e) => w.joinErrors[e] ?? w.joinErrors.unreachable,
    sourceFailed: (kind, e) => `${w.sourceFailedKind[kind]}\n\n${w.errors[e] ?? w.errors.unreachable}`,
    vpnDown: (v, e) => w.vpnDown(title(v), w.errors[e] ?? w.errors.unreachable),
    vpnBack: (v) => w.vpnBack(title(v)),
    checkFailed: (e) => w.checkFailed(w.errors[e] ?? w.errors.unreachable),
    announcement: (v, body) => `📢 ${title(v)}\n\n${body}`,

    // Admins (English only)
    btnUnlist: '🙈 Unlist', btnBanOwner: '⛔ Ban owner', btnDismiss: '✔️ Dismiss',
    adminReport: (r, v) =>
      `🚩 Report #${r.id}: ${r.reason}\n\nVPN #${v.id} ${title(v)} (${v.kind}, ${v.public ? 'public' : 'private'})\n` +
      `👥 ${v.active}${v.max ? `/${v.max}` : ''} · ${v.status}${v.unlisted ? ' · unlisted' : ''}\n` +
      (v.description ? `📝 ${v.description}\n` : '') + (v.kind === 'links' ? '' : `🔗 ${v.kind === 'sub' ? v.source : '(xtune connect link)'}`),
    adminNoReports: 'No open reports.',
    adminStats: (s) =>
      `🛠 Community VPN\n\nVPNs: ${s.all} (${s.listed} listed) by ${s.owners} owners\nActive memberships: ${s.joined}\n` +
      `Open reports: ${s.open}\nBanned owners: ${s.banned}`,
    adminReportGone: 'That report or VPN is gone.',
    adminDismissed: 'Dismissed.', adminUnlisted: 'Unlisted.', adminDeleted: 'Deleted.',
    adminBannedOwner: (n) => `Owner banned; ${n} VPN(s) deleted.`,
  };
}

// ----------------------------------------------------------------------------- en
const en = {
  profile: {
    description:
      'Community VPN 🌍\n\nFree VPNs shared by the people who run them. Browse the directory or open an invite, ' +
      'join, and get the connection details. Owners never see who you are.\n\n' +
      'Run a server? Share it publicly or by private invite, with an optional password. ' +
      'Works best with xtune: every member gets their own account.\n\nOpen source.',
    shortDescription: 'Free VPNs shared by their owners. Join one, or share yours. Works best with xtune. Open source.',
  },
  kb: { directory: '🌍 Directory', joined: '📂 My VPNs', add: '➕ Add VPN', mine: '🛠 My servers', language: '🌐 Language', about: 'ℹ️ About' },

  welcome: (name) =>
    `Hi${name ? ` ${name}` : ''}! 👋 Find a VPN shared by the community, or share your own.\n\n` +
    '🌍 Directory: public VPNs\n📂 My VPNs: the ones you joined\n➕ Add VPN: share yours, publicly or by private invite\n' +
    '🛠 My servers: manage what you shared\n\n' +
    '⭐ Running your own server? xtune finds the configs that get through your network and gives every member their own account (ℹ️ About).',
  help: 'Use the buttons below 👇',
  chooseLanguage: 'Choose your language:',
  languageSet: (n) => `Language: ${n}`,
  about:
    '🌍 Community VPN\n\nA directory of VPNs shared by their owners. Join one to get its connection details. ' +
    'Owners never see who you are, and you never see who they are.\n\n' +
    '⭐ Works best with xtune. Owners who run their server with xtune share it as a public profile, and every member ' +
    'gets their own account with its own limits, so one member can be removed without affecting anyone else:\n' +
    'xtune public add community --quota 20 --days 30 --members 100\nthen send the connect link to ➕ Add VPN.\n\n' +
    '🔒 Privacy: the bot keeps your Telegram id and language, the VPNs you joined or added, and a random label per ' +
    'membership. Owners see only labels; an xtune server gets only the label. Passwords are stored hashed. For a server you manage here, its management link is stored so the bot can reach it.\n\n' +
    '⚠️ The bot checks that servers answer, not that they work on your network. Use VPNs you trust: a server\'s owner ' +
    'can see traffic that isn\'t otherwise encrypted.',
  btnXtune: '⭐ xtune on GitHub',

  now: 'just now', minutes: (n) => `${n} min ago`, hours: (n) => `${n} h ago`, days: (n) => `${n} days ago`,
  unknown: 'unknown',
  membersOf: (a, m) => `${a} of ${m} members`, membersCount: (a) => `${a} members`,
  limits: (q, d) => `per member: ${q}, ${d}`, gb: (n) => `${n} GB`, unlimited: 'unlimited', daysN: (n) => `${n} days`,
  noExpiry: 'no expiry', expiresIn: (n) => `${n} days left`,
  kinds: { xtune: '⭐ xtune: your own account', sub: '📡 Subscription link', links: '🔗 Share links' },
  passwordNeeded: 'needs a password',
  notChecked: '❔ Not checked automatically (share links)',
  reachable: (t) => `✅ Server answers (checked ${t})`,
  downNote: '⚠️ Not answering: hidden from the directory',
  xtuneNote: 'You get your own account on this server. The owner sees only a random label, not who you are.',
  sharedNote: 'Everyone gets the same connection details. The owner never sees who you are.',

  dirEmpty: 'No public VPNs yet. Be the first: ➕ Add VPN.',
  dirTitle: (n) => `🌍 Public VPNs: ${n}`,
  btnJoin: '🔑 Join', btnJoinPassword: '🔑 Join (password)', btnShow: '📋 Connection details',
  btnReport: '🚩 Report', btnBack: '⬅️ Back', btnCancel: '✖️ Cancel', btnYes: '✅ Yes', btnNo: '✖️ No',
  btnLeave: '🚪 Leave', btnPage: '🌐 Usage page', btnManage: '🛠 Manage',
  cancelled: 'Cancelled.',
  expired: 'That took too long, so it was cancelled. Start again from the buttons below.',

  invalidLink: 'This invite doesn\'t exist anymore. Ask for a new one.',
  ownVpn: 'That\'s your own VPN 🙂 Share its invite link with others.',
  kicked: (v) => `The owner of ${v.name} removed you, so you can\'t join it again.`,
  unavailable: (v) => `${v.name} isn\'t taking new members right now. Try again later.`,
  locked: (m) => `Too many wrong passwords. Try again in ${m} min.`,
  passwordPrompt: (v) => `🔒 ${v.name} needs a password. Send it now (your message is deleted at once).`,
  wrongPassword: (n) => `Wrong password. ${n} tries left.`,
  joined: (v) => `🎉 You joined ${v.name}. Your connection details are below; they stay in 📂 My VPNs too.`,
  joinErrors: {
    full: '😕 This VPN is full. Try again later or pick another one.',
    paused: '⏸ This VPN isn\'t taking new members right now.',
    gone: 'This VPN doesn\'t exist on its server anymore. The owner has to update it.',
    busy: 'Many people are joining right now. Try again in a minute.',
    unreachable: 'The server didn\'t answer. Try again later.',
  },
  yourLink: '🔗 Your own subscription link (don\'t share it):',
  sharedLink: '🔗 Subscription link:',
  sharedLinks: '🔗 Connection links:',
  importHint: 'Add it in your app (v2rayNG, Hiddify, Streisand, NekoBox…) as a subscription, or scan the QR code.',
  importHintLinks: 'Copy them into your app (v2rayNG, Hiddify, Streisand, NekoBox…).',

  joinedEmpty: 'You haven\'t joined any VPN yet. Find one in 🌍 Directory, or open an invite link.',
  joinedTitle: (n) => `📂 Your VPNs: ${n}`,
  notMember: 'You\'re not a member anymore.',
  leaveConfirm: (v) => `Leave ${v.name}? ${v.kind === 'xtune' ? 'Your account on the server is removed.' : ''}`,
  left: (v) => `You left ${v.name}.`,
  notYours: 'That\'s not yours.',

  reportWhy: 'What\'s wrong with this VPN?',
  reasons: { illegal: '⚖️ Illegal use', scam: '💸 Scam or selling', dead: '💀 Doesn\'t work' },
  reported: 'Thanks, the admins will look at it.', alreadyReported: 'You already reported it.',

  bannedOwner: 'You can\'t add VPNs anymore.',
  tooManyVpns: (n) => `You already have ${n} VPNs, the most allowed. Delete one first.`,
  addSource:
    '➕ Send what members should get:\n\n' +
    '⭐ an xtune connect link (xtune public add NAME on your server): every member gets their own account\n' +
    '📡 a subscription URL (https://…)\n🔗 or share links (vless://, hysteria2://, ss://, …), one per line\n\n' +
    'Your message is deleted right away. Don\'t have a server yet? xtune sets one up: ℹ️ About.',
  sourceError: (e) => ({
    empty: 'Send a link.', tooMany: 'At most 20 links.', tooLong: 'That\'s too long for one message.',
    unknown: 'That\'s not an xtune connect link, a subscription URL or share links. Try again.',
  })[e],
  sourceKindChanged: (k) => `Send the same kind as before (${en.kinds[k]}).`,
  alreadyAdded: 'This one is already in the bot.',
  portBlocked: (p, xtune) => `This link uses port ${p}, but the bot can only reach ports 443 and 80.` +
    (xtune ? '\n\nUpdate xtune on the server (sudo xtune self-update, v0.7.1 or later), then get the link again: ' +
      'xtune public link NAME or xtune manage link. The subscription server then also listens on 443 and the link has no port.'
      : '\n\nUse an address on port 443.'),
  checking: '🔍 Checking…',
  sourceFailedKind: {
    xtune: 'Couldn\'t reach the xtune connect link.',
    sub: 'Couldn\'t read that subscription.',
    links: 'Couldn\'t read those links.',
  },
  errors: {
    unreachable: 'The server didn\'t answer.',
    gone: 'It doesn\'t exist on the server (was the link rotated or the profile deleted?).',
    empty: 'It has no links an app can use.',
    busy: 'The server is busy; try again in a minute.',
  },
  btnUseName: (n) => `Use "${n}"`,
  addName: (kind, max) => `What should it be called? (up to ${max} characters)`,
  nameBad: (max) => `Send a name of up to ${max} characters.`,
  chooseCountry: 'Where is the server?',
  btnNoCountry: '🌐 Skip',
  addVisibility: 'Who can join?\n\n🌍 Public: listed in the directory, anyone can join.\n🔒 Private: only people you send the invite link to.',
  btnPublic: '🌍 Public', btnPrivate: '🔒 Private (invite link)',
  addPassword: (max) => `Protect the invite with a password? Send it (up to ${max} characters), or tap No password.`,
  btnNoPassword: '🔓 No password',
  passwordBad: (max) => `Send a password of up to ${max} characters.`,
  added: (v, link) =>
    `✅ ${v.name} is added.\n\nInvite link:\n${link}\n\n` +
    (v.public ? 'It\'s listed in 🌍 Directory too.' : 'Send it to the people you want to invite.') +
    (v.password ? ' They\'ll need the password.' : ''),

  ownedEmpty: 'You haven\'t shared a VPN yet.',
  ownedTitle: (n) => `🛠 Your VPNs: ${n}`,
  btnAddVpn: '➕ Add VPN',
  isPublic: '🌍 Public', isPrivate: '🔒 Private',
  pausedNote: 'Paused: hidden and not taking new members',
  unlistedNote: 'Removed from the directory by the admins',
  passwordOn: 'password set', passwordOff: 'no password',
  inviteLink: '🔗 Invite link:',
  btnName: '✏️ Name', btnDesc: '📝 Description', btnCountry: '🏳️ Country',
  btnMakePrivate: '🔒 Make private', btnMakePublic: '🌍 Make public',
  btnPasswordSet: '🔑 Set password', btnPasswordChange: '🔑 Change password', btnPasswordRemove: '🔓 Remove password',
  btnMembers: '👥 Members', btnAnnounce: '📢 Announce',
  btnSource: (k) => (k === 'xtune' ? '🔗 Connect link' : k === 'sub' ? '🔗 Subscription URL' : '🔗 Links'),
  btnCheck: '🔍 Check now', btnPause: '⏸ Pause', btnResume: '▶️ Resume', btnNewLink: '🔄 New invite link',
  btnDelete: '🗑 Delete', btnDescRemove: '🗑 Remove description',
  editName: (v, max) => `Send the new name (up to ${max} characters). Now: ${v.name}`,
  editDesc: (v, max) => `Send a short description (up to ${max} characters): speed, rules, how long it runs…`,
  editPassword: (max) => `Send the new password (up to ${max} characters). Members who already joined stay.`,
  editSource: (k) => (k === 'xtune'
    ? 'Send the new connect link (xtune public token NAME). Members keep their accounts.'
    : 'Send the new links. Members are told to get them again.'),
  announcePrompt: (v) => `📢 Send the message for the members of ${v.name} (text only).`,
  announceWait: (m) => `You can announce again in ${m} min.`,
  textOnly: 'Send text, please.',
  saved: '✅ Saved.', passwordSaved: '✅ Password saved.', sourceSaved: '✅ Updated.',
  descBad: (max) => `At most ${max} characters.`,
  nowPublic: 'Now public.', nowPrivate: 'Now private.', paused: 'Paused.', resumed: 'Resumed.',
  passwordRemoved: 'Password removed.', checkOk: '✅ The server answers.',
  checkFailed: (e) => `⚠️ ${e}`,
  newLinkConfirm: 'Make a new invite link? The old one stops working; members stay.',
  newLinkDone: 'New invite link made.',
  deleteConfirm: (v) => `Delete ${v.name} from the bot? Members are told.` +
    (v.kind === 'xtune' ? ' Their accounts stay on your server until you run xtune public del.' : ''),
  deleted: 'Deleted.',
  membersHeader: (t, n) => `👥 ${t}: ${n} members`,
  membersEmpty: (v) => `No one has joined ${v.name} yet.`,
  joinedAgo: (t) => `joined ${t}`,
  memberInactive: 'inactive',
  kickHintXtune: 'Tap a label to remove that member: their account is deleted from the server.',
  kickHintShared: 'Tap a label to remove that member. They keep whatever links they already copied.',
  kickConfirm: (label, kind) => `Remove #${label}? They can't join again.` +
    (kind === 'xtune' ? '' : ' They keep the links they already copied; make new ones with 🔗 Links.'),
  kickedDone: 'Removed.',
  youWereKicked: (v) => `The owner of ${v.name} removed you from it.`,
  vpnRemoved: (v) => `${v.name} was removed from the bot.`,
  vpnUpdated: (v) => `🔄 ${v.name} has new connection details.`,
  announced: (n) => `📢 Sent to ${n} members.`,
  vpnDown: (t, e) => `⚠️ ${t} hasn't answered 3 checks in a row, so it's hidden from the directory. ${e}`,
  vpnBack: (t) => `✅ ${t} answers again and is back in the directory.`,
  ownerUnlisted: (v) => `🚫 The admins removed ${v.name} from the directory after reports. Invite links still work.`,
  ownerDeleted: (v) => `🗑 The admins deleted ${v.name} after reports.`,
  ownerBanned: '⛔ The admins removed your VPNs after reports. You can\'t add VPNs anymore.',
};

// ----------------------------------------------------------------------------- fa
const fa = {
  ...en,
  profile: {
    description:
      'وی‌پی‌ان اشتراکی 🌍\n\nوی‌پی‌ان‌های رایگانی که صاحب‌هاشون به اشتراک گذاشتن. فهرست رو ببین یا لینک دعوت رو باز کن، ' +
      'عضو شو و اطلاعات اتصال رو بگیر. صاحب سرور هیچ‌وقت نمی‌فهمه تو کی هستی.\n\n' +
      'سرور داری؟ عمومی یا با دعوت خصوصی (و رمز دلخواه) به اشتراکش بذار. ' +
      'با xtune بهترین کار رو می‌کنه: هر عضو حساب خودش رو می‌گیره.\n\nمتن‌باز.',
    shortDescription: 'وی‌پی‌ان‌های رایگان که صاحب‌هاشون به اشتراک گذاشتن. عضو شو یا مال خودت رو بذار. با xtune. متن‌باز.',
  },
  kb: { directory: '🌍 فهرست', joined: '📂 وی‌پی‌ان‌های من', add: '➕ افزودن وی‌پی‌ان', mine: '🛠 سرورهای من', language: '🌐 زبان', about: 'ℹ️ درباره' },

  welcome: (name) =>
    `سلام${name ? ` ${name}` : ''}! 👋 یه وی‌پی‌ان از بین اشتراک‌های بقیه پیدا کن، یا مال خودت رو به اشتراک بذار.\n\n` +
    '🌍 فهرست: وی‌پی‌ان‌های عمومی\n📂 وی‌پی‌ان‌های من: اون‌هایی که عضوشون شدی\n➕ افزودن وی‌پی‌ان: عمومی یا با دعوت خصوصی\n' +
    '🛠 سرورهای من: مدیریت چیزهایی که گذاشتی\n\n' +
    '⭐ سرور خودت رو داری؟ xtune کانفیگ‌هایی که از شبکه‌ی تو رد می‌شن رو پیدا می‌کنه و به هر عضو حساب جدا می‌ده (ℹ️ درباره).',
  help: 'از دکمه‌های پایین استفاده کن 👇',
  chooseLanguage: 'زبانت رو انتخاب کن:',
  languageSet: (n) => `زبان: ${n}`,
  about:
    '🌍 وی‌پی‌ان اشتراکی\n\nفهرستی از وی‌پی‌ان‌هایی که صاحب‌هاشون به اشتراک گذاشتن. عضو یکی شو تا اطلاعات اتصالش رو بگیری. ' +
    'صاحب سرور نمی‌فهمه تو کی هستی و تو هم نمی‌فهمی اون کیه.\n\n' +
    '⭐ با xtune بهترین کار رو می‌کنه. کسی که سرورش رو با xtune راه انداخته، اون رو به‌صورت پروفایل عمومی به اشتراک می‌ذاره و ' +
    'هر عضو حساب خودش رو با محدودیت‌های خودش می‌گیره؛ پس می‌شه یه عضو رو حذف کرد بدون اینکه بقیه اذیت بشن:\n' +
    'xtune public add community --quota 20 --days 30 --members 100\nبعد لینک اتصال رو توی «➕ افزودن وی‌پی‌ان» بفرست.\n\n' +
    '🔒 حریم خصوصی: ربات آیدی تلگرام و زبانت، وی‌پی‌ان‌هایی که عضو شدی یا گذاشتی و یه برچسب تصادفی برای هر عضویت رو نگه می‌داره. ' +
    'صاحب سرور فقط برچسب رو می‌بینه و سرور xtune هم فقط برچسب رو می‌گیره. رمزها هش‌شده ذخیره می‌شن. برای سروری که اینجا مدیریتش می‌کنی، لینک مدیریتش ذخیره می‌شه تا ربات بتونه بهش وصل بشه.\n\n' +
    '⚠️ ربات فقط بررسی می‌کنه که سرور جواب بده، نه اینکه از شبکه‌ی تو کار کنه. فقط از وی‌پی‌ان‌هایی استفاده کن که بهشون اعتماد داری: ' +
    'صاحب سرور ترافیکی که جدا رمزنگاری نشده رو می‌بینه.',
  btnXtune: '⭐ xtune در گیت‌هاب',

  now: 'همین الان', minutes: (n) => `${n} دقیقه پیش`, hours: (n) => `${n} ساعت پیش`, days: (n) => `${n} روز پیش`,
  unknown: 'نامشخص',
  membersOf: (a, m) => `${a} از ${m} عضو`, membersCount: (a) => `${a} عضو`,
  limits: (q, d) => `برای هر عضو: ${q}، ${d}`, gb: (n) => `${n} گیگ`, unlimited: 'نامحدود', daysN: (n) => `${n} روز`,
  noExpiry: 'بدون انقضا', expiresIn: (n) => `${n} روز مونده`,
  kinds: { xtune: '⭐ xtune: حساب مخصوص خودت', sub: '📡 لینک سابسکریپشن', links: '🔗 لینک‌های اتصال' },
  passwordNeeded: 'رمز لازم داره',
  notChecked: '❔ خودکار بررسی نمی‌شه (لینک‌های اتصال)',
  reachable: (t) => `✅ سرور جواب می‌ده (بررسی: ${t})`,
  downNote: '⚠️ جواب نمی‌ده: از فهرست پنهان شده',
  xtuneNote: 'روی این سرور حساب مخصوص خودت رو می‌گیری. صاحب سرور فقط یه برچسب تصادفی می‌بینه، نه اینکه تو کی هستی.',
  sharedNote: 'همه اطلاعات اتصال یکسان می‌گیرن. صاحب سرور هیچ‌وقت نمی‌فهمه تو کی هستی.',

  dirEmpty: 'هنوز وی‌پی‌ان عمومی‌ای نیست. اولین نفر باش: «➕ افزودن وی‌پی‌ان».',
  dirTitle: (n) => `🌍 وی‌پی‌ان‌های عمومی: ${n}`,
  btnJoin: '🔑 عضو شو', btnJoinPassword: '🔑 عضو شو (با رمز)', btnShow: '📋 اطلاعات اتصال',
  btnReport: '🚩 گزارش', btnBack: '⬅️ برگشت', btnCancel: '✖️ لغو', btnYes: '✅ آره', btnNo: '✖️ نه',
  btnLeave: '🚪 خروج', btnPage: '🌐 صفحه‌ی مصرف', btnManage: '🛠 مدیریت',
  cancelled: 'لغو شد.',
  expired: 'زیادی طول کشید و لغو شد. از دکمه‌های پایین دوباره شروع کن.',

  invalidLink: 'این دعوت دیگه وجود نداره. یه لینک جدید بخواه.',
  ownVpn: 'این وی‌پی‌ان خودته 🙂 لینک دعوتش رو برای بقیه بفرست.',
  kicked: (v) => `صاحب ${v.name} تو رو حذف کرده و دیگه نمی‌تونی عضوش بشی.`,
  unavailable: (v) => `${v.name} الان عضو جدید نمی‌گیره. بعداً امتحان کن.`,
  locked: (m) => `رمز اشتباه زیادی زدی. ${m} دقیقه‌ی دیگه امتحان کن.`,
  passwordPrompt: (v) => `🔒 ${v.name} رمز لازم داره. همین الان بفرستش (پیامت فوراً پاک می‌شه).`,
  wrongPassword: (n) => `رمز اشتباهه. ${n} بار دیگه می‌تونی امتحان کنی.`,
  joined: (v) => `🎉 عضو ${v.name} شدی. اطلاعات اتصالت پایینه و توی «📂 وی‌پی‌ان‌های من» هم می‌مونه.`,
  joinErrors: {
    full: '😕 ظرفیت این وی‌پی‌ان پره. بعداً امتحان کن یا یکی دیگه انتخاب کن.',
    paused: '⏸ این وی‌پی‌ان الان عضو جدید نمی‌گیره.',
    gone: 'این وی‌پی‌ان دیگه روی سرورش وجود نداره. صاحبش باید به‌روزش کنه.',
    busy: 'الان آدم‌های زیادی دارن عضو می‌شن. یه دقیقه‌ی دیگه امتحان کن.',
    unreachable: 'سرور جواب نداد. بعداً امتحان کن.',
  },
  yourLink: '🔗 لینک سابسکریپشن مخصوص خودت (به کسی نده):',
  sharedLink: '🔗 لینک سابسکریپشن:',
  sharedLinks: '🔗 لینک‌های اتصال:',
  importHint: 'توی برنامه‌ات (v2rayNG، Hiddify، Streisand، NekoBox و…) به‌عنوان سابسکریپشن اضافه‌اش کن یا کیوآر کد رو اسکن کن.',
  importHintLinks: 'کپی‌شون کن توی برنامه‌ات (v2rayNG، Hiddify، Streisand، NekoBox و…).',

  joinedEmpty: 'هنوز عضو هیچ وی‌پی‌انی نشدی. از «🌍 فهرست» یکی پیدا کن یا یه لینک دعوت باز کن.',
  joinedTitle: (n) => `📂 وی‌پی‌ان‌های تو: ${n}`,
  notMember: 'دیگه عضو نیستی.',
  leaveConfirm: (v) => `از ${v.name} خارج می‌شی؟ ${v.kind === 'xtune' ? 'حسابت روی سرور حذف می‌شه.' : ''}`,
  left: (v) => `از ${v.name} خارج شدی.`,
  notYours: 'این مال تو نیست.',

  reportWhy: 'مشکل این وی‌پی‌ان چیه؟',
  reasons: { illegal: '⚖️ استفاده‌ی غیرقانونی', scam: '💸 کلاهبرداری یا فروش', dead: '💀 کار نمی‌کنه' },
  reported: 'ممنون، ادمین‌ها بررسی می‌کنن.', alreadyReported: 'قبلاً گزارشش دادی.',

  bannedOwner: 'دیگه نمی‌تونی وی‌پی‌ان اضافه کنی.',
  tooManyVpns: (n) => `الان ${n} وی‌پی‌ان داری که بیشترین تعداد مجازه. اول یکی رو حذف کن.`,
  addSource:
    '➕ چیزی که اعضا باید بگیرن رو بفرست:\n\n' +
    '⭐ لینک اتصال xtune (روی سرورت: xtune public add NAME): هر عضو حساب خودش رو می‌گیره\n' +
    '📡 یه لینک سابسکریپشن (https://…)\n🔗 یا لینک‌های اتصال (vless://، hysteria2://، ss://، …)، هر کدوم توی یه خط\n\n' +
    'پیامت فوراً پاک می‌شه. هنوز سرور نداری؟ xtune راهش می‌اندازه: «ℹ️ درباره».',
  sourceError: (e) => ({
    empty: 'یه لینک بفرست.', tooMany: 'حداکثر ۲۰ لینک.', tooLong: 'برای یه پیام زیادی طولانیه.',
    unknown: 'این نه لینک اتصال xtune هست، نه لینک سابسکریپشن، نه لینک اتصال. دوباره امتحان کن.',
  })[e],
  sourceKindChanged: (k) => `همون نوع قبلی رو بفرست (${fa.kinds[k]}).`,
  alreadyAdded: 'این یکی قبلاً توی ربات هست.',
  portBlocked: (p, xtune) => `این لینک از پورت ${p} استفاده می‌کنه، ولی ربات فقط به پورت‌های ۴۴۳ و ۸۰ دسترسی داره.` +
    (xtune ? '\n\nروی سرور xtune رو به‌روز کن (sudo xtune self-update، نسخه‌ی 0.7.1 یا بالاتر)، بعد لینک رو دوباره بگیر: ' +
      'xtune public link NAME یا xtune manage link. اون‌وقت سرور سابسکریپشن روی ۴۴۳ هم گوش می‌ده و لینک پورت نداره.'
      : '\n\nیه آدرس روی پورت ۴۴۳ بفرست.'),
  checking: '🔍 دارم بررسی می‌کنم…',
  sourceFailedKind: {
    xtune: 'به لینک اتصال xtune دسترسی پیدا نکردم.',
    sub: 'نتونستم این سابسکریپشن رو بخونم.',
    links: 'نتونستم این لینک‌ها رو بخونم.',
  },
  errors: {
    unreachable: 'سرور جواب نداد.',
    gone: 'روی سرور وجود نداره (لینک عوض شده یا پروفایل حذف شده؟).',
    empty: 'هیچ لینکی که برنامه‌ها بتونن استفاده کنن نداره.',
    busy: 'سرور شلوغه؛ یه دقیقه‌ی دیگه امتحان کن.',
  },
  btnUseName: (n) => `همون «${n}»`,
  addName: (kind, max) => `اسمش چی باشه؟ (حداکثر ${max} حرف)`,
  nameBad: (max) => `یه اسم تا ${max} حرف بفرست.`,
  chooseCountry: 'سرور کجاست؟',
  btnNoCountry: '🌐 رد شو',
  addVisibility: 'کی می‌تونه عضو بشه؟\n\n🌍 عمومی: توی فهرست نشون داده می‌شه و همه می‌تونن عضو بشن.\n🔒 خصوصی: فقط کسایی که لینک دعوت رو براشون می‌فرستی.',
  btnPublic: '🌍 عمومی', btnPrivate: '🔒 خصوصی (لینک دعوت)',
  addPassword: (max) => `برای دعوت رمز می‌ذاری؟ بفرستش (تا ${max} حرف) یا «بدون رمز» رو بزن.`,
  btnNoPassword: '🔓 بدون رمز',
  passwordBad: (max) => `یه رمز تا ${max} حرف بفرست.`,
  added: (v, link) =>
    `✅ ${v.name} اضافه شد.\n\nلینک دعوت:\n${link}\n\n` +
    (v.public ? 'توی «🌍 فهرست» هم نشون داده می‌شه.' : 'برای کسایی که می‌خوای دعوتشون کنی بفرستش.') +
    (v.password ? ' رمز هم لازم دارن.' : ''),

  ownedEmpty: 'هنوز وی‌پی‌انی به اشتراک نذاشتی.',
  ownedTitle: (n) => `🛠 وی‌پی‌ان‌های تو: ${n}`,
  btnAddVpn: '➕ افزودن وی‌پی‌ان',
  isPublic: '🌍 عمومی', isPrivate: '🔒 خصوصی',
  pausedNote: 'متوقف: پنهانه و عضو جدید نمی‌گیره',
  unlistedNote: 'ادمین‌ها از فهرست برش داشتن',
  passwordOn: 'رمز داره', passwordOff: 'بدون رمز',
  inviteLink: '🔗 لینک دعوت:',
  btnName: '✏️ اسم', btnDesc: '📝 توضیحات', btnCountry: '🏳️ کشور',
  btnMakePrivate: '🔒 خصوصی کن', btnMakePublic: '🌍 عمومی کن',
  btnPasswordSet: '🔑 گذاشتن رمز', btnPasswordChange: '🔑 تغییر رمز', btnPasswordRemove: '🔓 برداشتن رمز',
  btnMembers: '👥 اعضا', btnAnnounce: '📢 اطلاعیه',
  btnSource: (k) => (k === 'xtune' ? '🔗 لینک اتصال' : k === 'sub' ? '🔗 لینک سابسکریپشن' : '🔗 لینک‌ها'),
  btnCheck: '🔍 بررسی کن', btnPause: '⏸ توقف', btnResume: '▶️ ادامه', btnNewLink: '🔄 لینک دعوت جدید',
  btnDelete: '🗑 حذف', btnDescRemove: '🗑 حذف توضیحات',
  editName: (v, max) => `اسم جدید رو بفرست (تا ${max} حرف). الان: ${v.name}`,
  editDesc: (v, max) => `یه توضیح کوتاه بفرست (تا ${max} حرف): سرعت، قوانین، تا کی روشنه و…`,
  editPassword: (max) => `رمز جدید رو بفرست (تا ${max} حرف). اعضای فعلی می‌مونن.`,
  editSource: (k) => (k === 'xtune'
    ? 'لینک اتصال جدید رو بفرست (xtune public token NAME). اعضا حساب‌هاشون رو نگه می‌دارن.'
    : 'لینک‌های جدید رو بفرست. به اعضا گفته می‌شه دوباره بگیرنشون.'),
  announcePrompt: (v) => `📢 پیامت برای اعضای ${v.name} رو بفرست (فقط متن).`,
  announceWait: (m) => `${m} دقیقه‌ی دیگه می‌تونی دوباره اطلاعیه بدی.`,
  textOnly: 'لطفاً متن بفرست.',
  saved: '✅ ذخیره شد.', passwordSaved: '✅ رمز ذخیره شد.', sourceSaved: '✅ به‌روز شد.',
  descBad: (max) => `حداکثر ${max} حرف.`,
  nowPublic: 'الان عمومیه.', nowPrivate: 'الان خصوصیه.', paused: 'متوقف شد.', resumed: 'ادامه پیدا کرد.',
  passwordRemoved: 'رمز برداشته شد.', checkOk: '✅ سرور جواب می‌ده.',
  newLinkConfirm: 'لینک دعوت جدید بسازم؟ لینک قبلی دیگه کار نمی‌کنه؛ اعضا می‌مونن.',
  newLinkDone: 'لینک دعوت جدید ساخته شد.',
  deleteConfirm: (v) => `${v.name} از ربات حذف بشه؟ به اعضا خبر داده می‌شه.` +
    (v.kind === 'xtune' ? ' حساب‌هاشون روی سرورت می‌مونه تا وقتی xtune public del رو اجرا کنی.' : ''),
  deleted: 'حذف شد.',
  membersHeader: (t, n) => `👥 ${t}: ${n} عضو`,
  membersEmpty: (v) => `هنوز کسی عضو ${v.name} نشده.`,
  joinedAgo: (t) => `عضویت: ${t}`,
  memberInactive: 'غیرفعال',
  kickHintXtune: 'روی یه برچسب بزن تا اون عضو حذف بشه: حسابش از سرور پاک می‌شه.',
  kickHintShared: 'روی یه برچسب بزن تا اون عضو حذف بشه. لینک‌هایی که قبلاً کپی کرده پیشش می‌مونه.',
  kickConfirm: (label, kind) => `#${label} حذف بشه؟ دیگه نمی‌تونه عضو بشه.` +
    (kind === 'xtune' ? '' : ' لینک‌هایی که کپی کرده پیشش می‌مونه؛ با «🔗 لینک‌ها» لینک جدید بذار.'),
  kickedDone: 'حذف شد.',
  youWereKicked: (v) => `صاحب ${v.name} تو رو ازش حذف کرد.`,
  vpnRemoved: (v) => `${v.name} از ربات حذف شد.`,
  vpnUpdated: (v) => `🔄 اطلاعات اتصال ${v.name} عوض شده.`,
  announced: (n) => `📢 برای ${n} عضو فرستاده شد.`,
  vpnDown: (t, e) => `⚠️ ${t} سه بار پشت هم جواب نداده و از فهرست پنهان شده. ${e}`,
  vpnBack: (t) => `✅ ${t} دوباره جواب می‌ده و برگشت توی فهرست.`,
  ownerUnlisted: (v) => `🚫 ادمین‌ها بعد از گزارش‌ها ${v.name} رو از فهرست برداشتن. لینک‌های دعوت هنوز کار می‌کنن.`,
  ownerDeleted: (v) => `🗑 ادمین‌ها بعد از گزارش‌ها ${v.name} رو حذف کردن.`,
  ownerBanned: '⛔ ادمین‌ها بعد از گزارش‌ها وی‌پی‌ان‌هات رو حذف کردن. دیگه نمی‌تونی وی‌پی‌ان اضافه کنی.',
};

// ----------------------------------------------------------------------------- ar
const ar = {
  ...en,
  profile: {
    description:
      'VPN المجتمع 🌍\n\nشبكات VPN مجانية يشاركها من يديرونها. تصفّح الدليل أو افتح دعوة، انضم واحصل على بيانات الاتصال. ' +
      'لا يعرف المالك من أنت أبداً.\n\nلديك خادم؟ شاركه علناً أو بدعوة خاصة مع كلمة مرور اختيارية. ' +
      'يعمل بأفضل شكل مع xtune: كل عضو يحصل على حسابه الخاص.\n\nمفتوح المصدر.',
    shortDescription: 'شبكات VPN مجانية يشاركها أصحابها. انضم إلى واحدة أو شارك خادمك. الأفضل مع xtune. مفتوح المصدر.',
  },
  kb: { directory: '🌍 الدليل', joined: '📂 شبكاتي', add: '➕ إضافة VPN', mine: '🛠 خوادمي', language: '🌐 اللغة', about: 'ℹ️ حول' },

  welcome: (name) =>
    `مرحباً${name ? ` ${name}` : ''}! 👋 ابحث عن VPN يشاركه المجتمع، أو شارك خادمك.\n\n` +
    '🌍 الدليل: الشبكات العامة\n📂 شبكاتي: التي انضممت إليها\n➕ إضافة VPN: شارك خادمك علناً أو بدعوة خاصة\n' +
    '🛠 خوادمي: إدارة ما شاركته\n\n' +
    '⭐ تدير خادمك الخاص؟ يجد xtune الإعدادات التي تعبر شبكتك ويعطي كل عضو حسابه الخاص (ℹ️ حول).',
  help: 'استخدم الأزرار في الأسفل 👇',
  chooseLanguage: 'اختر لغتك:',
  languageSet: (n) => `اللغة: ${n}`,
  about:
    '🌍 VPN المجتمع\n\nدليل لشبكات VPN يشاركها أصحابها. انضم إلى واحدة لتحصل على بيانات الاتصال. ' +
    'لا يعرف المالك من أنت، ولا تعرف أنت من هو.\n\n' +
    '⭐ يعمل بأفضل شكل مع xtune. من يدير خادمه بـ xtune يشاركه كملف عام، ويحصل كل عضو على حسابه الخاص بحدوده الخاصة، ' +
    'فيمكن إزالة عضو دون التأثير على الآخرين:\n' +
    'xtune public add community --quota 20 --days 30 --members 100\nثم أرسل رابط الاتصال إلى «➕ إضافة VPN».\n\n' +
    '🔒 الخصوصية: يحتفظ البوت بمعرّف تيليجرام ولغتك والشبكات التي انضممت إليها أو أضفتها ووسم عشوائي لكل عضوية. ' +
    'يرى المالكون الوسوم فقط، ويحصل خادم xtune على الوسم فقط. كلمات المرور مخزنة مجزأة (hash). وللخادم الذي تديره هنا يُحفظ رابط إدارته ليصل إليه البوت.\n\n' +
    '⚠️ يتحقق البوت من أن الخوادم تستجيب، لا من أنها تعمل على شبكتك. استخدم شبكات تثق بها: يرى مالك الخادم الحركة غير المشفرة.',
  btnXtune: '⭐ xtune على GitHub',

  now: 'الآن', minutes: (n) => `قبل ${n} دقيقة`, hours: (n) => `قبل ${n} ساعة`, days: (n) => `قبل ${n} يوم`,
  unknown: 'غير معروف',
  membersOf: (a, m) => `${a} من ${m} عضو`, membersCount: (a) => `${a} عضو`,
  limits: (q, d) => `لكل عضو: ${q}، ${d}`, gb: (n) => `${n} غيغابايت`, unlimited: 'غير محدود', daysN: (n) => `${n} يوم`,
  noExpiry: 'بلا انتهاء', expiresIn: (n) => `بقي ${n} يوم`,
  kinds: { xtune: '⭐ xtune: حسابك الخاص', sub: '📡 رابط اشتراك', links: '🔗 روابط اتصال' },
  passwordNeeded: 'يحتاج كلمة مرور',
  notChecked: '❔ لا يُفحص تلقائياً (روابط اتصال)',
  reachable: (t) => `✅ الخادم يستجيب (فُحص ${t})`,
  downNote: '⚠️ لا يستجيب: مخفي من الدليل',
  xtuneNote: 'تحصل على حسابك الخاص على هذا الخادم. يرى المالك وسماً عشوائياً فقط، لا هويتك.',
  sharedNote: 'يحصل الجميع على بيانات الاتصال نفسها. لا يعرف المالك من أنت أبداً.',

  dirEmpty: 'لا توجد شبكات عامة بعد. كن الأول: «➕ إضافة VPN».',
  dirTitle: (n) => `🌍 الشبكات العامة: ${n}`,
  btnJoin: '🔑 انضم', btnJoinPassword: '🔑 انضم (كلمة مرور)', btnShow: '📋 بيانات الاتصال',
  btnReport: '🚩 إبلاغ', btnBack: '⬅️ رجوع', btnCancel: '✖️ إلغاء', btnYes: '✅ نعم', btnNo: '✖️ لا',
  btnLeave: '🚪 مغادرة', btnPage: '🌐 صفحة الاستهلاك', btnManage: '🛠 إدارة',
  cancelled: 'أُلغي.',
  expired: 'استغرق الأمر وقتاً طويلاً فأُلغي. ابدأ من جديد من الأزرار في الأسفل.',

  invalidLink: 'هذه الدعوة لم تعد موجودة. اطلب واحدة جديدة.',
  ownVpn: 'هذه شبكتك 🙂 أرسل رابط دعوتها للآخرين.',
  kicked: (v) => `أزالك مالك ${v.name}، فلا يمكنك الانضمام إليها مجدداً.`,
  unavailable: (v) => `${v.name} لا تقبل أعضاء جدداً الآن. حاول لاحقاً.`,
  locked: (m) => `كلمات مرور خاطئة كثيرة. حاول بعد ${m} دقيقة.`,
  passwordPrompt: (v) => `🔒 ${v.name} تحتاج كلمة مرور. أرسلها الآن (تُحذف رسالتك فوراً).`,
  wrongPassword: (n) => `كلمة مرور خاطئة. بقيت ${n} محاولات.`,
  joined: (v) => `🎉 انضممت إلى ${v.name}. بيانات اتصالك في الأسفل، وتبقى في «📂 شبكاتي» أيضاً.`,
  joinErrors: {
    full: '😕 هذه الشبكة ممتلئة. حاول لاحقاً أو اختر غيرها.',
    paused: '⏸ هذه الشبكة لا تقبل أعضاء جدداً الآن.',
    gone: 'هذه الشبكة لم تعد موجودة على خادمها. على المالك تحديثها.',
    busy: 'كثيرون ينضمون الآن. حاول بعد دقيقة.',
    unreachable: 'لم يستجب الخادم. حاول لاحقاً.',
  },
  yourLink: '🔗 رابط اشتراكك الخاص (لا تشاركه):',
  sharedLink: '🔗 رابط الاشتراك:',
  sharedLinks: '🔗 روابط الاتصال:',
  importHint: 'أضفه في تطبيقك (v2rayNG، Hiddify، Streisand، NekoBox…) كاشتراك، أو امسح رمز QR.',
  importHintLinks: 'انسخها إلى تطبيقك (v2rayNG، Hiddify، Streisand، NekoBox…).',

  joinedEmpty: 'لم تنضم إلى أي شبكة بعد. ابحث في «🌍 الدليل» أو افتح رابط دعوة.',
  joinedTitle: (n) => `📂 شبكاتك: ${n}`,
  notMember: 'لم تعد عضواً.',
  leaveConfirm: (v) => `مغادرة ${v.name}؟ ${v.kind === 'xtune' ? 'سيُحذف حسابك على الخادم.' : ''}`,
  left: (v) => `غادرت ${v.name}.`,
  notYours: 'هذا ليس لك.',

  reportWhy: 'ما المشكلة في هذه الشبكة؟',
  reasons: { illegal: '⚖️ استخدام غير قانوني', scam: '💸 احتيال أو بيع', dead: '💀 لا تعمل' },
  reported: 'شكراً، سيراجعها المشرفون.', alreadyReported: 'أبلغت عنها من قبل.',

  bannedOwner: 'لم يعد بإمكانك إضافة شبكات.',
  tooManyVpns: (n) => `لديك ${n} شبكات، وهو الحد الأقصى. احذف واحدة أولاً.`,
  addSource:
    '➕ أرسل ما يجب أن يحصل عليه الأعضاء:\n\n' +
    '⭐ رابط اتصال xtune (على خادمك: xtune public add NAME): كل عضو يحصل على حسابه الخاص\n' +
    '📡 رابط اشتراك (https://…)\n🔗 أو روابط اتصال (vless://، hysteria2://، ss://، …)، رابط في كل سطر\n\n' +
    'تُحذف رسالتك فوراً. ليس لديك خادم؟ xtune يجهّزه لك: «ℹ️ حول».',
  sourceError: (e) => ({
    empty: 'أرسل رابطاً.', tooMany: '٢٠ رابطاً كحد أقصى.', tooLong: 'هذا طويل جداً لرسالة واحدة.',
    unknown: 'هذا ليس رابط اتصال xtune ولا رابط اشتراك ولا روابط اتصال. حاول مجدداً.',
  })[e],
  sourceKindChanged: (k) => `أرسل النوع نفسه كما من قبل (${ar.kinds[k]}).`,
  alreadyAdded: 'هذه موجودة في البوت بالفعل.',
  portBlocked: (p, xtune) => `يستخدم هذا الرابط المنفذ ${p}، لكن البوت لا يصل إلا إلى المنفذين ٤٤٣ و٨٠.` +
    (xtune ? '\n\nحدّث xtune على الخادم (sudo xtune self-update، الإصدار 0.7.1 أو أحدث)، ثم خذ الرابط مجدداً: ' +
      'xtune public link NAME أو xtune manage link. سيستمع خادم الاشتراكات على ٤٤٣ أيضاً ويصبح الرابط بلا منفذ.'
      : '\n\nاستخدم عنواناً على المنفذ ٤٤٣.'),
  checking: '🔍 جارٍ الفحص…',
  sourceFailedKind: {
    xtune: 'تعذّر الوصول إلى رابط اتصال xtune.',
    sub: 'تعذّرت قراءة هذا الاشتراك.',
    links: 'تعذّرت قراءة هذه الروابط.',
  },
  errors: {
    unreachable: 'لم يستجب الخادم.',
    gone: 'غير موجود على الخادم (هل تغيّر الرابط أو حُذف الملف؟).',
    empty: 'لا يحتوي روابط يمكن للتطبيقات استخدامها.',
    busy: 'الخادم مشغول؛ حاول بعد دقيقة.',
  },
  btnUseName: (n) => `استخدم «${n}»`,
  addName: (kind, max) => `ما اسمها؟ (حتى ${max} حرفاً)`,
  nameBad: (max) => `أرسل اسماً حتى ${max} حرفاً.`,
  chooseCountry: 'أين الخادم؟',
  btnNoCountry: '🌐 تخطَّ',
  addVisibility: 'من يمكنه الانضمام؟\n\n🌍 عامة: تظهر في الدليل ويمكن لأي أحد الانضمام.\n🔒 خاصة: فقط من ترسل لهم رابط الدعوة.',
  btnPublic: '🌍 عامة', btnPrivate: '🔒 خاصة (رابط دعوة)',
  addPassword: (max) => `تحمي الدعوة بكلمة مرور؟ أرسلها (حتى ${max} حرفاً) أو اضغط «بدون كلمة مرور».`,
  btnNoPassword: '🔓 بدون كلمة مرور',
  passwordBad: (max) => `أرسل كلمة مرور حتى ${max} حرفاً.`,
  added: (v, link) =>
    `✅ أُضيفت ${v.name}.\n\nرابط الدعوة:\n${link}\n\n` +
    (v.public ? 'تظهر في «🌍 الدليل» أيضاً.' : 'أرسله لمن تريد دعوتهم.') +
    (v.password ? ' سيحتاجون كلمة المرور.' : ''),

  ownedEmpty: 'لم تشارك أي شبكة بعد.',
  ownedTitle: (n) => `🛠 شبكاتك: ${n}`,
  btnAddVpn: '➕ إضافة VPN',
  isPublic: '🌍 عامة', isPrivate: '🔒 خاصة',
  pausedNote: 'متوقفة: مخفية ولا تقبل أعضاء جدداً',
  unlistedNote: 'أزالها المشرفون من الدليل',
  passwordOn: 'لها كلمة مرور', passwordOff: 'بلا كلمة مرور',
  inviteLink: '🔗 رابط الدعوة:',
  btnName: '✏️ الاسم', btnDesc: '📝 الوصف', btnCountry: '🏳️ الدولة',
  btnMakePrivate: '🔒 اجعلها خاصة', btnMakePublic: '🌍 اجعلها عامة',
  btnPasswordSet: '🔑 تعيين كلمة مرور', btnPasswordChange: '🔑 تغيير كلمة المرور', btnPasswordRemove: '🔓 إزالة كلمة المرور',
  btnMembers: '👥 الأعضاء', btnAnnounce: '📢 إعلان',
  btnSource: (k) => (k === 'xtune' ? '🔗 رابط الاتصال' : k === 'sub' ? '🔗 رابط الاشتراك' : '🔗 الروابط'),
  btnCheck: '🔍 افحص الآن', btnPause: '⏸ إيقاف', btnResume: '▶️ استئناف', btnNewLink: '🔄 رابط دعوة جديد',
  btnDelete: '🗑 حذف', btnDescRemove: '🗑 حذف الوصف',
  editName: (v, max) => `أرسل الاسم الجديد (حتى ${max} حرفاً). الآن: ${v.name}`,
  editDesc: (v, max) => `أرسل وصفاً قصيراً (حتى ${max} حرفاً): السرعة، القواعد، مدة التشغيل…`,
  editPassword: (max) => `أرسل كلمة المرور الجديدة (حتى ${max} حرفاً). يبقى الأعضاء الحاليون.`,
  editSource: (k) => (k === 'xtune'
    ? 'أرسل رابط الاتصال الجديد (xtune public token NAME). يحتفظ الأعضاء بحساباتهم.'
    : 'أرسل الروابط الجديدة. سيُطلب من الأعضاء أخذها مجدداً.'),
  announcePrompt: (v) => `📢 أرسل رسالتك لأعضاء ${v.name} (نص فقط).`,
  announceWait: (m) => `يمكنك الإعلان مجدداً بعد ${m} دقيقة.`,
  textOnly: 'أرسل نصاً من فضلك.',
  saved: '✅ حُفظ.', passwordSaved: '✅ حُفظت كلمة المرور.', sourceSaved: '✅ حُدّث.',
  descBad: (max) => `${max} حرفاً كحد أقصى.`,
  nowPublic: 'أصبحت عامة.', nowPrivate: 'أصبحت خاصة.', paused: 'أُوقفت.', resumed: 'استؤنفت.',
  passwordRemoved: 'أُزيلت كلمة المرور.', checkOk: '✅ الخادم يستجيب.',
  newLinkConfirm: 'إنشاء رابط دعوة جديد؟ يتوقف القديم؛ يبقى الأعضاء.',
  newLinkDone: 'أُنشئ رابط دعوة جديد.',
  deleteConfirm: (v) => `حذف ${v.name} من البوت؟ سيُبلَّغ الأعضاء.` +
    (v.kind === 'xtune' ? ' تبقى حساباتهم على خادمك حتى تشغّل xtune public del.' : ''),
  deleted: 'حُذفت.',
  membersHeader: (t, n) => `👥 ${t}: ${n} عضو`,
  membersEmpty: (v) => `لم ينضم أحد إلى ${v.name} بعد.`,
  joinedAgo: (t) => `انضم ${t}`,
  memberInactive: 'غير نشط',
  kickHintXtune: 'اضغط على وسم لإزالة ذلك العضو: يُحذف حسابه من الخادم.',
  kickHintShared: 'اضغط على وسم لإزالة ذلك العضو. يحتفظ بالروابط التي نسخها.',
  kickConfirm: (label, kind) => `إزالة #${label}؟ لن يستطيع الانضمام مجدداً.` +
    (kind === 'xtune' ? '' : ' يحتفظ بالروابط التي نسخها؛ ضع روابط جديدة من «🔗 الروابط».'),
  kickedDone: 'أُزيل.',
  youWereKicked: (v) => `أزالك مالك ${v.name} منها.`,
  vpnRemoved: (v) => `أُزيلت ${v.name} من البوت.`,
  vpnUpdated: (v) => `🔄 لدى ${v.name} بيانات اتصال جديدة.`,
  announced: (n) => `📢 أُرسل إلى ${n} عضو.`,
  vpnDown: (t, e) => `⚠️ لم تستجب ${t} لثلاثة فحوص متتالية، فأُخفيت من الدليل. ${e}`,
  vpnBack: (t) => `✅ ${t} تستجيب مجدداً وعادت إلى الدليل.`,
  ownerUnlisted: (v) => `🚫 أزال المشرفون ${v.name} من الدليل بعد بلاغات. روابط الدعوة ما زالت تعمل.`,
  ownerDeleted: (v) => `🗑 حذف المشرفون ${v.name} بعد بلاغات.`,
  ownerBanned: '⛔ أزال المشرفون شبكاتك بعد بلاغات. لم يعد بإمكانك إضافة شبكات.',
};

// ----------------------------------------------------------------------------- ru
const ru = {
  ...en,
  profile: {
    description:
      'Общий VPN 🌍\n\nБесплатные VPN, которыми делятся их владельцы. Смотрите каталог или откройте приглашение, ' +
      'вступайте и получайте данные для подключения. Владелец никогда не узнает, кто вы.\n\n' +
      'Есть сервер? Поделитесь им открыто или по закрытому приглашению, с паролем по желанию. ' +
      'Лучше всего с xtune: у каждого участника свой аккаунт.\n\nОткрытый исходный код.',
    shortDescription: 'Бесплатные VPN от их владельцев. Вступайте или делитесь своим. Лучше всего с xtune. Открытый код.',
  },
  kb: { directory: '🌍 Каталог', joined: '📂 Мои VPN', add: '➕ Добавить VPN', mine: '🛠 Мои серверы', language: '🌐 Язык', about: 'ℹ️ О боте' },

  welcome: (name) =>
    `Привет${name ? `, ${name}` : ''}! 👋 Найдите VPN, которым поделилось сообщество, или поделитесь своим.\n\n` +
    '🌍 Каталог: открытые VPN\n📂 Мои VPN: те, в которые вы вступили\n➕ Добавить VPN: открыто или по приглашению\n' +
    '🛠 Мои серверы: управление тем, чем вы поделились\n\n' +
    '⭐ Свой сервер? xtune находит конфиги, которые проходят через вашу сеть, и даёт каждому участнику свой аккаунт (ℹ️ О боте).',
  help: 'Пользуйтесь кнопками внизу 👇',
  chooseLanguage: 'Выберите язык:',
  languageSet: (n) => `Язык: ${n}`,
  about:
    '🌍 Общий VPN\n\nКаталог VPN, которыми делятся их владельцы. Вступите, чтобы получить данные для подключения. ' +
    'Владелец не видит, кто вы, а вы не видите, кто он.\n\n' +
    '⭐ Лучше всего с xtune. Владельцы, чей сервер работает на xtune, делятся им как публичным профилем, и каждый участник ' +
    'получает свой аккаунт со своими лимитами, так что одного можно удалить, не задев остальных:\n' +
    'xtune public add community --quota 20 --days 30 --members 100\nзатем отправьте ссылку подключения в «➕ Добавить VPN».\n\n' +
    '🔒 Приватность: бот хранит ваш Telegram id и язык, VPN, в которые вы вступили или которые добавили, и случайную метку ' +
    'для каждого членства. Владельцы видят только метки; сервер xtune получает только метку. Пароли хранятся в виде хэша. Для сервера, которым вы управляете здесь, хранится его ссылка управления.\n\n' +
    '⚠️ Бот проверяет, что серверы отвечают, а не что они работают в вашей сети. Пользуйтесь VPN, которым доверяете: ' +
    'владелец сервера видит незашифрованный трафик.',
  btnXtune: '⭐ xtune на GitHub',

  now: 'только что', minutes: (n) => `${n} мин назад`, hours: (n) => `${n} ч назад`, days: (n) => `${n} дн назад`,
  unknown: 'неизвестно',
  membersOf: (a, m) => `${a} из ${m} участников`, membersCount: (a) => `участников: ${a}`,
  limits: (q, d) => `на участника: ${q}, ${d}`, gb: (n) => `${n} ГБ`, unlimited: 'без лимита', daysN: (n) => `${n} дн`,
  noExpiry: 'бессрочно', expiresIn: (n) => `осталось ${n} дн`,
  kinds: { xtune: '⭐ xtune: свой аккаунт', sub: '📡 Ссылка подписки', links: '🔗 Ссылки подключения' },
  passwordNeeded: 'нужен пароль',
  notChecked: '❔ Не проверяется автоматически (ссылки)',
  reachable: (t) => `✅ Сервер отвечает (проверен ${t})`,
  downNote: '⚠️ Не отвечает: скрыт из каталога',
  xtuneNote: 'Вы получите свой аккаунт на этом сервере. Владелец видит только случайную метку, а не вас.',
  sharedNote: 'Все получают одинаковые данные для подключения. Владелец никогда не узнает, кто вы.',

  dirEmpty: 'Открытых VPN пока нет. Будьте первым: «➕ Добавить VPN».',
  dirTitle: (n) => `🌍 Открытые VPN: ${n}`,
  btnJoin: '🔑 Вступить', btnJoinPassword: '🔑 Вступить (пароль)', btnShow: '📋 Данные подключения',
  btnReport: '🚩 Пожаловаться', btnBack: '⬅️ Назад', btnCancel: '✖️ Отмена', btnYes: '✅ Да', btnNo: '✖️ Нет',
  btnLeave: '🚪 Выйти', btnPage: '🌐 Страница расхода', btnManage: '🛠 Управление',
  cancelled: 'Отменено.',
  expired: 'Прошло слишком много времени, действие отменено. Начните заново с кнопок внизу.',

  invalidLink: 'Этого приглашения больше нет. Попросите новое.',
  ownVpn: 'Это ваш VPN 🙂 Отправьте ссылку-приглашение другим.',
  kicked: (v) => `Владелец ${v.name} удалил вас, вступить снова нельзя.`,
  unavailable: (v) => `${v.name} сейчас не принимает новых участников. Попробуйте позже.`,
  locked: (m) => `Слишком много неверных паролей. Попробуйте через ${m} мин.`,
  passwordPrompt: (v) => `🔒 Для ${v.name} нужен пароль. Отправьте его (сообщение сразу удаляется).`,
  wrongPassword: (n) => `Неверный пароль. Осталось попыток: ${n}.`,
  joined: (v) => `🎉 Вы вступили в ${v.name}. Данные подключения ниже, они также остаются в «📂 Мои VPN».`,
  joinErrors: {
    full: '😕 Мест нет. Попробуйте позже или выберите другой.',
    paused: '⏸ Этот VPN сейчас не принимает новых участников.',
    gone: 'Этого VPN больше нет на сервере. Владельцу нужно его обновить.',
    busy: 'Сейчас вступает много людей. Попробуйте через минуту.',
    unreachable: 'Сервер не ответил. Попробуйте позже.',
  },
  yourLink: '🔗 Ваша личная ссылка подписки (никому не давайте):',
  sharedLink: '🔗 Ссылка подписки:',
  sharedLinks: '🔗 Ссылки подключения:',
  importHint: 'Добавьте её в приложение (v2rayNG, Hiddify, Streisand, NekoBox…) как подписку или отсканируйте QR-код.',
  importHintLinks: 'Скопируйте их в приложение (v2rayNG, Hiddify, Streisand, NekoBox…).',

  joinedEmpty: 'Вы ещё никуда не вступили. Найдите VPN в «🌍 Каталог» или откройте приглашение.',
  joinedTitle: (n) => `📂 Ваши VPN: ${n}`,
  notMember: 'Вы больше не участник.',
  leaveConfirm: (v) => `Выйти из ${v.name}? ${v.kind === 'xtune' ? 'Ваш аккаунт на сервере будет удалён.' : ''}`,
  left: (v) => `Вы вышли из ${v.name}.`,
  notYours: 'Это не ваше.',

  reportWhy: 'Что не так с этим VPN?',
  reasons: { illegal: '⚖️ Незаконное использование', scam: '💸 Мошенничество или продажа', dead: '💀 Не работает' },
  reported: 'Спасибо, администраторы посмотрят.', alreadyReported: 'Вы уже жаловались.',

  bannedOwner: 'Вы больше не можете добавлять VPN.',
  tooManyVpns: (n) => `У вас уже ${n} VPN, это максимум. Сначала удалите один.`,
  addSource:
    '➕ Отправьте то, что получат участники:\n\n' +
    '⭐ ссылку подключения xtune (на сервере: xtune public add NAME): у каждого участника свой аккаунт\n' +
    '📡 ссылку подписки (https://…)\n🔗 или ссылки подключения (vless://, hysteria2://, ss://, …), по одной в строке\n\n' +
    'Сообщение сразу удаляется. Нет сервера? xtune его настроит: «ℹ️ О боте».',
  sourceError: (e) => ({
    empty: 'Отправьте ссылку.', tooMany: 'Не больше 20 ссылок.', tooLong: 'Слишком длинно для одного сообщения.',
    unknown: 'Это не ссылка подключения xtune, не подписка и не ссылки подключения. Попробуйте ещё раз.',
  })[e],
  sourceKindChanged: (k) => `Отправьте то же, что и раньше (${ru.kinds[k]}).`,
  alreadyAdded: 'Этот уже есть в боте.',
  portBlocked: (p, xtune) => `Ссылка использует порт ${p}, а бот может достучаться только до портов 443 и 80.` +
    (xtune ? '\n\nОбновите xtune на сервере (sudo xtune self-update, версия 0.7.1 или новее) и получите ссылку заново: ' +
      'xtune public link NAME или xtune manage link. Сервер подписок будет слушать и 443, а в ссылке не будет порта.'
      : '\n\nИспользуйте адрес на порту 443.'),
  checking: '🔍 Проверяю…',
  sourceFailedKind: {
    xtune: 'Не удалось достучаться до ссылки подключения xtune.',
    sub: 'Не удалось прочитать подписку.',
    links: 'Не удалось прочитать ссылки.',
  },
  errors: {
    unreachable: 'Сервер не ответил.',
    gone: 'На сервере этого нет (ссылку сменили или профиль удалили?).',
    empty: 'В ней нет ссылок, которые понимают приложения.',
    busy: 'Сервер занят; попробуйте через минуту.',
  },
  btnUseName: (n) => `Оставить «${n}»`,
  addName: (kind, max) => `Как его назвать? (до ${max} символов)`,
  nameBad: (max) => `Отправьте название до ${max} символов.`,
  chooseCountry: 'Где сервер?',
  btnNoCountry: '🌐 Пропустить',
  addVisibility: 'Кто может вступить?\n\n🌍 Открытый: виден в каталоге, вступить может любой.\n🔒 Закрытый: только те, кому вы отправите приглашение.',
  btnPublic: '🌍 Открытый', btnPrivate: '🔒 Закрытый (приглашение)',
  addPassword: (max) => `Защитить приглашение паролем? Отправьте его (до ${max} символов) или нажмите «Без пароля».`,
  btnNoPassword: '🔓 Без пароля',
  passwordBad: (max) => `Отправьте пароль до ${max} символов.`,
  added: (v, link) =>
    `✅ ${v.name} добавлен.\n\nСсылка-приглашение:\n${link}\n\n` +
    (v.public ? 'Он также есть в «🌍 Каталог».' : 'Отправьте её тем, кого хотите пригласить.') +
    (v.password ? ' Им понадобится пароль.' : ''),

  ownedEmpty: 'Вы ещё ничем не поделились.',
  ownedTitle: (n) => `🛠 Ваши VPN: ${n}`,
  btnAddVpn: '➕ Добавить VPN',
  isPublic: '🌍 Открытый', isPrivate: '🔒 Закрытый',
  pausedNote: 'Приостановлен: скрыт и не принимает новых участников',
  unlistedNote: 'Администраторы убрали его из каталога',
  passwordOn: 'есть пароль', passwordOff: 'без пароля',
  inviteLink: '🔗 Ссылка-приглашение:',
  btnName: '✏️ Название', btnDesc: '📝 Описание', btnCountry: '🏳️ Страна',
  btnMakePrivate: '🔒 Сделать закрытым', btnMakePublic: '🌍 Сделать открытым',
  btnPasswordSet: '🔑 Задать пароль', btnPasswordChange: '🔑 Сменить пароль', btnPasswordRemove: '🔓 Убрать пароль',
  btnMembers: '👥 Участники', btnAnnounce: '📢 Объявление',
  btnSource: (k) => (k === 'xtune' ? '🔗 Ссылка подключения' : k === 'sub' ? '🔗 Ссылка подписки' : '🔗 Ссылки'),
  btnCheck: '🔍 Проверить', btnPause: '⏸ Приостановить', btnResume: '▶️ Возобновить', btnNewLink: '🔄 Новое приглашение',
  btnDelete: '🗑 Удалить', btnDescRemove: '🗑 Удалить описание',
  editName: (v, max) => `Отправьте новое название (до ${max} символов). Сейчас: ${v.name}`,
  editDesc: (v, max) => `Отправьте краткое описание (до ${max} символов): скорость, правила, сколько будет работать…`,
  editPassword: (max) => `Отправьте новый пароль (до ${max} символов). Участники остаются.`,
  editSource: (k) => (k === 'xtune'
    ? 'Отправьте новую ссылку подключения (xtune public token NAME). Аккаунты участников сохраняются.'
    : 'Отправьте новые ссылки. Участникам сообщат, чтобы они взяли их заново.'),
  announcePrompt: (v) => `📢 Отправьте сообщение для участников ${v.name} (только текст).`,
  announceWait: (m) => `Следующее объявление можно через ${m} мин.`,
  textOnly: 'Отправьте текст, пожалуйста.',
  saved: '✅ Сохранено.', passwordSaved: '✅ Пароль сохранён.', sourceSaved: '✅ Обновлено.',
  descBad: (max) => `Не больше ${max} символов.`,
  nowPublic: 'Теперь открытый.', nowPrivate: 'Теперь закрытый.', paused: 'Приостановлен.', resumed: 'Возобновлён.',
  passwordRemoved: 'Пароль убран.', checkOk: '✅ Сервер отвечает.',
  newLinkConfirm: 'Сделать новое приглашение? Старое перестанет работать; участники останутся.',
  newLinkDone: 'Новое приглашение создано.',
  deleteConfirm: (v) => `Удалить ${v.name} из бота? Участникам сообщат.` +
    (v.kind === 'xtune' ? ' Их аккаунты останутся на сервере, пока вы не выполните xtune public del.' : ''),
  deleted: 'Удалено.',
  membersHeader: (t, n) => `👥 ${t}: участников ${n}`,
  membersEmpty: (v) => `В ${v.name} пока никто не вступил.`,
  joinedAgo: (t) => `вступил ${t}`,
  memberInactive: 'неактивен',
  kickHintXtune: 'Нажмите на метку, чтобы удалить участника: его аккаунт удалится с сервера.',
  kickHintShared: 'Нажмите на метку, чтобы удалить участника. Скопированные ссылки у него останутся.',
  kickConfirm: (label, kind) => `Удалить #${label}? Вступить снова он не сможет.` +
    (kind === 'xtune' ? '' : ' Скопированные ссылки у него останутся; задайте новые в «🔗 Ссылки».'),
  kickedDone: 'Удалён.',
  youWereKicked: (v) => `Владелец ${v.name} удалил вас.`,
  vpnRemoved: (v) => `${v.name} удалён из бота.`,
  vpnUpdated: (v) => `🔄 У ${v.name} новые данные для подключения.`,
  announced: (n) => `📢 Отправлено участникам: ${n}.`,
  vpnDown: (t, e) => `⚠️ ${t} не ответил на 3 проверки подряд и скрыт из каталога. ${e}`,
  vpnBack: (t) => `✅ ${t} снова отвечает и вернулся в каталог.`,
  ownerUnlisted: (v) => `🚫 После жалоб администраторы убрали ${v.name} из каталога. Приглашения работают.`,
  ownerDeleted: (v) => `🗑 После жалоб администраторы удалили ${v.name}.`,
  ownerBanned: '⛔ После жалоб администраторы удалили ваши VPN. Добавлять новые вы больше не можете.',
};

// ----------------------------------------------------------------------------- es
const es = {
  ...en,
  profile: {
    description:
      'VPN comunitaria 🌍\n\nVPN gratuitas compartidas por quienes las administran. Explora el directorio o abre una invitación, ' +
      'únete y recibe los datos de conexión. El dueño nunca sabe quién eres.\n\n' +
      '¿Tienes un servidor? Compártelo en público o con invitación privada, con contraseña opcional. ' +
      'Funciona mejor con xtune: cada miembro recibe su propia cuenta.\n\nCódigo abierto.',
    shortDescription: 'VPN gratuitas compartidas por sus dueños. Únete a una o comparte la tuya. Mejor con xtune. Código abierto.',
  },
  kb: { directory: '🌍 Directorio', joined: '📂 Mis VPN', add: '➕ Añadir VPN', mine: '🛠 Mis servidores', language: '🌐 Idioma', about: 'ℹ️ Acerca de' },

  welcome: (name) =>
    `¡Hola${name ? ` ${name}` : ''}! 👋 Encuentra una VPN compartida por la comunidad o comparte la tuya.\n\n` +
    '🌍 Directorio: VPN públicas\n📂 Mis VPN: a las que te uniste\n➕ Añadir VPN: comparte la tuya en público o por invitación\n' +
    '🛠 Mis servidores: gestiona lo que compartiste\n\n' +
    '⭐ ¿Tienes tu propio servidor? xtune encuentra las configuraciones que pasan por tu red y da a cada miembro su propia cuenta (ℹ️ Acerca de).',
  help: 'Usa los botones de abajo 👇',
  chooseLanguage: 'Elige tu idioma:',
  languageSet: (n) => `Idioma: ${n}`,
  about:
    '🌍 VPN comunitaria\n\nUn directorio de VPN compartidas por sus dueños. Únete a una para recibir sus datos de conexión. ' +
    'El dueño no sabe quién eres y tú no sabes quién es él.\n\n' +
    '⭐ Funciona mejor con xtune. Quien administra su servidor con xtune lo comparte como perfil público, y cada miembro ' +
    'recibe su propia cuenta con sus propios límites, así que se puede quitar a uno sin afectar a los demás:\n' +
    'xtune public add community --quota 20 --days 30 --members 100\ny luego envía el enlace de conexión a «➕ Añadir VPN».\n\n' +
    '🔒 Privacidad: el bot guarda tu id de Telegram y tu idioma, las VPN a las que te uniste o que añadiste y una etiqueta ' +
    'aleatoria por membresía. Los dueños solo ven etiquetas; un servidor xtune solo recibe la etiqueta. Las contraseñas se guardan con hash. De un servidor que gestiones aquí se guarda su enlace de gestión para poder llegar a él.\n\n' +
    '⚠️ El bot comprueba que los servidores respondan, no que funcionen en tu red. Usa VPN en las que confíes: el dueño ' +
    'del servidor ve el tráfico que no va cifrado.',
  btnXtune: '⭐ xtune en GitHub',

  now: 'ahora mismo', minutes: (n) => `hace ${n} min`, hours: (n) => `hace ${n} h`, days: (n) => `hace ${n} días`,
  unknown: 'desconocido',
  membersOf: (a, m) => `${a} de ${m} miembros`, membersCount: (a) => `${a} miembros`,
  limits: (q, d) => `por miembro: ${q}, ${d}`, gb: (n) => `${n} GB`, unlimited: 'ilimitado', daysN: (n) => `${n} días`,
  noExpiry: 'sin caducidad', expiresIn: (n) => `quedan ${n} días`,
  kinds: { xtune: '⭐ xtune: tu propia cuenta', sub: '📡 Enlace de suscripción', links: '🔗 Enlaces de conexión' },
  passwordNeeded: 'requiere contraseña',
  notChecked: '❔ No se comprueba automáticamente (enlaces)',
  reachable: (t) => `✅ El servidor responde (comprobado ${t})`,
  downNote: '⚠️ No responde: oculta del directorio',
  xtuneNote: 'Recibes tu propia cuenta en este servidor. El dueño solo ve una etiqueta aleatoria, no quién eres.',
  sharedNote: 'Todos reciben los mismos datos de conexión. El dueño nunca sabe quién eres.',

  dirEmpty: 'Aún no hay VPN públicas. Sé el primero: «➕ Añadir VPN».',
  dirTitle: (n) => `🌍 VPN públicas: ${n}`,
  btnJoin: '🔑 Unirme', btnJoinPassword: '🔑 Unirme (contraseña)', btnShow: '📋 Datos de conexión',
  btnReport: '🚩 Denunciar', btnBack: '⬅️ Atrás', btnCancel: '✖️ Cancelar', btnYes: '✅ Sí', btnNo: '✖️ No',
  btnLeave: '🚪 Salir', btnPage: '🌐 Página de consumo', btnManage: '🛠 Gestionar',
  cancelled: 'Cancelado.',
  expired: 'Pasó demasiado tiempo y se canceló. Vuelve a empezar desde los botones de abajo.',

  invalidLink: 'Esta invitación ya no existe. Pide una nueva.',
  ownVpn: 'Es tu propia VPN 🙂 Envía su enlace de invitación a otros.',
  kicked: (v) => `El dueño de ${v.name} te quitó, así que no puedes volver a unirte.`,
  unavailable: (v) => `${v.name} no acepta miembros nuevos ahora. Inténtalo más tarde.`,
  locked: (m) => `Demasiadas contraseñas incorrectas. Inténtalo en ${m} min.`,
  passwordPrompt: (v) => `🔒 ${v.name} requiere contraseña. Envíala ahora (tu mensaje se borra al instante).`,
  wrongPassword: (n) => `Contraseña incorrecta. Te quedan ${n} intentos.`,
  joined: (v) => `🎉 Te uniste a ${v.name}. Tus datos de conexión están abajo y también quedan en «📂 Mis VPN».`,
  joinErrors: {
    full: '😕 Esta VPN está llena. Inténtalo más tarde o elige otra.',
    paused: '⏸ Esta VPN no acepta miembros nuevos ahora.',
    gone: 'Esta VPN ya no existe en su servidor. El dueño tiene que actualizarla.',
    busy: 'Mucha gente se está uniendo ahora. Inténtalo en un minuto.',
    unreachable: 'El servidor no respondió. Inténtalo más tarde.',
  },
  yourLink: '🔗 Tu propio enlace de suscripción (no lo compartas):',
  sharedLink: '🔗 Enlace de suscripción:',
  sharedLinks: '🔗 Enlaces de conexión:',
  importHint: 'Añádelo en tu app (v2rayNG, Hiddify, Streisand, NekoBox…) como suscripción o escanea el código QR.',
  importHintLinks: 'Cópialos en tu app (v2rayNG, Hiddify, Streisand, NekoBox…).',

  joinedEmpty: 'Aún no te has unido a ninguna VPN. Busca una en «🌍 Directorio» o abre un enlace de invitación.',
  joinedTitle: (n) => `📂 Tus VPN: ${n}`,
  notMember: 'Ya no eres miembro.',
  leaveConfirm: (v) => `¿Salir de ${v.name}? ${v.kind === 'xtune' ? 'Tu cuenta en el servidor se elimina.' : ''}`,
  left: (v) => `Saliste de ${v.name}.`,
  notYours: 'Eso no es tuyo.',

  reportWhy: '¿Qué le pasa a esta VPN?',
  reasons: { illegal: '⚖️ Uso ilegal', scam: '💸 Estafa o venta', dead: '💀 No funciona' },
  reported: 'Gracias, los administradores lo revisarán.', alreadyReported: 'Ya la denunciaste.',

  bannedOwner: 'Ya no puedes añadir VPN.',
  tooManyVpns: (n) => `Ya tienes ${n} VPN, el máximo permitido. Borra una primero.`,
  addSource:
    '➕ Envía lo que recibirán los miembros:\n\n' +
    '⭐ un enlace de conexión de xtune (en tu servidor: xtune public add NAME): cada miembro recibe su propia cuenta\n' +
    '📡 un enlace de suscripción (https://…)\n🔗 o enlaces de conexión (vless://, hysteria2://, ss://, …), uno por línea\n\n' +
    'Tu mensaje se borra al instante. ¿Aún no tienes servidor? xtune lo prepara: «ℹ️ Acerca de».',
  sourceError: (e) => ({
    empty: 'Envía un enlace.', tooMany: 'Como mucho 20 enlaces.', tooLong: 'Es demasiado largo para un mensaje.',
    unknown: 'Eso no es un enlace de conexión de xtune, ni una suscripción, ni enlaces de conexión. Inténtalo otra vez.',
  })[e],
  sourceKindChanged: (k) => `Envía el mismo tipo que antes (${es.kinds[k]}).`,
  alreadyAdded: 'Esta ya está en el bot.',
  portBlocked: (p, xtune) => `Este enlace usa el puerto ${p}, pero el bot solo llega a los puertos 443 y 80.` +
    (xtune ? '\n\nActualiza xtune en el servidor (sudo xtune self-update, v0.7.1 o posterior) y vuelve a obtener el enlace: ' +
      'xtune public link NAME o xtune manage link. El servidor de suscripciones escuchará también en 443 y el enlace no llevará puerto.'
      : '\n\nUsa una dirección en el puerto 443.'),
  checking: '🔍 Comprobando…',
  sourceFailedKind: {
    xtune: 'No se pudo llegar al enlace de conexión de xtune.',
    sub: 'No se pudo leer esa suscripción.',
    links: 'No se pudieron leer esos enlaces.',
  },
  errors: {
    unreachable: 'El servidor no respondió.',
    gone: 'No existe en el servidor (¿se cambió el enlace o se borró el perfil?).',
    empty: 'No tiene enlaces que las apps puedan usar.',
    busy: 'El servidor está ocupado; inténtalo en un minuto.',
  },
  btnUseName: (n) => `Usar «${n}»`,
  addName: (kind, max) => `¿Cómo se llama? (hasta ${max} caracteres)`,
  nameBad: (max) => `Envía un nombre de hasta ${max} caracteres.`,
  chooseCountry: '¿Dónde está el servidor?',
  btnNoCountry: '🌐 Omitir',
  addVisibility: '¿Quién puede unirse?\n\n🌍 Pública: aparece en el directorio y cualquiera puede unirse.\n🔒 Privada: solo quienes reciban tu enlace de invitación.',
  btnPublic: '🌍 Pública', btnPrivate: '🔒 Privada (invitación)',
  addPassword: (max) => `¿Proteger la invitación con contraseña? Envíala (hasta ${max} caracteres) o toca «Sin contraseña».`,
  btnNoPassword: '🔓 Sin contraseña',
  passwordBad: (max) => `Envía una contraseña de hasta ${max} caracteres.`,
  added: (v, link) =>
    `✅ ${v.name} añadida.\n\nEnlace de invitación:\n${link}\n\n` +
    (v.public ? 'También aparece en «🌍 Directorio».' : 'Envíalo a quienes quieras invitar.') +
    (v.password ? ' Necesitarán la contraseña.' : ''),

  ownedEmpty: 'Aún no has compartido ninguna VPN.',
  ownedTitle: (n) => `🛠 Tus VPN: ${n}`,
  btnAddVpn: '➕ Añadir VPN',
  isPublic: '🌍 Pública', isPrivate: '🔒 Privada',
  pausedNote: 'En pausa: oculta y sin miembros nuevos',
  unlistedNote: 'Los administradores la quitaron del directorio',
  passwordOn: 'con contraseña', passwordOff: 'sin contraseña',
  inviteLink: '🔗 Enlace de invitación:',
  btnName: '✏️ Nombre', btnDesc: '📝 Descripción', btnCountry: '🏳️ País',
  btnMakePrivate: '🔒 Hacer privada', btnMakePublic: '🌍 Hacer pública',
  btnPasswordSet: '🔑 Poner contraseña', btnPasswordChange: '🔑 Cambiar contraseña', btnPasswordRemove: '🔓 Quitar contraseña',
  btnMembers: '👥 Miembros', btnAnnounce: '📢 Anuncio',
  btnSource: (k) => (k === 'xtune' ? '🔗 Enlace de conexión' : k === 'sub' ? '🔗 Enlace de suscripción' : '🔗 Enlaces'),
  btnCheck: '🔍 Comprobar', btnPause: '⏸ Pausar', btnResume: '▶️ Reanudar', btnNewLink: '🔄 Nueva invitación',
  btnDelete: '🗑 Borrar', btnDescRemove: '🗑 Quitar descripción',
  editName: (v, max) => `Envía el nuevo nombre (hasta ${max} caracteres). Ahora: ${v.name}`,
  editDesc: (v, max) => `Envía una descripción corta (hasta ${max} caracteres): velocidad, reglas, cuánto durará…`,
  editPassword: (max) => `Envía la nueva contraseña (hasta ${max} caracteres). Los miembros actuales se quedan.`,
  editSource: (k) => (k === 'xtune'
    ? 'Envía el nuevo enlace de conexión (xtune public token NAME). Los miembros conservan sus cuentas.'
    : 'Envía los nuevos enlaces. Se avisará a los miembros para que los vuelvan a tomar.'),
  announcePrompt: (v) => `📢 Envía el mensaje para los miembros de ${v.name} (solo texto).`,
  announceWait: (m) => `Podrás anunciar otra vez en ${m} min.`,
  textOnly: 'Envía texto, por favor.',
  saved: '✅ Guardado.', passwordSaved: '✅ Contraseña guardada.', sourceSaved: '✅ Actualizado.',
  descBad: (max) => `Como mucho ${max} caracteres.`,
  nowPublic: 'Ahora es pública.', nowPrivate: 'Ahora es privada.', paused: 'En pausa.', resumed: 'Reanudada.',
  passwordRemoved: 'Contraseña quitada.', checkOk: '✅ El servidor responde.',
  newLinkConfirm: '¿Crear una nueva invitación? La anterior deja de funcionar; los miembros se quedan.',
  newLinkDone: 'Nueva invitación creada.',
  deleteConfirm: (v) => `¿Borrar ${v.name} del bot? Se avisará a los miembros.` +
    (v.kind === 'xtune' ? ' Sus cuentas siguen en tu servidor hasta que ejecutes xtune public del.' : ''),
  deleted: 'Borrada.',
  membersHeader: (t, n) => `👥 ${t}: ${n} miembros`,
  membersEmpty: (v) => `Nadie se ha unido a ${v.name} todavía.`,
  joinedAgo: (t) => `se unió ${t}`,
  memberInactive: 'inactivo',
  kickHintXtune: 'Toca una etiqueta para quitar a ese miembro: su cuenta se borra del servidor.',
  kickHintShared: 'Toca una etiqueta para quitar a ese miembro. Conserva los enlaces que ya copió.',
  kickConfirm: (label, kind) => `¿Quitar a #${label}? No podrá volver a unirse.` +
    (kind === 'xtune' ? '' : ' Conserva los enlaces que ya copió; pon otros nuevos con «🔗 Enlaces».'),
  kickedDone: 'Quitado.',
  youWereKicked: (v) => `El dueño de ${v.name} te quitó.`,
  vpnRemoved: (v) => `${v.name} se quitó del bot.`,
  vpnUpdated: (v) => `🔄 ${v.name} tiene nuevos datos de conexión.`,
  announced: (n) => `📢 Enviado a ${n} miembros.`,
  vpnDown: (t, e) => `⚠️ ${t} no respondió a 3 comprobaciones seguidas y se ocultó del directorio. ${e}`,
  vpnBack: (t) => `✅ ${t} responde de nuevo y volvió al directorio.`,
  ownerUnlisted: (v) => `🚫 Tras varias denuncias, los administradores quitaron ${v.name} del directorio. Las invitaciones siguen funcionando.`,
  ownerDeleted: (v) => `🗑 Tras varias denuncias, los administradores borraron ${v.name}.`,
  ownerBanned: '⛔ Tras varias denuncias, los administradores borraron tus VPN. Ya no puedes añadir más.',
};

// --------------------------------------------------------------- managed servers
// 🖥 Manage a server (lib/servers.js): each language's words, composed in composeSrv().

function composeSrv(locale, w, num, ago) {
  const gb = (bytes) => num((bytes / (1 << 30)).toFixed(bytes < (1 << 30) * 10 ? 1 : 0));
  const icon = (s) => ({ active: '🟢', disabled: '⚪️' })[s] ?? '🔴';
  const expiry = (ts) => {
    if (!ts) return w.never;
    const d = Math.ceil((ts - Date.now() / 1000) / 86400);
    return d <= 0 ? w.expired : w.daysLeft(num(d));
  };
  // a schedule in seconds: whole days past one, hours otherwise
  const every = (sec) => (sec > 86400 && sec % 86400 === 0 ? w.daysN(num(sec / 86400)) : w.hoursN(num(Math.round(sec / 3600))));
  const quota = (u) => (u.quota > 0 ? `${gb(u.used)} / ${gb(u.quota)} GB` : `${gb(u.used)} GB · ${w.unlimited}`);
  return {
    ...w, icon,
    status: (srv, s) => (s.role === 'reseller'
      ? [
        `🖥 ${s.reseller} (${w.reseller})`, '',
        `👥 ${num(s.users)}${s.maxUsers ? ` / ${num(s.maxUsers)}` : ''} ${w.usersWord}`,
        `📦 ${gb(s.assigned)}${s.quotaGB ? ` / ${num(s.quotaGB)}` : ''} GB ${w.assignedWord}`,
        `📶 ${gb(s.traffic)} GB`,
      ].join('\n')
      : [
        `🖥 ${s.addr}`, '',
        `Xray: ${s.xray ?? '?'}`,
        `${w.subWord}: ${s.sub ?? '?'}`,
        `👥 ${w.usersLine(num(s.users), num(s.active), num(s.online))}`,
        `📶 ${gb(s.traffic)} GB`,
        ...(s.ipBlocked ? ['', `⛔ ${w.ipBlocked(s.ipBlocked.replace(/\.$/, ''))}`] : []),
        ...(s.backup ? [`💾 ${w.backupLine(every(s.backup.every), s.backup.last && ago(s.backup.last))}`] : []),
        ...(s.backup?.error ? [`⚠️ ${w.backupFailed(s.backup.error)}`] : []),
        ...(s.workers ?? []).map((x) => `${s.workerMax && x.requests >= s.workerMax * 0.8 ? '⚠️' : '☁️'} ` +
          w.workerLine(x.host, num(x.requests), s.workerMax ? num(s.workerMax) : '')),
        '', w.configsWord,
        ...(s.configs ?? []).map((c) => `• ${c.id}: ` + ({
          active: `🟢 ${w.usedAgo(ago(c.since))}`,
          quiet: `⚠️ ${w.quietSince(ago(c.since))}`,
          follower: `↪️ ${c.server ?? ''}`,
        }[c.state] ?? `▫️ ${w.idle}`)),
        '', `xtune ${s.version}`,
      ].join('\n')),
    usersList: (srv, shown, total, page, pages) => [
      `👥 ${srv.name}: ${num(total)}${pages > 1 ? ` (${num(page)}/${num(pages)})` : ''}`, '',
      ...shown.map((u) => `${icon(u.status)} ${u.name} · ${quota(u)} · ${expiry(u.expires)}`),
    ].join('\n'),
    userCard: (u) => [
      `${icon(u.status)} ${u.name} · ${w.statuses[u.status] ?? u.status}`, '',
      `📦 ${quota(u)}`,
      `⏳ ${expiry(u.expires)}`,
      `📱 ${num(u.online)}${u.devices ? ` / ${num(u.devices)}` : ''} ${w.devicesWord}`,
      u.plan ? `📋 ${u.plan}` : null,
      u.reset ? `🔁 ${w.resets[u.reset] ?? u.reset}` : null,
      u.pool ? `🌍 ${u.pool}` : null,
      u.daily ? `📈 ${w.last30(gb(u.daily.reduce((a, b) => a + b, 0)))}` : null,
    ].filter((l) => l !== null).join('\n'),
    plansList: (plans) => (plans.length
      ? [w.plansTitle, '', ...plans.map((p) =>
        `📋 ${p.name}: ${p.quotaGB ? `${num(p.quotaGB)} GB` : w.unlimited}, ${p.days ? w.daysN(num(p.days)) : w.never}` +
        (p.devices ? `, ${num(p.devices)} ${w.devicesWord}` : ''))].join('\n')
      : w.noPlans),
    subCaption: (u) => `🔗 ${u.name}\n\n${u.sub}\n\n📦 ${quota(u)} · ⏳ ${expiry(u.expires)}`,
  };
}

const srvEn = {
  btnManage: '🖥 Manage a server', reseller: 'reseller',
  serversTitle: (n) => `🖥 Managed servers: ${n}`,
  manageHint: '🖥 Manage a server: send an xtune management link (xtune manage link) to manage its users and plans here.',
  addPrompt: '🖥 Send the management link: on your server run\nxtune manage link\n(or a reseller link from xtune manage reseller add NAME). Your message is deleted right away.',
  notALink: 'That\'s not an xtune management link (https://…/adm/…). Try again.',
  errors: { gone: 'The server doesn\'t know this link anymore (xtune manage token makes a new one).', unreachable: 'The server didn\'t answer. Try again later.' },
  btnRefresh: '🔄 Refresh', btnRemove: '🗑 Remove from bot', btnUsers: '👥 Users', btnAddUser: '➕ Add user', btnPlans: '📋 Plans',
  btnLinks: '🔗 Links', btnLimits: '✏️ Limits', btnRenew: '🔄 Renew', btnEnable: '▶️ Enable', btnDisable: '⏸ Disable',
  btnResetUsage: '♻️ Reset usage', btnRotate: '🔑 New keys', btnResetSub: '🔁 New sub link', btnDelete: '🗑 Delete',
  btnAddPlan: '➕ Add plan', btnRenewSame: '🔄 Same terms',
  noUsers: 'No users yet.',
  usersWord: 'users', assignedWord: 'assigned', subWord: 'Subscription', configsWord: 'Configs:', devicesWord: 'devices',
  usersLine: (n, a, o) => `${n} users · ${a} active · ${o} online`,
  ipBlocked: (why) => `The server's IP looks blocked: ${why}.\nOn the server: xtune migrate --to NEWHOST, or xtune autopilot digitalocean to move it by itself.`,
  backupLine: (every, last) => `Backups every ${every}` + (last ? `, last ${last}` : ', none sent yet'),
  backupFailed: (err) => `The last backup failed: ${err}`, hoursN: (n) => `${n} hours`,
  workerLine: (host, n, max) => `${host}: ${n}${max ? ` / ${max}` : ''} requests today`,
  usedAgo: (t) => `used ${t}`, quietSince: (t) => `no traffic since ${t}: probably blocked`, idle: 'no traffic yet',
  never: 'never expires', expired: 'expired', daysLeft: (n) => `${n} days left`, daysN: (n) => `${n} days`, unlimited: 'unlimited',
  statuses: { active: 'active', disabled: 'disabled', expired: 'expired', 'over quota': 'over quota' },
  resets: { monthly: 'usage resets monthly', weekly: 'usage resets weekly' },
  last30: (x) => `last 30 days: ${x} GB`,
  plansTitle: '📋 Plans', noPlans: 'No plans yet. A plan is a named set of limits for adding and renewing users.',
  linksHeader: (n) => `🔗 ${n}: share links`,
  addUserPrompt: '➕ Send the new user:\nNAME [quota GB] [days] [devices]   e.g. carol 50 30 2\nor NAME PLAN   e.g. dave basic\n(0 = unlimited / never)',
  limitPrompt: (n) => `✏️ New limits for ${n}:\nquota GB, days from today, devices; - keeps one\ne.g. 100 30 -   (0 = unlimited / never)`,
  planPrompt: '➕ Send the plan:\nNAME quota GB days [devices]   e.g. basic 50 30 2',
  renewWhich: (n) => `🔄 Renew ${n}: from their current expiry, with usage from zero.`,
  renewed: '✅ Renewed.', enabled: '✅ Enabled.', disabled: '⏸ Disabled.', usageReset: '♻️ Usage starts from zero.',
  rotateConfirm: (n) => `🔑 New keys for ${n}? Their current links stop working; their subscription updates by itself.`,
  rotated: '🔑 New keys made.',
  resetSubConfirm: (n) => `🔁 New subscription link for ${n}? The old link stops working; they need the new one.`,
  subReset: '🔁 New subscription link made.',
  deleteConfirm: (n) => `🗑 Delete ${n} from the server? This can't be undone.`,
  deleted: (n) => `${n} deleted.`, planDeleted: (n) => `Plan ${n} deleted.`, added: (n) => `✅ ${n} added.`, limitsSaved: '✅ Limits saved.',
  removeConfirm: (s) => `Remove ${s.name} from the bot? The link keeps working on the server until you run xtune manage token.`,
  removed: 'Removed.',
};

const srvFa = {
  btnManage: '🖥 مدیریت سرور', reseller: 'نماینده',
  serversTitle: (n) => `🖥 سرورهای تحت مدیریت: ${n}`,
  manageHint: '🖥 مدیریت سرور: لینک مدیریت xtune (xtune manage link) رو بفرست تا کاربرها و پلن‌هاش رو همین‌جا مدیریت کنی.',
  addPrompt: '🖥 لینک مدیریت رو بفرست: روی سرورت اجرا کن\nxtune manage link\n(یا لینک نماینده از xtune manage reseller add NAME). پیامت فوراً پاک می‌شه.',
  notALink: 'این لینک مدیریت xtune نیست (https://…/adm/…). دوباره امتحان کن.',
  errors: { gone: 'سرور دیگه این لینک رو نمی‌شناسه (xtune manage token یه لینک جدید می‌سازه).', unreachable: 'سرور جواب نداد. بعداً امتحان کن.' },
  btnRefresh: '🔄 به‌روزرسانی', btnRemove: '🗑 حذف از ربات', btnUsers: '👥 کاربرها', btnAddUser: '➕ کاربر جدید', btnPlans: '📋 پلن‌ها',
  btnLinks: '🔗 لینک‌ها', btnLimits: '✏️ محدودیت‌ها', btnRenew: '🔄 تمدید', btnEnable: '▶️ فعال کن', btnDisable: '⏸ غیرفعال کن',
  btnResetUsage: '♻️ صفر کردن مصرف', btnRotate: '🔑 کلید جدید', btnResetSub: '🔁 لینک سابسکریپشن جدید', btnDelete: '🗑 حذف',
  btnAddPlan: '➕ پلن جدید', btnRenewSame: '🔄 با همون شرایط',
  noUsers: 'هنوز کاربری نیست.',
  usersWord: 'کاربر', assignedWord: 'تخصیص‌داده‌شده', subWord: 'سابسکریپشن', configsWord: 'کانفیگ‌ها:', devicesWord: 'دستگاه',
  usersLine: (n, a, o) => `${n} کاربر · ${a} فعال · ${o} آنلاین`,
  ipBlocked: (why) => `به نظر می‌رسه آی‌پی سرور مسدود شده: ${why}.\nروی سرور: xtune migrate --to NEWHOST، یا xtune autopilot digitalocean تا خودش جابه‌جا بشه.`,
  backupLine: (every, last) => `بکاپ هر ${every}` + (last ? `، آخرین: ${last}` : '، هنوز بکاپی فرستاده نشده'),
  backupFailed: (err) => `آخرین بکاپ ناموفق بود: ${err}`, hoursN: (n) => `${n} ساعت`,
  workerLine: (host, n, max) => `${host}: ${n}${max ? ` / ${max}` : ''} درخواست امروز`,
  usedAgo: (t) => `استفاده: ${t}`, quietSince: (t) => `بی‌ترافیک از ${t}: احتمالاً مسدود شده`, idle: 'هنوز ترافیکی نداشته',
  never: 'بدون انقضا', expired: 'منقضی شده', daysLeft: (n) => `${n} روز مونده`, daysN: (n) => `${n} روز`, unlimited: 'نامحدود',
  statuses: { active: 'فعال', disabled: 'غیرفعال', expired: 'منقضی', 'over quota': 'حجم تموم شده' },
  resets: { monthly: 'مصرف ماهانه صفر می‌شه', weekly: 'مصرف هفتگی صفر می‌شه' },
  last30: (x) => `۳۰ روز اخیر: ${x} گیگ`,
  plansTitle: '📋 پلن‌ها', noPlans: 'هنوز پلنی نیست. پلن یه مجموعه‌ی اسم‌دار از محدودیت‌هاست برای ساختن و تمدید کاربرها.',
  linksHeader: (n) => `🔗 ${n}: لینک‌های اتصال`,
  addUserPrompt: '➕ کاربر جدید رو بفرست:\nاسم [حجم گیگ] [روز] [دستگاه]   مثلاً carol 50 30 2\nیا اسم پلن   مثلاً dave basic\n(۰ = نامحدود / بدون انقضا)',
  limitPrompt: (n) => `✏️ محدودیت‌های جدید ${n}:\nحجم گیگ، روز از امروز، دستگاه؛ - یعنی دست نزن\nمثلاً 100 30 -   (۰ = نامحدود / بدون انقضا)`,
  planPrompt: '➕ پلن رو بفرست:\nاسم حجم‌گیگ روز [دستگاه]   مثلاً basic 50 30 2',
  renewWhich: (n) => `🔄 تمدید ${n}: از تاریخ انقضای فعلی، با مصرف از صفر.`,
  renewed: '✅ تمدید شد.', enabled: '✅ فعال شد.', disabled: '⏸ غیرفعال شد.', usageReset: '♻️ مصرف از صفر شروع می‌شه.',
  rotateConfirm: (n) => `🔑 کلید جدید برای ${n}؟ لینک‌های فعلیش کار نمی‌کنن؛ سابسکریپشنش خودش به‌روز می‌شه.`,
  rotated: '🔑 کلید جدید ساخته شد.',
  resetSubConfirm: (n) => `🔁 لینک سابسکریپشن جدید برای ${n}؟ لینک قبلی کار نمی‌کنه و لینک جدید رو لازم داره.`,
  subReset: '🔁 لینک سابسکریپشن جدید ساخته شد.',
  deleteConfirm: (n) => `🗑 ${n} از سرور حذف بشه؟ برگشت‌پذیر نیست.`,
  deleted: (n) => `${n} حذف شد.`, planDeleted: (n) => `پلن ${n} حذف شد.`, added: (n) => `✅ ${n} اضافه شد.`, limitsSaved: '✅ محدودیت‌ها ذخیره شد.',
  removeConfirm: (s) => `${s.name} از ربات حذف بشه؟ لینک روی سرور کار می‌کنه تا وقتی xtune manage token رو اجرا کنی.`,
  removed: 'حذف شد.',
};

const srvAr = {
  btnManage: '🖥 إدارة خادم', reseller: 'موزّع',
  serversTitle: (n) => `🖥 الخوادم المُدارة: ${n}`,
  manageHint: '🖥 إدارة خادم: أرسل رابط إدارة xtune (xtune manage link) لإدارة مستخدميه وخططه من هنا.',
  addPrompt: '🖥 أرسل رابط الإدارة: شغّل على خادمك\nxtune manage link\n(أو رابط موزّع من xtune manage reseller add NAME). تُحذف رسالتك فوراً.',
  notALink: 'هذا ليس رابط إدارة xtune (https://…/adm/…). حاول مجدداً.',
  errors: { gone: 'لم يعد الخادم يعرف هذا الرابط (xtune manage token ينشئ رابطاً جديداً).', unreachable: 'لم يستجب الخادم. حاول لاحقاً.' },
  btnRefresh: '🔄 تحديث', btnRemove: '🗑 إزالة من البوت', btnUsers: '👥 المستخدمون', btnAddUser: '➕ مستخدم جديد', btnPlans: '📋 الخطط',
  btnLinks: '🔗 الروابط', btnLimits: '✏️ الحدود', btnRenew: '🔄 تجديد', btnEnable: '▶️ تفعيل', btnDisable: '⏸ تعطيل',
  btnResetUsage: '♻️ تصفير الاستهلاك', btnRotate: '🔑 مفاتيح جديدة', btnResetSub: '🔁 رابط اشتراك جديد', btnDelete: '🗑 حذف',
  btnAddPlan: '➕ خطة جديدة', btnRenewSame: '🔄 بالشروط نفسها',
  noUsers: 'لا يوجد مستخدمون بعد.',
  usersWord: 'مستخدم', assignedWord: 'مخصّص', subWord: 'الاشتراك', configsWord: 'الإعدادات:', devicesWord: 'أجهزة',
  usersLine: (n, a, o) => `${n} مستخدم · ${a} نشط · ${o} متصل`,
  ipBlocked: (why) => `يبدو أن عنوان IP للخادم محجوب: ${why}.\nعلى الخادم: xtune migrate --to NEWHOST، أو xtune autopilot digitalocean لينتقل تلقائيًا.`,
  backupLine: (every, last) => `نسخ احتياطي كل ${every}` + (last ? `، آخرها ${last}` : '، لم تُرسل أي نسخة بعد'),
  backupFailed: (err) => `فشلت آخر نسخة احتياطية: ${err}`, hoursN: (n) => `${n} ساعة`,
  workerLine: (host, n, max) => `${host}: ${n}${max ? ` / ${max}` : ''} طلب اليوم`,
  usedAgo: (t) => `استُخدم ${t}`, quietSince: (t) => `بلا حركة منذ ${t}: غالباً محجوب`, idle: 'لا حركة بعد',
  never: 'بلا انتهاء', expired: 'منتهٍ', daysLeft: (n) => `بقي ${n} يوم`, daysN: (n) => `${n} يوم`, unlimited: 'غير محدود',
  statuses: { active: 'نشط', disabled: 'معطّل', expired: 'منتهٍ', 'over quota': 'تجاوز الحصة' },
  resets: { monthly: 'يُصفَّر الاستهلاك شهرياً', weekly: 'يُصفَّر الاستهلاك أسبوعياً' },
  last30: (x) => `آخر ٣٠ يوماً: ${x} غيغابايت`,
  plansTitle: '📋 الخطط', noPlans: 'لا توجد خطط بعد. الخطة مجموعة حدود باسم لإضافة المستخدمين وتجديدهم.',
  linksHeader: (n) => `🔗 ${n}: روابط الاتصال`,
  addUserPrompt: '➕ أرسل المستخدم الجديد:\nالاسم [الحصة GB] [الأيام] [الأجهزة]   مثال carol 50 30 2\nأو الاسم الخطة   مثال dave basic\n(٠ = غير محدود / بلا انتهاء)',
  limitPrompt: (n) => `✏️ حدود جديدة لـ ${n}:\nالحصة GB، الأيام من اليوم، الأجهزة؛ - يُبقي القيمة\nمثال 100 30 -   (٠ = غير محدود / بلا انتهاء)`,
  planPrompt: '➕ أرسل الخطة:\nالاسم الحصة‌GB الأيام [الأجهزة]   مثال basic 50 30 2',
  renewWhich: (n) => `🔄 تجديد ${n}: من تاريخ الانتهاء الحالي، مع تصفير الاستهلاك.`,
  renewed: '✅ جُدّد.', enabled: '✅ فُعّل.', disabled: '⏸ عُطّل.', usageReset: '♻️ يبدأ الاستهلاك من الصفر.',
  rotateConfirm: (n) => `🔑 مفاتيح جديدة لـ ${n}؟ تتوقف روابطه الحالية؛ يتحدّث اشتراكه تلقائياً.`,
  rotated: '🔑 أُنشئت مفاتيح جديدة.',
  resetSubConfirm: (n) => `🔁 رابط اشتراك جديد لـ ${n}؟ يتوقف الرابط القديم ويحتاج الرابط الجديد.`,
  subReset: '🔁 أُنشئ رابط اشتراك جديد.',
  deleteConfirm: (n) => `🗑 حذف ${n} من الخادم؟ لا يمكن التراجع.`,
  deleted: (n) => `حُذف ${n}.`, planDeleted: (n) => `حُذفت الخطة ${n}.`, added: (n) => `✅ أُضيف ${n}.`, limitsSaved: '✅ حُفظت الحدود.',
  removeConfirm: (s) => `إزالة ${s.name} من البوت؟ يبقى الرابط صالحاً على الخادم حتى تشغّل xtune manage token.`,
  removed: 'أُزيل.',
};

const srvRu = {
  btnManage: '🖥 Управлять сервером', reseller: 'реселлер',
  serversTitle: (n) => `🖥 Управляемые серверы: ${n}`,
  manageHint: '🖥 Управлять сервером: отправьте ссылку управления xtune (xtune manage link), чтобы управлять пользователями и тарифами здесь.',
  addPrompt: '🖥 Отправьте ссылку управления: на сервере выполните\nxtune manage link\n(или ссылку реселлера из xtune manage reseller add NAME). Сообщение сразу удаляется.',
  notALink: 'Это не ссылка управления xtune (https://…/adm/…). Попробуйте ещё раз.',
  errors: { gone: 'Сервер больше не знает эту ссылку (xtune manage token создаёт новую).', unreachable: 'Сервер не ответил. Попробуйте позже.' },
  btnRefresh: '🔄 Обновить', btnRemove: '🗑 Убрать из бота', btnUsers: '👥 Пользователи', btnAddUser: '➕ Новый пользователь', btnPlans: '📋 Тарифы',
  btnLinks: '🔗 Ссылки', btnLimits: '✏️ Лимиты', btnRenew: '🔄 Продлить', btnEnable: '▶️ Включить', btnDisable: '⏸ Отключить',
  btnResetUsage: '♻️ Сбросить расход', btnRotate: '🔑 Новые ключи', btnResetSub: '🔁 Новая ссылка подписки', btnDelete: '🗑 Удалить',
  btnAddPlan: '➕ Новый тариф', btnRenewSame: '🔄 На тех же условиях',
  noUsers: 'Пользователей пока нет.',
  usersWord: 'пользователей', assignedWord: 'выделено', subWord: 'Подписка', configsWord: 'Конфиги:', devicesWord: 'устройств',
  usersLine: (n, a, o) => `${n} пользователей · ${a} активных · ${o} онлайн`,
  ipBlocked: (why) => `Похоже, IP сервера заблокирован: ${why}.\nНа сервере: xtune migrate --to NEWHOST или xtune autopilot digitalocean, чтобы сервер переезжал сам.`,
  backupLine: (every, last) => `Резервные копии каждые ${every}` + (last ? `, последняя ${last}` : ', пока ни одной'),
  backupFailed: (err) => `Последняя резервная копия не удалась: ${err}`, hoursN: (n) => `${n} ч`,
  workerLine: (host, n, max) => `${host}: ${n}${max ? ` / ${max}` : ''} запросов сегодня`,
  usedAgo: (t) => `использовался ${t}`, quietSince: (t) => `нет трафика с ${t}: вероятно, заблокирован`, idle: 'трафика ещё не было',
  never: 'бессрочно', expired: 'истёк', daysLeft: (n) => `осталось ${n} дн`, daysN: (n) => `${n} дн`, unlimited: 'без лимита',
  statuses: { active: 'активен', disabled: 'отключён', expired: 'истёк', 'over quota': 'лимит исчерпан' },
  resets: { monthly: 'расход сбрасывается ежемесячно', weekly: 'расход сбрасывается еженедельно' },
  last30: (x) => `за 30 дней: ${x} ГБ`,
  plansTitle: '📋 Тарифы', noPlans: 'Тарифов пока нет. Тариф — это именованный набор лимитов для добавления и продления.',
  linksHeader: (n) => `🔗 ${n}: ссылки подключения`,
  addUserPrompt: '➕ Отправьте нового пользователя:\nИМЯ [ГБ] [дней] [устройств]   например carol 50 30 2\nили ИМЯ ТАРИФ   например dave basic\n(0 = без лимита / бессрочно)',
  limitPrompt: (n) => `✏️ Новые лимиты для ${n}:\nГБ, дней от сегодня, устройств; - оставляет как есть\nнапример 100 30 -   (0 = без лимита / бессрочно)`,
  planPrompt: '➕ Отправьте тариф:\nИМЯ ГБ дней [устройств]   например basic 50 30 2',
  renewWhich: (n) => `🔄 Продлить ${n}: от текущей даты окончания, расход с нуля.`,
  renewed: '✅ Продлено.', enabled: '✅ Включён.', disabled: '⏸ Отключён.', usageReset: '♻️ Расход начинается с нуля.',
  rotateConfirm: (n) => `🔑 Новые ключи для ${n}? Текущие ссылки перестанут работать; подписка обновится сама.`,
  rotated: '🔑 Новые ключи созданы.',
  resetSubConfirm: (n) => `🔁 Новая ссылка подписки для ${n}? Старая перестанет работать, нужна новая.`,
  subReset: '🔁 Новая ссылка подписки создана.',
  deleteConfirm: (n) => `🗑 Удалить ${n} с сервера? Это необратимо.`,
  deleted: (n) => `${n} удалён.`, planDeleted: (n) => `Тариф ${n} удалён.`, added: (n) => `✅ ${n} добавлен.`, limitsSaved: '✅ Лимиты сохранены.',
  removeConfirm: (s) => `Убрать ${s.name} из бота? Ссылка продолжит работать на сервере, пока вы не выполните xtune manage token.`,
  removed: 'Убрано.',
};

const srvEs = {
  btnManage: '🖥 Gestionar un servidor', reseller: 'revendedor',
  serversTitle: (n) => `🖥 Servidores gestionados: ${n}`,
  manageHint: '🖥 Gestionar un servidor: envía un enlace de gestión de xtune (xtune manage link) para gestionar aquí sus usuarios y planes.',
  addPrompt: '🖥 Envía el enlace de gestión: en tu servidor ejecuta\nxtune manage link\n(o un enlace de revendedor de xtune manage reseller add NAME). Tu mensaje se borra al instante.',
  notALink: 'Eso no es un enlace de gestión de xtune (https://…/adm/…). Inténtalo otra vez.',
  errors: { gone: 'El servidor ya no reconoce este enlace (xtune manage token crea uno nuevo).', unreachable: 'El servidor no respondió. Inténtalo más tarde.' },
  btnRefresh: '🔄 Actualizar', btnRemove: '🗑 Quitar del bot', btnUsers: '👥 Usuarios', btnAddUser: '➕ Nuevo usuario', btnPlans: '📋 Planes',
  btnLinks: '🔗 Enlaces', btnLimits: '✏️ Límites', btnRenew: '🔄 Renovar', btnEnable: '▶️ Activar', btnDisable: '⏸ Desactivar',
  btnResetUsage: '♻️ Reiniciar consumo', btnRotate: '🔑 Claves nuevas', btnResetSub: '🔁 Nuevo enlace de suscripción', btnDelete: '🗑 Borrar',
  btnAddPlan: '➕ Nuevo plan', btnRenewSame: '🔄 Mismas condiciones',
  noUsers: 'Aún no hay usuarios.',
  usersWord: 'usuarios', assignedWord: 'asignados', subWord: 'Suscripción', configsWord: 'Configuraciones:', devicesWord: 'dispositivos',
  usersLine: (n, a, o) => `${n} usuarios · ${a} activos · ${o} en línea`,
  ipBlocked: (why) => `La IP del servidor parece bloqueada: ${why}.\nEn el servidor: xtune migrate --to NEWHOST, o xtune autopilot digitalocean para que se mueva solo.`,
  backupLine: (every, last) => `Copias de seguridad cada ${every}` + (last ? `, la última ${last}` : ', aún ninguna'),
  backupFailed: (err) => `La última copia falló: ${err}`, hoursN: (n) => `${n} horas`,
  workerLine: (host, n, max) => `${host}: ${n}${max ? ` / ${max}` : ''} solicitudes hoy`,
  usedAgo: (t) => `usada ${t}`, quietSince: (t) => `sin tráfico desde ${t}: probablemente bloqueada`, idle: 'sin tráfico aún',
  never: 'sin caducidad', expired: 'caducado', daysLeft: (n) => `quedan ${n} días`, daysN: (n) => `${n} días`, unlimited: 'ilimitado',
  statuses: { active: 'activo', disabled: 'desactivado', expired: 'caducado', 'over quota': 'sin cuota' },
  resets: { monthly: 'el consumo se reinicia cada mes', weekly: 'el consumo se reinicia cada semana' },
  last30: (x) => `últimos 30 días: ${x} GB`,
  plansTitle: '📋 Planes', noPlans: 'Aún no hay planes. Un plan es un conjunto de límites con nombre para añadir y renovar usuarios.',
  linksHeader: (n) => `🔗 ${n}: enlaces de conexión`,
  addUserPrompt: '➕ Envía el nuevo usuario:\nNOMBRE [GB] [días] [dispositivos]   p. ej. carol 50 30 2\no NOMBRE PLAN   p. ej. dave basic\n(0 = ilimitado / sin caducidad)',
  limitPrompt: (n) => `✏️ Nuevos límites para ${n}:\nGB, días desde hoy, dispositivos; - deja uno igual\np. ej. 100 30 -   (0 = ilimitado / sin caducidad)`,
  planPrompt: '➕ Envía el plan:\nNOMBRE GB días [dispositivos]   p. ej. basic 50 30 2',
  renewWhich: (n) => `🔄 Renovar ${n}: desde su caducidad actual, con el consumo a cero.`,
  renewed: '✅ Renovado.', enabled: '✅ Activado.', disabled: '⏸ Desactivado.', usageReset: '♻️ El consumo empieza de cero.',
  rotateConfirm: (n) => `🔑 ¿Claves nuevas para ${n}? Sus enlaces actuales dejan de funcionar; su suscripción se actualiza sola.`,
  rotated: '🔑 Claves nuevas creadas.',
  resetSubConfirm: (n) => `🔁 ¿Nuevo enlace de suscripción para ${n}? El anterior deja de funcionar y necesita el nuevo.`,
  subReset: '🔁 Nuevo enlace de suscripción creado.',
  deleteConfirm: (n) => `🗑 ¿Borrar ${n} del servidor? No se puede deshacer.`,
  deleted: (n) => `${n} borrado.`, planDeleted: (n) => `Plan ${n} borrado.`, added: (n) => `✅ ${n} añadido.`, limitsSaved: '✅ Límites guardados.',
  removeConfirm: (s) => `¿Quitar ${s.name} del bot? El enlace sigue funcionando en el servidor hasta que ejecutes xtune manage token.`,
  removed: 'Quitado.',
};

// --------------------------------------------------------------- how to connect
// Steps are numbered and the pages put together in composeGuide; app names and their menu
// items stay in English, as the apps show them.

function composeGuide(num, g) {
  const page = (title, steps, note) =>
    [title, '', ...steps.map((s, i) => `${num(i + 1)}. ${s}`), ...(note ? ['', `💡 ${note}`] : [])].join('\n');
  const pages = { xray: [g.btns.xray, '', g.pickIntro, '', ...g.pick.map((s) => `• ${s}`), '', g.pickOutro].join('\n') };
  for (const k of GUIDE_DEVICES) pages[k] = page(g.btns[k], g.steps[k], g.tip);
  for (const k of GUIDE_OWN_APPS) pages[k] = page(g.btns[k], g.steps[k], k === 'wg' || k === 'awg' ? g.oneDevice : null);
  return { ...g, pages };
}

const PICK_NAMES = ['VLESS REALITY', 'VLESS Encryption', 'Hysteria2', 'Shadowsocks', 'CDN', 'CF Worker', 'Trojan'];
const pick = (descs) => PICK_NAMES.map((n, i) => `${n}: ${descs[i]}`);

const guideEn = {
  btn: '📖 How to connect',
  intro: 'Pick your device for step-by-step instructions. One app takes your link with all its configs.',
  uses: (name, p) => `🔌 ${name}: ${p}`,
  ownApps: 'These protocols need their own app instead, with a file from your 🌐 Usage page:',
  btns: {
    android: '🤖 Android', ios: '🍏 iPhone / iPad', windows: '🪟 Windows', mac: '💻 Mac', linux: '🐧 Linux',
    xray: '🔌 Which config to pick',
    wg: '🛡 WireGuard', awg: '🥷 AmneziaWG', ovpn: '🔐 OpenVPN', ikev2: '📱 IKEv2', ssh: '🖥 SSH', dns: '🧬 DNS tunnel',
  },
  steps: {
    android: [
      'Install v2rayNG from Google Play or github.com/2dust/v2rayNG/releases. Happ and Hiddify work too.',
      'Copy your link: long-press it in the message with your connection details → Copy.',
      'In v2rayNG: ☰ → Subscription group setting → ➕. Paste the link into URL, type any name in Remarks, tap ✔️. ' +
        '(Share links instead? Copy them all, then on the main screen tap ➕ → Import config from clipboard.)',
      'On the main screen: ⋮ → Update subscription, then ⋮ → Real delay all configuration.',
      'Tap the config with the lowest delay, then ▶️ at the bottom. Allow the VPN request.',
    ],
    ios: [
      'Install Streisand or Happ from the App Store (both free).',
      'Copy your link: long-press it in the message with your connection details → Copy.',
      'In the app, tap ＋ and add from the clipboard. Subscription and share links both work; on another device, scan the QR code instead.',
      'Test the delays and pick the config with the lowest one.',
      'Turn it on, and tap Allow when iOS asks to add a VPN configuration.',
    ],
    windows: [
      'Download v2rayN from github.com/2dust/v2rayN/releases (the windows-64 zip), unzip it and run v2rayN.exe. Hiddify works too.',
      'Copy your link: right-click it in Telegram → Copy Link.',
      'In v2rayN: Subscription group → Subscription group settings → Add. Paste the link into Url, type any name in Remarks, Confirm. ' +
        '(Share links instead? Copy them all and press Ctrl+V in the main window.)',
      'Subscription group → Update subscriptions without proxy.',
      'Select all configs (Ctrl+A), right-click → Test real delay. Select the fastest and press Enter to use it.',
      'At the bottom, set System proxy to "Set system proxy". For apps that ignore it, turn on Enable Tun instead (run v2rayN as administrator).',
    ],
    mac: [
      'A Mac with an Apple chip (M1 or newer): install Streisand or Happ from the App Store. Any Mac: v2rayN for macOS from github.com/2dust/v2rayN/releases.',
      'Copy your link: right-click it in Telegram → Copy Link.',
      'Streisand or Happ: click ＋ and add from the clipboard. v2rayN: Subscription group → Subscription group settings → Add, paste the link into Url, ' +
        'then Subscription group → Update subscriptions without proxy.',
      'Test the delays and pick the config with the lowest one.',
      'Turn it on (v2rayN: System proxy → Set system proxy). Allow the VPN configuration if macOS asks.',
    ],
    linux: [
      'Download v2rayN for Linux from github.com/2dust/v2rayN/releases (the .deb, or the linux-64 zip). Hiddify (AppImage) works too.',
      'Copy your link.',
      'In v2rayN: Subscription group → Subscription group settings → Add. Paste the link into Url, type any name in Remarks, Confirm.',
      'Subscription group → Update subscriptions without proxy. Select all configs, right-click → Test real delay.',
      'Select the fastest, press Enter, and set System proxy to "Set system proxy" (or turn on Enable Tun).',
    ],
    wg: [
      'Install the WireGuard app: App Store, Google Play, or wireguard.com/install.',
      'Tap 🌐 Usage page under your connection details and download the "WireGuard app" file (.conf).',
      'In the app: ＋ → Import from file, and pick the file.',
      'Turn the tunnel on.',
    ],
    awg: [
      'Install AmneziaWG (Google Play, App Store) or AmneziaVPN (amnezia.org). The plain WireGuard app can\'t use these files.',
      'Tap 🌐 Usage page under your connection details and download an "AmneziaWG / AmneziaVPN app" file (.conf).',
      'AmneziaWG: ＋ → Import from file. AmneziaVPN: ＋ → File with connection settings.',
      'Connect. If there are several files and one doesn\'t connect, try another.',
    ],
    ovpn: [
      'Install OpenVPN Connect: App Store, Google Play, or openvpn.net.',
      'Tap 🌐 Usage page under your connection details and download the "OpenVPN" file (.ovpn).',
      'Open the file with OpenVPN Connect (or in the app: ＋ → Upload file) to import it.',
      'Log in with the name and password shown on your usage page, and connect.',
    ],
    ikev2: [
      'iPhone, iPad, Mac: open your 🌐 Usage page in Safari and download the "iPhone / iPad / Mac" file. Then Settings → Profile Downloaded → Install ' +
        '(Mac: System Settings → Privacy & Security → Profiles).',
      'Turn it on in Settings → VPN.',
      'Android: install strongSwan VPN Client from Google Play, download the "strongSwan app" file (.sswan) from the usage page, then in strongSwan: ⋮ → Import VPN profile.',
      'Tap the profile to connect. If it asks, log in with the name and password from the usage page.',
    ],
    ssh: [
      'Install an SSH tunnel app, such as HTTP Injector or NetMod on Android. NekoBox and Hiddify also take the ssh:// link in your subscription.',
      'Tap 🌐 Usage page under your connection details and download the "SSH apps" file (.txt): it has the server, the port and the settings.',
      'In the app, make an SSH connection with those settings and the name and password from the usage page.',
      'Connect.',
    ],
    dns: [
      'Install an app with a DNS tunnel (SlowDNS / dnstt), such as HTTP Injector or NetMod on Android.',
      'Tap 🌐 Usage page under your connection details and download the "DNS tunnel" file (.txt): it has the name server domain, the public key, a DNS resolver and an SSH login.',
      'In the app, choose the DNS tunnel (SlowDNS) mode and fill those in.',
      'Connect. It\'s slow: use it for messages when nothing else gets through.',
    ],
  },
  tip: 'Stopped working? Update the subscription first (the owner may have new configs), then try another config.',
  oneDevice: 'A file is for one device at a time. On a second device, use another protocol.',
  pickIntro: 'Your app shows a config per protocol (and per server). They all reach the same VPN; they differ in how they get past blocking:',
  pick: pick([
    'looks like a visit to a big website. Usually the fastest: try it first.',
    'encrypted with nothing for a filter to recognize. Needs an up-to-date app.',
    'over UDP, fast on poor connections. Doesn\'t work where UDP is blocked.',
    'simple and light.',
    'through Cloudflare. Slower, but works when the server\'s address is blocked.',
    'through a Cloudflare Worker, for when even the CDN is blocked.',
    'disguised like VLESS REALITY, for apps and networks that do better with Trojan.',
  ]),
  pickOutro: 'Test the delays in your app and use the lowest. When one stops working, switch to another or update the subscription.',
};

const guideFa = {
  btn: '📖 آموزش اتصال',
  intro: 'دستگاهت رو انتخاب کن تا قدم‌به‌قدم بهت بگم. یه برنامه لینکت رو با همه‌ی کانفیگ‌هاش می‌گیره.',
  uses: (name, p) => `🔌 ${name}: ${p}`,
  ownApps: 'این پروتکل‌ها برنامه‌ی خودشون رو می‌خوان، با یه فایل از 🌐 صفحه‌ی مصرف:',
  btns: {
    android: '🤖 اندروید', ios: '🍏 آیفون / آیپد', windows: '🪟 ویندوز', mac: '💻 مک', linux: '🐧 لینوکس',
    xray: '🔌 کدوم کانفیگ رو انتخاب کنم',
    wg: '🛡 WireGuard', awg: '🥷 AmneziaWG', ovpn: '🔐 OpenVPN', ikev2: '📱 IKEv2', ssh: '🖥 SSH', dns: '🧬 تونل DNS',
  },
  steps: {
    android: [
      'v2rayNG رو از گوگل‌پلی یا github.com/2dust/v2rayNG/releases نصب کن. Happ و Hiddify هم کار می‌کنن.',
      'لینکت رو کپی کن: توی پیام اطلاعات اتصال، انگشتت رو روش نگه دار ← Copy.',
      'توی v2rayNG: ☰ ← Subscription group setting ← ➕. لینک رو توی URL بچسبون، یه اسم دلخواه توی Remarks بنویس و ✔️ رو بزن. ' +
        '(به‌جاش لینک‌های اشتراکی داری؟ همه رو کپی کن و توی صفحه‌ی اصلی ➕ ← Import config from clipboard رو بزن.)',
      'توی صفحه‌ی اصلی: ⋮ ← Update subscription، بعد ⋮ ← Real delay all configuration.',
      'کانفیگی که کمترین تأخیر رو داره بزن، بعد ▶️ پایین صفحه. درخواست VPN رو قبول کن.',
    ],
    ios: [
      'Streisand یا Happ رو از اپ‌استور نصب کن (هر دو رایگانن).',
      'لینکت رو کپی کن: توی پیام اطلاعات اتصال، انگشتت رو روش نگه دار ← Copy.',
      'توی برنامه ＋ رو بزن و از کلیپ‌بورد اضافه کن. لینک سابسکریپشن و لینک‌های اشتراکی هر دو کار می‌کنن؛ روی یه دستگاه دیگه کیوآر کد رو اسکن کن.',
      'تأخیرها رو تست کن و کانفیگی که کمترین تأخیر رو داره انتخاب کن.',
      'روشنش کن و وقتی iOS برای اضافه کردن پیکربندی VPN پرسید، Allow رو بزن.',
    ],
    windows: [
      'v2rayN رو از github.com/2dust/v2rayN/releases دانلود کن (فایل zip مربوط به windows-64)، از حالت فشرده درش بیار و v2rayN.exe رو اجرا کن. Hiddify هم کار می‌کنه.',
      'لینکت رو کپی کن: توی تلگرام روش راست‌کلیک کن ← Copy Link.',
      'توی v2rayN: Subscription group ← Subscription group settings ← Add. لینک رو توی Url بچسبون، یه اسم دلخواه توی Remarks بنویس و Confirm رو بزن. ' +
        '(لینک‌های اشتراکی داری؟ همه رو کپی کن و توی پنجره‌ی اصلی Ctrl+V بزن.)',
      'Subscription group ← Update subscriptions without proxy.',
      'همه‌ی کانفیگ‌ها رو انتخاب کن (Ctrl+A)، راست‌کلیک ← Test real delay. سریع‌ترین رو انتخاب کن و Enter بزن.',
      'پایین پنجره، System proxy رو روی «Set system proxy» بذار. برای برنامه‌هایی که پروکسی رو نادیده می‌گیرن، به‌جاش Enable Tun رو روشن کن (v2rayN رو با Run as administrator اجرا کن).',
    ],
    mac: [
      'مک با تراشه‌ی اپل (M1 یا جدیدتر): Streisand یا Happ رو از اپ‌استور نصب کن. هر مکی: v2rayN نسخه‌ی macOS از github.com/2dust/v2rayN/releases.',
      'لینکت رو کپی کن: توی تلگرام روش راست‌کلیک کن ← Copy Link.',
      'Streisand یا Happ: ＋ رو بزن و از کلیپ‌بورد اضافه کن. v2rayN: Subscription group ← Subscription group settings ← Add، لینک رو توی Url بچسبون، ' +
        'بعد Subscription group ← Update subscriptions without proxy.',
      'تأخیرها رو تست کن و کانفیگی که کمترین تأخیر رو داره انتخاب کن.',
      'روشنش کن (v2rayN: System proxy ← Set system proxy). اگه macOS پرسید، پیکربندی VPN رو قبول کن.',
    ],
    linux: [
      'v2rayN نسخه‌ی لینوکس رو از github.com/2dust/v2rayN/releases دانلود کن (فایل .deb یا zip مربوط به linux-64). Hiddify (AppImage) هم کار می‌کنه.',
      'لینکت رو کپی کن.',
      'توی v2rayN: Subscription group ← Subscription group settings ← Add. لینک رو توی Url بچسبون، یه اسم دلخواه توی Remarks بنویس و Confirm رو بزن.',
      'Subscription group ← Update subscriptions without proxy. همه‌ی کانفیگ‌ها رو انتخاب کن، راست‌کلیک ← Test real delay.',
      'سریع‌ترین رو انتخاب کن، Enter بزن و System proxy رو روی «Set system proxy» بذار (یا Enable Tun رو روشن کن).',
    ],
    wg: [
      'برنامه‌ی WireGuard رو نصب کن: اپ‌استور، گوگل‌پلی یا wireguard.com/install.',
      'زیر اطلاعات اتصالت 🌐 صفحه‌ی مصرف رو بزن و فایل «WireGuard app» (.conf) رو دانلود کن.',
      'توی برنامه: ＋ ← Import from file و فایل رو انتخاب کن.',
      'تونل رو روشن کن.',
    ],
    awg: [
      'AmneziaWG (گوگل‌پلی، اپ‌استور) یا AmneziaVPN (amnezia.org) رو نصب کن. برنامه‌ی معمولی WireGuard این فایل‌ها رو نمی‌شناسه.',
      'زیر اطلاعات اتصالت 🌐 صفحه‌ی مصرف رو بزن و یه فایل «AmneziaWG / AmneziaVPN app» (.conf) دانلود کن.',
      'AmneziaWG: ＋ ← Import from file. AmneziaVPN: ＋ ← File with connection settings.',
      'وصل شو. اگه چند تا فایل هست و یکی وصل نشد، یکی دیگه رو امتحان کن.',
    ],
    ovpn: [
      'OpenVPN Connect رو نصب کن: اپ‌استور، گوگل‌پلی یا openvpn.net.',
      'زیر اطلاعات اتصالت 🌐 صفحه‌ی مصرف رو بزن و فایل «OpenVPN» (.ovpn) رو دانلود کن.',
      'فایل رو با OpenVPN Connect باز کن (یا توی برنامه: ＋ ← Upload file) تا وارد بشه.',
      'با نام کاربری و رمزی که توی صفحه‌ی مصرفت هست وارد شو و وصل شو.',
    ],
    ikev2: [
      'آیفون، آیپد، مک: صفحه‌ی مصرفت رو توی Safari باز کن و فایل «iPhone / iPad / Mac» رو دانلود کن. بعد Settings ← Profile Downloaded ← Install ' +
        '(مک: System Settings ← Privacy & Security ← Profiles).',
      'از Settings ← VPN روشنش کن.',
      'اندروید: strongSwan VPN Client رو از گوگل‌پلی نصب کن، فایل «strongSwan app» (.sswan) رو از صفحه‌ی مصرف دانلود کن، بعد توی strongSwan: ⋮ ← Import VPN profile.',
      'روی پروفایل بزن تا وصل بشی. اگه پرسید، نام کاربری و رمز صفحه‌ی مصرف رو وارد کن.',
    ],
    ssh: [
      'یه برنامه‌ی تونل SSH نصب کن، مثل HTTP Injector یا NetMod روی اندروید. NekoBox و Hiddify هم لینک ssh:// توی سابسکریپشنت رو می‌گیرن.',
      'زیر اطلاعات اتصالت 🌐 صفحه‌ی مصرف رو بزن و فایل «SSH apps» (.txt) رو دانلود کن: سرور، پورت و تنظیمات توشه.',
      'توی برنامه یه اتصال SSH با همین تنظیمات و نام کاربری و رمز صفحه‌ی مصرف بساز.',
      'وصل شو.',
    ],
    dns: [
      'یه برنامه با تونل DNS (SlowDNS / dnstt) نصب کن، مثل HTTP Injector یا NetMod روی اندروید.',
      'زیر اطلاعات اتصالت 🌐 صفحه‌ی مصرف رو بزن و فایل «DNS tunnel» (.txt) رو دانلود کن: دامنه‌ی نیم‌سرور، کلید عمومی، یه DNS resolver و ورود SSH توشه.',
      'توی برنامه حالت تونل DNS (SlowDNS) رو انتخاب کن و این‌ها رو وارد کن.',
      'وصل شو. کنده: وقتی هیچ چیز دیگه‌ای وصل نمی‌شه، برای پیام‌رسان ازش استفاده کن.',
    ],
  },
  tip: 'قطع شد؟ اول سابسکریپشن رو آپدیت کن (شاید صاحب سرور کانفیگ‌ها رو عوض کرده)، بعد یه کانفیگ دیگه رو امتحان کن.',
  oneDevice: 'هر فایل هم‌زمان فقط برای یه دستگاهه. روی دستگاه دوم از یه پروتکل دیگه استفاده کن.',
  pickIntro: 'برنامه‌ات برای هر پروتکل (و هر سرور) یه کانفیگ نشون می‌ده. همه به همون VPN وصل می‌شن؛ فرقشون توی روش رد شدن از فیلتره:',
  pick: pick([
    'شبیه باز کردن یه سایت بزرگه. معمولاً سریع‌ترینه: اول این رو امتحان کن.',
    'رمزنگاری‌شده و بدون نشونه‌ای که فیلتر بشناسه. برنامه‌ی به‌روز می‌خواد.',
    'روی UDP، روی اینترنت ضعیف سریعه. جایی که UDP بسته‌ست کار نمی‌کنه.',
    'ساده و سبک.',
    'از طریق Cloudflare. کندتره، ولی وقتی آی‌پی سرور فیلتر شده کار می‌کنه.',
    'از طریق یه Cloudflare Worker، برای وقتی که CDN هم بسته‌ست.',
    'مثل VLESS REALITY استتار شده، برای برنامه‌ها و شبکه‌هایی که با Trojan بهتر کار می‌کنن.',
  ]),
  pickOutro: 'تأخیرها رو توی برنامه‌ات تست کن و کمترین رو بزن. اگه یکی قطع شد، یکی دیگه رو بزن یا سابسکریپشن رو آپدیت کن.',
};

const guideAr = {
  btn: '📖 طريقة الاتصال',
  intro: 'اختر جهازك لتحصل على الخطوات بالتفصيل. تطبيق واحد يأخذ رابطك مع كل إعداداته.',
  uses: (name, p) => `🔌 ${name}: ${p}`,
  ownApps: 'هذه البروتوكولات تحتاج تطبيقها الخاص، مع ملف من 🌐 صفحة الاستهلاك:',
  btns: {
    android: '🤖 أندرويد', ios: '🍏 آيفون / آيباد', windows: '🪟 ويندوز', mac: '💻 ماك', linux: '🐧 لينكس',
    xray: '🔌 أي إعداد أختار',
    wg: '🛡 WireGuard', awg: '🥷 AmneziaWG', ovpn: '🔐 OpenVPN', ikev2: '📱 IKEv2', ssh: '🖥 SSH', dns: '🧬 نفق DNS',
  },
  steps: {
    android: [
      'ثبّت v2rayNG من Google Play أو من github.com/2dust/v2rayNG/releases. يعمل Happ و Hiddify أيضًا.',
      'انسخ رابطك: اضغط مطولًا عليه في رسالة بيانات الاتصال ← Copy.',
      'في v2rayNG: ☰ ← Subscription group setting ← ➕. الصق الرابط في URL، واكتب أي اسم في Remarks، واضغط ✔️. ' +
        '(لديك روابط مشاركة بدلًا منه؟ انسخها كلها، ثم في الشاشة الرئيسية اضغط ➕ ← Import config from clipboard.)',
      'في الشاشة الرئيسية: ⋮ ← Update subscription، ثم ⋮ ← Real delay all configuration.',
      'اضغط على الإعداد ذي أقل تأخير، ثم ▶️ في الأسفل. وافق على طلب VPN.',
    ],
    ios: [
      'ثبّت Streisand أو Happ من App Store (كلاهما مجاني).',
      'انسخ رابطك: اضغط مطولًا عليه في رسالة بيانات الاتصال ← Copy.',
      'في التطبيق اضغط ＋ وأضِف من الحافظة. روابط الاشتراك والمشاركة كلاهما يعمل؛ وعلى جهاز آخر امسح رمز QR.',
      'اختبر التأخير واختر الإعداد ذا أقل تأخير.',
      'شغّله، واضغط Allow عندما يطلب iOS إضافة إعداد VPN.',
    ],
    windows: [
      'نزّل v2rayN من github.com/2dust/v2rayN/releases (ملف zip الخاص بـ windows-64)، وفك ضغطه وشغّل v2rayN.exe. يعمل Hiddify أيضًا.',
      'انسخ رابطك: انقر عليه بالزر الأيمن في تيليجرام ← Copy Link.',
      'في v2rayN: Subscription group ← Subscription group settings ← Add. الصق الرابط في Url، واكتب أي اسم في Remarks، ثم Confirm. ' +
        '(لديك روابط مشاركة؟ انسخها كلها واضغط Ctrl+V في النافذة الرئيسية.)',
      'Subscription group ← Update subscriptions without proxy.',
      'حدد كل الإعدادات (Ctrl+A)، زر أيمن ← Test real delay. حدد الأسرع واضغط Enter لاستخدامه.',
      'في الأسفل، اجعل System proxy على «Set system proxy». للتطبيقات التي تتجاهله، فعّل Enable Tun بدلًا منه (شغّل v2rayN كمسؤول).',
    ],
    mac: [
      'ماك بشريحة Apple (M1 أو أحدث): ثبّت Streisand أو Happ من App Store. أي ماك: v2rayN لنظام macOS من github.com/2dust/v2rayN/releases.',
      'انسخ رابطك: انقر عليه بالزر الأيمن في تيليجرام ← Copy Link.',
      'Streisand أو Happ: انقر ＋ وأضِف من الحافظة. v2rayN: Subscription group ← Subscription group settings ← Add، والصق الرابط في Url، ' +
        'ثم Subscription group ← Update subscriptions without proxy.',
      'اختبر التأخير واختر الإعداد ذا أقل تأخير.',
      'شغّله (v2rayN: System proxy ← Set system proxy). وافق على إعداد VPN إن سأل macOS.',
    ],
    linux: [
      'نزّل v2rayN للينكس من github.com/2dust/v2rayN/releases (ملف .deb أو zip الخاص بـ linux-64). يعمل Hiddify (AppImage) أيضًا.',
      'انسخ رابطك.',
      'في v2rayN: Subscription group ← Subscription group settings ← Add. الصق الرابط في Url، واكتب أي اسم في Remarks، ثم Confirm.',
      'Subscription group ← Update subscriptions without proxy. حدد كل الإعدادات، زر أيمن ← Test real delay.',
      'حدد الأسرع، واضغط Enter، واجعل System proxy على «Set system proxy» (أو فعّل Enable Tun).',
    ],
    wg: [
      'ثبّت تطبيق WireGuard: App Store أو Google Play أو wireguard.com/install.',
      'اضغط 🌐 صفحة الاستهلاك تحت بيانات اتصالك ونزّل ملف «WireGuard app» (.conf).',
      'في التطبيق: ＋ ← Import from file، واختر الملف.',
      'شغّل النفق.',
    ],
    awg: [
      'ثبّت AmneziaWG (Google Play، App Store) أو AmneziaVPN (amnezia.org). تطبيق WireGuard العادي لا يقبل هذه الملفات.',
      'اضغط 🌐 صفحة الاستهلاك تحت بيانات اتصالك ونزّل ملف «AmneziaWG / AmneziaVPN app» (.conf).',
      'AmneziaWG: ＋ ← Import from file. AmneziaVPN: ＋ ← File with connection settings.',
      'اتصل. إن كانت هناك عدة ملفات ولم يتصل أحدها، جرّب غيره.',
    ],
    ovpn: [
      'ثبّت OpenVPN Connect: App Store أو Google Play أو openvpn.net.',
      'اضغط 🌐 صفحة الاستهلاك تحت بيانات اتصالك ونزّل ملف «OpenVPN» (.ovpn).',
      'افتح الملف بـ OpenVPN Connect (أو في التطبيق: ＋ ← Upload file) لاستيراده.',
      'سجّل الدخول بالاسم وكلمة المرور الظاهرين في صفحة الاستهلاك، واتصل.',
    ],
    ikev2: [
      'آيفون، آيباد، ماك: افتح صفحة الاستهلاك في Safari ونزّل ملف «iPhone / iPad / Mac». ثم Settings ← Profile Downloaded ← Install ' +
        '(ماك: System Settings ← Privacy & Security ← Profiles).',
      'شغّله من Settings ← VPN.',
      'أندرويد: ثبّت strongSwan VPN Client من Google Play، ونزّل ملف «strongSwan app» (.sswan) من صفحة الاستهلاك، ثم في strongSwan: ⋮ ← Import VPN profile.',
      'اضغط على الملف الشخصي للاتصال. إن طُلب منك، أدخل الاسم وكلمة المرور من صفحة الاستهلاك.',
    ],
    ssh: [
      'ثبّت تطبيق نفق SSH، مثل HTTP Injector أو NetMod على أندرويد. يقبل NekoBox و Hiddify أيضًا رابط ssh:// في اشتراكك.',
      'اضغط 🌐 صفحة الاستهلاك تحت بيانات اتصالك ونزّل ملف «SSH apps» (.txt): فيه الخادم والمنفذ والإعدادات.',
      'في التطبيق، أنشئ اتصال SSH بهذه الإعدادات وبالاسم وكلمة المرور من صفحة الاستهلاك.',
      'اتصل.',
    ],
    dns: [
      'ثبّت تطبيقًا فيه نفق DNS (SlowDNS / dnstt)، مثل HTTP Injector أو NetMod على أندرويد.',
      'اضغط 🌐 صفحة الاستهلاك تحت بيانات اتصالك ونزّل ملف «DNS tunnel» (.txt): فيه نطاق خادم الأسماء والمفتاح العام وخادم DNS وبيانات دخول SSH.',
      'في التطبيق، اختر وضع نفق DNS (SlowDNS) وأدخلها.',
      'اتصل. إنه بطيء: استخدمه للرسائل حين لا يعمل شيء آخر.',
    ],
  },
  tip: 'توقف عن العمل؟ حدّث الاشتراك أولًا (ربما غيّر المالك الإعدادات)، ثم جرّب إعدادًا آخر.',
  oneDevice: 'كل ملف لجهاز واحد في نفس الوقت. على جهاز ثانٍ استخدم بروتوكولًا آخر.',
  pickIntro: 'يعرض تطبيقك إعدادًا لكل بروتوكول (ولكل خادم). كلها تصل إلى نفس VPN؛ تختلف في طريقة تجاوز الحجب:',
  pick: pick([
    'يبدو كزيارة لموقع كبير. عادةً الأسرع: جرّبه أولًا.',
    'مشفّر ولا شيء فيه يتعرّف عليه الفلتر. يحتاج تطبيقًا محدّثًا.',
    'عبر UDP، سريع على الاتصالات الضعيفة. لا يعمل حيث يُحجب UDP.',
    'بسيط وخفيف.',
    'عبر Cloudflare. أبطأ، لكنه يعمل حين يُحجب عنوان الخادم.',
    'عبر Cloudflare Worker، لحين يُحجب حتى الـ CDN.',
    'متخفٍّ مثل VLESS REALITY، للتطبيقات والشبكات التي تعمل أفضل مع Trojan.',
  ]),
  pickOutro: 'اختبر التأخير في تطبيقك واستخدم الأقل. حين يتوقف أحدها، انتقل إلى غيره أو حدّث الاشتراك.',
};

const guideRu = {
  btn: '📖 Как подключиться',
  intro: 'Выберите устройство, чтобы получить пошаговую инструкцию. Одно приложение принимает вашу ссылку со всеми конфигами.',
  uses: (name, p) => `🔌 ${name}: ${p}`,
  ownApps: 'Этим протоколам нужно своё приложение и файл со 🌐 страницы расхода:',
  btns: {
    android: '🤖 Android', ios: '🍏 iPhone / iPad', windows: '🪟 Windows', mac: '💻 Mac', linux: '🐧 Linux',
    xray: '🔌 Какой конфиг выбрать',
    wg: '🛡 WireGuard', awg: '🥷 AmneziaWG', ovpn: '🔐 OpenVPN', ikev2: '📱 IKEv2', ssh: '🖥 SSH', dns: '🧬 DNS-туннель',
  },
  steps: {
    android: [
      'Установите v2rayNG из Google Play или с github.com/2dust/v2rayNG/releases. Happ и Hiddify тоже подойдут.',
      'Скопируйте ссылку: долгое нажатие на неё в сообщении с данными подключения → Copy.',
      'В v2rayNG: ☰ → Subscription group setting → ➕. Вставьте ссылку в URL, впишите любое имя в Remarks, нажмите ✔️. ' +
        '(У вас ссылки на конфиги? Скопируйте их все и на главном экране нажмите ➕ → Import config from clipboard.)',
      'На главном экране: ⋮ → Update subscription, затем ⋮ → Real delay all configuration.',
      'Выберите конфиг с наименьшей задержкой и нажмите ▶️ внизу. Разрешите запрос VPN.',
    ],
    ios: [
      'Установите Streisand или Happ из App Store (оба бесплатные).',
      'Скопируйте ссылку: долгое нажатие на неё в сообщении с данными подключения → Copy.',
      'В приложении нажмите ＋ и добавьте из буфера обмена. Подходят и ссылка подписки, и ссылки на конфиги; на другом устройстве отсканируйте QR-код.',
      'Проверьте задержки и выберите конфиг с наименьшей.',
      'Включите его и нажмите Allow, когда iOS попросит добавить конфигурацию VPN.',
    ],
    windows: [
      'Скачайте v2rayN с github.com/2dust/v2rayN/releases (zip для windows-64), распакуйте и запустите v2rayN.exe. Hiddify тоже подойдёт.',
      'Скопируйте ссылку: правый клик по ней в Telegram → Copy Link.',
      'В v2rayN: Subscription group → Subscription group settings → Add. Вставьте ссылку в Url, впишите любое имя в Remarks, Confirm. ' +
        '(Ссылки на конфиги? Скопируйте их все и нажмите Ctrl+V в главном окне.)',
      'Subscription group → Update subscriptions without proxy.',
      'Выделите все конфиги (Ctrl+A), правый клик → Test real delay. Выберите самый быстрый и нажмите Enter.',
      'Внизу выставьте System proxy в «Set system proxy». Для приложений, которые его игнорируют, включите Enable Tun (запустите v2rayN от администратора).',
    ],
    mac: [
      'Mac с чипом Apple (M1 и новее): установите Streisand или Happ из App Store. Любой Mac: v2rayN для macOS с github.com/2dust/v2rayN/releases.',
      'Скопируйте ссылку: правый клик по ней в Telegram → Copy Link.',
      'Streisand или Happ: нажмите ＋ и добавьте из буфера обмена. v2rayN: Subscription group → Subscription group settings → Add, вставьте ссылку в Url, ' +
        'затем Subscription group → Update subscriptions without proxy.',
      'Проверьте задержки и выберите конфиг с наименьшей.',
      'Включите его (v2rayN: System proxy → Set system proxy). Разрешите конфигурацию VPN, если macOS спросит.',
    ],
    linux: [
      'Скачайте v2rayN для Linux с github.com/2dust/v2rayN/releases (.deb или zip для linux-64). Hiddify (AppImage) тоже подойдёт.',
      'Скопируйте ссылку.',
      'В v2rayN: Subscription group → Subscription group settings → Add. Вставьте ссылку в Url, впишите любое имя в Remarks, Confirm.',
      'Subscription group → Update subscriptions without proxy. Выделите все конфиги, правый клик → Test real delay.',
      'Выберите самый быстрый, нажмите Enter и выставьте System proxy в «Set system proxy» (или включите Enable Tun).',
    ],
    wg: [
      'Установите приложение WireGuard: App Store, Google Play или wireguard.com/install.',
      'Нажмите 🌐 Страница расхода под данными подключения и скачайте файл «WireGuard app» (.conf).',
      'В приложении: ＋ → Import from file, выберите файл.',
      'Включите туннель.',
    ],
    awg: [
      'Установите AmneziaWG (Google Play, App Store) или AmneziaVPN (amnezia.org). Обычное приложение WireGuard эти файлы не примет.',
      'Нажмите 🌐 Страница расхода под данными подключения и скачайте файл «AmneziaWG / AmneziaVPN app» (.conf).',
      'AmneziaWG: ＋ → Import from file. AmneziaVPN: ＋ → File with connection settings.',
      'Подключитесь. Если файлов несколько и один не подключается, попробуйте другой.',
    ],
    ovpn: [
      'Установите OpenVPN Connect: App Store, Google Play или openvpn.net.',
      'Нажмите 🌐 Страница расхода под данными подключения и скачайте файл «OpenVPN» (.ovpn).',
      'Откройте файл в OpenVPN Connect (или в приложении: ＋ → Upload file), чтобы импортировать.',
      'Войдите с именем и паролем со страницы расхода и подключитесь.',
    ],
    ikev2: [
      'iPhone, iPad, Mac: откройте страницу расхода в Safari и скачайте файл «iPhone / iPad / Mac». Затем Settings → Profile Downloaded → Install ' +
        '(Mac: System Settings → Privacy & Security → Profiles).',
      'Включите в Settings → VPN.',
      'Android: установите strongSwan VPN Client из Google Play, скачайте файл «strongSwan app» (.sswan) со страницы расхода, затем в strongSwan: ⋮ → Import VPN profile.',
      'Нажмите на профиль, чтобы подключиться. Если спросит, введите имя и пароль со страницы расхода.',
    ],
    ssh: [
      'Установите приложение для SSH-туннеля, например HTTP Injector или NetMod на Android. NekoBox и Hiddify также принимают ссылку ssh:// из подписки.',
      'Нажмите 🌐 Страница расхода под данными подключения и скачайте файл «SSH apps» (.txt): в нём сервер, порт и настройки.',
      'В приложении создайте SSH-подключение с этими настройками, именем и паролем со страницы расхода.',
      'Подключитесь.',
    ],
    dns: [
      'Установите приложение с DNS-туннелем (SlowDNS / dnstt), например HTTP Injector или NetMod на Android.',
      'Нажмите 🌐 Страница расхода под данными подключения и скачайте файл «DNS tunnel» (.txt): в нём домен NS-сервера, публичный ключ, DNS-резолвер и вход SSH.',
      'В приложении выберите режим DNS-туннеля (SlowDNS) и введите эти данные.',
      'Подключитесь. Это медленно: для мессенджеров, когда больше ничего не работает.',
    ],
  },
  tip: 'Перестало работать? Сначала обновите подписку (владелец мог сменить конфиги), затем попробуйте другой конфиг.',
  oneDevice: 'Один файл — для одного устройства одновременно. На втором устройстве используйте другой протокол.',
  pickIntro: 'Приложение показывает конфиг на каждый протокол (и сервер). Все ведут в один VPN; отличаются тем, как обходят блокировки:',
  pick: pick([
    'выглядит как заход на крупный сайт. Обычно самый быстрый: начните с него.',
    'зашифрован, и фильтру не за что зацепиться. Нужно свежее приложение.',
    'по UDP, быстрый на плохой связи. Не работает там, где UDP заблокирован.',
    'простой и лёгкий.',
    'через Cloudflare. Медленнее, но работает, когда адрес сервера заблокирован.',
    'через Cloudflare Worker, на случай когда заблокирован даже CDN.',
    'замаскирован как VLESS REALITY, для приложений и сетей, где Trojan работает лучше.',
  ]),
  pickOutro: 'Проверьте задержки в приложении и выберите наименьшую. Если конфиг перестал работать, переключитесь на другой или обновите подписку.',
};

const guideEs = {
  btn: '📖 Cómo conectarse',
  intro: 'Elige tu dispositivo para ver los pasos. Una sola app recibe tu enlace con todas sus configuraciones.',
  uses: (name, p) => `🔌 ${name}: ${p}`,
  ownApps: 'Estos protocolos necesitan su propia app, con un archivo de tu 🌐 página de consumo:',
  btns: {
    android: '🤖 Android', ios: '🍏 iPhone / iPad', windows: '🪟 Windows', mac: '💻 Mac', linux: '🐧 Linux',
    xray: '🔌 Qué configuración elegir',
    wg: '🛡 WireGuard', awg: '🥷 AmneziaWG', ovpn: '🔐 OpenVPN', ikev2: '📱 IKEv2', ssh: '🖥 SSH', dns: '🧬 Túnel DNS',
  },
  steps: {
    android: [
      'Instala v2rayNG desde Google Play o github.com/2dust/v2rayNG/releases. Happ y Hiddify también sirven.',
      'Copia tu enlace: mantenlo pulsado en el mensaje con tus datos de conexión → Copy.',
      'En v2rayNG: ☰ → Subscription group setting → ➕. Pega el enlace en URL, escribe cualquier nombre en Remarks y pulsa ✔️. ' +
        '(¿Tienes enlaces de configuración? Cópialos todos y en la pantalla principal pulsa ➕ → Import config from clipboard.)',
      'En la pantalla principal: ⋮ → Update subscription, luego ⋮ → Real delay all configuration.',
      'Toca la configuración con menos retardo y luego ▶️ abajo. Acepta la solicitud de VPN.',
    ],
    ios: [
      'Instala Streisand o Happ desde la App Store (ambas gratis).',
      'Copia tu enlace: mantenlo pulsado en el mensaje con tus datos de conexión → Copy.',
      'En la app, toca ＋ y añade desde el portapapeles. Sirven el enlace de suscripción y los de configuración; en otro dispositivo, escanea el código QR.',
      'Prueba los retardos y elige la configuración con el menor.',
      'Actívala y toca Allow cuando iOS pida añadir una configuración VPN.',
    ],
    windows: [
      'Descarga v2rayN de github.com/2dust/v2rayN/releases (el zip windows-64), descomprímelo y ejecuta v2rayN.exe. Hiddify también sirve.',
      'Copia tu enlace: clic derecho sobre él en Telegram → Copy Link.',
      'En v2rayN: Subscription group → Subscription group settings → Add. Pega el enlace en Url, cualquier nombre en Remarks, Confirm. ' +
        '(¿Enlaces de configuración? Cópialos todos y pulsa Ctrl+V en la ventana principal.)',
      'Subscription group → Update subscriptions without proxy.',
      'Selecciona todas (Ctrl+A), clic derecho → Test real delay. Selecciona la más rápida y pulsa Enter.',
      'Abajo, pon System proxy en «Set system proxy». Para apps que lo ignoran, activa Enable Tun (ejecuta v2rayN como administrador).',
    ],
    mac: [
      'Mac con chip de Apple (M1 o posterior): instala Streisand o Happ desde la App Store. Cualquier Mac: v2rayN para macOS de github.com/2dust/v2rayN/releases.',
      'Copia tu enlace: clic derecho sobre él en Telegram → Copy Link.',
      'Streisand o Happ: haz clic en ＋ y añade desde el portapapeles. v2rayN: Subscription group → Subscription group settings → Add, pega el enlace en Url, ' +
        'luego Subscription group → Update subscriptions without proxy.',
      'Prueba los retardos y elige la configuración con el menor.',
      'Actívala (v2rayN: System proxy → Set system proxy). Acepta la configuración VPN si macOS lo pide.',
    ],
    linux: [
      'Descarga v2rayN para Linux de github.com/2dust/v2rayN/releases (el .deb o el zip linux-64). Hiddify (AppImage) también sirve.',
      'Copia tu enlace.',
      'En v2rayN: Subscription group → Subscription group settings → Add. Pega el enlace en Url, cualquier nombre en Remarks, Confirm.',
      'Subscription group → Update subscriptions without proxy. Selecciona todas, clic derecho → Test real delay.',
      'Selecciona la más rápida, pulsa Enter y pon System proxy en «Set system proxy» (o activa Enable Tun).',
    ],
    wg: [
      'Instala la app WireGuard: App Store, Google Play o wireguard.com/install.',
      'Toca 🌐 Página de consumo bajo tus datos de conexión y descarga el archivo «WireGuard app» (.conf).',
      'En la app: ＋ → Import from file, y elige el archivo.',
      'Activa el túnel.',
    ],
    awg: [
      'Instala AmneziaWG (Google Play, App Store) o AmneziaVPN (amnezia.org). La app normal de WireGuard no acepta estos archivos.',
      'Toca 🌐 Página de consumo bajo tus datos de conexión y descarga un archivo «AmneziaWG / AmneziaVPN app» (.conf).',
      'AmneziaWG: ＋ → Import from file. AmneziaVPN: ＋ → File with connection settings.',
      'Conéctate. Si hay varios archivos y uno no conecta, prueba otro.',
    ],
    ovpn: [
      'Instala OpenVPN Connect: App Store, Google Play u openvpn.net.',
      'Toca 🌐 Página de consumo bajo tus datos de conexión y descarga el archivo «OpenVPN» (.ovpn).',
      'Abre el archivo con OpenVPN Connect (o en la app: ＋ → Upload file) para importarlo.',
      'Inicia sesión con el nombre y la contraseña de tu página de consumo y conéctate.',
    ],
    ikev2: [
      'iPhone, iPad, Mac: abre tu página de consumo en Safari y descarga el archivo «iPhone / iPad / Mac». Luego Settings → Profile Downloaded → Install ' +
        '(Mac: System Settings → Privacy & Security → Profiles).',
      'Actívalo en Settings → VPN.',
      'Android: instala strongSwan VPN Client desde Google Play, descarga el archivo «strongSwan app» (.sswan) de la página de consumo y en strongSwan: ⋮ → Import VPN profile.',
      'Toca el perfil para conectarte. Si lo pide, usa el nombre y la contraseña de la página de consumo.',
    ],
    ssh: [
      'Instala una app de túnel SSH, como HTTP Injector o NetMod en Android. NekoBox y Hiddify también aceptan el enlace ssh:// de tu suscripción.',
      'Toca 🌐 Página de consumo bajo tus datos de conexión y descarga el archivo «SSH apps» (.txt): tiene el servidor, el puerto y los ajustes.',
      'En la app, crea una conexión SSH con esos ajustes y el nombre y la contraseña de la página de consumo.',
      'Conéctate.',
    ],
    dns: [
      'Instala una app con túnel DNS (SlowDNS / dnstt), como HTTP Injector o NetMod en Android.',
      'Toca 🌐 Página de consumo bajo tus datos de conexión y descarga el archivo «DNS tunnel» (.txt): tiene el dominio del servidor de nombres, la clave pública, un resolver DNS y un acceso SSH.',
      'En la app, elige el modo túnel DNS (SlowDNS) y rellena esos datos.',
      'Conéctate. Es lento: úsalo para mensajes cuando nada más funciona.',
    ],
  },
  tip: '¿Dejó de funcionar? Primero actualiza la suscripción (el dueño puede haber cambiado las configuraciones) y luego prueba otra configuración.',
  oneDevice: 'Cada archivo es para un dispositivo a la vez. En un segundo dispositivo, usa otro protocolo.',
  pickIntro: 'Tu app muestra una configuración por protocolo (y por servidor). Todas llegan a la misma VPN; cambian en cómo esquivan los bloqueos:',
  pick: pick([
    'parece una visita a un sitio web grande. Suele ser la más rápida: pruébala primero.',
    'cifrada y sin nada que un filtro reconozca. Necesita una app actualizada.',
    'por UDP, rápida en conexiones malas. No funciona donde UDP está bloqueado.',
    'simple y ligera.',
    'a través de Cloudflare. Más lenta, pero funciona cuando la dirección del servidor está bloqueada.',
    'a través de un Cloudflare Worker, para cuando incluso el CDN está bloqueado.',
    'camuflado como VLESS REALITY, para apps y redes que funcionan mejor con Trojan.',
  ]),
  pickOutro: 'Prueba los retardos en tu app y usa el menor. Cuando una deje de funcionar, cambia a otra o actualiza la suscripción.',
};

const GUIDE = { en: guideEn, fa: guideFa, ar: guideAr, ru: guideRu, es: guideEs };

const SRV = { en: srvEn, fa: srvFa, ar: srvAr, ru: srvRu, es: srvEs };
const TABLES = { en, fa, ar, ru, es };
const cache = {};

export function texts(locale) {
  const key = TABLES[locale] ? locale : DEFAULT_LOCALE;
  return (cache[key] ??= compose(key, TABLES[key]));
}
