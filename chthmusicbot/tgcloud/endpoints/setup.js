// endpoints/setup.js — one-off: applies the bot profile. Descriptions in every
// language, no command menu in private chats (users have the reply keyboard)
// and /player and /sync in groups.
//
//   npx tgcloud run endpoints/setup '{}'
//
// Only for `tgcloud run`: calls from a Mini App carry initData and are refused.

import { api, EndpointError } from 'sdk';

const PROFILE = {
  en: ['I sync your playlists with Telegram. Link a Spotify, YouTube Music or Apple Music playlist to a group, forum or channel: tracks posted in the chat are added to the playlist, and the playlist\'s tracks are posted in the chat when you tap Sync. Plus a shared Spotify queue for groups and song search.',
    'Sync Spotify, YouTube Music and Apple Music playlists with your groups and channels.'],
  fa: ['پلی‌لیست‌هات رو با تلگرام همگام می‌کنم. یه پلی‌لیست اسپاتیفای، یوتیوب موزیک یا اپل موزیک رو به یه گروه، انجمن یا کانال وصل کن: آهنگ‌هایی که توی چت فرستاده می‌شن به پلی‌لیست اضافه می‌شن، و با زدن همگام‌سازی آهنگ‌های پلی‌لیست توی چت پست می‌شن. به‌علاوه صف مشترک اسپاتیفای برای گروه‌ها و جستجوی آهنگ.',
    'همگام‌سازی پلی‌لیست‌های اسپاتیفای، یوتیوب موزیک و اپل موزیک با گروه‌ها و کانال‌هات.'],
  ar: ['أزامن قوائم التشغيل مع تيليجرام. اربط قائمة Spotify أو YouTube Music أو Apple Music بمجموعة أو منتدى أو قناة: تُضاف المقاطع المنشورة في الدردشة إلى القائمة، وتُنشر مقاطع القائمة في الدردشة عند الضغط على مزامنة. بالإضافة إلى قائمة انتظار Spotify مشتركة للمجموعات وبحث عن الأغاني.',
    'زامن قوائم Spotify وYouTube Music وApple Music مع مجموعاتك وقنواتك.'],
  ru: ['Синхронизирую плейлисты с Telegram. Привяжи плейлист Spotify, YouTube Music или Apple Music к группе, форуму или каналу: треки из чата добавляются в плейлист, а треки плейлиста публикуются в чате по кнопке «Синхронизировать». А ещё общая очередь Spotify для групп и поиск песен.',
    'Синхронизация плейлистов Spotify, YouTube Music и Apple Music с группами и каналами.'],
  es: ['Sincronizo tus listas con Telegram. Vincula una lista de Spotify, YouTube Music o Apple Music a un grupo, foro o canal: las pistas publicadas en el chat se añaden a la lista, y las de la lista se publican en el chat al tocar Sincronizar. Además, una cola de Spotify compartida para grupos y búsqueda de canciones.',
    'Sincroniza listas de Spotify, YouTube Music y Apple Music con tus grupos y canales.'],
};

const GROUP_COMMANDS = {
  en: [['player', 'Group player: share your Spotify queue'], ['sync', 'Admins: link this chat or topic to a playlist']],
  fa: [['player', 'پخش گروهی: صف اسپاتیفای‌ت رو به اشتراک بذار'], ['sync', 'مدیرها: این چت یا موضوع رو به یه پلی‌لیست وصل کن']],
  ar: [['player', 'مشغل المجموعة: شارك قائمة انتظار Spotify'], ['sync', 'للمشرفين: اربط هذه الدردشة أو الموضوع بقائمة تشغيل']],
  ru: [['player', 'Плеер группы: общая очередь твоего Spotify'], ['sync', 'Админам: привязать чат или тему к плейлисту']],
  es: [['player', 'Reproductor del grupo: comparte tu cola de Spotify'], ['sync', 'Admins: vincular este chat o tema a una lista']],
};

export default async function (input, ctx) {
  if (ctx?.initData) throw new EndpointError('Not available', { code: 'FORBIDDEN' });
  const done = [];
  await api.deleteMyCommands({});
  done.push('private command menu removed');
  for (const lang of [null, 'en', 'fa', 'ar', 'ru', 'es']) {
    const [description, short_description] = PROFILE[lang ?? 'en'];
    const language_code = lang ?? undefined;
    await api.setMyDescription({ description, language_code });
    await api.setMyShortDescription({ short_description, language_code });
    const commands = GROUP_COMMANDS[lang ?? 'en'].map(([command, desc]) => ({ command, description: desc }));
    await api.setMyCommands({ commands, scope: { type: 'all_group_chats' }, language_code });
    done.push(`description and group commands (${lang ?? 'default'})`);
  }
  return { done };
}
