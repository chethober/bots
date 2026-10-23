// Core multilingual strings: the /start welcome, the /games menu chrome, the
// /language switcher and the source link. Individual game titles/descriptions
// stay in English (fallback) per the core-surface scope.
import { makeT } from './i18n.js';

const strings = {
  welcome: {
    en: '<b>Welcome to Chth Games, {name}!</b> 🎲\n\nYou have <b>{chips}</b> play-money chips (everyone starts with {start}).\nGrab {daily} more every day with /daily. Chips are just for fun — they can\'t be bought, sold or cashed out.\n\nPlay here, add me to a group, or type <code>@{bot}</code> in any chat to drop a game in.',
    fa: '<b>به چث گیمز خوش اومدی، {name}!</b> 🎲\n\nتو <b>{chips}</b> چیپِ بازیچه‌ای داری (همه با {start} شروع می‌کنن).\nهر روز با /daily تا {daily} تای دیگه بگیر. چیپ‌ها فقط برای سرگرمی‌ان — نه خرید می‌شن، نه فروش و نه نقد.\n\nهمین‌جا بازی کن، منو به یه گروه اضافه کن، یا توی هر چتی <code>@{bot}</code> رو تایپ کن تا یه بازی بندازم اونجا.',
    ar: '<b>مرحبًا بك في Chth Games يا {name}!</b> 🎲\n\nلديك <b>{chips}</b> رقاقة لعب (يبدأ الجميع بـ {start}).\nاحصل على {daily} إضافية كل يوم عبر /daily. الرقائق للمتعة فقط — لا تُشترى ولا تُباع ولا تُصرف.\n\nالعب هنا، أو أضفني إلى مجموعة، أو اكتب <code>@{bot}</code> في أي محادثة لإسقاط لعبة.',
    ru: '<b>Добро пожаловать в Chth Games, {name}!</b> 🎲\n\nУ тебя <b>{chips}</b> игровых фишек (все начинают с {start}).\nЗабирай ещё {daily} каждый день по /daily. Фишки только для веселья — их нельзя купить, продать или обналичить.\n\nИграй здесь, добавь меня в группу или набери <code>@{bot}</code> в любом чате, чтобы бросить туда игру.',
    es: '<b>¡Bienvenido a Chth Games, {name}!</b> 🎲\n\nTienes <b>{chips}</b> fichas de juego (todos empiezan con {start}).\nConsigue {daily} más cada día con /daily. Las fichas son solo por diversión — no se compran, venden ni cobran.\n\nJuega aquí, añádeme a un grupo o escribe <code>@{bot}</code> en cualquier chat para soltar una partida.',
  },
  menu_header: {
    en: '🎮 Pick a game', fa: '🎮 یه بازی انتخاب کن', ar: '🎮 اختر لعبة', ru: '🎮 Выбери игру', es: '🎮 Elige un juego',
  },
  wallet_line: {
    en: 'Wallet: /balance · /daily · /top', fa: 'کیف‌پول: /balance · /daily · /top',
    ar: 'المحفظة: /balance · /daily · /top', ru: 'Кошелёк: /balance · /daily · /top', es: 'Cartera: /balance · /daily · /top',
  },
  hub_line: {
    en: '🎮 <b>Game hub</b>: every game with full graphics, plus 🚀 Crash and 🔴 Plinko.',
    fa: '🎮 <b>هاب بازی</b>: همهٔ بازی‌ها با گرافیک کامل، به‌علاوهٔ 🚀 کرش و 🔴 پلینکو.',
    ar: '🎮 <b>مركز الألعاب</b>: كل الألعاب برسومات كاملة، بالإضافة إلى 🚀 Crash و🔴 Plinko.',
    ru: '🎮 <b>Игровой хаб</b>: все игры с полной графикой, плюс 🚀 Crash и 🔴 Plinko.',
    es: '🎮 <b>Centro de juegos</b>: todos los juegos con gráficos completos, más 🚀 Crash y 🔴 Plinko.',
  },
  source: { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },
  choose_language: {
    en: '🌐 Choose your language:', fa: '🌐 زبان خود را انتخاب کنید:', ar: '🌐 اختر لغتك:',
    ru: '🌐 Выберите язык:', es: '🌐 Elige tu idioma:',
  },
  source_here: {
    en: '📦 Source code:', fa: '📦 کد منبع:', ar: '📦 الكود المصدري:', ru: '📦 Исходный код:', es: '📦 Código fuente:',
  },
  language_set: {
    en: '✅ Language set to {name}.', fa: '✅ زبان به {name} تغییر کرد.', ar: '✅ تم ضبط اللغة على {name}.',
    ru: '✅ Язык изменён на {name}.', es: '✅ Idioma cambiado a {name}.',
  },
};

export const t = makeT(strings);
