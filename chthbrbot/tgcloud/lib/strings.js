// Core multilingual strings for the owner's /start surface, the /language
// switcher and the source link. Everything else still comes from texts.js
// (Persian) as the fallback. Command tokens stay as-is.
import { makeT } from './i18n.js';

const welcome = ({ name, link, invitation }, nl) => nl
  .replace('{name}', name ? ` ${name}` : '')
  .replace('{link}', link)
  .replace('{invitation}', invitation);

const strings = {
  welcome: {
    en: (v) => welcome(v,
      `Hi{name}! 👋 This is your personal anonymous link:\n\n{link}\n\n` +
      `Put it in your bio, story or groups. Anyone who opens it can message you without revealing who they are. ` +
      `From under each message you can reply, block or report.\n\n` +
      `Your invitation text is now:\n«{invitation}»\n\n` +
      `/text – write your own invitation text\n/types – choose which kinds you accept (text, photo, music, …)\n` +
      `/qr – a QR code of your link for stories\n/pause and /resume – stop or resume receiving messages\n` +
      `/blocked – blocked senders and unblocking\n/stats – statistics\n` +
      `/newlink – a new link if yours fell into the wrong hands\n/privacy – what data is stored\n` +
      `/delete – delete your data\n/language – change language`),
    fa: (v) => welcome(v,
      `سلام{name}! 👋 این لینک ناشناس شخصی توئه:\n\n{link}\n\n` +
      `بذارش توی بیو، استوری یا گروه‌ها. هر کسی بازش کنه می‌تونه بدون اینکه هویتش معلوم بشه برات پیام بفرسته. ` +
      `از زیر خود پیام می‌تونی جواب بدی، مسدود کنی یا گزارش بدی.\n\n` +
      `متن دعوتت الان اینه:\n«{invitation}»\n\n` +
      `/text – نوشتن متن دعوت خودت\n/types – انتخاب نوع پیام‌هایی که می‌گیری (متن، عکس، موزیک، …)\n` +
      `/qr – کیوآر کد لینکت برای استوری\n/pause و /resume – توقف یا ادامه‌ی دریافت پیام\n` +
      `/blocked – فرستنده‌های مسدود و رفع مسدودیت\n/stats – آمار\n` +
      `/newlink – لینک جدید، اگه لینکت دست آدم نامناسب افتاده\n/privacy – چه اطلاعاتی ذخیره می‌شه\n` +
      `/delete – پاک کردن اطلاعاتت\n/language – تغییر زبان`),
    ar: (v) => welcome(v,
      `مرحبًا{name}! 👋 هذا رابطك المجهول الخاص:\n\n{link}\n\n` +
      `ضعه في نبذتك أو قصتك أو المجموعات. يمكن لأي شخص يفتحه أن يراسلك دون الكشف عن هويته. ` +
      `من أسفل كل رسالة يمكنك الرد أو الحظر أو الإبلاغ.\n\n` +
      `نص دعوتك الآن:\n«{invitation}»\n\n` +
      `/text – كتابة نص دعوتك\n/types – اختيار أنواع الرسائل التي تقبلها (نص، صورة، موسيقى، …)\n` +
      `/qr – رمز QR لرابطك للقصص\n/pause و /resume – إيقاف أو استئناف استقبال الرسائل\n` +
      `/blocked – المرسلون المحظورون وإلغاء الحظر\n/stats – إحصاءات\n` +
      `/newlink – رابط جديد إذا وقع رابطك في الأيدي الخطأ\n/privacy – ما البيانات التي تُحفظ\n` +
      `/delete – حذف بياناتك\n/language – تغيير اللغة`),
    ru: (v) => welcome(v,
      `Привет{name}! 👋 Это твоя личная анонимная ссылка:\n\n{link}\n\n` +
      `Добавь её в описание профиля, историю или группы. Любой, кто откроет её, сможет написать тебе, не раскрывая себя. ` +
      `Под каждым сообщением можно ответить, заблокировать или пожаловаться.\n\n` +
      `Твой текст приглашения сейчас:\n«{invitation}»\n\n` +
      `/text – свой текст приглашения\n/types – какие типы сообщений принимать (текст, фото, музыка, …)\n` +
      `/qr – QR-код ссылки для историй\n/pause и /resume – остановить или возобновить приём\n` +
      `/blocked – заблокированные и разблокировка\n/stats – статистика\n` +
      `/newlink – новая ссылка, если старая попала не в те руки\n/privacy – какие данные хранятся\n` +
      `/delete – удалить свои данные\n/language – сменить язык`),
    es: (v) => welcome(v,
      `¡Hola{name}! 👋 Este es tu enlace anónimo personal:\n\n{link}\n\n` +
      `Ponlo en tu biografía, historia o grupos. Cualquiera que lo abra puede escribirte sin revelar quién es. ` +
      `Debajo de cada mensaje puedes responder, bloquear o reportar.\n\n` +
      `Tu texto de invitación es ahora:\n«{invitation}»\n\n` +
      `/text – escribe tu propio texto de invitación\n/types – elige qué tipos aceptas (texto, foto, música, …)\n` +
      `/qr – un código QR de tu enlace para historias\n/pause y /resume – detener o reanudar la recepción\n` +
      `/blocked – remitentes bloqueados y desbloqueo\n/stats – estadísticas\n` +
      `/newlink – un enlace nuevo si el tuyo cayó en malas manos\n/privacy – qué datos se guardan\n` +
      `/delete – eliminar tus datos\n/language – cambiar idioma`),
  },
  help: {
    en: 'Send /start to get your personal anonymous link. Commands: /text, /types, /qr, /pause, /resume, /blocked, /stats, /newlink, /privacy, /delete, /language.',
    fa: 'برای گرفتن لینک ناشناس شخصیت /start رو بزن. دستورها: /text، /types، /qr، /pause، /resume، /blocked، /stats، /newlink، /privacy، /delete، /language.',
    ar: 'أرسل /start للحصول على رابطك المجهول الخاص. الأوامر: /text، /types، /qr، /pause، /resume، /blocked، /stats، /newlink، /privacy، /delete، /language.',
    ru: 'Отправь /start, чтобы получить личную анонимную ссылку. Команды: /text, /types, /qr, /pause, /resume, /blocked, /stats, /newlink, /privacy, /delete, /language.',
    es: 'Envía /start para obtener tu enlace anónimo personal. Comandos: /text, /types, /qr, /pause, /resume, /blocked, /stats, /newlink, /privacy, /delete, /language.',
  },
  btnShare: {
    en: '📤 Share link in a chat', fa: '📤 اشتراک لینک در یه چت', ar: '📤 مشاركة الرابط في محادثة',
    ru: '📤 Поделиться ссылкой в чате', es: '📤 Compartir enlace en un chat',
  },
  btnQr: {
    en: '🔳 QR code of the link', fa: '🔳 کیوآر کد لینک', ar: '🔳 رمز QR للرابط',
    ru: '🔳 QR-код ссылки', es: '🔳 Código QR del enlace',
  },
  source: {
    en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente',
  },
  choose_language: {
    en: '🌐 Choose your language:', fa: '🌐 زبان خود را انتخاب کنید:', ar: '🌐 اختر لغتك:',
    ru: '🌐 Выберите язык:', es: '🌐 Elige tu idioma:',
  },
  settings_title: {
    en: '⚙️ Settings', fa: '⚙️ تنظیمات', ar: '⚙️ الإعدادات', ru: '⚙️ Настройки', es: '⚙️ Ajustes',
  },
  source_here: {
    en: '📦 Source code:', fa: '📦 کد منبع:', ar: '📦 الكود المصدري:', ru: '📦 Исходный код:', es: '📦 Código fuente:',
  },
  language_set: {
    en: '✅ Language set to {name}.', fa: '✅ زبان به {name} تغییر کرد.', ar: '✅ تم ضبط اللغة على {name}.',
    ru: '✅ Язык изменён на {name}.', es: '✅ Idioma cambiado a {name}.',
  },
};

export const t = makeT(strings);
