// Every user-facing string, per locale: texts(locale) → the table for it.
// Persian (fa) is the original; en, ar, ru and es follow its keys one for one.
// Messages are sent as plain text (no parse_mode), so no escaping is needed.
//
// `owner` arguments are rows of the users table: { name, prompt, ... }. `name` is the
// owner's Telegram first name and may be null; `prompt` is their own invitation text,
// or null for the default one.

const DIGITS = { fa: '۰۱۲۳۴۵۶۷۸۹', ar: '٠١٢٣٤٥٦٧٨٩' };

// Helpers each table is built with: numbers in the locale's digits, "3 days ago",
// the owner's display name, the invitation senders see and a list of kinds.
function helpers(locale, w) {
  const num = (n) => (DIGITS[locale] ? String(n).replace(/\d/g, (d) => DIGITS[locale][d]) : String(n));
  const ago = (ts) => {
    const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
    if (s < 60) return w.now;
    if (s < 3600) return w.minutes(num(Math.floor(s / 60)));
    if (s < 86400) return w.hours(num(Math.floor(s / 3600)));
    return w.days(num(Math.floor(s / 86400)));
  };
  const who = (owner) => owner?.name || w.owner;
  const invitation = (owner) => owner.prompt || w.invite(who(owner));
  const kindList = (kinds) => kinds.map((k) => w.kinds[k]).join(w.comma);
  return { num, ago, who, invitation, kindList };
}

// ----------------------------------------------------------------------------- fa
const fa = (w) => {
  const { num, ago, who, invitation, kindList } = helpers('fa', w);
  return {
    ...w, num, ago, who, invitation, kindList,

    profile: {
      description:
        'لینک پیام ناشناس شخصی 🤫\n\n' +
        'یه لینک بگیر، بذارش توی بیو، استوری یا گروه‌ها، و از دوست‌ها و مخاطب‌هات پیام ناشناس دریافت کن — ' +
        'متن، عکس، ویس یا استیکر.\n\n' +
        'متن دعوتت رو خودت بنویس، ناشناس جواب بده، فرستنده رو مسدود کن یا پیام رو گزارش بده. ' +
        'هویت فرستنده هیچ‌وقت به تو نشون داده نمی‌شه.\n\n' +
        'برای شروع «شروع» رو بزن.',
      shortDescription: 'لینک ناشناس شخصی 🤫 از دوست‌ها و مخاطب‌هات پیام ناشناس بگیر و ناشناس جواب بده.',
    },

    // Reply keyboard
    kb: {
      link: '🎭 لینک من', stats: '📊 آمار', settings: '⚙️ تنظیمات', language: '🌐 زبان',
      privacy: '🔒 حریم خصوصی', source: '🔗 کد منبع',
    },

    // Home
    welcome: (owner, link) =>
      `سلام${owner.name ? ` ${owner.name}` : ''}! 👋 این لینک ناشناس شخصی توئه:\n\n${link}\n\n` +
      `بذارش توی بیو، استوری یا گروه‌ها. هر کسی بازش کنه می‌تونه بدون اینکه هویتش معلوم بشه ` +
      `برات پیام بفرسته. از زیر خود پیام می‌تونی جواب بدی، مسدود کنی یا گزارش بدی.\n\n` +
      `متن دعوتت الان اینه:\n«${invitation(owner)}»\n\n` +
      `از دکمه‌های پایین استفاده کن: «🎭 لینک من» برای اشتراک لینک، «⚙️ تنظیمات» برای متن دعوت، ` +
      `نوع پیام‌ها، کیوآر کد، توقف دریافت و بقیه‌ی کارها.`,
    help: 'از دکمه‌های پایین استفاده کن 👇',
    myLink: (owner, link) => `🎭 لینک ناشناس تو\n\n${link}\n\n«${invitation(owner)}»`,
    btnShare: '📤 اشتراک لینک در یه چت',
    btnQr: '🔳 کیوآر کد لینک',
    qrCaption: (owner, link) =>
      `🔳 کیوآر کد لینک ناشناس تو\n\n«${invitation(owner)}»\n${link}\n\n` +
      `بذارش توی استوری یا هر جای دیگه؛ هر کی اسکنش کنه مستقیم میاد تا بهت پیام ناشناس بده.`,
    btnBack: '⬅️ برگشت',
    btnCancel: '✖️ لغو',
    cancelled: 'لغو شد.',

    // Opening a link
    invalidLink: 'این لینک نامعتبره یا دیگه وجود نداره.',
    selfLink: (owner) =>
      `${owner.name ? `${owner.name}، ` : ''}این لینک خودته 🙂 بفرستش برای بقیه تا بتونن بهت پیام ناشناس بدن.`,
    ownerPaused: (owner) => `${who(owner)} فعلاً پیام دریافت نمی‌کنه. بعداً دوباره امتحان کن.`,
    sendPrompt: (owner) =>
      (owner.prompt ? `«${owner.prompt}»\n— ${who(owner)}\n\n` : `✉️ داری به ${who(owner)} پیام ناشناس می‌دی.\n\n`) +
      `پیامت رو همین الان بفرست.\n\n${who(owner)} نمی‌فهمه تو کی هستی.`,

    // Sending
    delivered: (owner) => `پیامت به ${who(owner)} رسید ✅`,
    btnUnsend: '🗑 پس گرفتن',
    btnSendAnother: '✉️ پیام بعدی',
    unsent: (owner) => `پیامت پس گرفته شد 🗑 دیگه توی چت ${who(owner)} نیست.`,
    unsentToast: 'پس گرفته شد',
    alreadyUnsent: 'قبلاً پس گرفته شده',
    unsendTooLate: (min) => `فقط تا ${num(min)} دقیقه بعد از ارسال می‌شه پیام رو پس گرفت.`,
    editTooLate: (min) => `ویرایش فقط تا ${num(min)} دقیقه بعد از ارسال به گیرنده می‌رسه — این ویرایش اعمال نشد.`,
    editFiltered: 'ویرایشت اعمال نشد چون کلماتی داره که این ربات اجازه نمی‌ده.',
    sendExpired: 'مهلت فرستادن پیام تموم شد ⌛️ برای فرستادن پیام دوباره لینک رو باز کن.',
    deliveryFailed: (owner) => `متأسفانه پیامت به ${who(owner)} نرسید.`,
    filtered: 'پیامت ارسال نشد چون کلماتی داره که این ربات اجازه نمی‌ده. لطفاً مهربون‌تر بازنویسیش کن.',
    unsupported: 'این نوع پیام رو نمی‌شه فرستاد. دوباره امتحان کن.',
    kindNotAccepted: (owner) => `${who(owner)} این نوع پیام رو قبول نمی‌کنه. یه نوع دیگه امتحان کن.`,

    // Received (owner side)
    newMessageHeader: (owner) =>
      `📩 یه پیام ناشناس جدید داری${owner.prompt ? `\nدر جواب: «${owner.prompt}»` : ''}`,
    btnReply: '↩️ پاسخ',
    btnBlock: '🚫 مسدود',
    btnReport: '⚠️ گزارش',
    btnGetLink: '🔗 لینک ناشناس خودت رو بگیر',

    // Reply flow
    replyPrompt: 'پاسخت رو الان بفرست (هر نوع پیامی). فرستنده نمی‌فهمه کیه، ولی می‌فهمه از طرف توئه.',
    replyHeader: (owner) => `💬 ${who(owner)} به پیامت جواب داد (برای جواب دادن، روی پیام زیر ریپلای کن):`,
    replySent: 'پاسخ ارسال شد ✅',
    replyFailed: 'پاسخت ارسال نشد — احتمالاً فرستنده ربات رو متوقف کرده.',
    replyTargetGone: 'این پیام دیگه وجود نداره.',
    replyExpired: 'مهلت جواب دادن تموم شد ⌛️ دوباره روی دکمه‌ی «↩️ پاسخ» بزن یا روی خود پیام ریپلای کن.',

    // Buttons under messages
    notYourMessage: 'این دکمه مال تو نیست.',
    blocked: 'فرستنده مسدود شد. دیگه پیامی ازش دریافت نمی‌کنی. (رفع مسدودیت: ⚙️ تنظیمات ← 🚫 مسدودها)',
    blockedToast: 'مسدود شد',
    reported: 'ممنون — پیام برای بررسی گزارش شد.',
    reportedToast: 'گزارش شد',
    alreadyReported: 'قبلاً گزارش شده',

    // Invitation text
    textMenu: (owner, max) =>
      `✏️ متن دعوت تو\n\nکسایی که لینکت رو باز می‌کنن این رو می‌بینن:\n«${invitation(owner)}»\n\n` +
      `متن جدیدت رو همین الان بفرست (حداکثر ${num(max)} حرف)، مثلاً:\n` +
      `«یه سؤال ازم بپرس که رو در رو روت نمی‌شه 😅»`,
    btnTextReset: '↩️ برگشت به متن پیش‌فرض',
    textSet: (owner) => `متن دعوتت ذخیره شد ✅\n\n«${invitation(owner)}»`,
    textReset: (owner) => `متن دعوت برگشت به پیش‌فرض ✅\n\n«${invitation(owner)}»`,
    textResetToast: 'برگشت به پیش‌فرض',
    textTooLong: (max) => `این متن طولانیه. لطفاً حداکثر ${num(max)} حرف بنویس.`,
    textNotText: 'لطفاً متن دعوت رو به صورت پیام متنی بفرست.',
    textFiltered: 'این متن کلماتی داره که این ربات اجازه نمی‌ده. یه متن دیگه بنویس.',
    textExpired: 'مهلت نوشتن متن دعوت تموم شد ⌛️ دوباره از ⚙️ تنظیمات ← ✏️ متن دعوت شروع کن.',

    // Blocked senders — `rows`: [{ at }] newest first
    noBlocked: 'هیچ‌کس رو مسدود نکردی.',
    blockedList: (rows, limited) =>
      `🚫 فرستنده‌های مسدود\n\nهویتشون معلوم نیست؛ فقط می‌بینی کِی مسدود شدن. ` +
      `روی شماره‌ی هر کدوم بزن تا رفع مسدودیت بشه.\n\n` +
      rows.map((r, i) => `${num(i + 1)}. مسدود شده ${ago(r.at)}`).join('\n') +
      (limited ? `\n\n(فقط ${num(rows.length)} مورد آخر)` : ''),
    btnUnblock: (i) => `🔓 ${num(i)}`,
    unblockedToast: 'رفع مسدودیت شد',

    // Confirmations (new link, delete)
    btnNo: '❌ نه',
    confirmCancelled: 'باشه، چیزی عوض نشد.',
    newlinkConfirm:
      '🔄 لینک جدید\n\nبا ساختن لینک جدید، لینک فعلیت دیگه کار نمی‌کنه و کسایی که فقط اون رو دارن ' +
      'نمی‌تونن بهت پیام بدن. پیام‌ها، پاسخ‌ها و مسدودی‌ها سر جاشون می‌مونن.\n\nمطمئنی؟',
    btnNewlinkYes: '✅ آره، لینک جدید بساز',
    newlinkDone: (link) => `لینک جدیدت ساخته شد ✅\n\n${link}\n\nلینک قبلی دیگه کار نمی‌کنه.`,
    deleteConfirm:
      '🗑 پاک کردن اطلاعات\n\nاین‌ها برای همیشه پاک می‌شن:\n' +
      '• لینکت (دیگه کار نمی‌کنه)، متن دعوت، زبان و تنظیماتت\n' +
      '• سابقه‌ی پیام‌هایی که دریافت کردی و پاسخ‌هات (دکمه‌های زیر پیام‌های قبلی دیگه کار نمی‌کنن)\n' +
      '• فهرست کسایی که مسدود کردی و گزارش‌هایی که دادی\n\n' +
      'این‌ها می‌مونن:\n' +
      '• سابقه‌ی پیام‌هایی که خودت ناشناس برای بقیه فرستادی — مال گیرنده‌هاست و برای مسدود کردن، ' +
      'گزارش و محدودیت تعداد پیام لازمه\n' +
      '• مسدودی‌ها، گزارش‌ها و محرومیت‌هایی که علیه تو ثبت شده\n\n' +
      'خود پیام‌ها توی چت تلگرامت می‌مونن؛ اون‌ها رو تلگرام نگه می‌داره، نه این ربات.\n\nمطمئنی؟',
    btnDeleteYes: '🗑 آره، پاک کن',
    deleted: 'اطلاعاتت پاک شد ✅ اگه دوباره لینک خواستی «🎭 لینک من» رو بزن.',

    // Admin (ADMIN_IDS) — reported messages
    adminReport: (report, owner, priorReports) =>
      `⚠️ گزارش #${num(report.id)}\n` +
      `صاحب لینک: ${owner?.name ?? '—'} (${report.ownerId})\n` +
      `گزارش‌های قبلی علیه این فرستنده: ${num(priorReports)}\n\n` +
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
      const m = (status) => num(s.messages[status] ?? 0);
      return `🛠 پنل مدیریت\n\n` +
        `👤 کاربرها\n` +
        `صاحبان لینک: ${num(s.users)} (متوقف: ${num(s.paused)})\n` +
        `جدید: ${num(s.newDay)} امروز، ${num(s.newWeek)} این هفته\n` +
        `همه‌ی کسایی که با ربات کار کردن: ${num(s.reach)}\n` +
        `فرستنده‌های ناشناس: ${num(s.senders)}\n\n` +
        `✉️ پیام‌ها\n` +
        `ارسال‌شده: ${m('delivered')} (امروز: ${num(s.deliveredDay)})\n` +
        `مسدود: ${m('blocked')} · محروم: ${m('banned')} · فیلترشده: ${m('filtered')}\n` +
        `ناموفق: ${m('failed')} · پس گرفته‌شده: ${m('unsent')}\n` +
        `پاسخ‌ها: ${num(s.replies)}\n\n` +
        `🛡 مدیریت\n` +
        `گزارش‌های باز: ${num(s.openReports)} از ${num(s.reports)}\n` +
        `محروم‌ها: ${num(s.bans)} · مسدودی‌های کاربرها: ${num(s.blocks)}\n\n` +
        `/reports – گزارش‌های باز\n` +
        `/bans – محروم‌ها و لغو محرومیت\n` +
        `/ban <شناسه> و /unban <شناسه> – محروم کردن یا لغو با شناسه‌ی تلگرام\n` +
        `/broadcast – پیام همگانی به همه‌ی کاربرها`;
    },
    btnAdminRefresh: '🔄 به‌روزرسانی',
    btnAdminReports: (n) => `⚠️ گزارش‌های باز (${num(n)})`,
    btnAdminBans: (n) => `⛔️ محروم‌ها (${num(n)})`,
    adminRefreshedToast: 'به‌روز شد',
    adminNoReports: 'گزارش بازی نیست ✅',
    adminReportsHeader: (shown, total) =>
      `⚠️ ${num(total)} گزارش باز${shown < total ? ` — ${num(shown)} تای قدیمی‌تر رو می‌بینی؛ بعد از بررسی دوباره /reports رو بزن` : ''}`,
    adminNoBans: 'هیچ‌کس محروم نیست.',
    adminBansList: (rows, limited) =>
      `⛔️ فرستنده‌های محروم از کل ربات\n\nروی شماره‌ی هر کدوم بزن تا محرومیتش لغو بشه.\n\n` +
      rows.map((r, i) =>
        `${num(i + 1)}. ${r.reportId ? `گزارش #${num(r.reportId)}` : 'دستی (/ban)'}، ${ago(r.createdAt)}`).join('\n') +
      (limited ? `\n\n(فقط ${num(rows.length)} مورد آخر)` : ''),
    adminBanUsage: (cmd) => `شناسه‌ی عددی تلگرام رو بعد از دستور بنویس، مثلاً:\n/${cmd} 123456789`,
    adminBanned: (id) => `⛔️ ${id} از کل ربات محروم شد. پیام‌های ناشناسش بی‌صدا دور ریخته می‌شن.`,
    adminAlreadyBanned: (id) => `${id} از قبل محرومه.`,
    adminUnbanned: (id) => `✅ محرومیت ${id} لغو شد.`,
    adminNotBanned: (id) => `${id} محروم نبود.`,
    broadcastPrompt: (n) =>
      `📢 پیام همگانی\n\nپیامی که می‌خوای برای ${num(n)} نفر فرستاده بشه رو همین الان بفرست ` +
      `(هر نوع پیامی؛ آلبوم فقط اولین موردش). قبل از ارسال ازت تأیید می‌گیرم.`,
    broadcastConfirm: (n) => `📢 این پیام برای ${num(n)} نفر فرستاده بشه؟`,
    btnBroadcastSend: '✅ آره، بفرست',
    btnBroadcastResume: '▶️ ادامه (اگه متوقف شد)',
    broadcastStartedToast: 'ارسال شروع شد',
    broadcastProgress: (sent, failed, total) =>
      `📢 در حال ارسال… ${num(sent + failed)} از ${num(total)}\n` +
      `رسید: ${num(sent)} · نرسید: ${num(failed)}\n\n` +
      `اگه یه دقیقه پیشرفتی نبود، دکمه‌ی ادامه رو بزن؛ از همون جایی که مونده ادامه می‌ده.`,
    broadcastDone: (sent, failed) =>
      `📢 پیام همگانی تموم شد ✅\nرسید: ${num(sent)} · نرسید (ربات رو بستن): ${num(failed)}`,
    broadcastBusy: 'این پیام همگانی همین الان در حال ارساله. اگه یه دقیقه پیشرفتی نبود دوباره امتحان کن.',
    broadcastAlreadyDone: 'این پیام همگانی قبلاً کامل فرستاده شده ✅',
    broadcastCancelled: 'پیام همگانی لغو شد.',
    broadcastExpired: 'مهلت فرستادن پیام همگانی تموم شد ⌛️ دوباره /broadcast رو بزن.',

    // Message types
    typesMenu: (kinds) =>
      `📥 چه پیام‌هایی دریافت کنی؟\n\nروی هر مورد بزن تا روشن ✅ یا خاموش ⬜️ بشه.\n\nالان: ${kindList(kinds)}`,
    typesLastOne: 'حداقل یه نوع باید روشن بمونه',

    // Stats, privacy
    needLink: 'هنوز لینک نداری — «🎭 لینک من» رو بزن تا بسازیمش.',
    stats: (owner, { received, replies, blocked, filtered }) =>
      `📊 آمار${owner.name ? ` ${owner.name}` : ''}\n\n` +
      `پیام‌های دریافتی: ${num(received)}\n` +
      `پاسخ‌های ارسالی: ${num(replies)}\n` +
      `فرستنده‌های مسدود: ${num(blocked)}\n` +
      `پیام‌های فیلترشده: ${num(filtered)}\n\n` +
      `وضعیت: ${owner.paused ? 'متوقف' : 'در حال دریافت'}`,
    privacy:
      `🔒 حریم خصوصی\n\n` +
      `این ربات این‌ها رو ذخیره می‌کنه:\n` +
      `• برای صاحب هر لینک: شناسه‌ی کاربری تلگرام، اسم کوچیک تلگرام (برای شخصی‌سازی پیام‌ها)، کد لینک، ` +
      `متن دعوتی که خودش نوشته، نوع پیام‌هایی که قبول می‌کنه، وضعیت توقف و زمان ساخت.\n` +
      `• برای هر کسی که با ربات کار می‌کنه: زبانش (انتخاب‌شده یا زبان تلگرامش) و شناسه‌ی پیام‌های منوی ربات توی چتش، ` +
      `تا پیام‌های قدیمی منو پاک بشن.\n` +
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
      `با ⚙️ تنظیمات ← 🗑 پاک کردن اطلاعاتم، لینکت، تنظیماتت، سابقه‌ی پیام‌های دریافتی و پاسخ‌هات، مسدودی‌هایی که انجام دادی و گزارش‌هایی که دادی پاک می‌شن. ` +
      `سابقه‌ی پیام‌هایی که خودت برای بقیه فرستادی و مسدودی/گزارش/محرومیت‌های علیه تو می‌مونن، ` +
      `چون مال گیرنده‌هاست و برای جلوگیری از مزاحمت لازمه.`,

    // Settings
    settingsTitle: '⚙️ تنظیمات',
    settingsReceiving: 'دریافت پیام: ▶️ روشن',
    settingsPaused: 'دریافت پیام: ⏸ متوقف',
    stPause: '⏸ توقف دریافت',
    stResume: '▶️ ادامه‌ی دریافت',
    stText: '✏️ متن دعوت',
    stTypes: '📨 نوع پیام‌ها',
    stBlocked: '🚫 مسدودها',
    stNewlink: '🔄 لینک جدید',
    stDelete: '🗑 پاک کردن اطلاعاتم',

    // Language, source
    chooseLanguage: '🌐 زبان خود را انتخاب کنید:',
    languageSet: (name) => `✅ زبان به ${name} تغییر کرد.`,
    sourceHere: '📦 کد منبع:',
    source: '🔗 کد منبع',

    // Inline mode (@bot in any chat)
    inlineShareTitle: '📤 اشتراک لینک ناشناس من',
    inlineCustomTitle: '✏️ اشتراک با همین متن',
    inlineInvite: (owner) => `🎭 ${invitation(owner)}\n\nهویتت معلوم نمی‌شه. روی دکمه‌ی زیر بزن 👇`,
    inlineLinkTitle: '🔗 فقط لینک',
    btnSendAnon: (owner) => `✉️ پیام ناشناس به ${who(owner)}`,
    inlinePaused: '⏸ دریافت پیامت متوقفه — اول از ⚙️ تنظیمات ادامه‌اش بده.',
  };
};

