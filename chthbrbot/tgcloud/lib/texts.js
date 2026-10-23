// Every user-facing string lives here (Persian). Translate freely; keep the function signatures.
// Messages are sent as plain text (no parse_mode), so no escaping is needed.
//
// `owner` arguments are rows of the users table: { name, prompt, ... }. `name` is the
// owner's Telegram first name and may be null; `prompt` is their own invitation text
// set with /text, or null for the default one.

// 123 → ۱۲۳
export const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

// Unix seconds → "۳ روز پیش".
export function ago(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return 'همین الان';
  if (s < 3600) return `${faNum(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${faNum(Math.floor(s / 3600))} ساعت پیش`;
  return `${faNum(Math.floor(s / 86400))} روز پیش`;
}

export const KIND_LABELS = {
  text:       '📝 متن',
  photo:      '🖼 عکس',
  video:      '🎬 ویدیو',
  animation:  '🎞 گیف',
  video_note: '⏺ ویدیو مسیج',
  voice:      '🎤 ویس',
  audio:      '🎵 موزیک',
  sticker:    '😀 استیکر',
  document:   '📎 فایل',
};
const kindList = (kinds) => kinds.map((k) => KIND_LABELS[k]).join('، ');

// Owner's display name, with a neutral fallback.
const who = (owner) => owner?.name || 'صاحب این لینک';

// The invitation senders see: the owner's own text, or the default.
export const invitation = (owner) => owner.prompt || `به ${who(owner)} پیام ناشناس بده 🤫`;

// Bot profile — applied by endpoints/setup.js.
export const BOT_PROFILE = {
  // Shown in the empty chat before /start (max 512 chars).
  description:
    'لینک پیام ناشناس شخصی 🤫\n\n' +
    'یه لینک بگیر، بذارش توی بیو، استوری یا گروه‌ها، و از دوست‌ها و مخاطب‌هات پیام ناشناس دریافت کن — ' +
    'متن، عکس، ویس یا استیکر.\n\n' +
    'متن دعوتت رو خودت بنویس، ناشناس جواب بده، فرستنده رو مسدود کن یا پیام رو گزارش بده. ' +
    'هویت فرستنده هیچ‌وقت به تو نشون داده نمی‌شه.\n\n' +
    'برای شروع /start رو بزن.',
  // Shown on the bot's profile and in shared links (max 120 chars).
  shortDescription: 'لینک ناشناس شخصی 🤫 از دوست‌ها و مخاطب‌هات پیام ناشناس بگیر و ناشناس جواب بده.',
  // Command menu. Command names must stay Latin.
  commands: [
    { command: 'start',   description: 'Get your anonymous link' },
    { command: 'text',    description: 'Set your invitation text' },
    { command: 'types',   description: 'Choose which message types you accept' },
    { command: 'pause',   description: 'Stop receiving messages' },
    { command: 'resume',  description: 'Resume receiving messages' },
    { command: 'qr',      description: 'QR code of your link' },
    { command: 'blocked', description: 'Blocked senders and unblocking' },
    { command: 'stats',   description: 'Your message stats' },
    { command: 'newlink', description: 'New link (the old one stops working)' },
    { command: 'privacy', description: 'What data is stored' },
    { command: 'delete',  description: 'Delete your data' },
    { command: 'language', description: 'Change language' },
    { command: 'cancel',  description: 'Cancel sending or replying' },
  ],
  // Added to the command menu in admins' chats only (ADMIN_IDS).
  adminCommands: [
    { command: 'admin',     description: '🛠 Admin panel and bot stats' },
    { command: 'reports',   description: '🛠 Open reports' },
    { command: 'bans',      description: '🛠 Banned senders' },
    { command: 'ban',       description: '🛠 Ban by id' },
    { command: 'unban',     description: '🛠 Unban by id' },
    { command: 'broadcast', description: '🛠 Broadcast a message' },
  ],
};

