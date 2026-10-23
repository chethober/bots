// Core multilingual strings: the /start help, /language switcher, source link
// and the two short gate/error messages. The panel, /status and /learn screens
// stay in English (fallback) per the core-surface scope.
import { makeT } from './i18n.js';

const strings = {
  help: {
    en: `I'm an AI secretary for your Telegram Business account. I answer your private chats while you're away, using Cloudflare Workers AI.

Setup:
1. Telegram Settings → Telegram Business → Chatbots → add me, and allow "Reply to messages".
2. Send /setup and I'll walk you through getting a free Cloudflare Workers AI key (Account ID + API token).
3. Tune mood, emoji style, temperature and more.

Commands:
/panel – open the management panel
/setup – connect Cloudflare AI step by step
/learn – teach me to write like you
/status – connection and today's usage
/pause, /resume – stop or start auto-replies
/language – change language
Any other text – preview how I'd answer it

Photos, voice messages, files and stickers from your contacts are forwarded to you here. Reply to one with anything, and I'll send it back to them from your account.`,
    fa: `من یه منشی هوش مصنوعی برای حساب تلگرام بیزینس تو هستم. وقتی نیستی، چت‌های خصوصیت رو با Cloudflare Workers AI جواب می‌دم.

راه‌اندازی:
۱. تنظیمات تلگرام → Telegram Business → Chatbots → منو اضافه کن و اجازهٔ «Reply to messages» رو بده.
۲. /setup رو بفرست تا قدم‌به‌قدم یه کلید رایگان Cloudflare Workers AI بگیری (Account ID + API token).
۳. حال‌وهوا، سبک ایموجی، دما و بقیهٔ تنظیمات رو تنظیم کن.

دستورها:
/panel – باز کردن پنل مدیریت
/setup – اتصال Cloudflare AI به‌صورت مرحله‌ای
/learn – یاد دادن سبک نوشتنت به من
/status – وضعیت اتصال و مصرف امروز
/pause، /resume – توقف یا شروع پاسخ خودکار
/language – تغییر زبان
هر متن دیگه – پیش‌نمایش جوابی که می‌دادم

عکس، ویس، فایل و استیکرِ مخاطب‌ها همین‌جا برات فرستاده می‌شه. به هر کدوم جواب بده تا از طرف حسابت براشون بفرستم.`,
    ar: `أنا سكرتير بالذكاء الاصطناعي لحساب Telegram Business الخاص بك. أرد على محادثاتك الخاصة أثناء غيابك باستخدام Cloudflare Workers AI.

الإعداد:
1. إعدادات تيليجرام → Telegram Business → Chatbots → أضفني، واسمح بـ "Reply to messages".
2. أرسل /setup وسأرشدك للحصول على مفتاح Cloudflare Workers AI مجاني (Account ID + API token).
3. اضبط المزاج ونمط الإيموجي ودرجة الحرارة وغيرها.

الأوامر:
/panel – فتح لوحة الإدارة
/setup – ربط Cloudflare AI خطوة بخطوة
/learn – علّمني أن أكتب مثلك
/status – الاتصال واستخدام اليوم
/pause، /resume – إيقاف أو تشغيل الردود التلقائية
/language – تغيير اللغة
أي نص آخر – معاينة كيف كنت سأرد

الصور والرسائل الصوتية والملفات والملصقات من جهات اتصالك تُحوَّل إليك هنا. رُد على أي منها بأي شيء وسأرسله إليهم من حسابك.`,
    ru: `Я ИИ-секретарь для твоего аккаунта Telegram Business. Отвечаю на личные чаты, пока тебя нет, с помощью Cloudflare Workers AI.

Настройка:
1. Настройки Telegram → Telegram Business → Chatbots → добавь меня и разреши «Reply to messages».
2. Отправь /setup — я помогу получить бесплатный ключ Cloudflare Workers AI (Account ID + API token).
3. Настрой настроение, стиль эмодзи, температуру и прочее.

Команды:
/panel – открыть панель управления
/setup – подключить Cloudflare AI по шагам
/learn – научить меня писать как ты
/status – подключение и расход за сегодня
/pause, /resume – остановить или запустить автоответы
/language – сменить язык
Любой другой текст – предпросмотр моего ответа

Фото, голосовые, файлы и стикеры от твоих контактов пересылаются сюда. Ответь на любое — и я отправлю это им от твоего имени.`,
    es: `Soy un secretario con IA para tu cuenta de Telegram Business. Respondo tus chats privados mientras no estás, usando Cloudflare Workers AI.

Configuración:
1. Ajustes de Telegram → Telegram Business → Chatbots → añádeme y permite "Reply to messages".
2. Envía /setup y te guío para obtener una clave gratuita de Cloudflare Workers AI (Account ID + API token).
3. Ajusta el tono, el estilo de emojis, la temperatura y más.

Comandos:
/panel – abrir el panel de gestión
/setup – conectar Cloudflare AI paso a paso
/learn – enséñame a escribir como tú
/status – conexión y uso de hoy
/pause, /resume – detener o iniciar respuestas automáticas
/language – cambiar idioma
Cualquier otro texto – vista previa de cómo respondería

Las fotos, notas de voz, archivos y stickers de tus contactos se te reenvían aquí. Responde a cualquiera con lo que sea y lo enviaré de vuelta desde tu cuenta.`,
  },
  source: { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },
  choose_language: {
    en: '🌐 Choose your language:', fa: '🌐 زبان خود را انتخاب کنید:', ar: '🌐 اختر لغتك:',
    ru: '🌐 Выберите язык:', es: '🌐 Elige tu idioma:',
  },
  settings_title: {
    en: '⚙️ Manage your secretary:', fa: '⚙️ مدیریت منشی:', ar: '⚙️ إدارة سكرتيرك:',
    ru: '⚙️ Управление секретарём:', es: '⚙️ Gestiona tu secretario:',
  },
  source_here: {
    en: '📦 Source code:', fa: '📦 کد منبع:', ar: '📦 الكود المصدري:', ru: '📦 Исходный код:', es: '📦 Código fuente:',
  },
  language_set: {
    en: '✅ Language set to {name}.', fa: '✅ زبان به {name} تغییر کرد.', ar: '✅ تم ضبط اللغة على {name}.',
    ru: '✅ Язык изменён на {name}.', es: '✅ Idioma cambiado a {name}.',
  },
  private: {
    en: 'Sorry, this secretary bot is private.', fa: 'ببخشید، این ربات منشی خصوصیه.',
    ar: 'عذرًا، بوت السكرتير هذا خاص.', ru: 'Извините, этот бот-секретарь приватный.', es: 'Lo siento, este bot secretario es privado.',
  },
  unknown: {
    en: 'Unknown command. Try /help.', fa: 'دستور ناشناخته. /help رو امتحان کن.',
    ar: 'أمر غير معروف. جرّب /help.', ru: 'Неизвестная команда. Попробуй /help.', es: 'Comando desconocido. Prueba /help.',
  },
};

export const t = makeT(strings);
