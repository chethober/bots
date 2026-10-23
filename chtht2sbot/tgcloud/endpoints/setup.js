// endpoints/setup.js — one-off: applies the bot profile. Descriptions in every
// language, no command menu for users (they have the reply keyboard) and the
// admin commands in each admin's chat (ADMIN_IDS; forum admins get theirs on /start).
//
//   npx tgcloud run endpoints/setup '{}'
//
// Only for `tgcloud run`: calls from a Mini App carry initData and are refused.

import { api, EndpointError } from 'sdk';
import { ADMIN_IDS } from '../lib/config.js';
import { ADMIN_COMMANDS } from '../lib/panel.js';

const PROFILE = {
  en: ['I watch a forum\'s topics and file every posted track — Spotify, YouTube, Apple Music, Deezer, SoundCloud, Tidal links and audio files — into a Spotify playlist per topic. Reposts of a track already in the playlist are removed.',
    'Files every track posted in a forum topic into that topic\'s Spotify playlist.'],
  fa: ['موضوع‌های یه گروه انجمنی رو زیر نظر دارم و هر آهنگی که فرستاده بشه — لینک اسپاتیفای، یوتیوب، اپل موزیک، دیزر، ساندکلاد، تایدال و فایل صوتی — رو به پلی‌لیست اسپاتیفای همون موضوع اضافه می‌کنم. ارسال دوبارهٔ آهنگ تکراری حذف می‌شه.',
    'هر آهنگی که توی یه موضوع فرستاده بشه رو به پلی‌لیست اسپاتیفای اون موضوع اضافه می‌کنم.'],
  ar: ['أراقب مواضيع مجموعة منتدى وأضيف كل مقطع يُنشر — روابط Spotify وYouTube وApple Music وDeezer وSoundCloud وTidal والملفات الصوتية — إلى قائمة تشغيل Spotify لكل موضوع. تُحذف إعادة نشر مقطع موجود.',
    'أضيف كل مقطع يُنشر في موضوع إلى قائمة تشغيل Spotify الخاصة به.'],
  ru: ['Слежу за темами форум-группы и добавляю каждый трек — ссылки Spotify, YouTube, Apple Music, Deezer, SoundCloud, Tidal и аудиофайлы — в Spotify-плейлист темы. Повторы уже добавленных треков удаляются.',
    'Добавляю каждый трек из темы форума в Spotify-плейлист этой темы.'],
  es: ['Vigilo los temas de un grupo-foro y guardo cada pista publicada — enlaces de Spotify, YouTube, Apple Music, Deezer, SoundCloud, Tidal y archivos de audio — en una lista de Spotify por tema. Se borran los repetidos.',
    'Guardo cada pista publicada en un tema en la lista de Spotify de ese tema.'],
};

export default async function (input, ctx) {
  if (ctx?.initData) throw new EndpointError('Not available', { code: 'FORBIDDEN' });
  const done = [];
  for (const lang of [null, 'en', 'fa', 'ar', 'ru', 'es']) {
    const [description, short_description] = PROFILE[lang ?? 'en'];
    const language_code = lang ?? undefined;
    await api.setMyDescription({ description, language_code });
    await api.setMyShortDescription({ short_description, language_code });
    done.push(`description (${lang ?? 'default'})`);
  }
  await api.deleteMyCommands({});
  done.push('user commands removed');
  for (const chat_id of ADMIN_IDS) {
    try {
      await api.setMyCommands({ commands: ADMIN_COMMANDS, scope: { type: 'chat', chat_id } });
      done.push(`admin commands for ${chat_id}`);
    } catch (e) {
      done.push(`admin commands for ${chat_id} failed (has the admin pressed Start?): ${e.description ?? e.message}`);
    }
  }
  return { done };
}
