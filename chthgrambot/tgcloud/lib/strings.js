// Every string the bot writes in chat, in English, Persian, Arabic, Russian and
// Spanish. The Mini App panel (web/) is separate and stays English.
// t(locale, key, vars) — {name} placeholders are filled from vars.
import { makeT } from './i18n.js';

const strings = {
  // --- reply keyboard -------------------------------------------------------
  kb_status:   { en: '📊 Status', fa: '📊 وضعیت', ar: '📊 الحالة', ru: '📊 Статус', es: '📊 Estado' },
  kb_settings: { en: '⚙️ Settings', fa: '⚙️ تنظیمات', ar: '⚙️ الإعدادات', ru: '⚙️ Настройки', es: '⚙️ Ajustes' },
  kb_learn:    { en: '🪞 Teach my style', fa: '🪞 یاد دادن سبکم', ar: '🪞 تعليم أسلوبي', ru: '🪞 Мой стиль', es: '🪞 Enseñar mi estilo' },
  kb_setup:    { en: '🔑 Connect AI', fa: '🔑 اتصال هوش مصنوعی', ar: '🔑 ربط الذكاء الاصطناعي', ru: '🔑 Подключить ИИ', es: '🔑 Conectar IA' },
  kb_language: { en: '🌐 Language', fa: '🌐 زبان', ar: '🌐 اللغة', ru: '🌐 Язык', es: '🌐 Idioma' },
  kb_help:     { en: 'ℹ️ Help', fa: 'ℹ️ راهنما', ar: 'ℹ️ مساعدة', ru: 'ℹ️ Помощь', es: 'ℹ️ Ayuda' },
  kb_source:   { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },

  // --- home / help ------------------------------------------------------------
  help: {
    en: `I'm an AI secretary for your Telegram Business account. I answer your private chats while you're away, using Cloudflare Workers AI.

Setup:
1. Telegram Settings → Telegram Business → Chatbots → add me, and allow "Reply to messages".
2. Tap 🔑 Connect AI and I'll walk you through getting a free Cloudflare Workers AI key (Account ID + API token).
3. Tune mood, emoji style, length and more in ⚙️ Settings, or open the panel for everything.

Buttons:
📊 Status – connection and today's usage, pause or resume
⚙️ Settings – one-tap settings and the panel
🪞 Teach my style – let me write like you
🌐 Language – change language
Any other text – preview how I'd answer it

Photos, voice messages, files and stickers from your contacts are forwarded to you here. Reply to one with anything, and I'll send it back to them from your account.`,
    fa: `من یه منشی هوش مصنوعی برای حساب تلگرام بیزینس تو هستم. وقتی نیستی، چت‌های خصوصیت رو با Cloudflare Workers AI جواب می‌دم.

راه‌اندازی:
۱. تنظیمات تلگرام → Telegram Business → Chatbots → منو اضافه کن و اجازهٔ «Reply to messages» رو بده.
۲. «🔑 اتصال هوش مصنوعی» رو بزن تا قدم‌به‌قدم یه کلید رایگان Cloudflare Workers AI بگیری (Account ID + API token).
۳. حال‌وهوا، سبک ایموجی، طول جواب و بقیه رو از «⚙️ تنظیمات» عوض کن، یا پنل رو برای همهٔ تنظیمات باز کن.

دکمه‌ها:
📊 وضعیت – اتصال و مصرف امروز، توقف یا ادامه
⚙️ تنظیمات – تنظیمات با یک لمس و پنل
🪞 یاد دادن سبکم – تا مثل خودت بنویسم
🌐 زبان – تغییر زبان
هر متن دیگه – پیش‌نمایش جوابی که می‌دادم

عکس، ویس، فایل و استیکرِ مخاطب‌ها همین‌جا برات فرستاده می‌شه. به هر کدوم جواب بده تا از طرف حسابت براشون بفرستم.`,
    ar: `أنا سكرتير بالذكاء الاصطناعي لحساب Telegram Business الخاص بك. أرد على محادثاتك الخاصة أثناء غيابك باستخدام Cloudflare Workers AI.

الإعداد:
1. إعدادات تيليجرام → Telegram Business → Chatbots → أضفني، واسمح بـ "Reply to messages".
2. اضغط «🔑 ربط الذكاء الاصطناعي» وسأرشدك للحصول على مفتاح Cloudflare Workers AI مجاني (Account ID + API token).
3. اضبط المزاج ونمط الإيموجي والطول وغيرها من «⚙️ الإعدادات»، أو افتح اللوحة لكل شيء.

الأزرار:
📊 الحالة – الاتصال واستخدام اليوم، إيقاف أو استئناف
⚙️ الإعدادات – إعدادات بلمسة واحدة واللوحة
🪞 تعليم أسلوبي – لأكتب مثلك
🌐 اللغة – تغيير اللغة
أي نص آخر – معاينة كيف كنت سأرد

الصور والرسائل الصوتية والملفات والملصقات من جهات اتصالك تُحوَّل إليك هنا. رُد على أي منها بأي شيء وسأرسله إليهم من حسابك.`,
    ru: `Я ИИ-секретарь для твоего аккаунта Telegram Business. Отвечаю на личные чаты, пока тебя нет, с помощью Cloudflare Workers AI.

Настройка:
1. Настройки Telegram → Telegram Business → Chatbots → добавь меня и разреши «Reply to messages».
2. Нажми «🔑 Подключить ИИ» — я помогу получить бесплатный ключ Cloudflare Workers AI (Account ID + API token).
3. Настроение, эмодзи, длину и прочее меняй в «⚙️ Настройках» или открой панель для всего.

Кнопки:
📊 Статус – подключение и расход за сегодня, пауза и запуск
⚙️ Настройки – настройки в одно касание и панель
🪞 Мой стиль – чтобы я писал как ты
🌐 Язык – сменить язык
Любой другой текст – предпросмотр моего ответа

Фото, голосовые, файлы и стикеры от твоих контактов пересылаются сюда. Ответь на любое — и я отправлю это им от твоего имени.`,
    es: `Soy un secretario con IA para tu cuenta de Telegram Business. Respondo tus chats privados mientras no estás, usando Cloudflare Workers AI.

Configuración:
1. Ajustes de Telegram → Telegram Business → Chatbots → añádeme y permite "Reply to messages".
2. Pulsa «🔑 Conectar IA» y te guío para obtener una clave gratuita de Cloudflare Workers AI (Account ID + API token).
3. Ajusta el tono, los emojis, la longitud y más en «⚙️ Ajustes», o abre el panel para todo.

Botones:
📊 Estado – conexión y uso de hoy, pausar o reanudar
⚙️ Ajustes – ajustes de un toque y el panel
🪞 Enseñar mi estilo – para que escriba como tú
🌐 Idioma – cambiar idioma
Cualquier otro texto – vista previa de cómo respondería

Las fotos, notas de voz, archivos y stickers de tus contactos se te reenvían aquí. Responde a cualquiera con lo que sea y lo enviaré de vuelta desde tu cuenta.`,
  },
  connect_prompt: {
    en: '⚙️ Tap below to connect Cloudflare AI and finish setup.',
    fa: '⚙️ برای اتصال Cloudflare AI و تموم کردن راه‌اندازی، دکمهٔ زیر رو بزن.',
    ar: '⚙️ اضغط أدناه لربط Cloudflare AI وإكمال الإعداد.',
    ru: '⚙️ Нажми ниже, чтобы подключить Cloudflare AI и закончить настройку.',
    es: '⚙️ Pulsa abajo para conectar Cloudflare AI y terminar la configuración.',
  },
  private: {
    en: 'Sorry, this secretary bot is private.', fa: 'ببخشید، این ربات منشی خصوصیه.',
    ar: 'عذرًا، بوت السكرتير هذا خاص.', ru: 'Извините, этот бот-секретарь приватный.', es: 'Lo siento, este bot secretario es privado.',
  },
  use_buttons: {
    en: 'Use the buttons below 👇', fa: 'از دکمه‌های پایین استفاده کن 👇', ar: 'استخدم الأزرار بالأسفل 👇',
    ru: 'Пользуйся кнопками внизу 👇', es: 'Usa los botones de abajo 👇',
  },
  source_here: { en: '📦 Source code:', fa: '📦 کد منبع:', ar: '📦 الكود المصدري:', ru: '📦 Исходный код:', es: '📦 Código fuente:' },
  choose_language: {
    en: '🌐 Choose your language:', fa: '🌐 زبان خود را انتخاب کنید:', ar: '🌐 اختر لغتك:',
    ru: '🌐 Выберите язык:', es: '🌐 Elige tu idioma:',
  },
  language_set: {
    en: '✅ Language set to {name}.', fa: '✅ زبان به {name} تغییر کرد.', ar: '✅ تم ضبط اللغة على {name}.',
    ru: '✅ Язык изменён на {name}.', es: '✅ Idioma cambiado a {name}.',
  },

  // --- inline buttons -----------------------------------------------------------
  menu_panel: { en: 'Panel', fa: 'پنل', ar: 'اللوحة', ru: 'Панель', es: 'Panel' },
  btn_panel: { en: '⚙️ Open panel', fa: '⚙️ باز کردن پنل', ar: '⚙️ فتح اللوحة', ru: '⚙️ Открыть панель', es: '⚙️ Abrir panel' },
  btn_setup: {
    en: '🔑 Connect Cloudflare AI', fa: '🔑 اتصال Cloudflare AI', ar: '🔑 ربط Cloudflare AI',
    ru: '🔑 Подключить Cloudflare AI', es: '🔑 Conectar Cloudflare AI',
  },
  btn_pause: { en: '⏸ Pause auto-replies', fa: '⏸ توقف پاسخ خودکار', ar: '⏸ إيقاف الردود التلقائية', ru: '⏸ Приостановить автоответы', es: '⏸ Pausar respuestas automáticas' },
  btn_resume: { en: '▶️ Resume auto-replies', fa: '▶️ ادامهٔ پاسخ خودکار', ar: '▶️ استئناف الردود التلقائية', ru: '▶️ Возобновить автоответы', es: '▶️ Reanudar respuestas automáticas' },
  paused: { en: 'Auto-replies paused', fa: 'پاسخ خودکار متوقف شد', ar: 'تم إيقاف الردود التلقائية', ru: 'Автоответы приостановлены', es: 'Respuestas automáticas en pausa' },
  resumed: { en: 'Auto-replies resumed', fa: 'پاسخ خودکار ادامه پیدا کرد', ar: 'تم استئناف الردود التلقائية', ru: 'Автоответы возобновлены', es: 'Respuestas automáticas reanudadas' },

  // --- ⚙️ Settings ----------------------------------------------------------------
  settings_title: {
    en: '⚙️ Manage your secretary:', fa: '⚙️ مدیریت منشی:', ar: '⚙️ إدارة سكرتيرك:',
    ru: '⚙️ Управление секретарём:', es: '⚙️ Gestiona tu secretario:',
  },
  st_on: { en: '▶️ Auto-replies: on', fa: '▶️ پاسخ خودکار: روشن', ar: '▶️ الردود التلقائية: مُفعّلة', ru: '▶️ Автоответы: вкл', es: '▶️ Respuestas automáticas: activadas' },
  st_off: { en: '⏸ Auto-replies: paused', fa: '⏸ پاسخ خودکار: متوقف', ar: '⏸ الردود التلقائية: متوقفة', ru: '⏸ Автоответы: на паузе', es: '⏸ Respuestas automáticas: en pausa' },
  st_voice: { en: 'Voice: {v}', fa: 'صدا: {v}', ar: 'الصوت: {v}', ru: 'Голос: {v}', es: 'Voz: {v}' },
  st_mood: { en: 'Mood: {v}', fa: 'حال‌وهوا: {v}', ar: 'المزاج: {v}', ru: 'Настроение: {v}', es: 'Tono: {v}' },
  st_emoji: { en: 'Emoji: {v}', fa: 'ایموجی: {v}', ar: 'الإيموجي: {v}', ru: 'Эмодзи: {v}', es: 'Emojis: {v}' },
  st_length: { en: 'Length: {v}', fa: 'طول: {v}', ar: 'الطول: {v}', ru: 'Длина: {v}', es: 'Longitud: {v}' },
  st_tone: { en: 'Tone: {v}', fa: 'لحن: {v}', ar: 'الأسلوب: {v}', ru: 'Тон: {v}', es: 'Registro: {v}' },
  st_media: { en: 'Media: {v}', fa: 'رسانه: {v}', ar: 'الوسائط: {v}', ru: 'Медиа: {v}', es: 'Multimedia: {v}' },
  st_learn: { en: '🪞 Learn my style: {v}', fa: '🪞 یادگیری سبکم: {v}', ar: '🪞 تعلّم أسلوبي: {v}', ru: '🪞 Учить мой стиль: {v}', es: '🪞 Aprender mi estilo: {v}' },
  st_ailabel: { en: '🤖 AI label: {v}', fa: '🤖 برچسب هوش مصنوعی: {v}', ar: '🤖 وسم الذكاء الاصطناعي: {v}', ru: '🤖 Метка ИИ: {v}', es: '🤖 Etiqueta IA: {v}' },
  on: { en: 'on', fa: 'روشن', ar: 'مُفعّل', ru: 'вкл', es: 'sí' },
  off: { en: 'off', fa: 'خاموش', ar: 'متوقف', ru: 'выкл', es: 'no' },

  // Option labels (the panel has its own English ones in settings.js).
  voice_assistant: { en: '🤖 Assistant', fa: '🤖 دستیار', ar: '🤖 مساعد', ru: '🤖 Ассистент', es: '🤖 Asistente' },
  voice_me: { en: '🪞 Speak as me', fa: '🪞 به‌جای من', ar: '🪞 بصوتي أنا', ru: '🪞 От моего имени', es: '🪞 Como yo' },
  mood_friendly: { en: '😊 Friendly', fa: '😊 صمیمی', ar: '😊 ودود', ru: '😊 Дружелюбное', es: '😊 Amable' },
  mood_professional: { en: '💼 Professional', fa: '💼 رسمی و کاری', ar: '💼 مهني', ru: '💼 Деловое', es: '💼 Profesional' },
  mood_playful: { en: '🎈 Playful', fa: '🎈 شوخ', ar: '🎈 مرح', ru: '🎈 Игривое', es: '🎈 Juguetón' },
  mood_witty: { en: '😏 Witty', fa: '😏 حاضرجواب', ar: '😏 ذكي الدعابة', ru: '😏 Остроумное', es: '😏 Ingenioso' },
  mood_calm: { en: '🧘 Calm', fa: '🧘 آرام', ar: '🧘 هادئ', ru: '🧘 Спокойное', es: '🧘 Tranquilo' },
  mood_enthusiastic: { en: '🔥 Enthusiastic', fa: '🔥 پرانرژی', ar: '🔥 متحمس', ru: '🔥 Восторженное', es: '🔥 Entusiasta' },
  mood_empathetic: { en: '🤗 Empathetic', fa: '🤗 همدل', ar: '🤗 متعاطف', ru: '🤗 Чуткое', es: '🤗 Empático' },
  mood_sarcastic: { en: '🙃 Sarcastic', fa: '🙃 کنایه‌دار', ar: '🙃 ساخر', ru: '🙃 Саркастичное', es: '🙃 Sarcástico' },
  mood_mysterious: { en: '🌙 Mysterious', fa: '🌙 مرموز', ar: '🌙 غامض', ru: '🌙 Загадочное', es: '🌙 Misterioso' },
  mood_custom: { en: '✏️ Custom', fa: '✏️ دلخواه', ar: '✏️ مخصص', ru: '✏️ Своё', es: '✏️ Personalizado' },
  emoji_none: { en: 'None', fa: 'هیچ', ar: 'بدون', ru: 'Нет', es: 'Ninguno' },
  emoji_minimal: { en: 'Minimal', fa: 'کم', ar: 'قليل', ru: 'Минимум', es: 'Mínimo' },
  emoji_balanced: { en: 'Balanced', fa: 'متعادل', ar: 'متوازن', ru: 'Умеренно', es: 'Equilibrado' },
  emoji_expressive: { en: 'Expressive', fa: 'زیاد', ar: 'كثير', ru: 'Много', es: 'Expresivo' },
  emoji_kaomoji: { en: 'Kaomoji', fa: 'کائوموجی', ar: 'كاوموجي', ru: 'Каомодзи', es: 'Kaomoji' },
  emoji_oldschool: { en: 'Old-school', fa: 'قدیمی :)', ar: 'كلاسيكي :)', ru: 'Олдскул :)', es: 'Clásico :)' },
  emoji_custom: { en: 'Custom set', fa: 'مجموعهٔ دلخواه', ar: 'مجموعة مخصصة', ru: 'Свой набор', es: 'Conjunto propio' },
  length_short: { en: 'Short', fa: 'کوتاه', ar: 'قصير', ru: 'Коротко', es: 'Corta' },
  length_medium: { en: 'Medium', fa: 'متوسط', ar: 'متوسط', ru: 'Средне', es: 'Media' },
  length_long: { en: 'Long', fa: 'بلند', ar: 'طويل', ru: 'Длинно', es: 'Larga' },
  formality_casual: { en: 'Casual', fa: 'خودمونی', ar: 'غير رسمي', ru: 'Неформальный', es: 'Informal' },
  formality_neutral: { en: 'Neutral', fa: 'معمولی', ar: 'محايد', ru: 'Нейтральный', es: 'Neutral' },
  formality_formal: { en: 'Formal', fa: 'رسمی', ar: 'رسمي', ru: 'Официальный', es: 'Formal' },
  media_relay: { en: '📨 Forward to me', fa: '📨 بفرست برام', ar: '📨 حوّلها إليّ', ru: '📨 Пересылать мне', es: '📨 Reenviármelo' },
  media_ai: { en: '🤖 AI answers', fa: '🤖 هوش مصنوعی جواب بده', ar: '🤖 يرد الذكاء الاصطناعي', ru: '🤖 Отвечает ИИ', es: '🤖 Responde la IA' },
  media_ignore: { en: '🙈 Ignore', fa: '🙈 نادیده بگیر', ar: '🙈 تجاهل', ru: '🙈 Игнорировать', es: '🙈 Ignorar' },

  // --- 📊 Status ------------------------------------------------------------------
  status_conn_none: { en: 'Business connection: ❌ not connected', fa: 'اتصال بیزینس: ❌ وصل نیست', ar: 'اتصال Business: ❌ غير متصل', ru: 'Подключение Business: ❌ нет', es: 'Conexión Business: ❌ sin conectar' },
  status_conn_ok: { en: 'Business connection: ✅ connected', fa: 'اتصال بیزینس: ✅ وصل', ar: 'اتصال Business: ✅ متصل', ru: 'Подключение Business: ✅ есть', es: 'Conexión Business: ✅ conectada' },
  status_conn_off: { en: 'Business connection: ❌ disabled', fa: 'اتصال بیزینس: ❌ غیرفعال', ar: 'اتصال Business: ❌ معطّل', ru: 'Подключение Business: ❌ отключено', es: 'Conexión Business: ❌ desactivada' },
  status_no_reply: {
    en: '⚠️ "Reply to messages" permission is off', fa: '⚠️ اجازهٔ «Reply to messages» خاموشه',
    ar: '⚠️ إذن "Reply to messages" متوقف', ru: '⚠️ Разрешение «Reply to messages» выключено', es: '⚠️ El permiso "Reply to messages" está desactivado',
  },
  status_auto_on: { en: 'Auto-replies: ▶️ on', fa: 'پاسخ خودکار: ▶️ روشن', ar: 'الردود التلقائية: ▶️ مُفعّلة', ru: 'Автоответы: ▶️ вкл', es: 'Respuestas automáticas: ▶️ activadas' },
  status_auto_off: { en: 'Auto-replies: ⏸ paused', fa: 'پاسخ خودکار: ⏸ متوقف', ar: 'الردود التلقائية: ⏸ متوقفة', ru: 'Автоответы: ⏸ на паузе', es: 'Respuestas automáticas: ⏸ en pausa' },
  status_window: { en: ' (only {from}–{to})', fa: ' (فقط {from}–{to})', ar: ' (فقط {from}–{to})', ru: ' (только {from}–{to})', es: ' (solo {from}–{to})' },
  status_creds_own: { en: 'AI credentials: ✅ your own', fa: 'کلید هوش مصنوعی: ✅ مال خودت', ar: 'بيانات الذكاء الاصطناعي: ✅ خاصة بك', ru: 'Ключ ИИ: ✅ свой', es: 'Credenciales de IA: ✅ propias' },
  status_creds_shared: { en: 'AI credentials: ✅ shared', fa: 'کلید هوش مصنوعی: ✅ اشتراکی', ar: 'بيانات الذكاء الاصطناعي: ✅ مشتركة', ru: 'Ключ ИИ: ✅ общий', es: 'Credenciales de IA: ✅ compartidas' },
  status_creds_none: {
    en: 'AI credentials: ❌ missing — tap 🔑 Connect AI', fa: 'کلید هوش مصنوعی: ❌ نداری — «🔑 اتصال هوش مصنوعی» رو بزن',
    ar: 'بيانات الذكاء الاصطناعي: ❌ مفقودة — اضغط «🔑 ربط الذكاء الاصطناعي»', ru: 'Ключ ИИ: ❌ нет — нажми «🔑 Подключить ИИ»',
    es: 'Credenciales de IA: ❌ faltan — pulsa «🔑 Conectar IA»',
  },
  status_style: { en: 'Mood: {mood} · Emoji: {emoji} · Temp: {temp}', fa: 'حال‌وهوا: {mood} · ایموجی: {emoji} · دما: {temp}', ar: 'المزاج: {mood} · الإيموجي: {emoji} · الحرارة: {temp}', ru: 'Настроение: {mood} · Эмодзи: {emoji} · Темп.: {temp}', es: 'Tono: {mood} · Emojis: {emoji} · Temp.: {temp}' },
  status_today: { en: 'Replies today: {n}', fa: 'جواب‌های امروز: {n}', ar: 'ردود اليوم: {n}', ru: 'Ответов сегодня: {n}', es: 'Respuestas hoy: {n}' },

  // --- 🪞 Teach my style ----------------------------------------------------------
  learn: {
    en: `🪞 Teach me to write like you

I have {n} samples of your writing.{hint}

Ways to teach me:
1. Just chat as usual. When "Learn my style" is on, I save what you type in your business chats.
2. Forward me messages you wrote, in bulk if you like.
3. Paste examples in the panel → Speak as me.

Then tap "Analyze my style" in the panel to turn the samples into a style guide you can edit.`,
    fa: `🪞 یادم بده مثل خودت بنویسم

{n} نمونه از نوشته‌هات دارم.{hint}

راه‌های یاد دادن:
۱. مثل همیشه چت کن. وقتی «یادگیری سبکم» روشنه، چیزهایی که توی چت‌های بیزینس می‌نویسی رو ذخیره می‌کنم.
۲. پیام‌هایی که خودت نوشتی رو برام فوروارد کن، حتی دسته‌جمعی.
۳. توی پنل → «به‌جای من» نمونه بچسبون.

بعد توی پنل «تحلیل سبک من» رو بزن تا نمونه‌ها بشن یه راهنمای سبک که می‌تونی ویرایشش کنی.`,
    ar: `🪞 علّمني أن أكتب مثلك

لدي {n} عينة من كتاباتك.{hint}

طرق التعليم:
1. دردش كالمعتاد. عندما يكون «تعلّم أسلوبي» مُفعّلًا أحفظ ما تكتبه في محادثات Business.
2. حوّل إليّ رسائل كتبتها بنفسك، دفعة واحدة إن شئت.
3. الصق أمثلة في اللوحة → بصوتي أنا.

ثم اضغط «حلّل أسلوبي» في اللوحة لتحويل العينات إلى دليل أسلوب يمكنك تعديله.`,
    ru: `🪞 Научи меня писать как ты

У меня {n} образцов твоих сообщений.{hint}

Как научить:
1. Просто переписывайся как обычно. Когда «Учить мой стиль» включено, я сохраняю то, что ты пишешь в бизнес-чатах.
2. Пересылай мне свои сообщения, можно пачкой.
3. Вставь примеры в панели → «От моего имени».

Потом нажми «Анализ стиля» в панели, чтобы превратить образцы в редактируемое описание стиля.`,
    es: `🪞 Enséñame a escribir como tú

Tengo {n} muestras de tu escritura.{hint}

Formas de enseñarme:
1. Chatea como siempre. Con «Aprender mi estilo» activado, guardo lo que escribes en tus chats de empresa.
2. Reenvíame mensajes que escribiste tú, en bloque si quieres.
3. Pega ejemplos en el panel → Como yo.

Luego pulsa «Analizar mi estilo» en el panel para convertir las muestras en una guía de estilo editable.`,
  },
  learn_hint: {
    en: '\n\nRight now I answer as your assistant. Switch Voice to "🪞 Speak as me" in ⚙️ Settings so I write as you.',
    fa: '\n\nالان به‌عنوان دستیارت جواب می‌دم. صدا رو در ⚙️ تنظیمات روی «🪞 به‌جای من» بذار تا مثل خودت بنویسم.',
    ar: '\n\nأرد الآن بصفتي مساعدك. غيّر الصوت إلى «🪞 بصوتي أنا» في ⚙️ الإعدادات لأكتب مثلك.',
    ru: '\n\nСейчас я отвечаю как твой ассистент. Переключи голос на «🪞 От моего имени» в ⚙️ Настройках, чтобы я писал как ты.',
    es: '\n\nAhora respondo como tu asistente. Cambia la voz a «🪞 Como yo» en ⚙️ Ajustes para que escriba como tú.',
  },
  forward_not_mine: {
    en: 'Only forward messages that you wrote yourself. I learn your style from those.',
    fa: 'فقط پیام‌هایی رو فوروارد کن که خودت نوشتی. سبکت رو از اون‌ها یاد می‌گیرم.',
    ar: 'حوّل فقط الرسائل التي كتبتها بنفسك. أتعلم أسلوبك منها.',
    ru: 'Пересылай только сообщения, которые написал(а) сам(а). По ним я учу твой стиль.',
    es: 'Reenvía solo mensajes que hayas escrito tú. De ellos aprendo tu estilo.',
  },
  learned: {
    en: '📝 Learned ({n} samples). Keep forwarding, or tap 🪞 Teach my style for options.',
    fa: '📝 یاد گرفتم ({n} نمونه). باز هم فوروارد کن، یا برای گزینه‌ها «🪞 یاد دادن سبکم» رو بزن.',
    ar: '📝 تعلّمت ({n} عينة). واصل التحويل، أو اضغط «🪞 تعليم أسلوبي» للخيارات.',
    ru: '📝 Запомнил ({n} образцов). Пересылай ещё или нажми «🪞 Мой стиль» для вариантов.',
    es: '📝 Aprendido ({n} muestras). Sigue reenviando o pulsa «🪞 Enseñar mi estilo» para más opciones.',
  },
  learn_skipped: {
    en: 'That one is too short or not text, skipped.', fa: 'این یکی خیلی کوتاهه یا متن نیست، رد شد.',
    ar: 'هذه قصيرة جدًا أو ليست نصًا، تم تخطيها.', ru: 'Это слишком коротко или не текст — пропущено.', es: 'Ese es demasiado corto o no es texto; omitido.',
  },
  preview: { en: '🧪 Preview:\n\n{text}', fa: '🧪 پیش‌نمایش:\n\n{text}', ar: '🧪 معاينة:\n\n{text}', ru: '🧪 Предпросмотр:\n\n{text}', es: '🧪 Vista previa:\n\n{text}' },

  // --- 🔑 setup wizard ---------------------------------------------------------------
  setup_step1: {
    en: `🔑 Connect Cloudflare Workers AI (free) — step 1 of 2

1. Open the Workers AI dashboard below. Sign up for free if you have no account; no card is needed.
2. Click "Use REST API".
3. Copy your Account ID and paste it here.

Tip: you can also paste any dashboard link. I'll pick the ID out of it.`,
    fa: `🔑 اتصال Cloudflare Workers AI (رایگان) — مرحلهٔ ۱ از ۲

۱. داشبورد Workers AI رو از دکمهٔ زیر باز کن. اگه حساب نداری رایگان ثبت‌نام کن؛ کارت لازم نیست.
۲. روی «Use REST API» بزن.
۳. Account ID رو کپی کن و اینجا بچسبون.

نکته: هر لینکی از داشبورد رو هم می‌تونی بچسبونی؛ خودم شناسه رو ازش درمیارم.`,
    ar: `🔑 ربط Cloudflare Workers AI (مجانًا) — الخطوة 1 من 2

1. افتح لوحة Workers AI أدناه. سجّل مجانًا إن لم يكن لديك حساب؛ لا حاجة لبطاقة.
2. اضغط "Use REST API".
3. انسخ Account ID والصقه هنا.

نصيحة: يمكنك أيضًا لصق أي رابط من اللوحة وسأستخرج المعرّف منه.`,
    ru: `🔑 Подключение Cloudflare Workers AI (бесплатно) — шаг 1 из 2

1. Открой панель Workers AI по кнопке ниже. Если аккаунта нет, зарегистрируйся бесплатно — карта не нужна.
2. Нажми «Use REST API».
3. Скопируй Account ID и вставь сюда.

Совет: можно вставить любую ссылку из панели — я сам вытащу из неё ID.`,
    es: `🔑 Conectar Cloudflare Workers AI (gratis) — paso 1 de 2

1. Abre el panel de Workers AI con el botón de abajo. Regístrate gratis si no tienes cuenta; no hace falta tarjeta.
2. Haz clic en "Use REST API".
3. Copia tu Account ID y pégalo aquí.

Consejo: también puedes pegar cualquier enlace del panel; sacaré el ID de ahí.`,
  },
  setup_step2: {
    en: `✅ Account ID saved — step 2 of 2

1. On the same "Use REST API" page, click "Create a Workers AI API Token".
2. Review it and click "Create API Token".
3. Copy the token and paste it here. Cloudflare only shows it once.

I'll delete your message right away and test the token.`,
    fa: `✅ Account ID ذخیره شد — مرحلهٔ ۲ از ۲

۱. توی همون صفحهٔ «Use REST API» روی «Create a Workers AI API Token» بزن.
۲. بررسیش کن و «Create API Token» رو بزن.
۳. توکن رو کپی کن و اینجا بچسبون. Cloudflare فقط یک بار نشونش می‌ده.

پیامت رو فوراً پاک می‌کنم و توکن رو امتحان می‌کنم.`,
    ar: `✅ تم حفظ Account ID — الخطوة 2 من 2

1. في صفحة "Use REST API" نفسها، اضغط "Create a Workers AI API Token".
2. راجعه واضغط "Create API Token".
3. انسخ الرمز والصقه هنا. Cloudflare يعرضه مرة واحدة فقط.

سأحذف رسالتك فورًا وأختبر الرمز.`,
    ru: `✅ Account ID сохранён — шаг 2 из 2

1. На той же странице «Use REST API» нажми «Create a Workers AI API Token».
2. Проверь и нажми «Create API Token».
3. Скопируй токен и вставь сюда. Cloudflare показывает его только один раз.

Я сразу удалю твоё сообщение и проверю токен.`,
    es: `✅ Account ID guardado — paso 2 de 2

1. En la misma página "Use REST API", haz clic en "Create a Workers AI API Token".
2. Revísalo y haz clic en "Create API Token".
3. Copia el token y pégalo aquí. Cloudflare solo lo muestra una vez.

Borraré tu mensaje al instante y probaré el token.`,
  },
  btn_dashboard: { en: '🌐 Open Workers AI dashboard', fa: '🌐 باز کردن داشبورد Workers AI', ar: '🌐 فتح لوحة Workers AI', ru: '🌐 Открыть панель Workers AI', es: '🌐 Abrir panel de Workers AI' },
  btn_signup: { en: '🆕 Create a free account', fa: '🆕 ساخت حساب رایگان', ar: '🆕 إنشاء حساب مجاني', ru: '🆕 Создать бесплатный аккаунт', es: '🆕 Crear una cuenta gratis' },
  btn_all_tokens: { en: '🗝 All API tokens (alternative)', fa: '🗝 همهٔ توکن‌ها (روش دیگه)', ar: '🗝 كل رموز API (بديل)', ru: '🗝 Все API-токены (другой способ)', es: '🗝 Todos los tokens de API (alternativa)' },
  btn_change_account: { en: '↩️ Change Account ID', fa: '↩️ تغییر Account ID', ar: '↩️ تغيير Account ID', ru: '↩️ Сменить Account ID', es: '↩️ Cambiar Account ID' },
  btn_cancel: { en: '✖️ Cancel', fa: '✖️ لغو', ar: '✖️ إلغاء', ru: '✖️ Отмена', es: '✖️ Cancelar' },
  setup_bad_account: {
    en: "That doesn't look like an Account ID. It is 32 characters long, using only 0–9 and a–f. Try again:",
    fa: 'این شبیه Account ID نیست. ۳۲ کاراکتره و فقط ۰–۹ و a–f داره. دوباره امتحان کن:',
    ar: 'هذا لا يبدو كـ Account ID. طوله 32 حرفًا من 0–9 و a–f فقط. حاول مجددًا:',
    ru: 'Это не похоже на Account ID: в нём 32 символа, только 0–9 и a–f. Попробуй ещё раз:',
    es: 'Eso no parece un Account ID. Tiene 32 caracteres, solo 0–9 y a–f. Inténtalo de nuevo:',
  },
  setup_bad_token: {
    en: 'That doesn\'t look like an API token. A token is about 40 letters, digits, "-" or "_", with no spaces. Paste it again:',
    fa: 'این شبیه API token نیست. توکن حدود ۴۰ حرف، عدد، «-» یا «_» بدون فاصله‌ست. دوباره بچسبون:',
    ar: 'هذا لا يبدو كرمز API. الرمز نحو 40 حرفًا ورقمًا و"-" أو "_" دون مسافات. الصقه مجددًا:',
    ru: 'Это не похоже на API-токен: около 40 букв, цифр, «-» или «_», без пробелов. Вставь ещё раз:',
    es: 'Eso no parece un token de API. Un token tiene unas 40 letras, dígitos, "-" o "_", sin espacios. Pégalo de nuevo:',
  },
  setup_testing: { en: '⏳ Testing your credentials…', fa: '⏳ دارم کلیدت رو امتحان می‌کنم…', ar: '⏳ جارٍ اختبار بياناتك…', ru: '⏳ Проверяю ключ…', es: '⏳ Probando tus credenciales…' },
  setup_rejected: {
    en: '❌ Cloudflare rejected these credentials ({error}).\n\nCheck that the token has the "Workers AI: Read" permission and belongs to the same account. Paste the token again, or change the Account ID.',
    fa: '❌ Cloudflare این کلید رو قبول نکرد ({error}).\n\nمطمئن شو توکن اجازهٔ «Workers AI: Read» داره و مال همون حسابه. توکن رو دوباره بچسبون یا Account ID رو عوض کن.',
    ar: '❌ رفض Cloudflare هذه البيانات ({error}).\n\nتأكد أن للرمز صلاحية "Workers AI: Read" وأنه لنفس الحساب. الصق الرمز مجددًا أو غيّر Account ID.',
    ru: '❌ Cloudflare отклонил эти данные ({error}).\n\nПроверь, что у токена есть право «Workers AI: Read» и он от того же аккаунта. Вставь токен ещё раз или смени Account ID.',
    es: '❌ Cloudflare rechazó estas credenciales ({error}).\n\nComprueba que el token tenga el permiso "Workers AI: Read" y sea de la misma cuenta. Pega el token de nuevo o cambia el Account ID.',
  },
  setup_quota_note: {
    en: "\n\nℹ️ Today's free AI quota is already used up. Replies start after 00:00 UTC.",
    fa: '\n\nℹ️ سهمیهٔ رایگان امروز تموم شده. جواب‌ها از بعد از ۰۰:۰۰ UTC شروع می‌شن.',
    ar: '\n\nℹ️ حصة الذكاء الاصطناعي المجانية لليوم مستنفدة. تبدأ الردود بعد 00:00 UTC.',
    ru: '\n\nℹ️ Бесплатная квота ИИ на сегодня уже израсходована. Ответы начнутся после 00:00 UTC.',
    es: '\n\nℹ️ La cuota gratuita de IA de hoy ya se agotó. Las respuestas empiezan después de las 00:00 UTC.',
  },
  setup_network_note: {
    en: "\n\nℹ️ I couldn't reach Cloudflare to test the token, but I saved it anyway.",
    fa: '\n\nℹ️ نتونستم برای امتحان به Cloudflare وصل بشم، ولی توکن رو ذخیره کردم.',
    ar: '\n\nℹ️ لم أتمكن من الوصول إلى Cloudflare لاختبار الرمز، لكنني حفظته.',
    ru: '\n\nℹ️ Не удалось связаться с Cloudflare для проверки, но токен я сохранил.',
    es: '\n\nℹ️ No pude contactar con Cloudflare para probar el token, pero lo guardé igualmente.',
  },
  setup_done: {
    en: '🎉 Cloudflare Workers AI connected!{note}\n\nSend me any message to preview a reply, or tune mood, emoji and more in ⚙️ Settings.',
    fa: '🎉 Cloudflare Workers AI وصل شد!{note}\n\nهر پیامی بفرست تا پیش‌نمایش جواب رو ببینی، یا حال‌وهوا، ایموجی و بقیه رو در ⚙️ تنظیمات عوض کن.',
    ar: '🎉 تم ربط Cloudflare Workers AI!{note}\n\nأرسل أي رسالة لمعاينة رد، أو اضبط المزاج والإيموجي وغيرها في ⚙️ الإعدادات.',
    ru: '🎉 Cloudflare Workers AI подключён!{note}\n\nОтправь любое сообщение для предпросмотра ответа или настрой настроение, эмодзи и прочее в ⚙️ Настройках.',
    es: '🎉 ¡Cloudflare Workers AI conectado!{note}\n\nEnvíame cualquier mensaje para ver una respuesta de prueba, o ajusta tono, emojis y más en ⚙️ Ajustes.',
  },
  setup_cancelled: {
    en: 'Setup cancelled.', fa: 'راه‌اندازی لغو شد.', ar: 'تم إلغاء الإعداد.', ru: 'Настройка отменена.', es: 'Configuración cancelada.',
  },

  // --- business connection ----------------------------------------------------------
  bc_disconnected: {
    en: '👋 Disconnected. I will no longer answer your chats.', fa: '👋 قطع شد. دیگه به چت‌هات جواب نمی‌دم.',
    ar: '👋 تم قطع الاتصال. لن أرد على محادثاتك بعد الآن.', ru: '👋 Отключено. Я больше не отвечаю на твои чаты.',
    es: '👋 Desconectado. Ya no responderé tus chats.',
  },
  bc_connected: {
    en: '✅ Connected as your Telegram Business secretary.', fa: '✅ به‌عنوان منشی تلگرام بیزینس وصل شدم.',
    ar: '✅ تم الاتصال كسكرتير Telegram Business الخاص بك.', ru: '✅ Подключён как твой секретарь Telegram Business.',
    es: '✅ Conectado como tu secretario de Telegram Business.',
  },
  bc_no_reply: {
    en: '⚠️ I don\'t have permission to reply. Enable "Reply to messages" in Settings → Telegram Business → Chatbots.',
    fa: '⚠️ اجازهٔ جواب دادن ندارم. «Reply to messages» رو در تنظیمات → Telegram Business → Chatbots روشن کن.',
    ar: '⚠️ ليس لدي إذن بالرد. فعّل "Reply to messages" في الإعدادات → Telegram Business → Chatbots.',
    ru: '⚠️ У меня нет права отвечать. Включи «Reply to messages» в Настройки → Telegram Business → Chatbots.',
    es: '⚠️ No tengo permiso para responder. Activa "Reply to messages" en Ajustes → Telegram Business → Chatbots.',
  },
  bc_need_key: {
    en: '🔑 One more step: connect a free Cloudflare AI key so I can write replies.',
    fa: '🔑 یه قدم دیگه: یه کلید رایگان Cloudflare AI وصل کن تا بتونم جواب بنویسم.',
    ar: '🔑 خطوة أخرى: اربط مفتاح Cloudflare AI مجانيًا لأتمكن من كتابة الردود.',
    ru: '🔑 Ещё шаг: подключи бесплатный ключ Cloudflare AI, чтобы я мог писать ответы.',
    es: '🔑 Un paso más: conecta una clave gratuita de Cloudflare AI para que pueda escribir respuestas.',
  },
  bc_tune: {
    en: 'Tune my mood, emoji style, creativity and more in ⚙️ Settings or the panel.',
    fa: 'حال‌وهوا، سبک ایموجی، خلاقیت و بقیه رو در ⚙️ تنظیمات یا پنل عوض کن.',
    ar: 'اضبط مزاجي ونمط الإيموجي والإبداع وغيرها في ⚙️ الإعدادات أو اللوحة.',
    ru: 'Настрой моё настроение, эмодзи, креативность и прочее в ⚙️ Настройках или панели.',
    es: 'Ajusta mi tono, emojis, creatividad y más en ⚙️ Ajustes o en el panel.',
  },
  no_creds_notice: {
    en: 'I received a message but have no Cloudflare AI credentials yet. Tap below to connect them.',
    fa: 'یه پیام اومد ولی هنوز کلید Cloudflare AI ندارم. برای اتصال دکمهٔ زیر رو بزن.',
    ar: 'وصلتني رسالة لكن لا توجد بيانات Cloudflare AI بعد. اضغط أدناه لربطها.',
    ru: 'Пришло сообщение, но ключа Cloudflare AI ещё нет. Нажми ниже, чтобы подключить.',
    es: 'Recibí un mensaje pero aún no tengo credenciales de Cloudflare AI. Pulsa abajo para conectarlas.',
  },

  // --- relayed contact media -------------------------------------------------------
  btn_reply: { en: '✍️ Reply', fa: '✍️ جواب', ar: '✍️ رد', ru: '✍️ Ответить', es: '✍️ Responder' },
  btn_let_ai: { en: '🤖 Let AI answer', fa: '🤖 هوش مصنوعی جواب بده', ar: '🤖 دع الذكاء الاصطناعي يرد', ru: '🤖 Пусть ответит ИИ', es: '🤖 Que responda la IA' },
  btn_ignore: { en: '🙈 Ignore', fa: '🙈 نادیده بگیر', ar: '🙈 تجاهل', ru: '🙈 Игнорировать', es: '🙈 Ignorar' },
  relay_header: {
    en: "📩 {who} sent: {kind}.\n\nReply to this message with anything (text, photo, voice…) and I'll send it to them from your account.",
    fa: '📩 {who} فرستاد: {kind}.\n\nبه همین پیام با هر چیزی (متن، عکس، ویس…) ریپلای کن تا از طرف حسابت براش بفرستم.',
    ar: '📩 أرسل {who}: {kind}.\n\nرُد على هذه الرسالة بأي شيء (نص، صورة، صوت…) وسأرسله إليه من حسابك.',
    ru: '📩 {who} прислал(а): {kind}.\n\nОтветь на это сообщение чем угодно (текст, фото, голосовое…) — я отправлю это от твоего аккаунта.',
    es: '📩 {who} envió: {kind}.\n\nResponde a este mensaje con lo que sea (texto, foto, voz…) y se lo enviaré desde tu cuenta.',
  },
  answer_prompt: { en: '✍️ Your answer to {name}:', fa: '✍️ جوابت به {name}:', ar: '✍️ ردك على {name}:', ru: '✍️ Твой ответ для {name}:', es: '✍️ Tu respuesta para {name}:' },
  answer_placeholder: { en: 'Type or send anything…', fa: 'بنویس یا هر چیزی بفرست…', ar: 'اكتب أو أرسل أي شيء…', ru: 'Напиши или отправь что угодно…', es: 'Escribe o envía lo que sea…' },
  them: { en: 'them', fa: 'مخاطب', ar: 'جهة الاتصال', ru: 'контакта', es: 'tu contacto' },
  cant_send: { en: "❌ Couldn't send: {why}", fa: '❌ ارسال نشد: {why}', ar: '❌ تعذّر الإرسال: {why}', ru: '❌ Не удалось отправить: {why}', es: '❌ No se pudo enviar: {why}' },
  cant_send_24h: {
    en: 'Telegram only allows replies in chats with a message from them in the last 24 hours.',
    fa: 'تلگرام فقط در چت‌هایی اجازهٔ جواب می‌ده که طرف تو ۲۴ ساعت گذشته پیام داده باشه.',
    ar: 'يسمح تيليجرام بالرد فقط في المحادثات التي وصلت منها رسالة خلال آخر 24 ساعة.',
    ru: 'Telegram разрешает отвечать только в чатах, где собеседник писал за последние 24 часа.',
    es: 'Telegram solo permite responder en chats con un mensaje suyo en las últimas 24 horas.',
  },
  sent_to: { en: '✅ Sent to {name}.', fa: '✅ برای {name} فرستاده شد.', ar: '✅ أُرسل إلى {name}.', ru: '✅ Отправлено: {name}.', es: '✅ Enviado a {name}.' },
  relay_answered: { en: '✅ Answered', fa: '✅ جواب داده شد', ar: '✅ تم الرد', ru: '✅ Отвечено', es: '✅ Respondido' },
  relay_ai: { en: '🤖 AI answered', fa: '🤖 هوش مصنوعی جواب داد', ar: '🤖 ردّ الذكاء الاصطناعي', ru: '🤖 Ответил ИИ', es: '🤖 Respondió la IA' },
  relay_ignored: { en: '🙈 Ignored', fa: '🙈 نادیده گرفته شد', ar: '🙈 تم التجاهل', ru: '🙈 Проигнорировано', es: '🙈 Ignorado' },
  too_old: { en: 'This message is too old', fa: 'این پیام خیلی قدیمیه', ar: 'هذه الرسالة قديمة جدًا', ru: 'Это сообщение слишком старое', es: 'Este mensaje es demasiado antiguo' },
  not_active: { en: 'Business connection is not active', fa: 'اتصال بیزینس فعال نیست', ar: 'اتصال Business غير نشط', ru: 'Подключение Business неактивно', es: 'La conexión Business no está activa' },
  writing: { en: 'Writing a reply…', fa: 'دارم جواب می‌نویسم…', ar: 'أكتب ردًا…', ru: 'Пишу ответ…', es: 'Escribiendo una respuesta…' },
  kind_photo: { en: 'a photo', fa: 'عکس', ar: 'صورة', ru: 'фото', es: 'una foto' },
  kind_animation: { en: 'a GIF', fa: 'گیف', ar: 'صورة متحركة', ru: 'GIF', es: 'un GIF' },
  kind_video: { en: 'a video', fa: 'ویدیو', ar: 'فيديو', ru: 'видео', es: 'un vídeo' },
  kind_voice: { en: 'a voice message', fa: 'ویس', ar: 'رسالة صوتية', ru: 'голосовое', es: 'una nota de voz' },
  kind_video_note: { en: 'a video message', fa: 'ویدیو مسیج', ar: 'رسالة فيديو', ru: 'видеосообщение', es: 'un videomensaje' },
  kind_audio: { en: 'audio', fa: 'صوت', ar: 'ملف صوتي', ru: 'аудио', es: 'un audio' },
  kind_document: { en: 'a file', fa: 'فایل', ar: 'ملف', ru: 'файл', es: 'un archivo' },
  kind_sticker: { en: 'a sticker', fa: 'استیکر', ar: 'ملصق', ru: 'стикер', es: 'un sticker' },
  kind_venue: { en: 'a venue', fa: 'مکان', ar: 'مكان', ru: 'место', es: 'un lugar' },
  kind_location: { en: 'a location', fa: 'موقعیت', ar: 'موقع', ru: 'геопозицию', es: 'una ubicación' },
  kind_contact: { en: 'a contact card', fa: 'کارت مخاطب', ar: 'بطاقة جهة اتصال', ru: 'контакт', es: 'un contacto' },
  kind_dice: { en: 'a dice', fa: 'تاس', ar: 'نرد', ru: 'кубик', es: 'un dado' },
  kind_poll: { en: 'a poll', fa: 'نظرسنجی', ar: 'استطلاع', ru: 'опрос', es: 'una encuesta' },
  kind_story: { en: 'a story', fa: 'استوری', ar: 'قصة', ru: 'историю', es: 'una historia' },
  kind_unknown: { en: 'a message', fa: 'پیام', ar: 'رسالة', ru: 'сообщение', es: 'un mensaje' },

  // --- AI errors ------------------------------------------------------------------------
  err_nocreds: {
    en: "No Cloudflare AI credentials yet. Tap 🔑 Connect AI and I'll walk you through it (free, about 2 minutes).",
    fa: 'هنوز کلید Cloudflare AI نداری. «🔑 اتصال هوش مصنوعی» رو بزن تا قدم‌به‌قدم راهنماییت کنم (رایگان، حدود ۲ دقیقه).',
    ar: 'لا توجد بيانات Cloudflare AI بعد. اضغط «🔑 ربط الذكاء الاصطناعي» وسأرشدك (مجانًا، نحو دقيقتين).',
    ru: 'Ключа Cloudflare AI пока нет. Нажми «🔑 Подключить ИИ» — проведу по шагам (бесплатно, около 2 минут).',
    es: 'Aún no hay credenciales de Cloudflare AI. Pulsa «🔑 Conectar IA» y te guío (gratis, unos 2 minutos).',
  },
  err_auth: {
    en: 'Cloudflare rejected the request ({error}). If other models work, this model may be unavailable on your account; otherwise tap 🔑 Connect AI to re-enter the key (it needs "Workers AI: Read").',
    fa: 'Cloudflare درخواست رو رد کرد ({error}). اگه مدل‌های دیگه کار می‌کنن، شاید این مدل روی حسابت در دسترس نیست؛ وگرنه «🔑 اتصال هوش مصنوعی» رو بزن و کلید رو دوباره وارد کن (اجازهٔ «Workers AI: Read» لازمه).',
    ar: 'رفض Cloudflare الطلب ({error}). إن كانت نماذج أخرى تعمل فقد لا يتوفر هذا النموذج لحسابك؛ وإلا فاضغط «🔑 ربط الذكاء الاصطناعي» لإعادة إدخال المفتاح (يحتاج "Workers AI: Read").',
    ru: 'Cloudflare отклонил запрос ({error}). Если другие модели работают, эта может быть недоступна для аккаунта; иначе нажми «🔑 Подключить ИИ» и введи ключ заново (нужно право «Workers AI: Read»).',
    es: 'Cloudflare rechazó la solicitud ({error}). Si otros modelos funcionan, este puede no estar disponible en tu cuenta; si no, pulsa «🔑 Conectar IA» para volver a introducir la clave (necesita "Workers AI: Read").',
  },
  err_quota: {
    en: 'The Cloudflare Workers AI free daily limit (10,000 neurons) is used up. Replies resume when it resets at 00:00 UTC — or pick a cheaper model in the panel.',
    fa: 'سقف رایگان روزانهٔ Cloudflare Workers AI (۱۰٬۰۰۰ نورون) تموم شده. جواب‌ها با ریست شدنش در ۰۰:۰۰ UTC ادامه پیدا می‌کنن — یا توی پنل یه مدل ارزون‌تر انتخاب کن.',
    ar: 'استُنفد الحد اليومي المجاني لـ Cloudflare Workers AI (10,000 نيورون). تُستأنف الردود عند إعادة الضبط 00:00 UTC — أو اختر نموذجًا أرخص في اللوحة.',
    ru: 'Бесплатный дневной лимит Cloudflare Workers AI (10 000 нейронов) исчерпан. Ответы возобновятся после сброса в 00:00 UTC — или выбери модель подешевле в панели.',
    es: 'Se agotó el límite diario gratuito de Cloudflare Workers AI (10.000 neuronas). Las respuestas vuelven al reiniciarse a las 00:00 UTC, o elige un modelo más barato en el panel.',
  },
  err_few_samples: {
    en: 'I need at least 5 samples of your writing first. Write in your chats, forward me your messages, or paste examples in the panel.',
    fa: 'اول حداقل ۵ نمونه از نوشته‌هات لازم دارم. توی چت‌هات بنویس، پیام‌هات رو فوروارد کن یا توی پنل نمونه بچسبون.',
    ar: 'أحتاج أولًا 5 عينات على الأقل من كتاباتك. اكتب في محادثاتك أو حوّل إليّ رسائلك أو الصق أمثلة في اللوحة.',
    ru: 'Сначала нужно минимум 5 образцов твоих сообщений. Пиши в чатах, пересылай мне свои сообщения или вставь примеры в панели.',
    es: 'Primero necesito al menos 5 muestras de tu escritura. Escribe en tus chats, reenvíame tus mensajes o pega ejemplos en el panel.',
  },
  err_network: {
    en: 'Could not reach Cloudflare. It will retry on the next message.', fa: 'به Cloudflare وصل نشدم. با پیام بعدی دوباره امتحان می‌کنم.',
    ar: 'تعذّر الوصول إلى Cloudflare. سأحاول مجددًا مع الرسالة التالية.', ru: 'Не удалось связаться с Cloudflare. Попробую снова со следующим сообщением.',
    es: 'No se pudo contactar con Cloudflare. Lo reintentaré con el próximo mensaje.',
  },
  err_model: { en: 'Cloudflare AI error: {error}', fa: 'خطای Cloudflare AI: {error}', ar: 'خطأ Cloudflare AI: {error}', ru: 'Ошибка Cloudflare AI: {error}', es: 'Error de Cloudflare AI: {error}' },
  err_other: { en: 'AI error: {error}', fa: 'خطای هوش مصنوعی: {error}', ar: 'خطأ الذكاء الاصطناعي: {error}', ru: 'Ошибка ИИ: {error}', es: 'Error de IA: {error}' },
};

export const t = makeT(strings);