export const T = {
  // /start
  welcome: (owner, link) =>
    `سلام${owner.name ? ` ${owner.name}` : ''}! 👋 این لینک ناشناس شخصی توئه:\n\n${link}\n\n` +
    `بذارش توی بیو، استوری یا گروه‌ها. هر کسی بازش کنه می‌تونه بدون اینکه هویتش معلوم بشه ` +
    `برات پیام بفرسته. از زیر خود پیام می‌تونی جواب بدی، مسدود کنی یا گزارش بدی.\n\n` +
    `متن دعوتت الان اینه:\n«${invitation(owner)}»\n\n` +
    `/text – نوشتن متن دعوت خودت\n` +
    `/types – انتخاب نوع پیام‌هایی که می‌گیری (متن، عکس، موزیک، …)\n` +
    `/qr – کیوآر کد لینکت برای استوری\n` +
    `/pause و /resume – توقف یا ادامه‌ی دریافت پیام\n` +
    `/blocked – فرستنده‌های مسدود و رفع مسدودیت\n` +
    `/stats – آمار\n` +
    `/newlink – لینک جدید، اگه لینکت دست آدم نامناسب افتاده\n` +
    `/privacy – چه اطلاعاتی ذخیره می‌شه\n` +
    `/delete – پاک کردن اطلاعاتت`,
  btnShare: '📤 اشتراک لینک در یه چت',
  btnQr: '🔳 کیوآر کد لینک',

  // /qr — caption of the QR code photo
  qrCaption: (owner, link) =>
    `🔳 کیوآر کد لینک ناشناس تو\n\n«${invitation(owner)}»\n${link}\n\n` +
    `بذارش توی استوری یا هر جای دیگه؛ هر کی اسکنش کنه مستقیم میاد تا بهت پیام ناشناس بده.`,
  invalidLink: 'این لینک نامعتبره یا دیگه وجود نداره.',
  selfLink: (owner) =>
    `${owner.name ? `${owner.name}، ` : ''}این لینک خودته 🙂 بفرستش برای بقیه تا بتونن بهت پیام ناشناس بدن.`,
  ownerPaused: (owner) => `${who(owner)} فعلاً پیام دریافت نمی‌کنه. بعداً دوباره امتحان کن.`,
  sendPrompt: (owner) =>
    (owner.prompt ? `«${owner.prompt}»\n— ${who(owner)}\n\n` : `✉️ داری به ${who(owner)} پیام ناشناس می‌دی.\n\n`) +
    `پیامت رو همین الان بفرست.\n\n` +
    `${who(owner)} نمی‌فهمه تو کی هستی.\n\nبرای لغو: /cancel`,

  // Sending
  delivered: (owner) => `پیامت به ${who(owner)} رسید ✅`,
  btnUnsend: '🗑 پس گرفتن',
  btnSendAnother: '✉️ پیام بعدی',
  unsent: (owner) => `پیامت پس گرفته شد 🗑 دیگه توی چت ${who(owner)} نیست.`,
  unsentToast: 'پس گرفته شد',
  alreadyUnsent: 'قبلاً پس گرفته شده',
  unsendTooLate: (min) => `فقط تا ${faNum(min)} دقیقه بعد از ارسال می‌شه پیام رو پس گرفت.`,
  editTooLate: (min) => `ویرایش فقط تا ${faNum(min)} دقیقه بعد از ارسال به گیرنده می‌رسه — این ویرایش اعمال نشد.`,
  editFiltered: 'ویرایشت اعمال نشد چون کلماتی داره که این ربات اجازه نمی‌ده.',
  sendExpired: 'مهلت فرستادن پیام تموم شد ⌛️ برای فرستادن پیام دوباره لینک رو باز کن.',
  deliveryFailed: (owner) => `متأسفانه پیامت به ${who(owner)} نرسید.`,
  filtered: 'پیامت ارسال نشد چون کلماتی داره که این ربات اجازه نمی‌ده. لطفاً مهربون‌تر بازنویسیش کن.',
  unsupported: 'این نوع پیام رو نمی‌شه فرستاد. دوباره امتحان کن.',
  kindNotAccepted: (owner) =>
    `${who(owner)} این نوع پیام رو قبول نمی‌کنه. یه نوع دیگه امتحان کن یا /cancel`,

  // Received (owner side)
  newMessageHeader: (owner) =>
    `📩 یه پیام ناشناس جدید داری${owner.prompt ? `\nدر جواب: «${owner.prompt}»` : ''}`,
  btnReply: '↩️ پاسخ',
  btnBlock: '🚫 مسدود',
  btnReport: '⚠️ گزارش',
  btnGetLink: '🔗 لینک ناشناس خودت رو بگیر',

  // Reply flow
  replyPrompt: 'پاسخت رو الان بفرست (هر نوع پیامی). فرستنده نمی‌فهمه کیه، ولی می‌فهمه از طرف توئه.\n\nبرای لغو: /cancel',
  replyHeader: (owner) => `💬 ${who(owner)} به پیامت جواب داد (برای جواب دادن، روی پیام زیر ریپلای کن):`,
  replySent: 'پاسخ ارسال شد ✅',
  replyFailed: 'پاسخت ارسال نشد — احتمالاً فرستنده ربات رو متوقف کرده.',
  replyTargetGone: 'این پیام دیگه وجود نداره.',
  replyExpired: 'مهلت جواب دادن تموم شد ⌛️ دوباره روی دکمه‌ی «↩️ پاسخ» بزن یا روی خود پیام ریپلای کن.',

  // Buttons
  notYourMessage: 'این دکمه مال تو نیست.',
  blocked: 'فرستنده مسدود شد. دیگه پیامی ازش دریافت نمی‌کنی. (رفع مسدودیت: /blocked)',
  blockedToast: 'مسدود شد',
  reported: 'ممنون — پیام برای بررسی گزارش شد.',
  reportedToast: 'گزارش شد',
  alreadyReported: 'قبلاً گزارش شده',

  // /text — the owner's own invitation
  textMenu: (owner, max) =>
    `✏️ متن دعوت تو\n\nکسایی که لینکت رو باز می‌کنن این رو می‌بینن:\n«${invitation(owner)}»\n\n` +
    `متن جدیدت رو همین الان بفرست (حداکثر ${faNum(max)} حرف)، مثلاً:\n` +
    `«یه سؤال ازم بپرس که رو در رو روت نمی‌شه 😅»\n\nبرای لغو: /cancel`,
  btnTextReset: '↩️ برگشت به متن پیش‌فرض',
  textSet: (owner) => `متن دعوتت ذخیره شد ✅\n\n«${invitation(owner)}»`,
  textReset: (owner) => `متن دعوت برگشت به پیش‌فرض ✅\n\n«${invitation(owner)}»`,
  textResetToast: 'برگشت به پیش‌فرض',
  textTooLong: (max) => `این متن طولانیه. لطفاً حداکثر ${faNum(max)} حرف بنویس.`,
  textNotText: 'لطفاً متن دعوت رو به صورت پیام متنی بفرست.',
  textFiltered: 'این متن کلماتی داره که این ربات اجازه نمی‌ده. یه متن دیگه بنویس.',
  textExpired: 'مهلت نوشتن متن دعوت تموم شد ⌛️ دوباره /text رو بزن.',

  // /blocked — `rows`: [{ at }] newest first
  noBlocked: 'هیچ‌کس رو مسدود نکردی.',
  blockedList: (rows, limited) =>
    `🚫 فرستنده‌های مسدود\n\nهویتشون معلوم نیست؛ فقط می‌بینی کِی مسدود شدن. ` +
    `روی شماره‌ی هر کدوم بزن تا رفع مسدودیت بشه.\n\n` +
    rows.map((r, i) => `${faNum(i + 1)}. مسدود شده ${ago(r.at)}`).join('\n') +
    (limited ? `\n\n(فقط ${faNum(rows.length)} مورد آخر)` : ''),
  btnUnblock: (i) => `🔓 ${faNum(i)}`,
  unblockedToast: 'رفع مسدودیت شد',

  // Confirmations (/newlink, /delete)
  btnNo: '❌ نه',
  confirmCancelled: 'باشه، چیزی عوض نشد.',
  newlinkConfirm:
    '🔄 لینک جدید\n\nبا ساختن لینک جدید، لینک فعلیت دیگه کار نمی‌کنه و کسایی که فقط اون رو دارن ' +
    'نمی‌تونن بهت پیام بدن. پیام‌ها، پاسخ‌ها و مسدودی‌ها سر جاشون می‌مونن.\n\nمطمئنی؟',
  btnNewlinkYes: '✅ آره، لینک جدید بساز',
  newlinkDone: (link) => `لینک جدیدت ساخته شد ✅\n\n${link}\n\nلینک قبلی دیگه کار نمی‌کنه.`,
  deleteConfirm:
    '🗑 پاک کردن اطلاعات\n\nاین‌ها برای همیشه پاک می‌شن:\n' +
    '• لینکت (دیگه کار نمی‌کنه)، متن دعوت و تنظیماتت\n' +
    '• سابقه‌ی پیام‌هایی که دریافت کردی و پاسخ‌هات (دکمه‌های زیر پیام‌های قبلی دیگه کار نمی‌کنن)\n' +
    '• فهرست کسایی که مسدود کردی و گزارش‌هایی که دادی\n\n' +
    'این‌ها می‌مونن:\n' +
    '• سابقه‌ی پیام‌هایی که خودت ناشناس برای بقیه فرستادی — مال گیرنده‌هاست و برای مسدود کردن، ' +
    'گزارش و محدودیت تعداد پیام لازمه\n' +
    '• مسدودی‌ها، گزارش‌ها و محرومیت‌هایی که علیه تو ثبت شده\n\n' +
    'خود پیام‌ها توی چت تلگرامت می‌مونن؛ اون‌ها رو تلگرام نگه می‌داره، نه این ربات.\n\nمطمئنی؟',
  btnDeleteYes: '🗑 آره، پاک کن',
  deleted: 'اطلاعاتت پاک شد ✅ اگه دوباره لینک خواستی /start رو بزن.',

  // Admin (ADMIN_IDS) — reported messages
  adminReport: (report, owner, priorReports) =>
    `⚠️ گزارش #${faNum(report.id)}\n` +
    `صاحب لینک: ${owner?.name ?? '—'} (${report.ownerId})\n` +
    `گزارش‌های قبلی علیه این فرستنده: ${faNum(priorReports)}\n\n` +
    `پیام گزارش‌شده زیر همینه 👇`,
  adminMessageGone: '(پیام گزارش‌شده دیگه در دسترس نیست.)',
  btnBan: '⛔️ محروم کردن فرستنده',
  btnDismiss: '✅ رد گزارش',
  btnBanned: '⛔️ محروم شد — لغو محرومیت',
  btnDismissed: '✅ رد شد — محروم کردن',
  bannedToast: 'فرستنده از کل ربات محروم شد',
  unbannedToast: 'محرومیت لغو شد',
  dismissedToast: 'گزارش رد شد',

  // Admin — /admin dashboard. `s`: counts from lib/admin.js (dashboardView).
  adminDashboard: (s) => {
    const m = (status) => faNum(s.messages[status] ?? 0);
    return `🛠 پنل مدیریت\n\n` +
      `👤 کاربرها\n` +
      `صاحبان لینک: ${faNum(s.users)} (متوقف: ${faNum(s.paused)})\n` +
      `جدید: ${faNum(s.newDay)} امروز، ${faNum(s.newWeek)} این هفته\n` +
      `همه‌ی کسایی که با ربات کار کردن: ${faNum(s.reach)}\n` +
      `فرستنده‌های ناشناس: ${faNum(s.senders)}\n\n` +
      `✉️ پیام‌ها\n` +
      `ارسال‌شده: ${m('delivered')} (امروز: ${faNum(s.deliveredDay)})\n` +
      `مسدود: ${m('blocked')} · محروم: ${m('banned')} · فیلترشده: ${m('filtered')}\n` +
      `ناموفق: ${m('failed')} · پس گرفته‌شده: ${m('unsent')}\n` +
      `پاسخ‌ها: ${faNum(s.replies)}\n\n` +
      `🛡 مدیریت\n` +
      `گزارش‌های باز: ${faNum(s.openReports)} از ${faNum(s.reports)}\n` +
      `محروم‌ها: ${faNum(s.bans)} · مسدودی‌های کاربرها: ${faNum(s.blocks)}\n\n` +
      `/reports – گزارش‌های باز\n` +
      `/bans – محروم‌ها و لغو محرومیت\n` +
      `/ban <شناسه> و /unban <شناسه> – محروم کردن یا لغو با شناسه‌ی تلگرام\n` +
      `/broadcast – پیام همگانی به همه‌ی کاربرها`;
  },
  btnAdminRefresh: '🔄 به‌روزرسانی',
  btnAdminReports: (n) => `⚠️ گزارش‌های باز (${faNum(n)})`,
  btnAdminBans: (n) => `⛔️ محروم‌ها (${faNum(n)})`,
  adminRefreshedToast: 'به‌روز شد',

  // /reports
  adminNoReports: 'گزارش بازی نیست ✅',
  adminReportsHeader: (shown, total) =>
    `⚠️ ${faNum(total)} گزارش باز${shown < total ? ` — ${faNum(shown)} تای قدیمی‌تر رو می‌بینی؛ بعد از بررسی دوباره /reports رو بزن` : ''}`,

  // /bans — `rows`: bans rows, newest first
  adminNoBans: 'هیچ‌کس محروم نیست.',
  adminBansList: (rows, limited) =>
    `⛔️ فرستنده‌های محروم از کل ربات\n\nروی شماره‌ی هر کدوم بزن تا محرومیتش لغو بشه.\n\n` +
    rows.map((r, i) =>
      `${faNum(i + 1)}. ${r.reportId ? `گزارش #${faNum(r.reportId)}` : 'دستی (/ban)'}، ${ago(r.createdAt)}`).join('\n') +
    (limited ? `\n\n(فقط ${faNum(rows.length)} مورد آخر)` : ''),

  // /ban, /unban <user id>
  adminBanUsage: (cmd) => `شناسه‌ی عددی تلگرام رو بعد از دستور بنویس، مثلاً:\n/${cmd} 123456789`,
  adminBanned: (id) => `⛔️ ${id} از کل ربات محروم شد. پیام‌های ناشناسش بی‌صدا دور ریخته می‌شن.`,
  adminAlreadyBanned: (id) => `${id} از قبل محرومه.`,
  adminUnbanned: (id) => `✅ محرومیت ${id} لغو شد.`,
  adminNotBanned: (id) => `${id} محروم نبود.`,

  // /broadcast
  broadcastPrompt: (n) =>
    `📢 پیام همگانی\n\nپیامی که می‌خوای برای ${faNum(n)} نفر فرستاده بشه رو همین الان بفرست ` +
    `(هر نوع پیامی؛ آلبوم فقط اولین موردش). قبل از ارسال ازت تأیید می‌گیرم.\n\nبرای لغو: /cancel`,
  broadcastConfirm: (n) => `📢 این پیام برای ${faNum(n)} نفر فرستاده بشه؟`,
  btnBroadcastSend: '✅ آره، بفرست',
  btnBroadcastResume: '▶️ ادامه (اگه متوقف شد)',
  broadcastStartedToast: 'ارسال شروع شد',
  broadcastProgress: (sent, failed, total) =>
    `📢 در حال ارسال… ${faNum(sent + failed)} از ${faNum(total)}\n` +
    `رسید: ${faNum(sent)} · نرسید: ${faNum(failed)}\n\n` +
    `اگه یه دقیقه پیشرفتی نبود، دکمه‌ی ادامه رو بزن؛ از همون جایی که مونده ادامه می‌ده.`,
  broadcastDone: (sent, failed) =>
    `📢 پیام همگانی تموم شد ✅\nرسید: ${faNum(sent)} · نرسید (ربات رو بستن): ${faNum(failed)}`,
  broadcastBusy: 'این پیام همگانی همین الان در حال ارساله. اگه یه دقیقه پیشرفتی نبود دوباره امتحان کن.',
  broadcastAlreadyDone: 'این پیام همگانی قبلاً کامل فرستاده شده ✅',
  broadcastCancelled: 'پیام همگانی لغو شد.',
  broadcastExpired: 'مهلت فرستادن پیام همگانی تموم شد ⌛️ دوباره /broadcast رو بزن.',

  // /types — which kinds of messages the owner accepts
  typesMenu: (kinds) =>
    `📥 چه پیام‌هایی دریافت کنی؟\n\nروی هر مورد بزن تا روشن ✅ یا خاموش ⬜️ بشه.\n\nالان: ${kindList(kinds)}`,
  typesLastOne: 'حداقل یه نوع باید روشن بمونه',

  // Commands
  cancelled: 'لغو شد.',
  nothingToCancel: 'چیزی برای لغو کردن نیست.',
  needLink: 'هنوز لینک نداری — /start رو بزن تا بسازیمش.',
  paused: 'متوقف شد ⏸ لینکت عوض نمی‌شه، ولی تا وقتی /resume رو نزنی کسی نمی‌تونه بهت پیام بده.',
  alreadyPaused: 'از قبل متوقفه. برای ادامه /resume رو بزن.',
  resumed: 'ادامه ▶️ دوباره پیام دریافت می‌کنی.',
  alreadyResumed: 'از قبل داری پیام دریافت می‌کنی.',
  stats: (owner, { received, replies, blocked, filtered }) =>
    `📊 آمار${owner.name ? ` ${owner.name}` : ''}\n\n` +
    `پیام‌های دریافتی: ${faNum(received)}\n` +
    `پاسخ‌های ارسالی: ${faNum(replies)}\n` +
    `فرستنده‌های مسدود: ${faNum(blocked)}\n` +
    `پیام‌های فیلترشده: ${faNum(filtered)}\n\n` +
    `وضعیت: ${owner.paused ? 'متوقف' : 'در حال دریافت'}`,
  privacy:
    `🔒 حریم خصوصی\n\n` +
    `این ربات این‌ها رو ذخیره می‌کنه:\n` +
    `• برای صاحب هر لینک: شناسه‌ی کاربری تلگرام، اسم کوچیک تلگرام (برای شخصی‌سازی پیام‌ها)، کد لینک، ` +
    `متن دعوتی که خودش نوشته، نوع پیام‌هایی که قبول می‌کنه، وضعیت توقف و زمان ساخت.\n` +
    `• برای هر پیام ناشناس: شناسه‌ی کاربری فرستنده و صاحب لینک، شناسه‌های چت/پیام تلگرام که برای ` +
    `رسوندن پاسخ، ویرایش و پس گرفتن پیام لازمه، شناسه‌ی آلبوم تلگرام (اگه پیام چندتا عکس/ویدیو باشه)، ` +
    `وضعیت (ارسال‌شده / مسدود / محروم / فیلترشده / ناموفق / پس گرفته‌شده) و زمان.\n` +
    `• مسدودی‌ها (شناسه‌ی صاحب لینک + فرستنده)، گزارش‌ها (شناسه‌ی پیام، صاحب لینک و فرستنده، و نتیجه‌ی بررسی)، ` +
    `محرومیت‌ها از کل ربات (شناسه‌ی فرستنده) و پاسخ‌ها (شناسه‌ی پیام و صاحب لینک، و شناسه‌های چت/پیام تلگرام که برای رسوندن ری‌اکشن‌ها و ریپلای‌ها لازمه).\n` +
    `• مرحله‌ای که الان توی ربات هستی (مثلاً «در حال نوشتن پیام برای <شناسه‌ی صاحب لینک>»).\n` +
    `• برای پیام‌های همگانی گرداننده‌ی ربات: شناسه‌ی آخرین کسی که پیام بهش رسیده، تا ارسال نیمه‌کاره از همون‌جا ادامه پیدا کنه.\n\n` +
    `چرا شناسه‌ی فرستنده ذخیره می‌شه: تا صاحب لینک بتونه مسدودش کنه، محدودیت تعداد پیام اعمال بشه ` +
    `و پیام‌های گزارش‌شده قابل بررسی باشن.\n\n` +
    `شناسه و اسم فرستنده هیچ‌وقت به صاحب لینک نشون داده نمی‌شه. اسم صاحب لینک به کسایی که لینکش رو باز می‌کنن نشون داده می‌شه. ` +
    `ربات متن، کپشن یا فایل پیام‌های ناشناس رو ذخیره نمی‌کنه — تلگرام مستقیم اون‌ها رو بین چت‌ها کپی می‌کنه. ` +
    `وقتی پیامی گزارش بشه، یه کپی ازش (بدون هویت فرستنده، همراه با اسم و شناسه‌ی صاحب لینک) برای گرداننده‌ی ربات فرستاده می‌شه تا بررسیش کنه. ` +
    `گرداننده‌ی ربات از نظر فنی به اطلاعات ذخیره‌شده دسترسی داره.\n\n` +
    `با /delete لینکت، تنظیماتت، سابقه‌ی پیام‌های دریافتی و پاسخ‌هات، مسدودی‌هایی که انجام دادی و گزارش‌هایی که دادی پاک می‌شن. ` +
    `سابقه‌ی پیام‌هایی که خودت برای بقیه فرستادی و مسدودی/گزارش/محرومیت‌های علیه تو می‌مونن، ` +
    `چون مال گیرنده‌هاست و برای جلوگیری از مزاحمت لازمه.`,
  help: 'برای گرفتن لینک ناشناس شخصیت /start رو بزن. دستورهای /text، /types، /qr، /pause، /resume، /blocked، /stats، /newlink، /privacy و /delete هم هستن.',

  // Inline mode (@bot in any chat)
  inlineShareTitle: '📤 اشتراک لینک ناشناس من',
  inlineCustomTitle: '✏️ اشتراک با همین متن',
  inlineInvite: (owner) => `🎭 ${invitation(owner)}\n\nهویتت معلوم نمی‌شه. روی دکمه‌ی زیر بزن 👇`,
  inlineLinkTitle: '🔗 فقط لینک',
  btnSendAnon: (owner) => `✉️ پیام ناشناس به ${who(owner)}`,
  inlinePaused: '⏸ دریافت پیامت متوقفه — اول /resume رو توی ربات بزن.',
};
