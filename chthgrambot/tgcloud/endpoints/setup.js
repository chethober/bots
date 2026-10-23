// endpoints/setup.js — one-off: applies the bot profile. Descriptions in every
// language and no command menu (the private chat runs on the reply keyboard).
//
//   npx tgcloud run endpoints/setup '{}'
//
// Only for `tgcloud run`: calls from the Mini App carry initData and are refused.

import { api, EndpointError } from 'sdk';

const PROFILE = {
  en: ['An AI secretary for your Telegram Business account. While you\'re away I answer your private chats with Cloudflare Workers AI — in your tone, or even in your own style — and forward photos, voice messages and files to you.\n\nPress Start, connect a free Cloudflare AI key with one button, then add me in Settings → Telegram Business → Chatbots.',
    'AI secretary for Telegram Business: answers your chats while you\'re away, in your style.'],
  fa: ['منشی هوش مصنوعی برای حساب تلگرام بیزینس. وقتی نیستی، چت‌های خصوصیت رو با Cloudflare Workers AI جواب می‌دم — با لحنی که می‌خوای یا حتی به سبک خودت — و عکس، ویس و فایل‌ها رو برات می‌فرستم.\n\n«شروع» رو بزن، با یه دکمه یه کلید رایگان Cloudflare AI وصل کن، بعد منو در تنظیمات → Telegram Business → Chatbots اضافه کن.',
    'منشی هوش مصنوعی تلگرام بیزینس: وقتی نیستی به سبک خودت جواب می‌ده.'],
  ar: ['سكرتير بالذكاء الاصطناعي لحساب Telegram Business. أثناء غيابك أرد على محادثاتك الخاصة عبر Cloudflare Workers AI — بالنبرة التي تختارها أو حتى بأسلوبك — وأحوّل إليك الصور والرسائل الصوتية والملفات.\n\nاضغط «ابدأ»، واربط مفتاح Cloudflare AI مجانيًا بزر واحد، ثم أضفني من الإعدادات → Telegram Business → Chatbots.',
    'سكرتير ذكاء اصطناعي لـ Telegram Business: يرد على محادثاتك أثناء غيابك بأسلوبك.'],
  ru: ['ИИ-секретарь для аккаунта Telegram Business. Пока тебя нет, отвечаю на личные чаты через Cloudflare Workers AI — нужным тоном или даже в твоём стиле — и пересылаю тебе фото, голосовые и файлы.\n\nНажми «Старт», подключи бесплатный ключ Cloudflare AI одной кнопкой и добавь меня в Настройки → Telegram Business → Chatbots.',
    'ИИ-секретарь Telegram Business: отвечает на чаты, пока тебя нет, в твоём стиле.'],
  es: ['Un secretario con IA para tu cuenta de Telegram Business. Mientras no estás, respondo tus chats privados con Cloudflare Workers AI — en el tono que elijas o incluso con tu propio estilo — y te reenvío fotos, notas de voz y archivos.\n\nPulsa Iniciar, conecta una clave gratuita de Cloudflare AI con un botón y añádeme en Ajustes → Telegram Business → Chatbots.',
    'Secretario con IA para Telegram Business: responde tus chats cuando no estás, a tu estilo.'],
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
  done.push('commands removed');
  return { done };
}
