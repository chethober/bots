// endpoints/setup.js — one-off: applies the bot profile. Descriptions in every
// language; no command menu in private chats (they have the reply keyboard),
// while groups keep the command list, since commands are how a group uses the bot.
//
//   npx tgcloud run endpoints/setup '{}'
//
// Only for `tgcloud run`: calls from a Mini App carry initData and are refused.

import { api, EndpointError } from 'sdk';
import { MENU_COMMANDS } from '../lib/hubs/main.js';

const PROFILE = {
  en: ['👋 A pocket multi-tool: crypto prices, watchlists, alerts and a portfolio; live scores and fixtures for the teams you follow; recipes, cocktails and coffee; dice, picks, books, movies and trivia; and a daily briefing with your weather. Works in groups too.',
    'Crypto, sports, food and drinks, random picks and a daily briefing.'],
  fa: ['👋 یه چندکارهٔ جیبی: قیمت کریپتو، فهرست دنبال‌شده، هشدار و پرتفوی؛ نتایج زنده و برنامهٔ تیم‌هایی که دنبال می‌کنی؛ دستور غذا، کوکتل و قهوه؛ تاس، انتخاب تصادفی، کتاب، فیلم و مسابقهٔ اطلاعات عمومی؛ و خلاصهٔ روزانه با هوای شهرت. در گروه‌ها هم کار می‌کنه.',
    'کریپتو، ورزش، خوراکی و نوشیدنی، انتخاب تصادفی و خلاصهٔ روزانه.'],
  ar: ['👋 أداة متعددة في جيبك: أسعار العملات الرقمية وقوائم المتابعة والتنبيهات والمحفظة؛ النتائج المباشرة والمواعيد للفرق التي تتابعها؛ الوصفات والكوكتيلات والقهوة؛ النرد والاختيارات والكتب والأفلام والمسابقات؛ وموجز يومي مع طقسك. تعمل في المجموعات أيضًا.',
    'العملات الرقمية والرياضة والطعام والشراب والاختيارات العشوائية وموجز يومي.'],
  ru: ['👋 Карманный мультитул: курсы криптовалют, список отслеживания, оповещения и портфель; live-счёт и расписание твоих команд; рецепты, коктейли и кофе; кубики, случайный выбор, книги, фильмы и викторины; и ежедневная сводка с погодой. Работает и в группах.',
    'Крипто, спорт, еда и напитки, случайный выбор и ежедневная сводка.'],
  es: ['👋 Una multiherramienta de bolsillo: precios cripto, lista de seguimiento, alertas y cartera; resultados en vivo y calendario de tus equipos; recetas, cócteles y café; dados, elecciones al azar, libros, películas y trivia; y un resumen diario con tu tiempo. También funciona en grupos.',
    'Cripto, deportes, comida y bebida, elecciones al azar y un resumen diario.'],
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
  done.push('private-chat commands removed');
  await api.setMyCommands({ commands: MENU_COMMANDS, scope: { type: 'all_group_chats' } });
  done.push(`${MENU_COMMANDS.length} group commands`);
  return { done };
}