// ----------------------------------------------------------------------------- en
const en = (w) => {
  const { num, ago, who, invitation, kindList } = helpers('en', w);
  return {
    ...w, num, ago, who, invitation, kindList,

    profile: {
      description:
        'Your personal anonymous message link 🤫\n\n' +
        'Get a link, put it in your bio, story or groups, and receive anonymous messages from friends and followers — ' +
        'text, photos, voice or stickers.\n\n' +
        'Write your own invitation text, reply anonymously, block a sender or report a message. ' +
        "The sender's identity is never shown to you.\n\n" +
        'Press Start to begin.',
      shortDescription: 'Personal anonymous link 🤫 Get anonymous messages from friends and reply anonymously.',
    },

    kb: {
      link: '🎭 My link', stats: '📊 Stats', settings: '⚙️ Settings', language: '🌐 Language',
      privacy: '🔒 Privacy', source: '🔗 Source code',
    },

    welcome: (owner, link) =>
      `Hi${owner.name ? ` ${owner.name}` : ''}! 👋 This is your personal anonymous link:\n\n${link}\n\n` +
      `Put it in your bio, story or groups. Anyone who opens it can message you without revealing who they are. ` +
      `Under each message you can reply, block or report.\n\n` +
      `Your invitation text is now:\n«${invitation(owner)}»\n\n` +
      `Use the buttons below: 🎭 My link to share it, ⚙️ Settings for your invitation text, ` +
      `message types, QR code, pausing and more.`,
    help: 'Use the buttons below 👇',
    myLink: (owner, link) => `🎭 Your anonymous link\n\n${link}\n\n«${invitation(owner)}»`,
    btnShare: '📤 Share link in a chat',
    btnQr: '🔳 QR code of the link',
    qrCaption: (owner, link) =>
      `🔳 QR code of your anonymous link\n\n«${invitation(owner)}»\n${link}\n\n` +
      `Put it in your story or anywhere else; whoever scans it can send you an anonymous message right away.`,
    btnBack: '⬅️ Back',
    btnCancel: '✖️ Cancel',
    cancelled: 'Cancelled.',

    invalidLink: "This link is invalid or doesn't exist anymore.",
    selfLink: (owner) =>
      `${owner.name ? `${owner.name}, ` : ''}this is your own link 🙂 Send it to others so they can message you anonymously.`,
    ownerPaused: (owner) => `${who(owner)} isn't receiving messages right now. Try again later.`,
    sendPrompt: (owner) =>
      (owner.prompt ? `«${owner.prompt}»\n— ${who(owner)}\n\n` : `✉️ You're sending ${who(owner)} an anonymous message.\n\n`) +
      `Send your message now.\n\n${who(owner)} won't know who you are.`,

    delivered: (owner) => `Your message reached ${who(owner)} ✅`,
    btnUnsend: '🗑 Unsend',
    btnSendAnother: '✉️ Send another',
    unsent: (owner) => `Your message was unsent 🗑 It's no longer in ${who(owner)}'s chat.`,
    unsentToast: 'Unsent',
    alreadyUnsent: 'Already unsent',
    unsendTooLate: (min) => `A message can only be unsent within ${num(min)} minutes of sending.`,
    editTooLate: (min) => `Edits only reach the recipient within ${num(min)} minutes of sending — this edit wasn't applied.`,
    editFiltered: "Your edit wasn't applied because it contains words this bot doesn't allow.",
    sendExpired: 'Time to send ran out ⌛️ Open the link again to send a message.',
    deliveryFailed: (owner) => `Sorry, your message couldn't be delivered to ${who(owner)}.`,
    filtered: "Your message wasn't sent because it contains words this bot doesn't allow. Please rephrase it more kindly.",
    unsupported: "This kind of message can't be sent. Try again.",
    kindNotAccepted: (owner) => `${who(owner)} doesn't accept this kind of message. Try another kind.`,

    newMessageHeader: (owner) =>
      `📩 You have a new anonymous message${owner.prompt ? `\nIn reply to: «${owner.prompt}»` : ''}`,
    btnReply: '↩️ Reply',
    btnBlock: '🚫 Block',
    btnReport: '⚠️ Report',
    btnGetLink: '🔗 Get your own anonymous link',

    replyPrompt: "Send your reply now (any kind of message). The sender won't learn who you are, but will know it's from you.",
    replyHeader: (owner) => `💬 ${who(owner)} replied to your message (reply to the message below to answer):`,
    replySent: 'Reply sent ✅',
    replyFailed: "Your reply couldn't be sent — the sender has probably stopped the bot.",
    replyTargetGone: "This message doesn't exist anymore.",
    replyExpired: 'Time to reply ran out ⌛️ Tap «↩️ Reply» again or reply to the message itself.',

    notYourMessage: "This button isn't yours.",
    blocked: "Sender blocked. You won't receive their messages anymore. (To unblock: ⚙️ Settings → 🚫 Blocked senders)",
    blockedToast: 'Blocked',
    reported: 'Thanks — the message was reported for review.',
    reportedToast: 'Reported',
    alreadyReported: 'Already reported',

    textMenu: (owner, max) =>
      `✏️ Your invitation text\n\nPeople who open your link see:\n«${invitation(owner)}»\n\n` +
      `Send your new text now (up to ${num(max)} characters), for example:\n` +
      `«Ask me something you'd never ask to my face 😅»`,
    btnTextReset: '↩️ Back to the default text',
    textSet: (owner) => `Invitation text saved ✅\n\n«${invitation(owner)}»`,
    textReset: (owner) => `Invitation text is back to the default ✅\n\n«${invitation(owner)}»`,
    textResetToast: 'Back to default',
    textTooLong: (max) => `That's too long. Please write at most ${num(max)} characters.`,
    textNotText: 'Please send the invitation text as a text message.',
    textFiltered: "That text contains words this bot doesn't allow. Write something else.",
    textExpired: 'Time to write the invitation text ran out ⌛️ Start again from ⚙️ Settings → ✏️ Invitation text.',

    noBlocked: "You haven't blocked anyone.",
    blockedList: (rows, limited) =>
      `🚫 Blocked senders\n\nTheir identity isn't shown; you only see when they were blocked. ` +
      `Tap a number to unblock.\n\n` +
      rows.map((r, i) => `${num(i + 1)}. blocked ${ago(r.at)}`).join('\n') +
      (limited ? `\n\n(only the latest ${num(rows.length)})` : ''),
    btnUnblock: (i) => `🔓 ${num(i)}`,
    unblockedToast: 'Unblocked',

    btnNo: '❌ No',
    confirmCancelled: 'OK, nothing changed.',
    newlinkConfirm:
      "🔄 New link\n\nWith a new link your current one stops working, and people who only have it " +
      "can't message you anymore. Messages, replies and blocks stay as they are.\n\nAre you sure?",
    btnNewlinkYes: '✅ Yes, make a new link',
    newlinkDone: (link) => `Your new link is ready ✅\n\n${link}\n\nThe old link no longer works.`,
    deleteConfirm:
      '🗑 Delete your data\n\nThese are deleted for good:\n' +
      '• your link (it stops working), invitation text, language and settings\n' +
      "• the record of messages you received and your replies (buttons under earlier messages stop working)\n" +
      "• the list of people you blocked and the reports you made\n\n" +
      'These stay:\n' +
      '• the record of anonymous messages you sent to others — it belongs to the recipients and is needed for blocking, ' +
      'reports and rate limits\n' +
      '• blocks, reports and bans made against you\n\n' +
      'The messages themselves stay in your Telegram chat; Telegram keeps those, not this bot.\n\nAre you sure?',
    btnDeleteYes: '🗑 Yes, delete',
    deleted: 'Your data was deleted ✅ Tap «🎭 My link» if you want a link again.',

    adminReport: (report, owner, priorReports) =>
      `⚠️ Report #${num(report.id)}\n` +
      `Link owner: ${owner?.name ?? '—'} (${report.ownerId})\n` +
      `Earlier reports against this sender: ${num(priorReports)}\n\n` +
      `The reported message is below 👇`,
    adminMessageGone: '(The reported message is no longer available.)',
    btnBan: '⛔️ Ban the sender',
    btnDismiss: '✅ Dismiss',
    btnBanned: '⛔️ Banned — unban',
    btnDismissed: '✅ Dismissed — ban',
    bannedToast: 'Sender banned from the whole bot',
    unbannedToast: 'Ban lifted',
    dismissedToast: 'Report dismissed',

    adminDashboard: (s) => {
      const m = (status) => num(s.messages[status] ?? 0);
      return `🛠 Admin panel\n\n` +
        `👤 Users\n` +
        `Link owners: ${num(s.users)} (paused: ${num(s.paused)})\n` +
        `New: ${num(s.newDay)} today, ${num(s.newWeek)} this week\n` +
        `Everyone who used the bot: ${num(s.reach)}\n` +
        `Anonymous senders: ${num(s.senders)}\n\n` +
        `✉️ Messages\n` +
        `Delivered: ${m('delivered')} (today: ${num(s.deliveredDay)})\n` +
        `Blocked: ${m('blocked')} · Banned: ${m('banned')} · Filtered: ${m('filtered')}\n` +
        `Failed: ${m('failed')} · Unsent: ${m('unsent')}\n` +
        `Replies: ${num(s.replies)}\n\n` +
        `🛡 Moderation\n` +
        `Open reports: ${num(s.openReports)} of ${num(s.reports)}\n` +
        `Bans: ${num(s.bans)} · User blocks: ${num(s.blocks)}\n\n` +
        `/reports – open reports\n` +
        `/bans – bans and unbanning\n` +
        `/ban <id> and /unban <id> – ban or unban by Telegram id\n` +
        `/broadcast – message everyone`;
    },
    btnAdminRefresh: '🔄 Refresh',
    btnAdminReports: (n) => `⚠️ Open reports (${num(n)})`,
    btnAdminBans: (n) => `⛔️ Bans (${num(n)})`,
    adminRefreshedToast: 'Refreshed',
    adminNoReports: 'No open reports ✅',
    adminReportsHeader: (shown, total) =>
      `⚠️ ${num(total)} open report(s)${shown < total ? ` — showing the ${num(shown)} oldest; send /reports again after reviewing` : ''}`,
    adminNoBans: 'Nobody is banned.',
    adminBansList: (rows, limited) =>
      `⛔️ Senders banned from the whole bot\n\nTap a number to lift that ban.\n\n` +
      rows.map((r, i) =>
        `${num(i + 1)}. ${r.reportId ? `report #${num(r.reportId)}` : 'manual (/ban)'}, ${ago(r.createdAt)}`).join('\n') +
      (limited ? `\n\n(only the latest ${num(rows.length)})` : ''),
    adminBanUsage: (cmd) => `Put the numeric Telegram id after the command, e.g.:\n/${cmd} 123456789`,
    adminBanned: (id) => `⛔️ ${id} is banned from the whole bot. Their anonymous messages are silently dropped.`,
    adminAlreadyBanned: (id) => `${id} is already banned.`,
    adminUnbanned: (id) => `✅ Ban on ${id} lifted.`,
    adminNotBanned: (id) => `${id} wasn't banned.`,
    broadcastPrompt: (n) =>
      `📢 Broadcast\n\nSend the message that should go to ${num(n)} people now ` +
      `(any kind; for an album only its first item). I'll ask you to confirm before sending.`,
    broadcastConfirm: (n) => `📢 Send this message to ${num(n)} people?`,
    btnBroadcastSend: '✅ Yes, send',
    btnBroadcastResume: '▶️ Resume (if it stopped)',
    broadcastStartedToast: 'Sending started',
    broadcastProgress: (sent, failed, total) =>
      `📢 Sending… ${num(sent + failed)} of ${num(total)}\n` +
      `Delivered: ${num(sent)} · Failed: ${num(failed)}\n\n` +
      `If there's no progress for a minute, tap Resume; it continues where it stopped.`,
    broadcastDone: (sent, failed) =>
      `📢 Broadcast finished ✅\nDelivered: ${num(sent)} · Failed (blocked the bot): ${num(failed)}`,
    broadcastBusy: 'This broadcast is being sent right now. If there is no progress for a minute, try again.',
    broadcastAlreadyDone: 'This broadcast was already sent in full ✅',
    broadcastCancelled: 'Broadcast cancelled.',
    broadcastExpired: 'Time to send the broadcast ran out ⌛️ Send /broadcast again.',

    typesMenu: (kinds) =>
      `📥 Which messages do you accept?\n\nTap an item to turn it on ✅ or off ⬜️.\n\nNow: ${kindList(kinds)}`,
    typesLastOne: 'At least one kind has to stay on',

    needLink: "You don't have a link yet — tap «🎭 My link» to make one.",
    stats: (owner, { received, replies, blocked, filtered }) =>
      `📊 Stats${owner.name ? ` for ${owner.name}` : ''}\n\n` +
      `Messages received: ${num(received)}\n` +
      `Replies sent: ${num(replies)}\n` +
      `Blocked senders: ${num(blocked)}\n` +
      `Filtered messages: ${num(filtered)}\n\n` +
      `Status: ${owner.paused ? 'paused' : 'receiving'}`,
    privacy:
      `🔒 Privacy\n\n` +
      `This bot stores:\n` +
      `• For each link owner: Telegram user id, Telegram first name (to personalise messages), link code, ` +
      `their own invitation text, the message kinds they accept, the paused flag and when it was created.\n` +
      `• For everyone who uses the bot: their language (chosen, or their Telegram language) and the ids of the bot's ` +
      `menu messages in their chat, so old menus can be removed.\n` +
      `• For each anonymous message: the sender's and link owner's user ids, the Telegram chat/message ids needed to ` +
      `deliver replies, edits and unsends, the Telegram album id (for multi-photo/video messages), ` +
      `the status (delivered / blocked / banned / filtered / failed / unsent) and the time.\n` +
      `• Blocks (link owner + sender ids), reports (message, link owner and sender ids, and the outcome), ` +
      `bot-wide bans (sender id) and replies (message and link owner ids, and the Telegram chat/message ids needed to relay reactions and replies).\n` +
      `• The step you're at in the bot (e.g. "writing a message to <link owner id>").\n` +
      `• For the operator's broadcasts: the id of the last person reached, so an interrupted run resumes there.\n\n` +
      `Why the sender's id is stored: so the link owner can block them, rate limits apply ` +
      `and reported messages can be reviewed.\n\n` +
      `The sender's id and name are never shown to the link owner. The link owner's name is shown to people who open their link. ` +
      `The bot doesn't store the text, captions or files of anonymous messages — Telegram copies them between chats directly. ` +
      `When a message is reported, a copy of it (without the sender's identity, with the link owner's name and id) is sent to the bot's operator for review. ` +
      `The operator technically has access to the stored data.\n\n` +
      `⚙️ Settings → 🗑 Delete my data removes your link, settings, the record of messages you received and your replies, the blocks you made and the reports you filed. ` +
      `The record of messages you sent to others and blocks/reports/bans against you stay, ` +
      `because they belong to the recipients and are needed to prevent abuse.`,

    settingsTitle: '⚙️ Settings',
    settingsReceiving: 'Receiving messages: ▶️ on',
    settingsPaused: 'Receiving messages: ⏸ paused',
    stPause: '⏸ Pause receiving',
    stResume: '▶️ Resume receiving',
    stText: '✏️ Invitation text',
    stTypes: '📨 Message types',
    stBlocked: '🚫 Blocked senders',
    stNewlink: '🔄 New link',
    stDelete: '🗑 Delete my data',

    chooseLanguage: '🌐 Choose your language:',
    languageSet: (name) => `✅ Language set to ${name}.`,
    sourceHere: '📦 Source code:',
    source: '🔗 Source code',

    inlineShareTitle: '📤 Share my anonymous link',
    inlineCustomTitle: '✏️ Share with this text',
    inlineInvite: (owner) => `🎭 ${invitation(owner)}\n\nYour identity stays hidden. Tap the button below 👇`,
    inlineLinkTitle: '🔗 Just the link',
    btnSendAnon: (owner) => `✉️ Anonymous message to ${who(owner)}`,
    inlinePaused: '⏸ Receiving is paused — resume it in ⚙️ Settings first.',
  };
};

// ----------------------------------------------------------------------------- ar
const ar = (w) => {
  const { num, ago, who, invitation, kindList } = helpers('ar', w);
  return {
    ...w, num, ago, who, invitation, kindList,

    profile: {
      description:
        'رابط رسائل مجهولة خاص بك 🤫\n\n' +
        'احصل على رابط وضعه في نبذتك أو قصتك أو المجموعات، واستقبل رسائل مجهولة من أصدقائك ومتابعيك — ' +
        'نص أو صور أو رسائل صوتية أو ملصقات.\n\n' +
        'اكتب نص دعوتك بنفسك، وردّ دون كشف هويتك، واحظر مرسلًا أو أبلغ عن رسالة. ' +
        'هوية المرسل لا تظهر لك أبدًا.\n\n' +
        'اضغط «ابدأ» للبدء.',
      shortDescription: 'رابط مجهول خاص 🤫 استقبل رسائل مجهولة من أصدقائك وردّ دون كشف هويتك.',
    },

    kb: {
      link: '🎭 رابطي', stats: '📊 الإحصاءات', settings: '⚙️ الإعدادات', language: '🌐 اللغة',
      privacy: '🔒 الخصوصية', source: '🔗 الكود المصدري',
    },

    welcome: (owner, link) =>
      `مرحبًا${owner.name ? ` ${owner.name}` : ''}! 👋 هذا رابطك المجهول الخاص:\n\n${link}\n\n` +
      `ضعه في نبذتك أو قصتك أو المجموعات. يمكن لأي شخص يفتحه أن يراسلك دون الكشف عن هويته. ` +
      `من أسفل كل رسالة يمكنك الرد أو الحظر أو الإبلاغ.\n\n` +
      `نص دعوتك الآن:\n«${invitation(owner)}»\n\n` +
      `استخدم الأزرار بالأسفل: «🎭 رابطي» لمشاركته، و«⚙️ الإعدادات» لنص الدعوة ` +
      `وأنواع الرسائل ورمز QR وإيقاف الاستقبال وغير ذلك.`,
    help: 'استخدم الأزرار بالأسفل 👇',
    myLink: (owner, link) => `🎭 رابطك المجهول\n\n${link}\n\n«${invitation(owner)}»`,
    btnShare: '📤 مشاركة الرابط في محادثة',
    btnQr: '🔳 رمز QR للرابط',
    qrCaption: (owner, link) =>
      `🔳 رمز QR لرابطك المجهول\n\n«${invitation(owner)}»\n${link}\n\n` +
      `ضعه في قصتك أو في أي مكان؛ من يمسحه يستطيع إرسال رسالة مجهولة إليك مباشرة.`,
    btnBack: '⬅️ رجوع',
    btnCancel: '✖️ إلغاء',
    cancelled: 'تم الإلغاء.',

    invalidLink: 'هذا الرابط غير صالح أو لم يعد موجودًا.',
    selfLink: (owner) =>
      `${owner.name ? `${owner.name}، ` : ''}هذا رابطك أنت 🙂 أرسله للآخرين ليتمكنوا من مراسلتك دون كشف هويتهم.`,
    ownerPaused: (owner) => `${who(owner)} لا يستقبل الرسائل حاليًا. حاول لاحقًا.`,
    sendPrompt: (owner) =>
      (owner.prompt ? `«${owner.prompt}»\n— ${who(owner)}\n\n` : `✉️ أنت ترسل رسالة مجهولة إلى ${who(owner)}.\n\n`) +
      `أرسل رسالتك الآن.\n\nلن يعرف ${who(owner)} من أنت.`,

    delivered: (owner) => `وصلت رسالتك إلى ${who(owner)} ✅`,
    btnUnsend: '🗑 استرجاع',
    btnSendAnother: '✉️ رسالة أخرى',
    unsent: (owner) => `تم استرجاع رسالتك 🗑 لم تعد في محادثة ${who(owner)}.`,
    unsentToast: 'تم الاسترجاع',
    alreadyUnsent: 'تم استرجاعها من قبل',
    unsendTooLate: (min) => `يمكن استرجاع الرسالة خلال ${num(min)} دقيقة فقط من إرسالها.`,
    editTooLate: (min) => `التعديل يصل إلى المستلم خلال ${num(min)} دقيقة فقط من الإرسال — لم يُطبَّق هذا التعديل.`,
    editFiltered: 'لم يُطبَّق تعديلك لأنه يحتوي على كلمات لا يسمح بها هذا البوت.',
    sendExpired: 'انتهت مهلة الإرسال ⌛️ افتح الرابط مرة أخرى لإرسال رسالة.',
    deliveryFailed: (owner) => `للأسف لم تصل رسالتك إلى ${who(owner)}.`,
    filtered: 'لم تُرسل رسالتك لأنها تحتوي على كلمات لا يسمح بها هذا البوت. أعد صياغتها بلطف أكثر.',
    unsupported: 'لا يمكن إرسال هذا النوع من الرسائل. حاول مرة أخرى.',
    kindNotAccepted: (owner) => `${who(owner)} لا يقبل هذا النوع من الرسائل. جرّب نوعًا آخر.`,

    newMessageHeader: (owner) =>
      `📩 لديك رسالة مجهولة جديدة${owner.prompt ? `\nردًا على: «${owner.prompt}»` : ''}`,
    btnReply: '↩️ رد',
    btnBlock: '🚫 حظر',
    btnReport: '⚠️ إبلاغ',
    btnGetLink: '🔗 احصل على رابطك المجهول',

    replyPrompt: 'أرسل ردك الآن (أي نوع من الرسائل). لن يعرف المرسل من أنت، لكنه سيعرف أن الرد منك.',
    replyHeader: (owner) => `💬 ردّ ${who(owner)} على رسالتك (للرد، رُدّ على الرسالة أدناه):`,
    replySent: 'تم إرسال الرد ✅',
    replyFailed: 'لم يُرسل ردك — على الأرجح أوقف المرسل البوت.',
    replyTargetGone: 'هذه الرسالة لم تعد موجودة.',
    replyExpired: 'انتهت مهلة الرد ⌛️ اضغط «↩️ رد» مرة أخرى أو رُدّ على الرسالة نفسها.',

    notYourMessage: 'هذا الزر ليس لك.',
    blocked: 'تم حظر المرسل. لن تستقبل رسائله بعد الآن. (لإلغاء الحظر: ⚙️ الإعدادات ← 🚫 المحظورون)',
    blockedToast: 'تم الحظر',
    reported: 'شكرًا — تم الإبلاغ عن الرسالة للمراجعة.',
    reportedToast: 'تم الإبلاغ',
    alreadyReported: 'تم الإبلاغ عنها من قبل',

    textMenu: (owner, max) =>
      `✏️ نص دعوتك\n\nمن يفتح رابطك يرى:\n«${invitation(owner)}»\n\n` +
      `أرسل نصك الجديد الآن (حتى ${num(max)} حرفًا)، مثلًا:\n` +
      `«اسألني سؤالًا لا تجرؤ على طرحه وجهًا لوجه 😅»`,
    btnTextReset: '↩️ العودة إلى النص الافتراضي',
    textSet: (owner) => `تم حفظ نص الدعوة ✅\n\n«${invitation(owner)}»`,
    textReset: (owner) => `عاد نص الدعوة إلى الافتراضي ✅\n\n«${invitation(owner)}»`,
    textResetToast: 'عاد إلى الافتراضي',
    textTooLong: (max) => `النص طويل جدًا. اكتب ${num(max)} حرفًا على الأكثر.`,
    textNotText: 'أرسل نص الدعوة كرسالة نصية.',
    textFiltered: 'هذا النص يحتوي على كلمات لا يسمح بها هذا البوت. اكتب نصًا آخر.',
    textExpired: 'انتهت مهلة كتابة نص الدعوة ⌛️ ابدأ من جديد من ⚙️ الإعدادات ← ✏️ نص الدعوة.',

    noBlocked: 'لم تحظر أحدًا.',
    blockedList: (rows, limited) =>
      `🚫 المرسلون المحظورون\n\nهويتهم غير معروفة؛ ترى فقط متى حُظروا. ` +
      `اضغط على رقم لإلغاء حظره.\n\n` +
      rows.map((r, i) => `${num(i + 1)}. حُظر ${ago(r.at)}`).join('\n') +
      (limited ? `\n\n(آخر ${num(rows.length)} فقط)` : ''),
    btnUnblock: (i) => `🔓 ${num(i)}`,
    unblockedToast: 'تم إلغاء الحظر',

    btnNo: '❌ لا',
    confirmCancelled: 'حسنًا، لم يتغير شيء.',
    newlinkConfirm:
      '🔄 رابط جديد\n\nعند إنشاء رابط جديد يتوقف رابطك الحالي، ولن يتمكن من لديه الرابط القديم فقط ' +
      'من مراسلتك. تبقى الرسائل والردود وقائمة الحظر كما هي.\n\nهل أنت متأكد؟',
    btnNewlinkYes: '✅ نعم، أنشئ رابطًا جديدًا',
    newlinkDone: (link) => `تم إنشاء رابطك الجديد ✅\n\n${link}\n\nالرابط القديم لم يعد يعمل.`,
    deleteConfirm:
      '🗑 حذف بياناتك\n\nسيُحذف نهائيًا:\n' +
      '• رابطك (سيتوقف عن العمل) ونص الدعوة واللغة والإعدادات\n' +
      '• سجل الرسائل التي استقبلتها وردودك (أزرار الرسائل السابقة ستتوقف)\n' +
      '• قائمة من حظرتهم والبلاغات التي قدمتها\n\n' +
      'يبقى:\n' +
      '• سجل الرسائل المجهولة التي أرسلتها للآخرين — فهو يخص المستلمين ومطلوب للحظر ' +
      'والبلاغات وحدود الإرسال\n' +
      '• الحظر والبلاغات والمنع المسجّلة ضدك\n\n' +
      'تبقى الرسائل نفسها في محادثة تيليجرام؛ تيليجرام يحتفظ بها، لا هذا البوت.\n\nهل أنت متأكد؟',
    btnDeleteYes: '🗑 نعم، احذف',
    deleted: 'تم حذف بياناتك ✅ اضغط «🎭 رابطي» إذا أردت رابطًا من جديد.',

    adminReport: (report, owner, priorReports) =>
      `⚠️ بلاغ #${num(report.id)}\n` +
      `صاحب الرابط: ${owner?.name ?? '—'} (${report.ownerId})\n` +
      `بلاغات سابقة ضد هذا المرسل: ${num(priorReports)}\n\n` +
      `الرسالة المُبلّغ عنها بالأسفل 👇`,
    adminMessageGone: '(الرسالة المُبلّغ عنها لم تعد متاحة.)',
    btnBan: '⛔️ منع المرسل',
    btnDismiss: '✅ رفض البلاغ',
    btnBanned: '⛔️ ممنوع — إلغاء المنع',
    btnDismissed: '✅ مرفوض — منع',
    bannedToast: 'تم منع المرسل من البوت بالكامل',
    unbannedToast: 'تم إلغاء المنع',
    dismissedToast: 'تم رفض البلاغ',

    adminDashboard: (s) => {
      const m = (status) => num(s.messages[status] ?? 0);
      return `🛠 لوحة الإدارة\n\n` +
        `👤 المستخدمون\n` +
        `أصحاب الروابط: ${num(s.users)} (متوقفون: ${num(s.paused)})\n` +
        `جدد: ${num(s.newDay)} اليوم، ${num(s.newWeek)} هذا الأسبوع\n` +
        `كل من استخدم البوت: ${num(s.reach)}\n` +
        `المرسلون المجهولون: ${num(s.senders)}\n\n` +
        `✉️ الرسائل\n` +
        `مُرسلة: ${m('delivered')} (اليوم: ${num(s.deliveredDay)})\n` +
        `محظورة: ${m('blocked')} · ممنوعة: ${m('banned')} · مُرشّحة: ${m('filtered')}\n` +
        `فاشلة: ${m('failed')} · مُسترجعة: ${m('unsent')}\n` +
        `الردود: ${num(s.replies)}\n\n` +
        `🛡 الإشراف\n` +
        `بلاغات مفتوحة: ${num(s.openReports)} من ${num(s.reports)}\n` +
        `الممنوعون: ${num(s.bans)} · حظر المستخدمين: ${num(s.blocks)}\n\n` +
        `/reports – البلاغات المفتوحة\n` +
        `/bans – الممنوعون وإلغاء المنع\n` +
        `/ban <المعرّف> و /unban <المعرّف> – منع أو إلغاء بمعرّف تيليجرام\n` +
        `/broadcast – رسالة جماعية للجميع`;
    },
    btnAdminRefresh: '🔄 تحديث',
    btnAdminReports: (n) => `⚠️ بلاغات مفتوحة (${num(n)})`,
    btnAdminBans: (n) => `⛔️ الممنوعون (${num(n)})`,
    adminRefreshedToast: 'تم التحديث',
    adminNoReports: 'لا توجد بلاغات مفتوحة ✅',
    adminReportsHeader: (shown, total) =>
      `⚠️ ${num(total)} بلاغ مفتوح${shown < total ? ` — تعرض أقدم ${num(shown)}؛ أرسل /reports مجددًا بعد المراجعة` : ''}`,
    adminNoBans: 'لا يوجد أحد ممنوع.',
    adminBansList: (rows, limited) =>
      `⛔️ المرسلون الممنوعون من البوت بالكامل\n\nاضغط على رقم لإلغاء منعه.\n\n` +
      rows.map((r, i) =>
        `${num(i + 1)}. ${r.reportId ? `بلاغ #${num(r.reportId)}` : 'يدوي (/ban)'}، ${ago(r.createdAt)}`).join('\n') +
      (limited ? `\n\n(آخر ${num(rows.length)} فقط)` : ''),
    adminBanUsage: (cmd) => `اكتب معرّف تيليجرام الرقمي بعد الأمر، مثلًا:\n/${cmd} 123456789`,
    adminBanned: (id) => `⛔️ تم منع ${id} من البوت بالكامل. رسائله المجهولة تُتجاهل بصمت.`,
    adminAlreadyBanned: (id) => `${id} ممنوع مسبقًا.`,
    adminUnbanned: (id) => `✅ تم إلغاء منع ${id}.`,
    adminNotBanned: (id) => `${id} لم يكن ممنوعًا.`,
    broadcastPrompt: (n) =>
      `📢 رسالة جماعية\n\nأرسل الآن الرسالة التي تريد إرسالها إلى ${num(n)} شخص ` +
      `(أي نوع؛ للألبوم أول عنصر فقط). سأطلب تأكيدك قبل الإرسال.`,
    broadcastConfirm: (n) => `📢 إرسال هذه الرسالة إلى ${num(n)} شخص؟`,
    btnBroadcastSend: '✅ نعم، أرسل',
    btnBroadcastResume: '▶️ متابعة (إن توقف)',
    broadcastStartedToast: 'بدأ الإرسال',
    broadcastProgress: (sent, failed, total) =>
      `📢 جارٍ الإرسال… ${num(sent + failed)} من ${num(total)}\n` +
      `وصلت: ${num(sent)} · لم تصل: ${num(failed)}\n\n` +
      `إن لم يتقدم الإرسال لدقيقة، اضغط «متابعة»؛ سيكمل من حيث توقف.`,
    broadcastDone: (sent, failed) =>
      `📢 انتهت الرسالة الجماعية ✅\nوصلت: ${num(sent)} · لم تصل (حظروا البوت): ${num(failed)}`,
    broadcastBusy: 'هذه الرسالة الجماعية قيد الإرسال الآن. إن لم يتقدم الإرسال لدقيقة، حاول مجددًا.',
    broadcastAlreadyDone: 'أُرسلت هذه الرسالة الجماعية بالكامل من قبل ✅',
    broadcastCancelled: 'أُلغيت الرسالة الجماعية.',
    broadcastExpired: 'انتهت مهلة إرسال الرسالة الجماعية ⌛️ أرسل /broadcast مجددًا.',

    typesMenu: (kinds) =>
      `📥 ما الرسائل التي تستقبلها؟\n\nاضغط على أي عنصر لتفعيله ✅ أو إيقافه ⬜️.\n\nالآن: ${kindList(kinds)}`,
    typesLastOne: 'يجب أن يبقى نوع واحد مفعّلًا على الأقل',

    needLink: 'ليس لديك رابط بعد — اضغط «🎭 رابطي» لإنشائه.',
    stats: (owner, { received, replies, blocked, filtered }) =>
      `📊 إحصاءات${owner.name ? ` ${owner.name}` : ''}\n\n` +
      `الرسائل المستلمة: ${num(received)}\n` +
      `الردود المرسلة: ${num(replies)}\n` +
      `المرسلون المحظورون: ${num(blocked)}\n` +
      `الرسائل المُرشّحة: ${num(filtered)}\n\n` +
      `الحالة: ${owner.paused ? 'متوقف' : 'يستقبل'}`,
    privacy:
      `🔒 الخصوصية\n\n` +
      `يحفظ هذا البوت:\n` +
      `• لكل صاحب رابط: معرّف مستخدم تيليجرام، والاسم الأول (لتخصيص الرسائل)، ورمز الرابط، ` +
      `ونص الدعوة الذي كتبه، وأنواع الرسائل التي يقبلها، وحالة الإيقاف ووقت الإنشاء.\n` +
      `• لكل من يستخدم البوت: لغته (المختارة أو لغة تيليجرام) ومعرّفات رسائل قوائم البوت في محادثته، ` +
      `لحذف القوائم القديمة.\n` +
      `• لكل رسالة مجهولة: معرّفا المرسل وصاحب الرابط، ومعرّفات المحادثة/الرسالة اللازمة ` +
      `لإيصال الردود والتعديلات والاسترجاع، ومعرّف ألبوم تيليجرام (للرسائل متعددة الصور/الفيديو)، ` +
      `والحالة (مُرسلة / محظورة / ممنوعة / مُرشّحة / فاشلة / مُسترجعة) والوقت.\n` +
      `• الحظر (معرّفا صاحب الرابط والمرسل)، والبلاغات (معرّفات الرسالة وصاحب الرابط والمرسل، ونتيجة المراجعة)، ` +
      `والمنع من البوت بالكامل (معرّف المرسل)، والردود (معرّفا الرسالة وصاحب الرابط، ومعرّفات المحادثة/الرسالة اللازمة لنقل التفاعلات والردود).\n` +
      `• الخطوة التي أنت فيها حاليًا (مثلًا «يكتب رسالة إلى <معرّف صاحب الرابط>»).\n` +
      `• للرسائل الجماعية من مشغّل البوت: معرّف آخر من وصلته الرسالة، ليُستأنف الإرسال المتقطع من هناك.\n\n` +
      `لماذا يُحفظ معرّف المرسل: ليتمكن صاحب الرابط من حظره، وتُطبَّق حدود الإرسال، ` +
      `وتمكن مراجعة الرسائل المُبلّغ عنها.\n\n` +
      `لا يظهر معرّف المرسل ولا اسمه لصاحب الرابط أبدًا. يظهر اسم صاحب الرابط لمن يفتح رابطه. ` +
      `لا يحفظ البوت نص الرسائل المجهولة أو تعليقاتها أو ملفاتها — تيليجرام ينسخها بين المحادثات مباشرة. ` +
      `عند الإبلاغ عن رسالة، تُرسل نسخة منها (دون هوية المرسل، مع اسم صاحب الرابط ومعرّفه) إلى مشغّل البوت لمراجعتها. ` +
      `لمشغّل البوت تقنيًا وصول إلى البيانات المحفوظة.\n\n` +
      `عبر ⚙️ الإعدادات ← 🗑 حذف بياناتي يُحذف رابطك وإعداداتك وسجل الرسائل المستلمة وردودك والحظر الذي أجريته والبلاغات التي قدمتها. ` +
      `يبقى سجل الرسائل التي أرسلتها للآخرين والحظر/البلاغات/المنع ضدك، ` +
      `لأنها تخص المستلمين ولازمة لمنع الإزعاج.`,

    settingsTitle: '⚙️ الإعدادات',
    settingsReceiving: 'استقبال الرسائل: ▶️ مُفعّل',
    settingsPaused: 'استقبال الرسائل: ⏸ متوقف',
    stPause: '⏸ إيقاف الاستقبال',
    stResume: '▶️ استئناف الاستقبال',
    stText: '✏️ نص الدعوة',
    stTypes: '📨 أنواع الرسائل',
    stBlocked: '🚫 المحظورون',
    stNewlink: '🔄 رابط جديد',
    stDelete: '🗑 حذف بياناتي',

    chooseLanguage: '🌐 اختر لغتك:',
    languageSet: (name) => `✅ تم ضبط اللغة على ${name}.`,
    sourceHere: '📦 الكود المصدري:',
    source: '🔗 الكود المصدري',

    inlineShareTitle: '📤 مشاركة رابطي المجهول',
    inlineCustomTitle: '✏️ مشاركة بهذا النص',
    inlineInvite: (owner) => `🎭 ${invitation(owner)}\n\nهويتك تبقى مخفية. اضغط الزر أدناه 👇`,
    inlineLinkTitle: '🔗 الرابط فقط',
    btnSendAnon: (owner) => `✉️ رسالة مجهولة إلى ${who(owner)}`,
    inlinePaused: '⏸ الاستقبال متوقف — استأنفه أولًا من ⚙️ الإعدادات.',
  };
};

// ----------------------------------------------------------------------------- ru
const ru = (w) => {
  const { num, ago, who, invitation, kindList } = helpers('ru', w);
  return {
    ...w, num, ago, who, invitation, kindList,

    profile: {
      description:
        'Личная ссылка для анонимных сообщений 🤫\n\n' +
        'Получи ссылку, добавь её в описание, историю или группы и получай анонимные сообщения от друзей и подписчиков — ' +
        'текст, фото, голосовые или стикеры.\n\n' +
        'Напиши свой текст приглашения, отвечай анонимно, блокируй отправителей или жалуйся на сообщения. ' +
        'Личность отправителя тебе никогда не показывается.\n\n' +
        'Нажми «Старт», чтобы начать.',
      shortDescription: 'Личная анонимная ссылка 🤫 Получай анонимные сообщения от друзей и отвечай анонимно.',
    },

    kb: {
      link: '🎭 Моя ссылка', stats: '📊 Статистика', settings: '⚙️ Настройки', language: '🌐 Язык',
      privacy: '🔒 Конфиденциальность', source: '🔗 Исходный код',
    },

    welcome: (owner, link) =>
      `Привет${owner.name ? `, ${owner.name}` : ''}! 👋 Это твоя личная анонимная ссылка:\n\n${link}\n\n` +
      `Добавь её в описание профиля, историю или группы. Любой, кто откроет её, сможет написать тебе, не раскрывая себя. ` +
      `Под каждым сообщением можно ответить, заблокировать или пожаловаться.\n\n` +
      `Твой текст приглашения сейчас:\n«${invitation(owner)}»\n\n` +
      `Пользуйся кнопками внизу: «🎭 Моя ссылка» — чтобы поделиться ею, «⚙️ Настройки» — текст приглашения, ` +
      `типы сообщений, QR-код, пауза и остальное.`,
    help: 'Пользуйся кнопками внизу 👇',
    myLink: (owner, link) => `🎭 Твоя анонимная ссылка\n\n${link}\n\n«${invitation(owner)}»`,
    btnShare: '📤 Поделиться ссылкой в чате',
    btnQr: '🔳 QR-код ссылки',
    qrCaption: (owner, link) =>
      `🔳 QR-код твоей анонимной ссылки\n\n«${invitation(owner)}»\n${link}\n\n` +
      `Размести его в истории или где угодно: кто отсканирует, сразу сможет написать тебе анонимно.`,
    btnBack: '⬅️ Назад',
    btnCancel: '✖️ Отмена',
    cancelled: 'Отменено.',

    invalidLink: 'Эта ссылка недействительна или больше не существует.',
    selfLink: (owner) =>
      `${owner.name ? `${owner.name}, ` : ''}это твоя собственная ссылка 🙂 Отправь её другим, чтобы они могли писать тебе анонимно.`,
    ownerPaused: (owner) => `${who(owner)} сейчас не принимает сообщения. Попробуй позже.`,
    sendPrompt: (owner) =>
      (owner.prompt ? `«${owner.prompt}»\n— ${who(owner)}\n\n` : `✉️ Анонимное сообщение. Получатель: ${who(owner)}.\n\n`) +
      `Отправь своё сообщение прямо сейчас.\n\nПолучатель не узнает, кто ты.`,

    delivered: (owner) => `Сообщение доставлено ✅ Получатель: ${who(owner)}`,
    btnUnsend: '🗑 Отозвать',
    btnSendAnother: '✉️ Ещё сообщение',
    unsent: () => `Сообщение отозвано 🗑 У получателя его больше нет.`,
    unsentToast: 'Отозвано',
    alreadyUnsent: 'Уже отозвано',
    unsendTooLate: (min) => `Отозвать сообщение можно только в течение ${num(min)} мин после отправки.`,
    editTooLate: (min) => `Правки доходят до получателя только в течение ${num(min)} мин после отправки — эта правка не применена.`,
    editFiltered: 'Правка не применена: в ней есть слова, которые этот бот не пропускает.',
    sendExpired: 'Время на отправку вышло ⌛️ Открой ссылку снова, чтобы написать.',
    deliveryFailed: (owner) => `К сожалению, сообщение не доставлено. Получатель: ${who(owner)}.`,
    filtered: 'Сообщение не отправлено: в нём есть слова, которые этот бот не пропускает. Перефразируй помягче.',
    unsupported: 'Такой тип сообщения отправить нельзя. Попробуй ещё раз.',
    kindNotAccepted: (owner) => `${who(owner)} не принимает такой тип сообщений. Попробуй другой.`,

    newMessageHeader: (owner) =>
      `📩 У тебя новое анонимное сообщение${owner.prompt ? `\nВ ответ на: «${owner.prompt}»` : ''}`,
    btnReply: '↩️ Ответить',
    btnBlock: '🚫 Заблокировать',
    btnReport: '⚠️ Пожаловаться',
    btnGetLink: '🔗 Получи свою анонимную ссылку',

    replyPrompt: 'Отправь ответ сейчас (любой тип сообщения). Отправитель не узнает, кто ты, но поймёт, что ответ от тебя.',
    replyHeader: (owner) => `💬 Ответ на твоё сообщение — ${who(owner)} (чтобы ответить, сделай реплай на сообщение ниже):`,
    replySent: 'Ответ отправлен ✅',
    replyFailed: 'Ответ не отправлен — вероятно, отправитель остановил бота.',
    replyTargetGone: 'Этого сообщения больше нет.',
    replyExpired: 'Время на ответ вышло ⌛️ Нажми «↩️ Ответить» снова или сделай реплай на само сообщение.',

    notYourMessage: 'Эта кнопка не для тебя.',
    blocked: 'Отправитель заблокирован. Его сообщения больше не придут. (Разблокировать: ⚙️ Настройки → 🚫 Заблокированные)',
    blockedToast: 'Заблокирован',
    reported: 'Спасибо — жалоба на сообщение отправлена на проверку.',
    reportedToast: 'Жалоба отправлена',
    alreadyReported: 'Жалоба уже отправлена',

    textMenu: (owner, max) =>
      `✏️ Твой текст приглашения\n\nТе, кто откроет твою ссылку, видят:\n«${invitation(owner)}»\n\n` +
      `Отправь новый текст сейчас (до ${num(max)} символов), например:\n` +
      `«Спроси то, что никогда не спросишь в лицо 😅»`,
    btnTextReset: '↩️ Вернуть текст по умолчанию',
    textSet: (owner) => `Текст приглашения сохранён ✅\n\n«${invitation(owner)}»`,
    textReset: (owner) => `Текст приглашения сброшен ✅\n\n«${invitation(owner)}»`,
    textResetToast: 'Сброшено',
    textTooLong: (max) => `Слишком длинно. Не больше ${num(max)} символов, пожалуйста.`,
    textNotText: 'Отправь текст приглашения обычным текстовым сообщением.',
    textFiltered: 'В этом тексте есть слова, которые этот бот не пропускает. Напиши другой.',
    textExpired: 'Время на текст приглашения вышло ⌛️ Начни снова: ⚙️ Настройки → ✏️ Текст приглашения.',

    noBlocked: 'Ты никого не блокировал(а).',
    blockedList: (rows, limited) =>
      `🚫 Заблокированные отправители\n\nКто они — неизвестно; видно только, когда их заблокировали. ` +
      `Нажми на номер, чтобы разблокировать.\n\n` +
      rows.map((r, i) => `${num(i + 1)}. заблокирован ${ago(r.at)}`).join('\n') +
      (limited ? `\n\n(только последние ${num(rows.length)})` : ''),
    btnUnblock: (i) => `🔓 ${num(i)}`,
    unblockedToast: 'Разблокирован',

    btnNo: '❌ Нет',
    confirmCancelled: 'Хорошо, ничего не изменилось.',
    newlinkConfirm:
      '🔄 Новая ссылка\n\nС новой ссылкой текущая перестанет работать, и те, у кого есть только она, ' +
      'не смогут тебе написать. Сообщения, ответы и блокировки останутся.\n\nУверен(а)?',
    btnNewlinkYes: '✅ Да, создать новую',
    newlinkDone: (link) => `Новая ссылка готова ✅\n\n${link}\n\nСтарая больше не работает.`,
    deleteConfirm:
      '🗑 Удаление данных\n\nБудет удалено навсегда:\n' +
      '• твоя ссылка (перестанет работать), текст приглашения, язык и настройки\n' +
      '• история полученных сообщений и твоих ответов (кнопки под прежними сообщениями перестанут работать)\n' +
      '• список заблокированных тобой и твои жалобы\n\n' +
      'Останется:\n' +
      '• история анонимных сообщений, которые ты отправлял(а) другим — она принадлежит получателям и нужна для блокировок, ' +
      'жалоб и лимитов\n' +
      '• блокировки, жалобы и баны против тебя\n\n' +
      'Сами сообщения остаются в твоём чате Telegram; их хранит Telegram, а не этот бот.\n\nУверен(а)?',
    btnDeleteYes: '🗑 Да, удалить',
    deleted: 'Твои данные удалены ✅ Нажми «🎭 Моя ссылка», если снова понадобится ссылка.',

    adminReport: (report, owner, priorReports) =>
      `⚠️ Жалоба #${num(report.id)}\n` +
      `Владелец ссылки: ${owner?.name ?? '—'} (${report.ownerId})\n` +
      `Прежних жалоб на этого отправителя: ${num(priorReports)}\n\n` +
      `Сообщение, на которое пожаловались, ниже 👇`,
    adminMessageGone: '(Сообщение, на которое пожаловались, больше недоступно.)',
    btnBan: '⛔️ Забанить отправителя',
    btnDismiss: '✅ Отклонить',
    btnBanned: '⛔️ Забанен — разбанить',
    btnDismissed: '✅ Отклонено — забанить',
    bannedToast: 'Отправитель забанен во всём боте',
    unbannedToast: 'Бан снят',
    dismissedToast: 'Жалоба отклонена',

    adminDashboard: (s) => {
      const m = (status) => num(s.messages[status] ?? 0);
      return `🛠 Панель администратора\n\n` +
        `👤 Пользователи\n` +
        `Владельцы ссылок: ${num(s.users)} (на паузе: ${num(s.paused)})\n` +
        `Новые: ${num(s.newDay)} сегодня, ${num(s.newWeek)} за неделю\n` +
        `Все, кто пользовался ботом: ${num(s.reach)}\n` +
        `Анонимные отправители: ${num(s.senders)}\n\n` +
        `✉️ Сообщения\n` +
        `Доставлено: ${m('delivered')} (сегодня: ${num(s.deliveredDay)})\n` +
        `Заблокировано: ${m('blocked')} · Забанено: ${m('banned')} · Отфильтровано: ${m('filtered')}\n` +
        `Не доставлено: ${m('failed')} · Отозвано: ${m('unsent')}\n` +
        `Ответы: ${num(s.replies)}\n\n` +
        `🛡 Модерация\n` +
        `Открытые жалобы: ${num(s.openReports)} из ${num(s.reports)}\n` +
        `Баны: ${num(s.bans)} · Блокировки пользователей: ${num(s.blocks)}\n\n` +
        `/reports – открытые жалобы\n` +
        `/bans – баны и разбан\n` +
        `/ban <id> и /unban <id> – бан или разбан по id Telegram\n` +
        `/broadcast – рассылка всем`;
    },
    btnAdminRefresh: '🔄 Обновить',
    btnAdminReports: (n) => `⚠️ Открытые жалобы (${num(n)})`,
    btnAdminBans: (n) => `⛔️ Баны (${num(n)})`,
    adminRefreshedToast: 'Обновлено',
    adminNoReports: 'Открытых жалоб нет ✅',
    adminReportsHeader: (shown, total) =>
      `⚠️ Открытых жалоб: ${num(total)}${shown < total ? ` — показаны ${num(shown)} самых старых; после проверки отправь /reports снова` : ''}`,
    adminNoBans: 'Никто не забанен.',
    adminBansList: (rows, limited) =>
      `⛔️ Отправители, забаненные во всём боте\n\nНажми на номер, чтобы снять бан.\n\n` +
      rows.map((r, i) =>
        `${num(i + 1)}. ${r.reportId ? `жалоба #${num(r.reportId)}` : 'вручную (/ban)'}, ${ago(r.createdAt)}`).join('\n') +
      (limited ? `\n\n(только последние ${num(rows.length)})` : ''),
    adminBanUsage: (cmd) => `Укажи числовой id Telegram после команды, например:\n/${cmd} 123456789`,
    adminBanned: (id) => `⛔️ ${id} забанен во всём боте. Его анонимные сообщения молча отбрасываются.`,
    adminAlreadyBanned: (id) => `${id} уже забанен.`,
    adminUnbanned: (id) => `✅ Бан с ${id} снят.`,
    adminNotBanned: (id) => `${id} не был забанен.`,
    broadcastPrompt: (n) =>
      `📢 Рассылка\n\nОтправь сейчас сообщение, которое получат ${num(n)} чел. ` +
      `(любой тип; у альбома только первый элемент). Перед отправкой я попрошу подтверждение.`,
    broadcastConfirm: (n) => `📢 Отправить это сообщение ${num(n)} чел.?`,
    btnBroadcastSend: '✅ Да, отправить',
    btnBroadcastResume: '▶️ Продолжить (если остановилась)',
    broadcastStartedToast: 'Рассылка началась',
    broadcastProgress: (sent, failed, total) =>
      `📢 Отправка… ${num(sent + failed)} из ${num(total)}\n` +
      `Доставлено: ${num(sent)} · Не доставлено: ${num(failed)}\n\n` +
      `Если минуту нет прогресса, нажми «Продолжить» — рассылка пойдёт с того же места.`,
    broadcastDone: (sent, failed) =>
      `📢 Рассылка завершена ✅\nДоставлено: ${num(sent)} · Не доставлено (заблокировали бота): ${num(failed)}`,
    broadcastBusy: 'Эта рассылка сейчас отправляется. Если минуту нет прогресса, попробуй снова.',
    broadcastAlreadyDone: 'Эта рассылка уже отправлена полностью ✅',
    broadcastCancelled: 'Рассылка отменена.',
    broadcastExpired: 'Время на рассылку вышло ⌛️ Отправь /broadcast снова.',

    typesMenu: (kinds) =>
      `📥 Какие сообщения принимать?\n\nНажми на пункт, чтобы включить ✅ или выключить ⬜️.\n\nСейчас: ${kindList(kinds)}`,
    typesLastOne: 'Хотя бы один тип должен остаться включённым',

    needLink: 'У тебя ещё нет ссылки — нажми «🎭 Моя ссылка», чтобы создать её.',
    stats: (owner, { received, replies, blocked, filtered }) =>
      `📊 Статистика${owner.name ? ` — ${owner.name}` : ''}\n\n` +
      `Получено сообщений: ${num(received)}\n` +
      `Отправлено ответов: ${num(replies)}\n` +
      `Заблокировано отправителей: ${num(blocked)}\n` +
      `Отфильтровано сообщений: ${num(filtered)}\n\n` +
      `Статус: ${owner.paused ? 'на паузе' : 'принимаю'}`,
    privacy:
      `🔒 Конфиденциальность\n\n` +
      `Бот хранит:\n` +
      `• Для каждого владельца ссылки: id пользователя Telegram, имя в Telegram (для персонализации), код ссылки, ` +
      `его текст приглашения, принимаемые типы сообщений, признак паузы и время создания.\n` +
      `• Для каждого, кто пользуется ботом: язык (выбранный или язык Telegram) и id сообщений-меню бота в чате, ` +
      `чтобы удалять старые меню.\n` +
      `• Для каждого анонимного сообщения: id отправителя и владельца ссылки, id чатов/сообщений Telegram, нужные для ` +
      `ответов, правок и отзыва, id альбома Telegram (для сообщений из нескольких фото/видео), ` +
      `статус (доставлено / заблокировано / забанено / отфильтровано / не доставлено / отозвано) и время.\n` +
      `• Блокировки (id владельца ссылки и отправителя), жалобы (id сообщения, владельца и отправителя, итог проверки), ` +
      `баны во всём боте (id отправителя) и ответы (id сообщения и владельца, а также id чатов/сообщений Telegram для передачи реакций и реплаев).\n` +
      `• Шаг, на котором ты сейчас в боте (например, «пишет сообщение для <id владельца>»).\n` +
      `• Для рассылок оператора бота: id последнего получателя, чтобы прерванная рассылка продолжилась с него.\n\n` +
      `Зачем хранится id отправителя: чтобы владелец ссылки мог его заблокировать, работали лимиты ` +
      `и жалобы можно было проверить.\n\n` +
      `Id и имя отправителя никогда не показываются владельцу ссылки. Имя владельца ссылки видят те, кто её открывает. ` +
      `Бот не хранит текст, подписи и файлы анонимных сообщений — Telegram копирует их между чатами напрямую. ` +
      `Когда на сообщение жалуются, его копия (без данных отправителя, с именем и id владельца ссылки) отправляется оператору бота на проверку. ` +
      `Технически у оператора есть доступ к сохранённым данным.\n\n` +
      `⚙️ Настройки → 🗑 Удалить мои данные удаляет твою ссылку, настройки, историю полученных сообщений и ответов, твои блокировки и жалобы. ` +
      `История сообщений, которые ты отправлял(а) другим, и блокировки/жалобы/баны против тебя остаются, ` +
      `потому что они принадлежат получателям и нужны для защиты от злоупотреблений.`,

    settingsTitle: '⚙️ Настройки',
    settingsReceiving: 'Приём сообщений: ▶️ вкл',
    settingsPaused: 'Приём сообщений: ⏸ на паузе',
    stPause: '⏸ Приостановить',
    stResume: '▶️ Возобновить',
    stText: '✏️ Текст приглашения',
    stTypes: '📨 Типы сообщений',
    stBlocked: '🚫 Заблокированные',
    stNewlink: '🔄 Новая ссылка',
    stDelete: '🗑 Удалить мои данные',

    chooseLanguage: '🌐 Выберите язык:',
    languageSet: (name) => `✅ Язык изменён на ${name}.`,
    sourceHere: '📦 Исходный код:',
    source: '🔗 Исходный код',

    inlineShareTitle: '📤 Поделиться анонимной ссылкой',
    inlineCustomTitle: '✏️ Поделиться с этим текстом',
    inlineInvite: (owner) => `🎭 ${invitation(owner)}\n\nТвоё имя останется скрытым. Нажми кнопку ниже 👇`,
    inlineLinkTitle: '🔗 Только ссылка',
    btnSendAnon: (owner) => `✉️ Анонимно написать: ${who(owner)}`,
    inlinePaused: '⏸ Приём на паузе — сначала возобнови его в ⚙️ Настройках.',
  };
};

// ----------------------------------------------------------------------------- es
const es = (w) => {
  const { num, ago, who, invitation, kindList } = helpers('es', w);
  return {
    ...w, num, ago, who, invitation, kindList,

    profile: {
      description:
        'Tu enlace personal de mensajes anónimos 🤫\n\n' +
        'Consigue un enlace, ponlo en tu biografía, historia o grupos y recibe mensajes anónimos de amigos y seguidores — ' +
        'texto, fotos, notas de voz o stickers.\n\n' +
        'Escribe tu propio texto de invitación, responde de forma anónima, bloquea a un remitente o reporta un mensaje. ' +
        'Nunca verás la identidad del remitente.\n\n' +
        'Pulsa Iniciar para empezar.',
      shortDescription: 'Enlace anónimo personal 🤫 Recibe mensajes anónimos de tus amigos y responde de forma anónima.',
    },

    kb: {
      link: '🎭 Mi enlace', stats: '📊 Estadísticas', settings: '⚙️ Ajustes', language: '🌐 Idioma',
      privacy: '🔒 Privacidad', source: '🔗 Código fuente',
    },

    welcome: (owner, link) =>
      `¡Hola${owner.name ? `, ${owner.name}` : ''}! 👋 Este es tu enlace anónimo personal:\n\n${link}\n\n` +
      `Ponlo en tu biografía, historia o grupos. Cualquiera que lo abra puede escribirte sin revelar quién es. ` +
      `Debajo de cada mensaje puedes responder, bloquear o reportar.\n\n` +
      `Tu texto de invitación es ahora:\n«${invitation(owner)}»\n\n` +
      `Usa los botones de abajo: 🎭 Mi enlace para compartirlo, ⚙️ Ajustes para tu texto de invitación, ` +
      `tipos de mensaje, código QR, pausa y más.`,
    help: 'Usa los botones de abajo 👇',
    myLink: (owner, link) => `🎭 Tu enlace anónimo\n\n${link}\n\n«${invitation(owner)}»`,
    btnShare: '📤 Compartir enlace en un chat',
    btnQr: '🔳 Código QR del enlace',
    qrCaption: (owner, link) =>
      `🔳 Código QR de tu enlace anónimo\n\n«${invitation(owner)}»\n${link}\n\n` +
      `Ponlo en tu historia o donde quieras; quien lo escanee podrá enviarte un mensaje anónimo al instante.`,
    btnBack: '⬅️ Atrás',
    btnCancel: '✖️ Cancelar',
    cancelled: 'Cancelado.',

    invalidLink: 'Este enlace no es válido o ya no existe.',
    selfLink: (owner) =>
      `${owner.name ? `${owner.name}, ` : ''}este es tu propio enlace 🙂 Envíalo a otros para que puedan escribirte de forma anónima.`,
    ownerPaused: (owner) => `${who(owner)} no está recibiendo mensajes ahora. Inténtalo más tarde.`,
    sendPrompt: (owner) =>
      (owner.prompt ? `«${owner.prompt}»\n— ${who(owner)}\n\n` : `✉️ Estás enviando un mensaje anónimo a ${who(owner)}.\n\n`) +
      `Envía tu mensaje ahora.\n\n${who(owner)} no sabrá quién eres.`,

    delivered: (owner) => `Tu mensaje llegó a ${who(owner)} ✅`,
    btnUnsend: '🗑 Retirar',
    btnSendAnother: '✉️ Enviar otro',
    unsent: (owner) => `Tu mensaje fue retirado 🗑 Ya no está en el chat de ${who(owner)}.`,
    unsentToast: 'Retirado',
    alreadyUnsent: 'Ya fue retirado',
    unsendTooLate: (min) => `Solo se puede retirar un mensaje dentro de los ${num(min)} minutos posteriores al envío.`,
    editTooLate: (min) => `Las ediciones solo llegan al destinatario dentro de los ${num(min)} minutos posteriores al envío — esta edición no se aplicó.`,
    editFiltered: 'Tu edición no se aplicó porque contiene palabras que este bot no permite.',
    sendExpired: 'Se acabó el tiempo para enviar ⌛️ Abre el enlace de nuevo para enviar un mensaje.',
    deliveryFailed: (owner) => `Lo siento, tu mensaje no pudo llegar a ${who(owner)}.`,
    filtered: 'Tu mensaje no se envió porque contiene palabras que este bot no permite. Reescríbelo con más amabilidad.',
    unsupported: 'Este tipo de mensaje no se puede enviar. Inténtalo de nuevo.',
    kindNotAccepted: (owner) => `${who(owner)} no acepta este tipo de mensaje. Prueba con otro.`,

    newMessageHeader: (owner) =>
      `📩 Tienes un nuevo mensaje anónimo${owner.prompt ? `\nEn respuesta a: «${owner.prompt}»` : ''}`,
    btnReply: '↩️ Responder',
    btnBlock: '🚫 Bloquear',
    btnReport: '⚠️ Reportar',
    btnGetLink: '🔗 Consigue tu propio enlace anónimo',

    replyPrompt: 'Envía tu respuesta ahora (cualquier tipo de mensaje). El remitente no sabrá quién eres, pero sabrá que es tuya.',
    replyHeader: (owner) => `💬 ${who(owner)} respondió a tu mensaje (para contestar, responde al mensaje de abajo):`,
    replySent: 'Respuesta enviada ✅',
    replyFailed: 'Tu respuesta no se pudo enviar — probablemente el remitente detuvo el bot.',
    replyTargetGone: 'Este mensaje ya no existe.',
    replyExpired: 'Se acabó el tiempo para responder ⌛️ Pulsa «↩️ Responder» otra vez o responde al propio mensaje.',

    notYourMessage: 'Este botón no es tuyo.',
    blocked: 'Remitente bloqueado. Ya no recibirás sus mensajes. (Para desbloquear: ⚙️ Ajustes → 🚫 Bloqueados)',
    blockedToast: 'Bloqueado',
    reported: 'Gracias — el mensaje fue reportado para su revisión.',
    reportedToast: 'Reportado',
    alreadyReported: 'Ya fue reportado',

    textMenu: (owner, max) =>
      `✏️ Tu texto de invitación\n\nQuienes abren tu enlace ven:\n«${invitation(owner)}»\n\n` +
      `Envía tu nuevo texto ahora (máximo ${num(max)} caracteres), por ejemplo:\n` +
      `«Pregúntame algo que nunca me preguntarías en persona 😅»`,
    btnTextReset: '↩️ Volver al texto predeterminado',
    textSet: (owner) => `Texto de invitación guardado ✅\n\n«${invitation(owner)}»`,
    textReset: (owner) => `El texto de invitación volvió al predeterminado ✅\n\n«${invitation(owner)}»`,
    textResetToast: 'Predeterminado',
    textTooLong: (max) => `Es demasiado largo. Escribe como máximo ${num(max)} caracteres.`,
    textNotText: 'Envía el texto de invitación como un mensaje de texto.',
    textFiltered: 'Ese texto contiene palabras que este bot no permite. Escribe otro.',
    textExpired: 'Se acabó el tiempo para escribir el texto ⌛️ Empieza de nuevo en ⚙️ Ajustes → ✏️ Texto de invitación.',

    noBlocked: 'No has bloqueado a nadie.',
    blockedList: (rows, limited) =>
      `🚫 Remitentes bloqueados\n\nNo se muestra quiénes son; solo cuándo fueron bloqueados. ` +
      `Pulsa un número para desbloquear.\n\n` +
      rows.map((r, i) => `${num(i + 1)}. bloqueado ${ago(r.at)}`).join('\n') +
      (limited ? `\n\n(solo los ${num(rows.length)} más recientes)` : ''),
    btnUnblock: (i) => `🔓 ${num(i)}`,
    unblockedToast: 'Desbloqueado',

    btnNo: '❌ No',
    confirmCancelled: 'Vale, no cambió nada.',
    newlinkConfirm:
      '🔄 Enlace nuevo\n\nCon un enlace nuevo, el actual deja de funcionar y quienes solo tengan ese ' +
      'ya no podrán escribirte. Los mensajes, respuestas y bloqueos se mantienen.\n\n¿Seguro?',
    btnNewlinkYes: '✅ Sí, crear un enlace nuevo',
    newlinkDone: (link) => `Tu nuevo enlace está listo ✅\n\n${link}\n\nEl anterior ya no funciona.`,
    deleteConfirm:
      '🗑 Borrar tus datos\n\nSe borra para siempre:\n' +
      '• tu enlace (deja de funcionar), el texto de invitación, el idioma y los ajustes\n' +
      '• el registro de los mensajes que recibiste y tus respuestas (los botones de mensajes anteriores dejan de funcionar)\n' +
      '• la lista de personas que bloqueaste y los reportes que hiciste\n\n' +
      'Se mantiene:\n' +
      '• el registro de los mensajes anónimos que enviaste a otros — pertenece a los destinatarios y es necesario para bloqueos, ' +
      'reportes y límites de envío\n' +
      '• los bloqueos, reportes y bloqueos globales en tu contra\n\n' +
      'Los mensajes en sí siguen en tu chat de Telegram; los guarda Telegram, no este bot.\n\n¿Seguro?',
    btnDeleteYes: '🗑 Sí, borrar',
    deleted: 'Tus datos se borraron ✅ Pulsa «🎭 Mi enlace» si quieres un enlace otra vez.',

    adminReport: (report, owner, priorReports) =>
      `⚠️ Reporte #${num(report.id)}\n` +
      `Dueño del enlace: ${owner?.name ?? '—'} (${report.ownerId})\n` +
      `Reportes anteriores contra este remitente: ${num(priorReports)}\n\n` +
      `El mensaje reportado está abajo 👇`,
    adminMessageGone: '(El mensaje reportado ya no está disponible.)',
    btnBan: '⛔️ Bloquear al remitente en el bot',
    btnDismiss: '✅ Descartar',
    btnBanned: '⛔️ Bloqueado — desbloquear',
    btnDismissed: '✅ Descartado — bloquear',
    bannedToast: 'Remitente bloqueado en todo el bot',
    unbannedToast: 'Bloqueo retirado',
    dismissedToast: 'Reporte descartado',

    adminDashboard: (s) => {
      const m = (status) => num(s.messages[status] ?? 0);
      return `🛠 Panel de administración\n\n` +
        `👤 Usuarios\n` +
        `Dueños de enlace: ${num(s.users)} (en pausa: ${num(s.paused)})\n` +
        `Nuevos: ${num(s.newDay)} hoy, ${num(s.newWeek)} esta semana\n` +
        `Todos los que usaron el bot: ${num(s.reach)}\n` +
        `Remitentes anónimos: ${num(s.senders)}\n\n` +
        `✉️ Mensajes\n` +
        `Entregados: ${m('delivered')} (hoy: ${num(s.deliveredDay)})\n` +
        `Bloqueados: ${m('blocked')} · Vetados: ${m('banned')} · Filtrados: ${m('filtered')}\n` +
        `Fallidos: ${m('failed')} · Retirados: ${m('unsent')}\n` +
        `Respuestas: ${num(s.replies)}\n\n` +
        `🛡 Moderación\n` +
        `Reportes abiertos: ${num(s.openReports)} de ${num(s.reports)}\n` +
        `Vetados: ${num(s.bans)} · Bloqueos de usuarios: ${num(s.blocks)}\n\n` +
        `/reports – reportes abiertos\n` +
        `/bans – vetados y quitar veto\n` +
        `/ban <id> y /unban <id> – vetar o quitar veto por id de Telegram\n` +
        `/broadcast – mensaje a todos`;
    },
    btnAdminRefresh: '🔄 Actualizar',
    btnAdminReports: (n) => `⚠️ Reportes abiertos (${num(n)})`,
    btnAdminBans: (n) => `⛔️ Vetados (${num(n)})`,
    adminRefreshedToast: 'Actualizado',
    adminNoReports: 'No hay reportes abiertos ✅',
    adminReportsHeader: (shown, total) =>
      `⚠️ ${num(total)} reporte(s) abierto(s)${shown < total ? ` — ves los ${num(shown)} más antiguos; envía /reports otra vez tras revisarlos` : ''}`,
    adminNoBans: 'No hay nadie vetado.',
    adminBansList: (rows, limited) =>
      `⛔️ Remitentes vetados en todo el bot\n\nPulsa un número para quitar ese veto.\n\n` +
      rows.map((r, i) =>
        `${num(i + 1)}. ${r.reportId ? `reporte #${num(r.reportId)}` : 'manual (/ban)'}, ${ago(r.createdAt)}`).join('\n') +
      (limited ? `\n\n(solo los ${num(rows.length)} más recientes)` : ''),
    adminBanUsage: (cmd) => `Escribe el id numérico de Telegram tras el comando, por ejemplo:\n/${cmd} 123456789`,
    adminBanned: (id) => `⛔️ ${id} está vetado en todo el bot. Sus mensajes anónimos se descartan en silencio.`,
    adminAlreadyBanned: (id) => `${id} ya estaba vetado.`,
    adminUnbanned: (id) => `✅ Veto a ${id} retirado.`,
    adminNotBanned: (id) => `${id} no estaba vetado.`,
    broadcastPrompt: (n) =>
      `📢 Difusión\n\nEnvía ahora el mensaje que debe llegar a ${num(n)} personas ` +
      `(cualquier tipo; de un álbum solo el primer elemento). Te pediré confirmación antes de enviarlo.`,
    broadcastConfirm: (n) => `📢 ¿Enviar este mensaje a ${num(n)} personas?`,
    btnBroadcastSend: '✅ Sí, enviar',
    btnBroadcastResume: '▶️ Reanudar (si se detuvo)',
    broadcastStartedToast: 'Envío iniciado',
    broadcastProgress: (sent, failed, total) =>
      `📢 Enviando… ${num(sent + failed)} de ${num(total)}\n` +
      `Entregados: ${num(sent)} · Fallidos: ${num(failed)}\n\n` +
      `Si no avanza en un minuto, pulsa Reanudar; sigue donde se quedó.`,
    broadcastDone: (sent, failed) =>
      `📢 Difusión terminada ✅\nEntregados: ${num(sent)} · Fallidos (bloquearon el bot): ${num(failed)}`,
    broadcastBusy: 'Esta difusión se está enviando ahora. Si no avanza en un minuto, inténtalo de nuevo.',
    broadcastAlreadyDone: 'Esta difusión ya se envió por completo ✅',
    broadcastCancelled: 'Difusión cancelada.',
    broadcastExpired: 'Se acabó el tiempo para la difusión ⌛️ Envía /broadcast otra vez.',

    typesMenu: (kinds) =>
      `📥 ¿Qué mensajes aceptas?\n\nPulsa un elemento para activarlo ✅ o desactivarlo ⬜️.\n\nAhora: ${kindList(kinds)}`,
    typesLastOne: 'Al menos un tipo debe quedar activado',

    needLink: 'Aún no tienes enlace — pulsa «🎭 Mi enlace» para crearlo.',
    stats: (owner, { received, replies, blocked, filtered }) =>
      `📊 Estadísticas${owner.name ? ` de ${owner.name}` : ''}\n\n` +
      `Mensajes recibidos: ${num(received)}\n` +
      `Respuestas enviadas: ${num(replies)}\n` +
      `Remitentes bloqueados: ${num(blocked)}\n` +
      `Mensajes filtrados: ${num(filtered)}\n\n` +
      `Estado: ${owner.paused ? 'en pausa' : 'recibiendo'}`,
    privacy:
      `🔒 Privacidad\n\n` +
      `Este bot guarda:\n` +
      `• De cada dueño de enlace: id de usuario de Telegram, nombre de pila de Telegram (para personalizar mensajes), código del enlace, ` +
      `su propio texto de invitación, los tipos de mensaje que acepta, si está en pausa y cuándo se creó.\n` +
      `• De cada persona que usa el bot: su idioma (elegido o el de Telegram) y los ids de los mensajes de menú del bot en su chat, ` +
      `para poder borrar los menús antiguos.\n` +
      `• De cada mensaje anónimo: los ids del remitente y del dueño del enlace, los ids de chat/mensaje de Telegram necesarios para ` +
      `entregar respuestas, ediciones y retiradas, el id del álbum de Telegram (para mensajes con varias fotos/vídeos), ` +
      `el estado (entregado / bloqueado / vetado / filtrado / fallido / retirado) y la hora.\n` +
      `• Bloqueos (ids del dueño y del remitente), reportes (ids del mensaje, del dueño y del remitente, y el resultado), ` +
      `vetos en todo el bot (id del remitente) y respuestas (ids del mensaje y del dueño, y los ids de chat/mensaje de Telegram para transmitir reacciones y respuestas).\n` +
      `• El paso en el que estás en el bot (p. ej. «escribiendo un mensaje para <id del dueño>»).\n` +
      `• Para las difusiones del operador: el id de la última persona alcanzada, para que un envío interrumpido continúe desde ahí.\n\n` +
      `Por qué se guarda el id del remitente: para que el dueño del enlace pueda bloquearlo, se apliquen límites de envío ` +
      `y se puedan revisar los mensajes reportados.\n\n` +
      `El id y el nombre del remitente nunca se muestran al dueño del enlace. El nombre del dueño se muestra a quienes abren su enlace. ` +
      `El bot no guarda el texto, los pies de foto ni los archivos de los mensajes anónimos — Telegram los copia directamente entre chats. ` +
      `Cuando se reporta un mensaje, se envía una copia (sin la identidad del remitente, con el nombre e id del dueño) al operador del bot para revisarla. ` +
      `El operador tiene acceso técnico a los datos guardados.\n\n` +
      `⚙️ Ajustes → 🗑 Borrar mis datos elimina tu enlace, tus ajustes, el registro de mensajes recibidos y tus respuestas, los bloqueos que hiciste y los reportes que enviaste. ` +
      `El registro de los mensajes que enviaste a otros y los bloqueos/reportes/vetos en tu contra se mantienen, ` +
      `porque pertenecen a los destinatarios y son necesarios para evitar abusos.`,

    settingsTitle: '⚙️ Ajustes',
    settingsReceiving: 'Recibir mensajes: ▶️ activado',
    settingsPaused: 'Recibir mensajes: ⏸ en pausa',
    stPause: '⏸ Pausar',
    stResume: '▶️ Reanudar',
    stText: '✏️ Texto de invitación',
    stTypes: '📨 Tipos de mensaje',
    stBlocked: '🚫 Bloqueados',
    stNewlink: '🔄 Enlace nuevo',
    stDelete: '🗑 Borrar mis datos',

    chooseLanguage: '🌐 Elige tu idioma:',
    languageSet: (name) => `✅ Idioma cambiado a ${name}.`,
    sourceHere: '📦 Código fuente:',
    source: '🔗 Código fuente',

    inlineShareTitle: '📤 Compartir mi enlace anónimo',
    inlineCustomTitle: '✏️ Compartir con este texto',
    inlineInvite: (owner) => `🎭 ${invitation(owner)}\n\nTu identidad queda oculta. Pulsa el botón de abajo 👇`,
    inlineLinkTitle: '🔗 Solo el enlace',
    btnSendAnon: (owner) => `✉️ Mensaje anónimo a ${who(owner)}`,
    inlinePaused: '⏸ La recepción está en pausa — reanúdala primero en ⚙️ Ajustes.',
  };
};

// Words the helpers need, per locale.
const WORDS = {
  fa: {
    now: 'همین الان', minutes: (n) => `${n} دقیقه پیش`, hours: (n) => `${n} ساعت پیش`, days: (n) => `${n} روز پیش`,
    owner: 'صاحب این لینک', invite: (who) => `به ${who} پیام ناشناس بده 🤫`, comma: '، ',
    kinds: {
      text: '📝 متن', photo: '🖼 عکس', video: '🎬 ویدیو', animation: '🎞 گیف', video_note: '⏺ ویدیو مسیج',
      voice: '🎤 ویس', audio: '🎵 موزیک', sticker: '😀 استیکر', document: '📎 فایل',
    },
  },
  en: {
    now: 'just now', minutes: (n) => `${n} min ago`, hours: (n) => `${n} h ago`, days: (n) => `${n} days ago`,
    owner: 'the link owner', invite: (who) => `Send ${who} an anonymous message 🤫`, comma: ', ',
    kinds: {
      text: '📝 Text', photo: '🖼 Photo', video: '🎬 Video', animation: '🎞 GIF', video_note: '⏺ Video message',
      voice: '🎤 Voice', audio: '🎵 Music', sticker: '😀 Sticker', document: '📎 File',
    },
  },
  ar: {
    now: 'الآن', minutes: (n) => `قبل ${n} دقيقة`, hours: (n) => `قبل ${n} ساعة`, days: (n) => `قبل ${n} يوم`,
    owner: 'صاحب هذا الرابط', invite: (who) => `أرسل إلى ${who} رسالة مجهولة 🤫`, comma: '، ',
    kinds: {
      text: '📝 نص', photo: '🖼 صورة', video: '🎬 فيديو', animation: '🎞 GIF', video_note: '⏺ رسالة فيديو',
      voice: '🎤 رسالة صوتية', audio: '🎵 موسيقى', sticker: '😀 ملصق', document: '📎 ملف',
    },
  },
  ru: {
    now: 'только что', minutes: (n) => `${n} мин назад`, hours: (n) => `${n} ч назад`, days: (n) => `${n} дн. назад`,
    owner: 'владелец ссылки', invite: (who) => `Анонимное сообщение — ${who} 🤫`, comma: ', ',
    kinds: {
      text: '📝 Текст', photo: '🖼 Фото', video: '🎬 Видео', animation: '🎞 GIF', video_note: '⏺ Кружок',
      voice: '🎤 Голосовое', audio: '🎵 Музыка', sticker: '😀 Стикер', document: '📎 Файл',
    },
  },
  es: {
    now: 'ahora mismo', minutes: (n) => `hace ${n} min`, hours: (n) => `hace ${n} h`, days: (n) => `hace ${n} días`,
    owner: 'el dueño del enlace', invite: (who) => `Envía a ${who} un mensaje anónimo 🤫`, comma: ', ',
    kinds: {
      text: '📝 Texto', photo: '🖼 Foto', video: '🎬 Vídeo', animation: '🎞 GIF', video_note: '⏺ Videomensaje',
      voice: '🎤 Nota de voz', audio: '🎵 Música', sticker: '😀 Sticker', document: '📎 Archivo',
    },
  },
};

const BUILDERS = { fa, en, ar, ru, es };
const cache = {};

// Language used when nothing is known about a chat (the bot started out Persian).
export const DEFAULT_LOCALE = 'fa';

export function texts(locale) {
  const l = BUILDERS[locale] ? locale : DEFAULT_LOCALE;
  return (cache[l] ??= BUILDERS[l](WORDS[l]));
}
