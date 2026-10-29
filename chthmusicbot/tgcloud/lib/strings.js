// User-facing strings, translated into the supported locales. Strings shown
// in HTML messages (home, accounts, syncs, the wizard, finds, the player card)
// must not contain a bare < > or &.
import { makeT } from './i18n.js';

const strings = {
  // --- home, about, language ---------------------------------------------------
  welcome: {
    en: '👋 Hi {name}!', fa: '👋 سلام {name}!', ar: '👋 مرحبًا {name}!', ru: '👋 Привет, {name}!', es: '👋 ¡Hola, {name}!',
  },
  home: {
    en: 'I sync your music playlists with Telegram chats.\n\n🎧 <b>Accounts</b>: connect Spotify, YouTube Music or Apple Music.\n➕ <b>New sync</b>: link a playlist to a group, forum or channel.\n🔎 <b>Find music</b>: send a song name or link.\n\nIn groups, /player shares your Spotify queue.',
    fa: 'پلی‌لیست‌های موسیقی‌ت رو با چت‌های تلگرام همگام می‌کنم.\n\n🎧 <b>حساب‌ها</b>: اسپاتیفای، یوتیوب موزیک یا اپل موزیک رو وصل کن.\n➕ <b>همگام‌سازی جدید</b>: یه پلی‌لیست رو به گروه، انجمن یا کانال وصل کن.\n🔎 <b>پیدا کردن آهنگ</b>: اسم یا لینک یه آهنگ رو بفرست.\n\nتوی گروه‌ها، /player صف اسپاتیفای‌ت رو به اشتراک می‌ذاره.',
    ar: 'أزامن قوائم الموسيقى مع دردشات تيليجرام.\n\n🎧 <b>الحسابات</b>: اربط Spotify أو YouTube Music أو Apple Music.\n➕ <b>مزامنة جديدة</b>: اربط قائمة تشغيل بمجموعة أو منتدى أو قناة.\n🔎 <b>ابحث عن أغنية</b>: أرسل اسم أغنية أو رابطها.\n\nفي المجموعات، يشارك /player قائمة انتظار Spotify الخاصة بك.',
    ru: 'Синхронизирую музыкальные плейлисты с чатами Telegram.\n\n🎧 <b>Аккаунты</b>: подключи Spotify, YouTube Music или Apple Music.\n➕ <b>Новая синхронизация</b>: привяжи плейлист к группе, форуму или каналу.\n🔎 <b>Найти музыку</b>: пришли название или ссылку на песню.\n\nВ группах /player делится очередью твоего Spotify.',
    es: 'Sincronizo tus listas de música con chats de Telegram.\n\n🎧 <b>Cuentas</b>: conecta Spotify, YouTube Music o Apple Music.\n➕ <b>Nueva sincronización</b>: vincula una lista a un grupo, foro o canal.\n🔎 <b>Buscar música</b>: envía el nombre o el enlace de una canción.\n\nEn grupos, /player comparte tu cola de Spotify.',
  },
  home_no_accounts: {
    en: 'No account connected yet: start with 🎧 Accounts.',
    fa: 'هنوز هیچ حسابی وصل نشده: از 🎧 حساب‌ها شروع کن.',
    ar: 'لا يوجد حساب مرتبط بعد: ابدأ من 🎧 الحسابات.',
    ru: 'Пока нет подключённых аккаунтов: начни с 🎧 Аккаунты.',
    es: 'Aún no hay cuentas conectadas: empieza por 🎧 Cuentas.',
  },
  about: {
    en: [
      'I keep music playlists and Telegram chats in sync.',
      '',
      '💬 → 🎧 Tracks posted in a group, forum topic or channel are added to its playlist: Spotify, YouTube, Apple Music, Deezer, SoundCloud, Tidal links and audio files.',
      '🎧 → 💬 Tap 🔄 Sync now and the playlist\'s new tracks are posted in the chat.',
      '🎶 /player in a group shares your Spotify: everyone can queue songs.',
      '🔎 Find any song by name, and get its audio from @chethoberbot.',
    ].join('\n'),
    fa: [
      'پلی‌لیست‌های موسیقی و چت‌های تلگرام رو با هم همگام نگه می‌دارم.',
      '',
      '💬 → 🎧 آهنگ‌هایی که توی گروه، موضوع انجمن یا کانال فرستاده می‌شن به پلی‌لیستش اضافه می‌شن: لینک اسپاتیفای، یوتیوب، اپل موزیک، دیزر، ساندکلاد، تایدال و فایل صوتی.',
      '🎧 → 💬 دکمهٔ 🔄 همگام‌سازی رو بزن تا آهنگ‌های جدید پلی‌لیست توی چت پست بشن.',
      '🎶 /player توی گروه اسپاتیفای‌ت رو به اشتراک می‌ذاره: همه می‌تونن آهنگ به صف اضافه کنن.',
      '🔎 هر آهنگی رو با اسمش پیدا کن و فایلش رو از @chethoberbot بگیر.',
    ].join('\n'),
    ar: [
      'أُبقي قوائم الموسيقى ودردشات تيليجرام متزامنة.',
      '',
      '💬 → 🎧 تُضاف المقاطع المنشورة في مجموعة أو موضوع منتدى أو قناة إلى قائمتها: روابط Spotify وYouTube وApple Music وDeezer وSoundCloud وTidal والملفات الصوتية.',
      '🎧 → 💬 اضغط 🔄 زامن الآن لتُنشر المقاطع الجديدة من القائمة في الدردشة.',
      '🎶 يشارك /player في المجموعة حساب Spotify الخاص بك: يمكن للجميع إضافة أغانٍ إلى قائمة الانتظار.',
      '🔎 ابحث عن أي أغنية باسمها واحصل على ملفها الصوتي من @chethoberbot.',
    ].join('\n'),
    ru: [
      'Держу музыкальные плейлисты и чаты Telegram в синхроне.',
      '',
      '💬 → 🎧 Треки из группы, темы форума или канала добавляются в их плейлист: ссылки Spotify, YouTube, Apple Music, Deezer, SoundCloud, Tidal и аудиофайлы.',
      '🎧 → 💬 Нажми 🔄 Синхронизировать, и новые треки плейлиста появятся в чате.',
      '🎶 /player в группе делится твоим Spotify: все могут добавлять песни в очередь.',
      '🔎 Найди любую песню по названию и получи аудио от @chethoberbot.',
    ].join('\n'),
    es: [
      'Mantengo sincronizadas tus listas de música y tus chats de Telegram.',
      '',
      '💬 → 🎧 Las pistas publicadas en un grupo, tema de foro o canal se añaden a su lista: enlaces de Spotify, YouTube, Apple Music, Deezer, SoundCloud, Tidal y archivos de audio.',
      '🎧 → 💬 Toca 🔄 Sincronizar ahora y las pistas nuevas de la lista se publican en el chat.',
      '🎶 /player en un grupo comparte tu Spotify: todos pueden añadir canciones a la cola.',
      '🔎 Busca cualquier canción por su nombre y consigue el audio de @chethoberbot.',
    ].join('\n'),
  },
  choose_language: {
    en: '🌐 Choose your language:', fa: '🌐 زبان خود را انتخاب کنید:', ar: '🌐 اختر لغتك:',
    ru: '🌐 Выберите язык:', es: '🌐 Elige tu idioma:',
  },
  language_set: {
    en: '✅ Language set to {name}.', fa: '✅ زبان به {name} تغییر کرد.', ar: '✅ تم ضبط اللغة على {name}.',
    ru: '✅ Язык изменён на {name}.', es: '✅ Idioma cambiado a {name}.',
  },

  // --- general -------------------------------------------------------------------
  back: { en: '« Back', fa: '« برگشت', ar: '« رجوع', ru: '« Назад', es: '« Atrás' },
  cancel: { en: '✖️ Cancel', fa: '✖️ لغو', ar: '✖️ إلغاء', ru: '✖️ Отмена', es: '✖️ Cancelar' },
  someone: { en: 'someone', fa: 'یک نفر', ar: 'شخص ما', ru: 'кто-то', es: 'alguien' },
  expired: {
    en: 'This button has expired.', fa: 'این دکمه منقضی شده.', ar: 'انتهت صلاحية هذا الزر.',
    ru: 'Эта кнопка устарела.', es: 'Este botón ha caducado.',
  },
  failed: {
    en: '⚠️ Something went wrong: {error}', fa: '⚠️ مشکلی پیش آمد: {error}', ar: '⚠️ حدث خطأ: {error}',
    ru: '⚠️ Что-то пошло не так: {error}', es: '⚠️ Algo salió mal: {error}',
  },
  admins_only: {
    en: 'Only the chat\'s admins can do this.', fa: 'فقط مدیرهای چت می‌تونن این کار رو بکنن.',
    ar: 'يمكن لمشرفي الدردشة فقط فعل ذلك.', ru: 'Это могут только администраторы чата.',
    es: 'Solo los administradores del chat pueden hacer esto.',
  },
  open_bot: { en: '🤖 Open the bot', fa: '🤖 باز کردن بات', ar: '🤖 افتح البوت', ru: '🤖 Открыть бота', es: '🤖 Abrir el bot' },
  listen_anywhere: {
    en: '🎧 Listen anywhere', fa: '🎧 گوش دادن در هر اپی', ar: '🎧 استمع في أي تطبيق', ru: '🎧 Слушать где угодно', es: '🎧 Escuchar en cualquier app',
  },

  // --- accounts --------------------------------------------------------------------
  accounts_title: { en: '🎧 <b>Accounts</b>', fa: '🎧 <b>حساب‌ها</b>', ar: '🎧 <b>الحسابات</b>', ru: '🎧 <b>Аккаунты</b>', es: '🎧 <b>Cuentas</b>' },
  accounts_hint: {
    en: 'Each sync uses the account of the person who set it up. Spotify can also use your own Spotify app: the login page explains how.',
    fa: 'هر همگام‌سازی از حساب کسی استفاده می‌کنه که راهش انداخته. برای اسپاتیفای می‌تونی اپ اسپاتیفای خودت رو هم استفاده کنی: صفحهٔ ورود توضیح می‌ده.',
    ar: 'تستخدم كل مزامنة حساب من أعدّها. يمكن لـ Spotify أيضًا استخدام تطبيق Spotify الخاص بك: صفحة الدخول تشرح الطريقة.',
    ru: 'Каждая синхронизация работает через аккаунт того, кто её настроил. Для Spotify можно использовать и своё приложение Spotify: как — написано на странице входа.',
    es: 'Cada sincronización usa la cuenta de quien la configuró. Spotify también puede usar tu propia app de Spotify: la página de inicio de sesión explica cómo.',
  },
  connect: { en: '🔌 Connect {service}', fa: '🔌 اتصال {service}', ar: '🔌 ربط {service}', ru: '🔌 Подключить {service}', es: '🔌 Conectar {service}' },
  disconnect: { en: '❌ Disconnect {service}', fa: '❌ قطع {service}', ar: '❌ فصل {service}', ru: '❌ Отключить {service}', es: '❌ Desconectar {service}' },
  disconnect_confirm: {
    en: 'Disconnect {service}? Syncs that use it stop until you connect it again.',
    fa: '{service} قطع بشه؟ همگام‌سازی‌هایی که ازش استفاده می‌کنن تا وصل کردن دوباره متوقف می‌شن.',
    ar: 'فصل {service}؟ تتوقف المزامنات التي تستخدمه حتى تربطه مجددًا.',
    ru: 'Отключить {service}? Синхронизации через него остановятся, пока не подключишь снова.',
    es: '¿Desconectar {service}? Las sincronizaciones que lo usan se detienen hasta que lo vuelvas a conectar.',
  },
  yes_disconnect: { en: '❌ Disconnect', fa: '❌ قطع کن', ar: '❌ افصل', ru: '❌ Отключить', es: '❌ Desconectar' },
  not_connected: { en: 'not connected', fa: 'وصل نیست', ar: 'غير مرتبط', ru: 'не подключён', es: 'no conectado' },
  unavailable: {
    en: 'not available on this bot yet', fa: 'فعلاً روی این بات در دسترس نیست', ar: 'غير متاح في هذا البوت بعد',
    ru: 'пока недоступен в этом боте', es: 'aún no disponible en este bot',
  },
  connected: {
    en: '✅ {service} connected: {name}', fa: '✅ {service} وصل شد: {name}', ar: '✅ تم ربط {service}: {name}',
    ru: '✅ {service} подключён: {name}', es: '✅ {service} conectado: {name}',
  },
  youtube_code: {
    en: '🔴 <b>Connect YouTube Music</b>\n\n1. Open {url}\n2. Enter the code <code>{code}</code> and allow access\n3. Come back and tap ✅',
    fa: '🔴 <b>اتصال یوتیوب موزیک</b>\n\n۱. {url} رو باز کن\n۲. کد <code>{code}</code> رو وارد کن و دسترسی بده\n۳. برگرد و ✅ رو بزن',
    ar: '🔴 <b>ربط YouTube Music</b>\n\n1. افتح {url}\n2. أدخل الرمز <code>{code}</code> واسمح بالوصول\n3. عُد واضغط ✅',
    ru: '🔴 <b>Подключение YouTube Music</b>\n\n1. Открой {url}\n2. Введи код <code>{code}</code> и разреши доступ\n3. Вернись и нажми ✅',
    es: '🔴 <b>Conectar YouTube Music</b>\n\n1. Abre {url}\n2. Introduce el código <code>{code}</code> y permite el acceso\n3. Vuelve y toca ✅',
  },
  youtube_open: { en: '🔗 Open Google', fa: '🔗 باز کردن گوگل', ar: '🔗 افتح Google', ru: '🔗 Открыть Google', es: '🔗 Abrir Google' },
  youtube_done: { en: '✅ I entered the code', fa: '✅ کد رو وارد کردم', ar: '✅ أدخلت الرمز', ru: '✅ Я ввёл код', es: '✅ Ya introduje el código' },
  youtube_pending: {
    en: 'Not yet: enter the code on the Google page and allow access, then tap ✅ again.',
    fa: 'هنوز نه: کد رو توی صفحهٔ گوگل وارد کن و دسترسی بده، بعد دوباره ✅ رو بزن.',
    ar: 'ليس بعد: أدخل الرمز في صفحة Google واسمح بالوصول، ثم اضغط ✅ مجددًا.',
    ru: 'Ещё нет: введи код на странице Google и разреши доступ, потом снова нажми ✅.',
    es: 'Todavía no: introduce el código en la página de Google y permite el acceso, luego toca ✅ otra vez.',
  },

  // --- syncs ------------------------------------------------------------------------
  syncs_title: {
    en: '🔗 <b>Your syncs</b>\n→ chat to playlist · ← playlist to chat · ⇄ both ways',
    fa: '🔗 <b>همگام‌سازی‌هات</b>\n→ چت به پلی‌لیست · ← پلی‌لیست به چت · ⇄ دوطرفه',
    ar: '🔗 <b>مزامناتك</b>\n→ من الدردشة إلى القائمة · ← من القائمة إلى الدردشة · ⇄ في الاتجاهين',
    ru: '🔗 <b>Твои синхронизации</b>\n→ чат в плейлист · ← плейлист в чат · ⇄ в обе стороны',
    es: '🔗 <b>Tus sincronizaciones</b>\n→ chat a lista · ← lista a chat · ⇄ en ambos sentidos',
  },
  syncs_empty: {
    en: 'No syncs yet. Tap ➕ New sync to link a playlist to a group, forum or channel.',
    fa: 'هنوز همگام‌سازی‌ای نداری. ➕ همگام‌سازی جدید رو بزن تا یه پلی‌لیست رو به گروه، انجمن یا کانال وصل کنی.',
    ar: 'لا توجد مزامنات بعد. اضغط ➕ مزامنة جديدة لربط قائمة تشغيل بمجموعة أو منتدى أو قناة.',
    ru: 'Синхронизаций пока нет. Нажми ➕ Новая синхронизация, чтобы привязать плейлист к группе, форуму или каналу.',
    es: 'Aún no hay sincronizaciones. Toca ➕ Nueva sincronización para vincular una lista a un grupo, foro o canal.',
  },
  new_sync_button: { en: '➕ New sync', fa: '➕ همگام‌سازی جدید', ar: '➕ مزامنة جديدة', ru: '➕ Новая синхронизация', es: '➕ Nueva sincronización' },
  every_topic: { en: 'every topic', fa: 'همهٔ موضوع‌ها', ar: 'كل المواضيع', ru: 'все темы', es: 'todos los temas' },
  per_topic_playlists: {
    en: 'A playlist per topic', fa: 'یه پلی‌لیست برای هر موضوع', ar: 'قائمة لكل موضوع', ru: 'Плейлист на каждую тему', es: 'Una lista por tema',
  },
  bot_not_in_chat: {
    en: '⚠️ I\'m not in this chat anymore: add me back as an admin.',
    fa: '⚠️ دیگه توی این چت نیستم: دوباره به‌عنوان مدیر اضافه‌م کن.',
    ar: '⚠️ لم أعد في هذه الدردشة: أضفني مجددًا كمشرف.',
    ru: '⚠️ Меня больше нет в этом чате: добавь меня снова как администратора.',
    es: '⚠️ Ya no estoy en este chat: vuelve a añadirme como administrador.',
  },
  dir_in: { en: '💬 → 🎧 Chat to playlist', fa: '💬 → 🎧 چت به پلی‌لیست', ar: '💬 → 🎧 من الدردشة إلى القائمة', ru: '💬 → 🎧 Чат в плейлист', es: '💬 → 🎧 Del chat a la lista' },
  dir_out: { en: '🎧 → 💬 Playlist to chat', fa: '🎧 → 💬 پلی‌لیست به چت', ar: '🎧 → 💬 من القائمة إلى الدردشة', ru: '🎧 → 💬 Плейлист в чат', es: '🎧 → 💬 De la lista al chat' },
  dir_both: { en: '🔄 Both ways', fa: '🔄 دوطرفه', ar: '🔄 في الاتجاهين', ru: '🔄 В обе стороны', es: '🔄 En ambos sentidos' },
  link_stats: {
    en: '📊 {tracks} tracks synced · {pending} waiting', fa: '📊 {tracks} آهنگ همگام شده · {pending} در انتظار',
    ar: '📊 {tracks} مقطعًا متزامنًا · {pending} قيد الانتظار', ru: '📊 Синхронизировано треков: {tracks} · ждут: {pending}',
    es: '📊 {tracks} pistas sincronizadas · {pending} en espera',
  },
  link_topics: { en: '🗂 {n} topics so far', fa: '🗂 تا الان {n} موضوع', ar: '🗂 {n} موضوعًا حتى الآن', ru: '🗂 Тем пока: {n}', es: '🗂 {n} temas por ahora' },
  sync_hint: {
    en: 'Tap 🔄 Sync now to post the playlist\'s new tracks in the chat (up to 20 at a time).',
    fa: '🔄 همگام‌سازی رو بزن تا آهنگ‌های جدید پلی‌لیست توی چت پست بشن (هر بار تا ۲۰ تا).',
    ar: 'اضغط 🔄 زامن الآن لنشر المقاطع الجديدة من القائمة في الدردشة (حتى 20 في كل مرة).',
    ru: 'Нажми 🔄 Синхронизировать, чтобы опубликовать новые треки плейлиста в чате (до 20 за раз).',
    es: 'Toca 🔄 Sincronizar ahora para publicar las pistas nuevas de la lista en el chat (hasta 20 cada vez).',
  },
  sync_now: { en: '🔄 Sync now', fa: '🔄 همگام‌سازی', ar: '🔄 زامن الآن', ru: '🔄 Синхронизировать', es: '🔄 Sincronizar ahora' },
  change_direction: { en: '↔️ Direction', fa: '↔️ جهت', ar: '↔️ الاتجاه', ru: '↔️ Направление', es: '↔️ Dirección' },
  reaction_on: { en: '👌 Reaction: on', fa: '👌 واکنش: روشن', ar: '👌 التفاعل: مفعّل', ru: '👌 Реакция: вкл', es: '👌 Reacción: sí' },
  reaction_off: { en: '🔕 Reaction: off', fa: '🔕 واکنش: خاموش', ar: '🔕 التفاعل: متوقف', ru: '🔕 Реакция: выкл', es: '🔕 Reacción: no' },
  dedupe_on: { en: '🔁 Delete reposts: on', fa: '🔁 حذف تکراری: روشن', ar: '🔁 حذف المكرر: مفعّل', ru: '🔁 Удалять повторы: вкл', es: '🔁 Borrar repetidos: sí' },
  dedupe_off: { en: '🔁 Delete reposts: off', fa: '🔁 حذف تکراری: خاموش', ar: '🔁 حذف المكرر: متوقف', ru: '🔁 Удалять повторы: выкл', es: '🔁 Borrar repetidos: no' },
  audio_on: { en: '🎵 Audio files: on', fa: '🎵 فایل صوتی: روشن', ar: '🎵 الملفات الصوتية: مفعّلة', ru: '🎵 Аудиофайлы: вкл', es: '🎵 Archivos de audio: sí' },
  audio_off: { en: '🎵 Audio files: off', fa: '🎵 فایل صوتی: خاموش', ar: '🎵 الملفات الصوتية: متوقفة', ru: '🎵 Аудиофайлы: выкл', es: '🎵 Archivos de audio: no' },
  open_playlist: { en: '🔗 Open playlist', fa: '🔗 باز کردن پلی‌لیست', ar: '🔗 افتح القائمة', ru: '🔗 Открыть плейлист', es: '🔗 Abrir lista' },
  remove_sync: { en: '🗑 Remove', fa: '🗑 حذف', ar: '🗑 إزالة', ru: '🗑 Удалить', es: '🗑 Eliminar' },
  remove_confirm: {
    en: 'Remove the sync of “{playlist}”? The playlist and the chat\'s messages stay.',
    fa: 'همگام‌سازی «{playlist}» حذف بشه؟ خود پلی‌لیست و پیام‌های چت می‌مونن.',
    ar: 'إزالة مزامنة «{playlist}»؟ تبقى القائمة ورسائل الدردشة.',
    ru: 'Удалить синхронизацию «{playlist}»? Сам плейлист и сообщения в чате останутся.',
    es: '¿Eliminar la sincronización de «{playlist}»? La lista y los mensajes del chat se quedan.',
  },
  yes_remove: { en: '🗑 Remove', fa: '🗑 حذف کن', ar: '🗑 أزل', ru: '🗑 Удалить', es: '🗑 Eliminar' },
  removed: { en: 'Removed.', fa: 'حذف شد.', ar: 'تمت الإزالة.', ru: 'Удалено.', es: 'Eliminado.' },
  syncing: { en: '🔄 Syncing…', fa: '🔄 در حال همگام‌سازی…', ar: '🔄 جارٍ المزامنة…', ru: '🔄 Синхронизирую…', es: '🔄 Sincronizando…' },
  synced: {
    en: '✅ Synced: {posted} posted, {retried} added again.', fa: '✅ همگام شد: {posted} پست شد، {retried} دوباره اضافه شد.',
    ar: '✅ تمت المزامنة: نُشر {posted}، وأُعيدت إضافة {retried}.', ru: '✅ Готово: опубликовано {posted}, добавлено повторно {retried}.',
    es: '✅ Sincronizado: {posted} publicadas, {retried} añadidas de nuevo.',
  },
  synced_more: {
    en: '✅ Posted {posted}. {remaining} more to go: tap 🔄 Sync now again in a minute.',
    fa: '✅ {posted} تا پست شد. {remaining} تای دیگه مونده: یه دقیقه دیگه دوباره 🔄 همگام‌سازی رو بزن.',
    ar: '✅ نُشر {posted}. بقي {remaining}: اضغط 🔄 زامن الآن مجددًا بعد دقيقة.',
    ru: '✅ Опубликовано {posted}. Осталось {remaining}: нажми 🔄 Синхронизировать ещё раз через минуту.',
    es: '✅ Publicadas {posted}. Quedan {remaining}: toca 🔄 Sincronizar ahora otra vez en un minuto.',
  },
  sync_failed: {
    en: '⚠️ Sync of “{playlist}” in {chat} failed: {error}',
    fa: '⚠️ همگام‌سازی «{playlist}» در {chat} انجام نشد: {error}',
    ar: '⚠️ فشلت مزامنة «{playlist}» في {chat}: {error}',
    ru: '⚠️ Синхронизация «{playlist}» в {chat} не удалась: {error}',
    es: '⚠️ Falló la sincronización de «{playlist}» en {chat}: {error}',
  },
  repost_removed: {
    en: '🔁 Removed a repost by {who}: it\'s already in the playlist.',
    fa: '🔁 پست تکراری {who} حذف شد: از قبل توی پلی‌لیست هست.',
    ar: '🔁 حُذف منشور مكرر من {who}: موجود مسبقًا في القائمة.',
    ru: '🔁 Удалён повтор от {who}: трек уже в плейлисте.',
    es: '🔁 Eliminado un repetido de {who}: ya está en la lista.',
  },

  // --- ➕ New sync ------------------------------------------------------------------
  new_pick_chat: {
    en: '➕ <b>New sync</b>\n\nPick the chat with the buttons below. I\'ll be added as an admin there if I\'m not yet.',
    fa: '➕ <b>همگام‌سازی جدید</b>\n\nبا دکمه‌های پایین چت رو انتخاب کن. اگه هنوز اونجا نیستم به‌عنوان مدیر اضافه می‌شم.',
    ar: '➕ <b>مزامنة جديدة</b>\n\nاختر الدردشة بالأزرار أدناه. سأُضاف كمشرف هناك إن لم أكن موجودًا.',
    ru: '➕ <b>Новая синхронизация</b>\n\nВыбери чат кнопками ниже. Если меня там ещё нет, я добавлюсь как администратор.',
    es: '➕ <b>Nueva sincronización</b>\n\nElige el chat con los botones de abajo. Me añadiré como administrador si aún no estoy.',
  },
  pick_group: { en: '👥 A group or forum', fa: '👥 یه گروه یا انجمن', ar: '👥 مجموعة أو منتدى', ru: '👥 Группа или форум', es: '👥 Un grupo o foro' },
  pick_channel: { en: '📢 A channel', fa: '📢 یه کانال', ar: '📢 قناة', ru: '📢 Канал', es: '📢 Un canal' },
  new_forum_mode: {
    en: '<b>{chat}</b> is a forum. Sync it how?\n\nFor a single topic, post /sync in that topic.',
    fa: '<b>{chat}</b> یه انجمنه. چطور همگام بشه؟\n\nبرای فقط یه موضوع، /sync رو توی همون موضوع بفرست.',
    ar: '<b>{chat}</b> منتدى. كيف تريد مزامنته؟\n\nلموضوع واحد فقط، أرسل /sync في ذلك الموضوع.',
    ru: '<b>{chat}</b> — форум. Как синхронизировать?\n\nДля одной темы отправь /sync в этой теме.',
    es: '<b>{chat}</b> es un foro. ¿Cómo sincronizarlo?\n\nPara un solo tema, envía /sync en ese tema.',
  },
  mode_whole: {
    en: '📚 The whole forum → one playlist', fa: '📚 کل انجمن ← یه پلی‌لیست', ar: '📚 المنتدى كله ← قائمة واحدة',
    ru: '📚 Весь форум → один плейлист', es: '📚 Todo el foro → una lista',
  },
  mode_topics: {
    en: '🗂 Each topic → its own playlist', fa: '🗂 هر موضوع ← پلی‌لیست خودش', ar: '🗂 كل موضوع ← قائمته الخاصة',
    ru: '🗂 Каждая тема → свой плейлист', es: '🗂 Cada tema → su propia lista',
  },
  new_no_accounts: {
    en: 'Connect a music account first.', fa: 'اول یه حساب موسیقی وصل کن.', ar: 'اربط حساب موسيقى أولًا.',
    ru: 'Сначала подключи музыкальный аккаунт.', es: 'Primero conecta una cuenta de música.',
  },
  new_pick_service: {
    en: 'Which account should this sync use?', fa: 'این همگام‌سازی از کدوم حساب استفاده کنه؟', ar: 'أي حساب تستخدم هذه المزامنة؟',
    ru: 'Через какой аккаунт синхронизировать?', es: '¿Qué cuenta usará esta sincronización?',
  },
  new_pick_playlist: {
    en: 'Pick a {service} playlist for <b>{chat}</b>. 👁 = not yours, it can only be posted to the chat.',
    fa: 'یه پلی‌لیست {service} برای <b>{chat}</b> انتخاب کن. 👁 = مال تو نیست و فقط می‌شه توی چت پستش کرد.',
    ar: 'اختر قائمة {service} لـ <b>{chat}</b>. 👁 = ليست لك، يمكن نشرها في الدردشة فقط.',
    ru: 'Выбери плейлист {service} для <b>{chat}</b>. 👁 — не твой, его можно только публиковать в чат.',
    es: 'Elige una lista de {service} para <b>{chat}</b>. 👁 = no es tuya, solo se puede publicar en el chat.',
  },
  new_playlist: { en: '➕ New playlist “{name}”', fa: '➕ پلی‌لیست جدید «{name}»', ar: '➕ قائمة جديدة «{name}»', ru: '➕ Новый плейлист «{name}»', es: '➕ Lista nueva «{name}»' },
  paste_playlist: { en: '🔗 Paste a playlist link', fa: '🔗 لینک یه پلی‌لیست رو بفرست', ar: '🔗 الصق رابط قائمة', ru: '🔗 Вставить ссылку на плейлист', es: '🔗 Pegar un enlace de lista' },
  new_paste_link: {
    en: 'Send me the link of any {service} playlist.', fa: 'لینک هر پلی‌لیستی از {service} رو برام بفرست.',
    ar: 'أرسل لي رابط أي قائمة على {service}.', ru: 'Пришли ссылку на любой плейлист {service}.',
    es: 'Envíame el enlace de cualquier lista de {service}.',
  },
  bad_playlist_link: {
    en: 'That doesn\'t look like a {service} playlist link. Try again.', fa: 'این شبیه لینک پلی‌لیست {service} نیست. دوباره امتحان کن.',
    ar: 'لا يبدو هذا رابط قائمة على {service}. حاول مجددًا.', ru: 'Это не похоже на ссылку на плейлист {service}. Попробуй ещё раз.',
    es: 'Eso no parece un enlace de lista de {service}. Inténtalo de nuevo.',
  },
  new_pick_direction: {
    en: 'Sync <b>{playlist}</b> and <b>{chat}</b> in which direction?',
    fa: '<b>{playlist}</b> و <b>{chat}</b> در چه جهتی همگام بشن؟',
    ar: 'في أي اتجاه تتم مزامنة <b>{playlist}</b> و<b>{chat}</b>؟',
    ru: 'В какую сторону синхронизировать <b>{playlist}</b> и <b>{chat}</b>?',
    es: '¿En qué sentido sincronizar <b>{playlist}</b> y <b>{chat}</b>?',
  },
  read_only_playlist: {
    en: '👁 This playlist isn\'t yours, so its tracks can only be posted to the chat.',
    fa: '👁 این پلی‌لیست مال تو نیست، پس آهنگ‌هاش فقط می‌تونن توی چت پست بشن.',
    ar: '👁 هذه القائمة ليست لك، لذا يمكن نشر مقاطعها في الدردشة فقط.',
    ru: '👁 Этот плейлист не твой, поэтому его треки можно только публиковать в чате.',
    es: '👁 Esta lista no es tuya, así que sus pistas solo se pueden publicar en el chat.',
  },
  new_baseline: {
    en: 'Should 🔄 Sync now also post the tracks already in <b>{playlist}</b>?',
    fa: '🔄 همگام‌سازی آهنگ‌هایی که الان توی <b>{playlist}</b> هستن رو هم پست کنه؟',
    ar: 'هل ينشر 🔄 زامن الآن أيضًا المقاطع الموجودة حاليًا في <b>{playlist}</b>؟',
    ru: 'Публиковать при 🔄 синхронизации и треки, которые уже есть в <b>{playlist}</b>?',
    es: '¿🔄 Sincronizar ahora también debe publicar las pistas que ya están en <b>{playlist}</b>?',
  },
  base_all: { en: '📤 Yes, post them too', fa: '📤 آره، اونا رو هم پست کن', ar: '📤 نعم، انشرها أيضًا', ru: '📤 Да, их тоже', es: '📤 Sí, publícalas también' },
  base_new: { en: '⏭ No, only new ones', fa: '⏭ نه، فقط جدیدها', ar: '⏭ لا، الجديدة فقط', ru: '⏭ Нет, только новые', es: '⏭ No, solo las nuevas' },
  new_done: { en: '✅ Sync created.', fa: '✅ همگام‌سازی ساخته شد.', ar: '✅ تم إنشاء المزامنة.', ru: '✅ Синхронизация создана.', es: '✅ Sincronización creada.' },
  new_cancelled: { en: 'Cancelled.', fa: 'لغو شد.', ar: 'تم الإلغاء.', ru: 'Отменено.', es: 'Cancelado.' },
  sync_topic_here: {
    en: 'Tap below to link this topic to a playlist.', fa: 'برای وصل کردن این موضوع به یه پلی‌لیست، دکمهٔ پایین رو بزن.',
    ar: 'اضغط أدناه لربط هذا الموضوع بقائمة تشغيل.', ru: 'Нажми ниже, чтобы привязать эту тему к плейлисту.',
    es: 'Toca abajo para vincular este tema a una lista.',
  },
  sync_chat_here: {
    en: 'Tap below to link this chat to a playlist.', fa: 'برای وصل کردن این چت به یه پلی‌لیست، دکمهٔ پایین رو بزن.',
    ar: 'اضغط أدناه لربط هذه الدردشة بقائمة تشغيل.', ru: 'Нажми ниже, чтобы привязать этот чат к плейлисту.',
    es: 'Toca abajo para vincular este chat a una lista.',
  },
  group_welcome: {
    en: '👋 Hi! I sync this chat with music playlists.\n\nAdmins: set it up in a private chat with @{bot} (➕ New sync), or post /sync here.\nEveryone: /player shares a Spotify queue with the group, /playlist opens the synced playlists, /top shows who posts the most music, /random picks a song and /song finds one, with its audio.',
    fa: '👋 سلام! این چت رو با پلی‌لیست‌های موسیقی همگام می‌کنم.\n\nمدیرها: توی چت خصوصی با @{bot} راهش بندازید (➕ همگام‌سازی جدید)، یا همین‌جا /sync بفرستید.\nهمه: /player یه صف اسپاتیفای رو با گروه به اشتراک می‌ذاره، /playlist پلی‌لیست‌های همگام رو باز می‌کنه، /top نشون می‌ده کی بیشتر آهنگ می‌فرسته، /random یه آهنگ تصادفی انتخاب می‌کنه و /song یه آهنگ رو با فایلش پیدا می‌کنه.',
    ar: '👋 مرحبًا! أزامن هذه الدردشة مع قوائم الموسيقى.\n\nللمشرفين: اضبطوها في دردشة خاصة مع @{bot} (➕ مزامنة جديدة)، أو أرسلوا /sync هنا.\nللجميع: يشارك /player قائمة انتظار Spotify مع المجموعة، ويفتح /playlist القوائم المتزامنة، ويعرض /top من ينشر أكثر الموسيقى، ويختار /random أغنية عشوائية، ويجد /song أغنية مع ملفها الصوتي.',
    ru: '👋 Привет! Я синхронизирую этот чат с музыкальными плейлистами.\n\nАдминам: настройте это в личке с @{bot} (➕ Новая синхронизация) или отправьте /sync здесь.\nВсем: /player делится очередью Spotify с группой, /playlist открывает связанные плейлисты, /top показывает, кто присылает больше всего музыки, /random выбирает случайную песню, а /song находит песню вместе с аудио.',
    es: '👋 ¡Hola! Sincronizo este chat con listas de música.\n\nAdmins: configuradlo en un chat privado con @{bot} (➕ Nueva sincronización) o enviad /sync aquí.\nTodos: /player comparte una cola de Spotify con el grupo, /playlist abre las listas sincronizadas, /top muestra quién comparte más música, /random elige una canción y /song busca una, con su audio.',
  },

  // --- ⏮ Add old songs ------------------------------------------------------------------
  bf_button: { en: '⏮ Add old songs', fa: '⏮ اضافه کردن آهنگ‌های قدیمی', ar: '⏮ أضف الأغاني القديمة', ru: '⏮ Добавить старые песни', es: '⏮ Añadir canciones antiguas' },
  bf_title: {
    en: '⏮ <b>Adding old songs to {playlist}</b>', fa: '⏮ <b>اضافه کردن آهنگ‌های قدیمی به {playlist}</b>', ar: '⏮ <b>إضافة الأغاني القديمة إلى {playlist}</b>',
    ru: '⏮ <b>Добавляю старые песни в {playlist}</b>', es: '⏮ <b>Añadiendo canciones antiguas a {playlist}</b>',
  },
  bf_how: {
    en: 'I can\'t read the chat\'s history myself, so bring it to me here:\n• <b>Forward</b> old posts from the chat: select up to 100 at once → Forward → this chat, and repeat.\n• Or send the <b>whole history</b>: Telegram Desktop → the chat → ⋮ → Export chat history → no media, format JSON → send me result.json.\n\nSongs already in the playlist are skipped.',
    fa: 'خودم نمی‌تونم تاریخچهٔ چت رو بخونم، پس همین‌جا برام بیارش:\n• پست‌های قدیمی چت رو <b>فوروارد</b> کن: تا ۱۰۰ تا رو با هم انتخاب کن ← Forward ← همین چت، و تکرار کن.\n• یا <b>کل تاریخچه</b> رو بفرست: تلگرام دسکتاپ ← اون چت ← ⋮ ← Export chat history ← بدون رسانه، فرمت JSON ← فایل result.json رو برام بفرست.\n\nآهنگ‌هایی که از قبل توی پلی‌لیست هستن رد می‌شن.',
    ar: 'لا أستطيع قراءة سجل الدردشة بنفسي، فأحضره إليّ هنا:\n• <b>حوّل</b> المنشورات القديمة من الدردشة: اختر حتى 100 دفعة واحدة ← Forward ← هذه الدردشة، وكرّر.\n• أو أرسل <b>السجل كاملًا</b>: Telegram Desktop ← الدردشة ← ⋮ ← Export chat history ← بلا وسائط، بصيغة JSON ← أرسل لي result.json.\n\nتُتخطّى الأغاني الموجودة في القائمة.',
    ru: 'Сам я не могу читать историю чата, так что принеси её сюда:\n• <b>Перешли</b> старые посты из чата: выдели до 100 сразу → Переслать → этот чат, и повтори.\n• Или пришли <b>всю историю</b>: Telegram Desktop → чат → ⋮ → Экспорт истории чата → без медиа, формат JSON → пришли мне result.json.\n\nПесни, которые уже есть в плейлисте, пропускаются.',
    es: 'No puedo leer el historial del chat yo solo, así que tráemelo aquí:\n• <b>Reenvía</b> publicaciones antiguas del chat: selecciona hasta 100 a la vez → Reenviar → este chat, y repite.\n• O envía <b>todo el historial</b>: Telegram Desktop → el chat → ⋮ → Exportar historial → sin multimedia, formato JSON → envíame result.json.\n\nLas canciones que ya están en la lista se omiten.',
  },
  bf_how_topic: {
    en: 'I can\'t read the topic\'s history myself, so bring it to me here:\n• <b>Forward</b> its old posts: select up to 100 at once → Forward → this chat, and repeat.\n• Or send the forum\'s <b>whole history</b>: Telegram Desktop → the forum → ⋮ → Export chat history → no media, format JSON → send me result.json. I take only this topic\'s posts.\n\nSongs already in the playlist are skipped.',
    fa: 'خودم نمی‌تونم تاریخچهٔ موضوع رو بخونم، پس همین‌جا برام بیارش:\n• پست‌های قدیمیش رو <b>فوروارد</b> کن: تا ۱۰۰ تا با هم ← Forward ← همین چت، و تکرار کن.\n• یا <b>کل تاریخچهٔ</b> انجمن رو بفرست: تلگرام دسکتاپ ← انجمن ← ⋮ ← Export chat history ← بدون رسانه، فرمت JSON ← result.json رو بفرست. فقط پست‌های همین موضوع رو برمی‌دارم.\n\nآهنگ‌هایی که از قبل توی پلی‌لیست هستن رد می‌شن.',
    ar: 'لا أستطيع قراءة سجل الموضوع بنفسي، فأحضره إليّ هنا:\n• <b>حوّل</b> منشوراته القديمة: حتى 100 دفعة واحدة ← Forward ← هذه الدردشة، وكرّر.\n• أو أرسل <b>سجل المنتدى كاملًا</b>: Telegram Desktop ← المنتدى ← ⋮ ← Export chat history ← بلا وسائط، بصيغة JSON ← أرسل result.json. آخذ منشورات هذا الموضوع فقط.\n\nتُتخطّى الأغاني الموجودة في القائمة.',
    ru: 'Сам я не могу читать историю темы, так что принеси её сюда:\n• <b>Перешли</b> её старые посты: до 100 сразу → Переслать → этот чат, и повтори.\n• Или пришли <b>всю историю</b> форума: Telegram Desktop → форум → ⋮ → Экспорт истории чата → без медиа, формат JSON → пришли result.json. Я возьму только посты этой темы.\n\nПесни, которые уже есть в плейлисте, пропускаются.',
    es: 'No puedo leer el historial del tema yo solo, así que tráemelo aquí:\n• <b>Reenvía</b> sus publicaciones antiguas: hasta 100 a la vez → Reenviar → este chat, y repite.\n• O envía <b>todo el historial</b> del foro: Telegram Desktop → el foro → ⋮ → Exportar historial → sin multimedia, formato JSON → envíame result.json. Solo tomo las publicaciones de este tema.\n\nLas canciones que ya están en la lista se omiten.',
  },
  bf_how_topics: {
    en: 'I can\'t read the forum\'s history myself: send me its export. Telegram Desktop → the forum → ⋮ → Export chat history → no media, format JSON → send me result.json.\n\nEach topic\'s songs go to its own playlist (found by the topic\'s name, or created). Posts in General are skipped, like live ones, and songs already in a playlist too.',
    fa: 'خودم نمی‌تونم تاریخچهٔ انجمن رو بخونم: فایل خروجیش رو برام بفرست. تلگرام دسکتاپ ← انجمن ← ⋮ ← Export chat history ← بدون رسانه، فرمت JSON ← result.json رو بفرست.\n\nآهنگ‌های هر موضوع به پلی‌لیست خودش می‌رن (با اسم موضوع پیدا می‌شه یا ساخته می‌شه). پست‌های General رد می‌شن، مثل پست‌های زنده، و آهنگ‌هایی که از قبل توی پلی‌لیستن هم.',
    ar: 'لا أستطيع قراءة سجل المنتدى بنفسي: أرسل لي تصديره. Telegram Desktop ← المنتدى ← ⋮ ← Export chat history ← بلا وسائط، بصيغة JSON ← أرسل result.json.\n\nتذهب أغاني كل موضوع إلى قائمته (يُعثر عليها باسم الموضوع أو تُنشأ). تُتخطّى منشورات General كما في المنشورات الحية، والأغاني الموجودة في القائمة أيضًا.',
    ru: 'Сам я не могу читать историю форума: пришли мне её экспорт. Telegram Desktop → форум → ⋮ → Экспорт истории чата → без медиа, формат JSON → пришли result.json.\n\nПесни каждой темы попадут в её плейлист (найденный по названию темы или новый). Посты в General пропускаются, как и при живой синхронизации, а также песни, которые уже есть в плейлисте.',
    es: 'No puedo leer el historial del foro yo solo: envíame su exportación. Telegram Desktop → el foro → ⋮ → Exportar historial → sin multimedia, formato JSON → envíame result.json.\n\nLas canciones de cada tema van a su propia lista (encontrada por el nombre del tema, o creada). Las publicaciones en General se omiten, como en vivo, y también las canciones que ya están en una lista.',
  },

  bf_stats: {
    en: '✅ Added: {added}\n🔁 Already there: {known}\n❔ Not recognized: {missed}\n⚠️ Not added yet (🔄 Sync now retries): {failed}\n⏳ Waiting: {waiting}',
    fa: '✅ اضافه شد: {added}\n🔁 از قبل بود: {known}\n❔ تشخیص داده نشد: {missed}\n⚠️ هنوز اضافه نشده (🔄 همگام‌سازی دوباره امتحان می‌کنه): {failed}\n⏳ در انتظار: {waiting}',
    ar: '✅ أُضيفت: {added}\n🔁 موجودة مسبقًا: {known}\n❔ لم يُتعرف عليها: {missed}\n⚠️ لم تُضف بعد (🔄 زامن الآن يعيد المحاولة): {failed}\n⏳ في الانتظار: {waiting}',
    ru: '✅ Добавлено: {added}\n🔁 Уже были: {known}\n❔ Не распознано: {missed}\n⚠️ Пока не добавлено (🔄 синхронизация повторит): {failed}\n⏳ В очереди: {waiting}',
    es: '✅ Añadidas: {added}\n🔁 Ya estaban: {known}\n❔ No reconocidas: {missed}\n⚠️ Aún sin añadir (🔄 Sincronizar ahora reintenta): {failed}\n⏳ En espera: {waiting}',
  },
  bf_queued: {
    en: '📥 Posts with music in the export: {n}.', fa: '📥 {n} پست آهنگ‌دار از فایل خونده شد.', ar: '📥 قُرئ {n} منشورًا فيه موسيقى من الملف.',
    ru: '📥 Прочитано постов с музыкой из экспорта: {n}.', es: '📥 Publicaciones con música en la exportación: {n}.',
  },
  bf_limit: {
    en: '⏸ A music service is limiting lookups for now: tap ⏩ Continue in a minute.', fa: '⏸ یکی از سرویس‌های موسیقی فعلاً جستجو رو محدود کرده: یه دقیقه دیگه ⏩ ادامه رو بزن.',
    ar: '⏸ تحدّ خدمة موسيقى من عمليات البحث حاليًا: اضغط ⏩ متابعة بعد دقيقة.', ru: '⏸ Музыкальный сервис временно ограничил запросы: нажми ⏩ Продолжить через минуту.',
    es: '⏸ Un servicio de música está limitando las búsquedas por ahora: toca ⏩ Continuar en un minuto.',
  },

  bf_working: { en: '⏳ Adding… (up to 20 seconds)', fa: '⏳ در حال اضافه کردن… (تا ۲۰ ثانیه)', ar: '⏳ جارٍ الإضافة… (حتى 20 ثانية)', ru: '⏳ Добавляю… (до 20 секунд)', es: '⏳ Añadiendo… (hasta 20 segundos)' },
  bf_continue: { en: '⏩ Continue', fa: '⏩ ادامه', ar: '⏩ متابعة', ru: '⏩ Продолжить', es: '⏩ Continuar' },
  bf_refresh: { en: '🔄 Refresh', fa: '🔄 به‌روزرسانی', ar: '🔄 تحديث', ru: '🔄 Обновить', es: '🔄 Actualizar' },
  bf_done: { en: '✅ Done', fa: '✅ تمام', ar: '✅ تم', ru: '✅ Готово', es: '✅ Listo' },
  bf_bad_file: {
    en: 'I couldn\'t read that file. Send result.json from Export chat history, in JSON format and without media (up to 20 MB).',
    fa: 'نتونستم این فایل رو بخونم. result.json رو از Export chat history بفرست، با فرمت JSON و بدون رسانه (تا ۲۰ مگابایت).',
    ar: 'لم أستطع قراءة هذا الملف. أرسل result.json من Export chat history، بصيغة JSON وبلا وسائط (حتى 20 ميغابايت).',
    ru: 'Не удалось прочитать файл. Пришли result.json из экспорта истории чата, в формате JSON и без медиа (до 20 МБ).',
    es: 'No pude leer ese archivo. Envía result.json de Exportar historial, en formato JSON y sin multimedia (hasta 20 MB).',
  },
  bf_wrong_chat: {
    en: 'That export is from another chat ({chat}). Export the chat this sync is linked to.', fa: 'این فایل مال یه چت دیگه‌ست ({chat}). از چتی که این همگام‌سازی بهش وصله خروجی بگیر.',
    ar: 'هذا التصدير من دردشة أخرى ({chat}). صدّر الدردشة المرتبطة بهذه المزامنة.', ru: 'Это экспорт другого чата ({chat}). Экспортируй чат, к которому привязана синхронизация.',
    es: 'Esa exportación es de otro chat ({chat}). Exporta el chat vinculado a esta sincronización.',
  },
  bf_no_topic_posts: {
    en: 'I found no music posts of this topic in the export. Is it the right forum? Forwarding the topic\'s posts works too.',
    fa: 'توی فایل هیچ پست آهنگ‌داری از این موضوع پیدا نکردم. انجمن درسته؟ فوروارد کردن پست‌های موضوع هم جواب می‌ده.',
    ar: 'لم أجد منشورات موسيقى لهذا الموضوع في التصدير. هل هو المنتدى الصحيح؟ تحويل منشورات الموضوع يعمل أيضًا.',
    ru: 'В экспорте нет постов с музыкой из этой темы. Это тот форум? Можно и переслать посты темы.',
    es: 'No encontré publicaciones con música de este tema en la exportación. ¿Es el foro correcto? También puedes reenviar las publicaciones del tema.',
  },
  bf_forward_topics: {
    en: 'Forwarded posts don\'t say which topic they\'re from: for every topic, send the forum\'s export (result.json) instead.',
    fa: 'پست‌های فورواردی نمی‌گن مال کدوم موضوعن: برای همهٔ موضوع‌ها، فایل خروجی انجمن (result.json) رو بفرست.',
    ar: 'المنشورات المحوّلة لا تذكر موضوعها: لكل المواضيع، أرسل تصدير المنتدى (result.json) بدلًا من ذلك.',
    ru: 'Пересланные посты не говорят, из какой они темы: для всех тем пришли экспорт форума (result.json).',
    es: 'Las publicaciones reenviadas no dicen de qué tema son: para todos los temas, envía la exportación del foro (result.json).',
  },
  bf_queued_topics: {
    en: '📥 Posts with music in the export: {n}, in {topics} topics. Each goes to its topic\'s playlist.',
    fa: '📥 پست‌های آهنگ‌دار فایل: {n}، توی {topics} موضوع. هر کدوم به پلی‌لیست موضوع خودش می‌ره.',
    ar: '📥 منشورات فيها موسيقى في التصدير: {n}، في {topics} موضوعًا. يذهب كل منها إلى قائمة موضوعه.',
    ru: '📥 Постов с музыкой в экспорте: {n}, тем: {topics}. Каждый попадёт в плейлист своей темы.',
    es: '📥 Publicaciones con música en la exportación: {n}, en {topics} temas. Cada una va a la lista de su tema.',
  },


  // --- /playlist, /top, /random in groups and channels --------------------------------
  chat_playlists: {
    en: '🎧 <b>Playlists synced with this chat</b>', fa: '🎧 <b>پلی‌لیست‌های همگام با این چت</b>', ar: '🎧 <b>قوائم التشغيل المتزامنة مع هذه الدردشة</b>',
    ru: '🎧 <b>Плейлисты, связанные с этим чатом</b>', es: '🎧 <b>Listas sincronizadas con este chat</b>',
  },
  chat_no_playlists: {
    en: 'No playlist is synced with this chat yet. Admins can link one with /sync.', fa: 'هنوز هیچ پلی‌لیستی با این چت همگام نشده. مدیرها می‌تونن با /sync یکی وصل کنن.',
    ar: 'لا توجد قائمة تشغيل متزامنة مع هذه الدردشة بعد. يمكن للمشرفين ربط واحدة بـ /sync.', ru: 'К этому чату пока не привязан ни один плейлист. Админы могут привязать его через /sync.',
    es: 'Aún no hay ninguna lista sincronizada con este chat. Los admins pueden vincular una con /sync.',
  },
  chat_top: {
    en: '🏆 <b>Top music posters</b>', fa: '🏆 <b>بیشترین آهنگ‌فرست‌ها</b>', ar: '🏆 <b>أكثر من نشر الأغاني</b>',
    ru: '🏆 <b>Больше всех музыки прислали</b>', es: '🏆 <b>Quién más música ha compartido</b>',
  },
  chat_top_empty: {
    en: 'No tracks from this chat have made it into a playlist yet: post a song link to start.', fa: 'هنوز هیچ آهنگی از این چت به پلی‌لیست نرفته: یه لینک آهنگ بفرست تا شروع بشه.',
    ar: 'لم تُضف أي مقاطع من هذه الدردشة إلى قائمة بعد: انشر رابط أغنية للبدء.', ru: 'Пока ни один трек из этого чата не попал в плейлист: пришли ссылку на песню, чтобы начать.',
    es: 'Aún no ha llegado ninguna pista de este chat a una lista: publica un enlace de una canción para empezar.',
  },
  chat_random: {
    en: '🎲 A random pick from <b>{playlist}</b>:', fa: '🎲 یه انتخاب تصادفی از <b>{playlist}</b>:', ar: '🎲 اختيار عشوائي من <b>{playlist}</b>:',
    ru: '🎲 Случайный трек из <b>{playlist}</b>:', es: '🎲 Una elección al azar de <b>{playlist}</b>:',
  },
  chat_random_empty: {
    en: '<b>{playlist}</b> is empty.', fa: '<b>{playlist}</b> خالیه.', ar: '<b>{playlist}</b> فارغة.', ru: '<b>{playlist}</b> пуст.', es: '<b>{playlist}</b> está vacía.',
  },
  chat_song_usage: {
    en: 'Send /song and a song name, like /song bohemian rhapsody.', fa: '/song رو با اسم یه آهنگ بفرست، مثلاً /song bohemian rhapsody.',
    ar: 'أرسل /song واسم أغنية، مثل /song bohemian rhapsody.', ru: 'Отправь /song и название песни, например /song bohemian rhapsody.',
    es: 'Envía /song y el nombre de una canción, como /song bohemian rhapsody.',
  },

  // --- 🔎 Find music -------------------------------------------------------------------
  find_prompt: {
    en: '🔎 Send me a song name, a link or an audio file.', fa: '🔎 اسم یه آهنگ، لینکش یا فایل صوتیش رو برام بفرست.',
    ar: '🔎 أرسل لي اسم أغنية أو رابطها أو ملفًا صوتيًا.', ru: '🔎 Пришли название песни, ссылку или аудиофайл.',
    es: '🔎 Envíame el nombre de una canción, un enlace o un archivo de audio.',
  },
  find_results: { en: '🔎 Results for <b>{query}</b>:', fa: '🔎 نتیجه‌ها برای <b>{query}</b>:', ar: '🔎 نتائج <b>{query}</b>:', ru: '🔎 Результаты по <b>{query}</b>:', es: '🔎 Resultados para <b>{query}</b>:' },
  find_none: {
    en: 'Nothing found for <b>{query}</b>.', fa: 'چیزی برای <b>{query}</b> پیدا نشد.', ar: 'لم يُعثر على شيء لـ <b>{query}</b>.',
    ru: 'Ничего не найдено по <b>{query}</b>.', es: 'No se encontró nada para <b>{query}</b>.',
  },
  find_unknown: {
    en: 'I couldn\'t recognize that song.', fa: 'نتونستم این آهنگ رو تشخیص بدم.', ar: 'لم أتعرف على هذه الأغنية.',
    ru: 'Не удалось распознать эту песню.', es: 'No pude reconocer esa canción.',
  },
  find_add: { en: '➕ Add to playlist', fa: '➕ اضافه به پلی‌لیست', ar: '➕ أضف إلى قائمة', ru: '➕ В плейлист', es: '➕ Añadir a una lista' },
  find_no_playlists: {
    en: 'You have no playlist I can add to: create one in your music app first.', fa: 'هیچ پلی‌لیستی نداری که بتونم بهش اضافه کنم: اول توی برنامهٔ موسیقی‌ت یکی بساز.',
    ar: 'ليست لديك قائمة يمكنني الإضافة إليها: أنشئ واحدة في تطبيق الموسيقى أولًا.', ru: 'Нет плейлистов, в которые я могу добавлять: сначала создай плейлист в музыкальном приложении.',
    es: 'No tienes ninguna lista a la que pueda añadir: crea una en tu app de música primero.',
  },
  btn_like: { en: '❤️ Like', fa: '❤️ لایک', ar: '❤️ إعجاب', ru: '❤️ Лайк', es: '❤️ Me gusta' },
  btn_add: { en: '➕ Add', fa: '➕ اضافه', ar: '➕ أضف', ru: '➕ Добавить', es: '➕ Añadir' },
  btn_audio: { en: '🎵 Audio', fa: '🎵 فایل', ar: '🎵 الصوت', ru: '🎵 Аудио', es: '🎵 Audio' },
  liked: { en: '❤️ Liked on {services}.', fa: '❤️ توی {services} لایک شد.', ar: '❤️ تم الإعجاب على {services}.', ru: '❤️ Лайк в {services}.', es: '❤️ Te gusta en {services}.' },
  audio_asked: { en: '⏳ Getting the audio from @{bot}…', fa: '⏳ دارم فایل رو از @{bot} می‌گیرم…', ar: '⏳ أجلب الملف الصوتي من @{bot}…', ru: '⏳ Получаю аудио у @{bot}…', es: '⏳ Pidiendo el audio a @{bot}…' },
  audio_coming: { en: '⏳ The audio is on its way.', fa: '⏳ فایل داره میاد.', ar: '⏳ الملف الصوتي في الطريق.', ru: '⏳ Аудио уже в пути.', es: '⏳ El audio ya está en camino.' },
  find_queue: { en: '▶️ Play next on my Spotify', fa: '▶️ پخش بعدی روی اسپاتیفای من', ar: '▶️ شغّلها تاليًا على Spotify', ru: '▶️ Следующей в моём Spotify', es: '▶️ Siguiente en mi Spotify' },
  find_audio: { en: '⬇️ Get the audio (@{bot})', fa: '⬇️ گرفتن فایل صوتی (@{bot})', ar: '⬇️ احصل على الملف الصوتي (@{bot})', ru: '⬇️ Получить аудио (@{bot})', es: '⬇️ Conseguir el audio (@{bot})' },
  find_pick_sync: {
    en: 'Add <b>{song}</b> to which playlist?', fa: '<b>{song}</b> به کدوم پلی‌لیست اضافه بشه؟', ar: 'إلى أي قائمة تُضاف <b>{song}</b>؟',
    ru: 'В какой плейлист добавить <b>{song}</b>?', es: '¿A qué lista añadir <b>{song}</b>?',
  },
  find_added: { en: '✅ Added to {playlist}.', fa: '✅ به {playlist} اضافه شد.', ar: '✅ أُضيفت إلى {playlist}.', ru: '✅ Добавлено в {playlist}.', es: '✅ Añadida a {playlist}.' },
  find_already: { en: 'It\'s already in {playlist}.', fa: 'از قبل توی {playlist} هست.', ar: 'موجودة مسبقًا في {playlist}.', ru: 'Уже есть в {playlist}.', es: 'Ya está en {playlist}.' },
  find_not_on: { en: 'This song isn\'t on {service}.', fa: 'این آهنگ توی {service} نیست.', ar: 'هذه الأغنية غير موجودة على {service}.', ru: 'Этой песни нет в {service}.', es: 'Esta canción no está en {service}.' },
  find_queued: { en: '✅ Queued on your Spotify.', fa: '✅ به صف اسپاتیفای‌ت اضافه شد.', ar: '✅ أُضيفت إلى قائمة انتظار Spotify.', ru: '✅ Добавлено в очередь Spotify.', es: '✅ Añadida a tu cola de Spotify.' },
  find_audio_asked: {
    en: '⏳ Asked @{bot}: the audio will arrive here.', fa: '⏳ از @{bot} خواستم: فایل صوتی همین‌جا میاد.',
    ar: '⏳ طلبت من @{bot}: سيصل الملف الصوتي هنا.', ru: '⏳ Спросил @{bot}: аудио придёт сюда.',
    es: '⏳ Se lo pedí a @{bot}: el audio llegará aquí.',
  },
  find_audio_failed: {
    en: 'I can\'t reach @{bot} right now.', fa: 'الان نمی‌تونم به @{bot} دسترسی پیدا کنم.', ar: 'لا يمكنني الوصول إلى @{bot} الآن.',
    ru: 'Сейчас не получается связаться с @{bot}.', es: 'Ahora mismo no puedo contactar con @{bot}.',
  },
  inline_open_bot: { en: '🎧 Sync playlists with chats', fa: '🎧 همگام‌سازی پلی‌لیست با چت', ar: '🎧 زامن القوائم مع الدردشات', ru: '🎧 Синхронизация плейлистов с чатами', es: '🎧 Sincroniza listas con chats' },

  // --- group player -----------------------------------------------------------------------
  player_title: {
    en: '🎶 <b>Group player</b> · {host}\'s Spotify', fa: '🎶 <b>پخش گروهی</b> · اسپاتیفای {host}',
    ar: '🎶 <b>مشغل المجموعة</b> · Spotify الخاص بـ {host}', ru: '🎶 <b>Плеер группы</b> · Spotify {host}',
    es: '🎶 <b>Reproductor del grupo</b> · Spotify de {host}',
  },
  player_idle: {
    en: 'Nothing is playing. Open Spotify on a device and start a song.', fa: 'چیزی پخش نمی‌شه. اسپاتیفای رو روی یه دستگاه باز کن و یه آهنگ پخش کن.',
    ar: 'لا شيء قيد التشغيل. افتح Spotify على جهاز وشغّل أغنية.', ru: 'Ничего не играет. Открой Spotify на устройстве и включи песню.',
    es: 'No suena nada. Abre Spotify en un dispositivo y pon una canción.',
  },
  player_next: { en: '⏭ Up next:', fa: '⏭ بعدی‌ها:', ar: '⏭ التالي:', ru: '⏭ Далее:', es: '⏭ A continuación:' },
  player_how_add: {
    en: '➕ To add a song, post a link or audio file here, or type @{bot} and a song name.',
    fa: '➕ برای اضافه کردن آهنگ، لینک یا فایل صوتی رو همین‌جا بفرست، یا @{bot} و اسم آهنگ رو تایپ کن.',
    ar: '➕ لإضافة أغنية، انشر رابطًا أو ملفًا صوتيًا هنا، أو اكتب @{bot} واسم الأغنية.',
    ru: '➕ Чтобы добавить песню, отправь сюда ссылку или аудиофайл, или набери @{bot} и название.',
    es: '➕ Para añadir una canción, publica aquí un enlace o un audio, o escribe @{bot} y el nombre.',
  },
  player_how_add_off: {
    en: '🔒 Queue posts is off: posted songs aren\'t queued.', fa: '🔒 صف پست‌ها خاموشه: آهنگ‌های فرستاده‌شده به صف نمی‌رن.',
    ar: '🔒 إضافة المنشورات متوقفة: لا تُضاف الأغاني المنشورة إلى قائمة الانتظار.', ru: '🔒 Очередь из сообщений выключена: присланные песни не добавляются.',
    es: '🔒 Cola de publicaciones desactivada: las canciones publicadas no se añaden.',
  },
  player_add: { en: '➕ Add a song', fa: '➕ اضافه کردن آهنگ', ar: '➕ أضف أغنية', ru: '➕ Добавить песню', es: '➕ Añadir canción' },
  player_end: { en: '⏹ End', fa: '⏹ پایان', ar: '⏹ إنهاء', ru: '⏹ Завершить', es: '⏹ Terminar' },
  queue_posts_on: { en: '🔁 Queue posts: on', fa: '🔁 صف پست‌ها: روشن', ar: '🔁 إضافة المنشورات: مفعّلة', ru: '🔁 Очередь из сообщений: вкл', es: '🔁 Cola de publicaciones: sí' },
  queue_posts_off: { en: '🔁 Queue posts: off', fa: '🔁 صف پست‌ها: خاموش', ar: '🔁 إضافة المنشورات: متوقفة', ru: '🔁 Очередь из сообщений: выкл', es: '🔁 Cola de publicaciones: no' },
  player_ended: { en: '⏹ The group player has ended.', fa: '⏹ پخش گروهی تموم شد.', ar: '⏹ انتهى مشغل المجموعة.', ru: '⏹ Плеер группы выключен.', es: '⏹ El reproductor del grupo ha terminado.' },
  player_host_only: {
    en: 'Only the host and admins can control the player.', fa: 'فقط میزبان و مدیرها می‌تونن پخش رو کنترل کنن.',
    ar: 'يمكن للمضيف والمشرفين فقط التحكم في المشغل.', ru: 'Управлять плеером могут только хозяин и администраторы.',
    es: 'Solo el anfitrión y los administradores pueden controlar el reproductor.',
  },
  player_host_gone: {
    en: 'The host disconnected Spotify. Send /player to host it yourself.', fa: 'میزبان اسپاتیفای رو قطع کرده. /player رو بفرست تا خودت میزبان بشی.',
    ar: 'فصل المضيف Spotify. أرسل /player لتستضيفه بنفسك.', ru: 'Хозяин отключил Spotify. Отправь /player, чтобы стать хозяином.',
    es: 'El anfitrión desconectó Spotify. Envía /player para ser tú el anfitrión.',
  },
  player_need_spotify: {
    en: 'To host the group player, connect your Spotify in a private chat with me first.',
    fa: 'برای میزبانی پخش گروهی، اول توی چت خصوصی با من اسپاتیفای‌ت رو وصل کن.',
    ar: 'لاستضافة مشغل المجموعة، اربط Spotify أولًا في دردشة خاصة معي.',
    ru: 'Чтобы стать хозяином плеера, сначала подключи Spotify в личке со мной.',
    es: 'Para ser anfitrión del reproductor, primero conecta tu Spotify en un chat privado conmigo.',
  },

  // --- errors ---------------------------------------------------------------------------------
  err_expired: {
    en: 'The {service} sign-in expired: connect it again in 🎧 Accounts.', fa: 'ورود {service} منقضی شده: توی 🎧 حساب‌ها دوباره وصلش کن.',
    ar: 'انتهت صلاحية تسجيل الدخول إلى {service}: اربطه مجددًا من 🎧 الحسابات.', ru: 'Вход в {service} истёк: подключи его снова в 🎧 Аккаунты.',
    es: 'La sesión de {service} caducó: vuelve a conectarlo en 🎧 Cuentas.',
  },
  err_not_connected: {
    en: '{service} isn\'t connected: connect it in 🎧 Accounts.', fa: '{service} وصل نیست: توی 🎧 حساب‌ها وصلش کن.',
    ar: '{service} غير مرتبط: اربطه من 🎧 الحسابات.', ru: '{service} не подключён: подключи его в 🎧 Аккаунты.',
    es: '{service} no está conectado: conéctalo en 🎧 Cuentas.',
  },
  err_no_device: {
    en: 'No active Spotify device: open Spotify somewhere and play something first.', fa: 'هیچ دستگاه اسپاتیفای فعالی نیست: اول اسپاتیفای رو یه جا باز کن و یه چیزی پخش کن.',
    ar: 'لا يوجد جهاز Spotify نشط: افتح Spotify في مكان ما وشغّل شيئًا أولًا.', ru: 'Нет активного устройства Spotify: сначала открой Spotify и что-нибудь включи.',
    es: 'No hay ningún dispositivo de Spotify activo: abre Spotify en algún sitio y pon algo primero.',
  },
  err_premium: {
    en: 'Controlling playback needs Spotify Premium.', fa: 'کنترل پخش به اسپاتیفای پریمیوم نیاز داره.', ar: 'التحكم في التشغيل يتطلب Spotify Premium.',
    ru: 'Для управления воспроизведением нужен Spotify Premium.', es: 'Controlar la reproducción requiere Spotify Premium.',
  },
  err_quota: {
    en: 'YouTube\'s daily limit for this bot is used up. Try again tomorrow.', fa: 'سقف روزانهٔ یوتیوب برای این بات پر شده. فردا دوباره امتحان کن.',
    ar: 'استُنفد الحد اليومي لـ YouTube لهذا البوت. حاول غدًا.', ru: 'Дневной лимит YouTube для этого бота исчерпан. Попробуй завтра.',
    es: 'Se agotó el límite diario de YouTube para este bot. Inténtalo mañana.',
  },
  err_scope: {
    en: 'Connect {service} again in 🎧 Accounts to allow this.', fa: 'برای این کار {service} رو توی 🎧 حساب‌ها دوباره وصل کن.',
    ar: 'اربط {service} مجددًا في 🎧 الحسابات للسماح بذلك.', ru: 'Подключи {service} заново в 🎧 Аккаунты, чтобы это разрешить.',
    es: 'Vuelve a conectar {service} en 🎧 Cuentas para permitirlo.',
  },
  err_forbidden: {
    en: 'Not allowed: is this playlist yours?', fa: 'اجازه نداری: این پلی‌لیست مال توئه؟', ar: 'غير مسموح: هل هذه القائمة لك؟',
    ru: 'Нет доступа: это твой плейлист?', es: 'No permitido: ¿esta lista es tuya?',
  },
  err_rate: {
    en: 'Too many requests: try again in a minute.', fa: 'درخواست‌ها زیاده: یه دقیقه دیگه امتحان کن.', ar: 'طلبات كثيرة جدًا: حاول بعد دقيقة.',
    ru: 'Слишком много запросов: попробуй через минуту.', es: 'Demasiadas solicitudes: inténtalo en un minuto.',
  },
  err_bot_removed: {
    en: 'I can\'t post there: am I still an admin of the chat?', fa: 'نمی‌تونم اونجا پست بذارم: هنوز مدیر چتم؟',
    ar: 'لا يمكنني النشر هناك: هل ما زلت مشرفًا في الدردشة؟', ru: 'Не могу писать туда: я всё ещё администратор чата?',
    es: 'No puedo publicar ahí: ¿sigo siendo administrador del chat?',
  },
  err_bot_not_added: {
    en: 'I couldn\'t open that chat. Add me to it as an admin and try again.', fa: 'نتونستم اون چت رو باز کنم. من رو به‌عنوان مدیر اضافه کن و دوباره امتحان کن.',
    ar: 'لم أستطع فتح تلك الدردشة. أضفني كمشرف وحاول مجددًا.', ru: 'Не удалось открыть этот чат. Добавь меня администратором и попробуй снова.',
    es: 'No pude abrir ese chat. Añádeme como administrador e inténtalo de nuevo.',
  },
};

export const STRINGS = strings;
export const t = makeT(strings);
