// Core user-facing strings for t2s, translated into the supported locales.
// Command tokens (/status, /playlist …) stay as-is; only prose is translated.
import { makeT } from './i18n.js';

const strings = {
  help: {
    en: [
      'I collect music posted in the forum topics into Spotify playlists, one playlist per topic.',
      '',
      'Recognized: Spotify track links, YouTube / Apple Music / Deezer / SoundCloud / Tidal links, and audio files.',
      "Reposts of a track already in the topic's playlist are deleted.",
      '',
      'Admin commands (here, in private):',
      "/status — every topic's playlist and track count",
      '/playlist <topic> <spotify playlist link> — link a topic to a playlist',
      "/dedupe <topic> — remove duplicate tracks from a topic's playlist",
      '/reaction [on|off|<emoji>] — toggle the reaction on added posts',
      '/language — change language',
      '/spotify <refresh_token> — connect Spotify',
    ].join('\n'),
    fa: [
      'من موسیقی ارسال‌شده در موضوع‌های گروه را در پلی‌لیست‌های اسپاتیفای جمع می‌کنم؛ برای هر موضوع یک پلی‌لیست.',
      '',
      'قابل‌تشخیص: لینک آهنگ اسپاتیفای، لینک‌های یوتیوب / اپل موزیک / دیزر / ساندکلاد / تایدال و فایل‌های صوتی.',
      'ارسال دوبارهٔ آهنگی که از قبل در پلی‌لیست موضوع باشد حذف می‌شود.',
      '',
      'دستورهای مدیر (همین‌جا، در خصوصی):',
      '/status — پلی‌لیست و تعداد آهنگ هر موضوع',
      '/playlist <موضوع> <لینک پلی‌لیست> — پیوند یک موضوع به یک پلی‌لیست',
      '/dedupe <موضوع> — حذف آهنگ‌های تکراری از پلی‌لیست یک موضوع',
      '/reaction [on|off|<ایموجی>] — روشن/خاموش کردن واکنش روی پست‌ها',
      '/language — تغییر زبان',
      '/spotify <refresh_token> — اتصال اسپاتیفای',
    ].join('\n'),
    ar: [
      'أجمع الموسيقى المنشورة في مواضيع المجموعة ضمن قوائم تشغيل Spotify، قائمة لكل موضوع.',
      '',
      'المدعوم: روابط مقاطع Spotify، وروابط YouTube / Apple Music / Deezer / SoundCloud / Tidal، والملفات الصوتية.',
      'يُحذف إعادة نشر مقطع موجود مسبقًا في قائمة الموضوع.',
      '',
      'أوامر المشرف (هنا، في الخاص):',
      '/status — قائمة التشغيل وعدد المقاطع لكل موضوع',
      '/playlist <الموضوع> <رابط قائمة التشغيل> — ربط موضوع بقائمة تشغيل',
      '/dedupe <الموضوع> — إزالة المقاطع المكررة من قائمة موضوع',
      '/reaction [on|off|<إيموجي>] — تبديل التفاعل على المنشورات',
      '/language — تغيير اللغة',
      '/spotify <refresh_token> — ربط Spotify',
    ].join('\n'),
    ru: [
      'Я собираю музыку из тем группы в плейлисты Spotify — по одному плейлисту на тему.',
      '',
      'Распознаю: ссылки на треки Spotify, ссылки YouTube / Apple Music / Deezer / SoundCloud / Tidal и аудиофайлы.',
      'Повторная публикация трека, уже имеющегося в плейлисте темы, удаляется.',
      '',
      'Команды администратора (здесь, в личке):',
      '/status — плейлист и число треков по каждой теме',
      '/playlist <тема> <ссылка на плейлист> — привязать тему к плейлисту',
      '/dedupe <тема> — удалить дубликаты из плейлиста темы',
      '/reaction [on|off|<эмодзи>] — включить/выключить реакцию на постах',
      '/language — сменить язык',
      '/spotify <refresh_token> — подключить Spotify',
    ].join('\n'),
    es: [
      'Recojo la música publicada en los temas del grupo en listas de Spotify, una lista por tema.',
      '',
      'Reconozco: enlaces de pistas de Spotify, enlaces de YouTube / Apple Music / Deezer / SoundCloud / Tidal y archivos de audio.',
      'Si se vuelve a publicar una pista que ya está en la lista del tema, se elimina.',
      '',
      'Comandos de administrador (aquí, en privado):',
      '/status — lista y número de pistas de cada tema',
      '/playlist <tema> <enlace de la lista> — vincular un tema a una lista',
      '/dedupe <tema> — quitar pistas duplicadas de la lista de un tema',
      '/reaction [on|off|<emoji>] — activar/desactivar la reacción en los posts',
      '/language — cambiar idioma',
      '/spotify <refresh_token> — conectar Spotify',
    ].join('\n'),
  },
  source: {
    en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente',
  },
  spotify_connected: {
    en: 'Spotify: connected ✅', fa: 'اسپاتیفای: متصل ✅', ar: 'Spotify: متصل ✅',
    ru: 'Spotify: подключён ✅', es: 'Spotify: conectado ✅',
  },
  spotify_not: {
    en: 'Spotify: not connected ❌', fa: 'اسپاتیفای: متصل نیست ❌', ar: 'Spotify: غير متصل ❌',
    ru: 'Spotify: не подключён ❌', es: 'Spotify: no conectado ❌',
  },
  choose_language: {
    en: '🌐 Choose your language:', fa: '🌐 زبان خود را انتخاب کنید:', ar: '🌐 اختر لغتك:',
    ru: '🌐 Выберите язык:', es: '🌐 Elige tu idioma:',
  },
  language_set: {
    en: '✅ Language set to {name}.', fa: '✅ زبان به {name} تغییر کرد.', ar: '✅ تم ضبط اللغة على {name}.',
    ru: '✅ Язык изменён на {name}.', es: '✅ Idioma cambiado a {name}.',
  },
  settings_title: {
    en: '⚙️ Settings', fa: '⚙️ تنظیمات', ar: '⚙️ الإعدادات', ru: '⚙️ Настройки', es: '⚙️ Ajustes',
  },
  source_here: {
    en: '📦 Source code:', fa: '📦 کد منبع:', ar: '📦 الكود المصدري:', ru: '📦 Исходный код:', es: '📦 Código fuente:',
  },
  reaction_on: {
    en: '🔔 Reaction: on {emoji} — tap to turn off', fa: '🔔 واکنش: روشن {emoji} — برای خاموش کردن بزن',
    ar: '🔔 التفاعل: مُفعّل {emoji} — اضغط للإيقاف', ru: '🔔 Реакция: вкл {emoji} — нажми, чтобы выключить',
    es: '🔔 Reacción: activada {emoji} — toca para desactivar',
  },
  reaction_off: {
    en: '🔕 Reaction: off — tap to turn on', fa: '🔕 واکنش: خاموش — برای روشن کردن بزن',
    ar: '🔕 التفاعل: متوقف — اضغط للتفعيل', ru: '🔕 Реакция: выкл — нажми, чтобы включить',
    es: '🔕 Reacción: desactivada — toca para activar',
  },
  admins_only: {
    en: 'Only forum admins can use this command.',
    fa: 'فقط مدیران گروه می‌توانند از این دستور استفاده کنند.',
    ar: 'يمكن لمشرفي المجموعة فقط استخدام هذا الأمر.',
    ru: 'Эту команду могут использовать только администраторы группы.',
    es: 'Solo los administradores del grupo pueden usar este comando.',
  },
};

export const t = makeT(strings);
