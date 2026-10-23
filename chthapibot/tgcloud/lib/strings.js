// Core multilingual strings: the /start greeting, the reply keyboard, the main
// menu, /help header, the /language switcher, prompts' chrome and the source
// link. The detailed command reference and the hub screens stay in English
// (fallback) per the core-surface scope.
import { makeT } from './i18n.js';

export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chthapibot';

const strings = {
  greeting: {
    en: "👋 Hi! I'm a pocket multi-tool: crypto, sports, food and drinks, random picks and a daily briefing. Pick a category on the keyboard below.",
    fa: '👋 سلام! من یه چندکارهٔ جیبی‌ام: کریپتو، ورزش، خوراکی و نوشیدنی، انتخاب‌های تصادفی و خلاصهٔ روزانه. یه دسته رو از دکمه‌های پایین انتخاب کن.',
    ar: '👋 مرحبًا! أنا أداة متعددة في جيبك: العملات الرقمية والرياضة والطعام والشراب والاختيارات العشوائية وموجز يومي. اختر فئة من لوحة الأزرار بالأسفل.',
    ru: '👋 Привет! Я карманный мультитул: крипто, спорт, еда и напитки, случайный выбор и ежедневная сводка. Выбери категорию на клавиатуре ниже.',
    es: '👋 ¡Hola! Soy una multiherramienta de bolsillo: cripto, deportes, comida y bebida, elecciones al azar y un resumen diario. Elige una categoría en el teclado de abajo.',
  },
  menu_title: {
    en: '🏠 <b>Main menu</b>', fa: '🏠 <b>منوی اصلی</b>', ar: '🏠 <b>القائمة الرئيسية</b>',
    ru: '🏠 <b>Главное меню</b>', es: '🏠 <b>Menú principal</b>',
  },
  help_header: {
    en: 'Here is everything I can do:', fa: 'هر کاری که می‌تونم انجام بدم اینجاست:',
    ar: 'هذا كل ما يمكنني فعله:', ru: 'Вот всё, что я умею:', es: 'Esto es todo lo que puedo hacer:',
  },
  btn_crypto: { en: '💰 Crypto', fa: '💰 کریپتو', ar: '💰 العملات', ru: '💰 Крипто', es: '💰 Cripto' },
  btn_sports: { en: '🏆 Sports', fa: '🏆 ورزش', ar: '🏆 الرياضة', ru: '🏆 Спорт', es: '🏆 Deportes' },
  btn_food: { en: '🍽 Food & drinks', fa: '🍽 خوراکی و نوشیدنی', ar: '🍽 الطعام والشراب', ru: '🍽 Еда и напитки', es: '🍽 Comida y bebida' },
  btn_random: { en: '🎲 Random', fa: '🎲 تصادفی', ar: '🎲 عشوائي', ru: '🎲 Случайное', es: '🎲 Aleatorio' },
  btn_daily: { en: '☀️ Daily briefing', fa: '☀️ خلاصهٔ روزانه', ar: '☀️ الموجز اليومي', ru: '☀️ Ежедневная сводка', es: '☀️ Resumen diario' },
  btn_notifications: { en: '🔔 Notifications', fa: '🔔 اعلان‌ها', ar: '🔔 الإشعارات', ru: '🔔 Уведомления', es: '🔔 Notificaciones' },
  btn_settings: { en: '⚙️ Settings', fa: '⚙️ تنظیمات', ar: '⚙️ الإعدادات', ru: '⚙️ Настройки', es: '⚙️ Ajustes' },
  btn_language: { en: '🌐 Language', fa: '🌐 زبان', ar: '🌐 اللغة', ru: '🌐 Язык', es: '🌐 Idioma' },
  btn_cancel: { en: '✖️ Cancel', fa: '✖️ لغو', ar: '✖️ إلغاء', ru: '✖️ Отмена', es: '✖️ Cancelar' },
  btn_back_settings: { en: '⬅️ Settings', fa: '⬅️ تنظیمات', ar: '⬅️ الإعدادات', ru: '⬅️ Настройки', es: '⬅️ Ajustes' },
  btn_share_location: { en: '📍 Share location', fa: '📍 ارسال موقعیت', ar: '📍 مشاركة الموقع', ru: '📍 Отправить геопозицию', es: '📍 Compartir ubicación' },
  placeholder: {
    en: 'Pick a category or type a command', fa: 'یه دسته انتخاب کن یا دستوری بنویس', ar: 'اختر فئة أو اكتب أمرًا',
    ru: 'Выбери категорию или введи команду', es: 'Elige una categoría o escribe un comando',
  },
  prompt_hint: {
    en: 'Send your answer as a message, or tap Cancel.', fa: 'جوابت رو به‌صورت پیام بفرست، یا «لغو» رو بزن.',
    ar: 'أرسل إجابتك في رسالة، أو اضغط «إلغاء».', ru: 'Отправь ответ сообщением или нажми «Отмена».',
    es: 'Envía tu respuesta como mensaje o toca Cancelar.',
  },
  cancelled: { en: 'Cancelled.', fa: 'لغو شد.', ar: 'تم الإلغاء.', ru: 'Отменено.', es: 'Cancelado.' },
  location_prompt: {
    en: 'Tap 📍 to share your location. It sets your time zone and adds weather to the daily briefing.',
    fa: 'برای ارسال موقعیتت 📍 رو بزن. منطقهٔ زمانی‌ات تنظیم می‌شه و هوا به خلاصهٔ روزانه اضافه می‌شه.',
    ar: 'اضغط 📍 لمشاركة موقعك. يضبط ذلك منطقتك الزمنية ويضيف الطقس إلى الموجز اليومي.',
    ru: 'Нажми 📍, чтобы отправить геопозицию. Она задаст часовой пояс и добавит погоду в ежедневную сводку.',
    es: 'Toca 📍 para compartir tu ubicación. Ajusta tu zona horaria y añade el tiempo al resumen diario.',
  },
  source: { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },
  source_here: { en: '📦 Source code:', fa: '📦 کد منبع:', ar: '📦 الكود المصدري:', ru: '📦 Исходный код:', es: '📦 Código fuente:' },
  choose_language: {
    en: '🌐 Choose your language:', fa: '🌐 زبان خود را انتخاب کنید:', ar: '🌐 اختر لغتك:',
    ru: '🌐 Выберите язык:', es: '🌐 Elige tu idioma:',
  },
  language_set: {
    en: '✅ Language set to {name}.', fa: '✅ زبان به {name} تغییر کرد.', ar: '✅ تم ضبط اللغة على {name}.',
    ru: '✅ Язык изменён на {name}.', es: '✅ Idioma cambiado a {name}.',
  },
};

export const t = makeT(strings);
