// Core multilingual strings: the /start greeting, the main menu, /help header,
// the /language switcher and the source link. The detailed command reference
// and the hub screens stay in English (fallback) per the core-surface scope.
import { makeT } from './i18n.js';

export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chthapibot';

const strings = {
  greeting: {
    en: "👋 Hi! I'm a pocket multi-tool. Pick a category:",
    fa: '👋 سلام! من یه چندکارهٔ جیبی‌ام. یه دسته رو انتخاب کن:',
    ar: '👋 مرحبًا! أنا أداة متعددة في جيبك. اختر فئة:',
    ru: '👋 Привет! Я карманный мультитул. Выбери категорию:',
    es: '👋 ¡Hola! Soy una multiherramienta de bolsillo. Elige una categoría:',
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
  btn_hide: { en: '✖️ Hide menu', fa: '✖️ بستن منو', ar: '✖️ إخفاء القائمة', ru: '✖️ Скрыть меню', es: '✖️ Ocultar menú' },
  source: { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },
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
