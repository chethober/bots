// Menu and chat strings, keyed: t(locale, key, vars). Game text itself is in
// dict.js, keyed by its English wording (see tr in i18n.js).
import { makeT } from './i18n.js';

const strings = {
  // Reply keyboard (private chat)
  kb_games:    { en: '🎮 Games', fa: '🎮 بازی‌ها', ar: '🎮 الألعاب', ru: '🎮 Игры', es: '🎮 Juegos' },
  kb_hub:      { en: '🕹 Game hub', fa: '🕹 هاب بازی', ar: '🕹 مركز الألعاب', ru: '🕹 Игровой хаб', es: '🕹 Centro de juegos' },
  kb_balance:  { en: '💰 Balance', fa: '💰 موجودی', ar: '💰 الرصيد', ru: '💰 Баланс', es: '💰 Saldo' },
  kb_daily:    { en: '🎁 Daily chips', fa: '🎁 چیپ روزانه', ar: '🎁 الرقائق اليومية', ru: '🎁 Ежедневные фишки', es: '🎁 Fichas diarias' },
  kb_top:      { en: '🏆 Top players', fa: '🏆 برترین‌ها', ar: '🏆 أفضل اللاعبين', ru: '🏆 Лучшие игроки', es: '🏆 Mejores jugadores' },
  kb_language: { en: '🌐 Language', fa: '🌐 زبان', ar: '🌐 اللغة', ru: '🌐 Язык', es: '🌐 Idioma' },
  kb_shop:     { en: '💎 Buy chips', fa: '💎 خرید چیپ', ar: '💎 شراء رقائق', ru: '💎 Купить фишки', es: '💎 Comprar fichas' },
  kb_source:   { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },

  welcome: {
    en: '<b>Welcome to Chth Games, {name}!</b> 🎲\n\nYou have <b>{chips}</b> play-money chips (everyone starts with {start}).\nGrab {daily} more every day with 🎁 Daily chips. Want more? 💎 Buy chips with Telegram Stars. Chips are for play only — they can\'t be sold, sent or cashed out.\n\nPlay here with the buttons below, add me to a group, or type <code>@{bot}</code> in any chat to drop a game in.',
    fa: '<b>به چث گیمز خوش اومدی، {name}!</b> 🎲\n\nتو <b>{chips}</b> چیپِ بازیچه‌ای داری (همه با {start} شروع می‌کنن).\nهر روز با «🎁 چیپ روزانه» تا {daily} تای دیگه بگیر. بیشتر می‌خوای؟ با «💎 خرید چیپ» و استارز تلگرام بخر. چیپ‌ها فقط برای بازی‌ان — نه فروخته می‌شن، نه منتقل و نه نقد.\n\nبا دکمه‌های پایین همین‌جا بازی کن، منو به یه گروه اضافه کن، یا توی هر چتی <code>@{bot}</code> رو تایپ کن تا یه بازی بندازم اونجا.',
    ar: '<b>مرحبًا بك في Chth Games يا {name}!</b> 🎲\n\nلديك <b>{chips}</b> رقاقة لعب (يبدأ الجميع بـ {start}).\nاحصل على {daily} إضافية كل يوم عبر «🎁 الرقائق اليومية». تريد المزيد؟ «💎 اشترِ رقائق» بنجوم تيليجرام. الرقائق للعب فقط — لا تُباع ولا تُحوَّل ولا تُصرف.\n\nالعب هنا بالأزرار بالأسفل، أو أضفني إلى مجموعة، أو اكتب <code>@{bot}</code> في أي محادثة لإسقاط لعبة.',
    ru: '<b>Добро пожаловать в Chth Games, {name}!</b> 🎲\n\nУ тебя <b>{chips}</b> игровых фишек (все начинают с {start}).\nЗабирай ещё {daily} каждый день кнопкой «🎁 Ежедневные фишки». Нужно больше? «💎 Купить фишки» за Telegram Stars. Фишки только для игры — их нельзя продать, передать или обналичить.\n\nИграй здесь кнопками внизу, добавь меня в группу или набери <code>@{bot}</code> в любом чате, чтобы бросить туда игру.',
    es: '<b>¡Bienvenido a Chth Games, {name}!</b> 🎲\n\nTienes <b>{chips}</b> fichas de juego (todos empiezan con {start}).\nConsigue {daily} más cada día con «🎁 Fichas diarias». ¿Quieres más? «💎 Comprar fichas» con Telegram Stars. Las fichas son solo para jugar: no se venden, transfieren ni cobran.\n\nJuega aquí con los botones de abajo, añádeme a un grupo o escribe <code>@{bot}</code> en cualquier chat para soltar una partida.',
  },
  menu_header: {
    en: '🎮 Pick a game', fa: '🎮 یه بازی انتخاب کن', ar: '🎮 اختر لعبة', ru: '🎮 Выбери игру', es: '🎮 Elige un juego',
  },
  hub_line: {
    en: '🎮 <b>Game hub</b>: every game with full graphics, plus 🚀 Crash and 🔴 Plinko.',
    fa: '🎮 <b>هاب بازی</b>: همهٔ بازی‌ها با گرافیک کامل، به‌علاوهٔ 🚀 کرش و 🔴 پلینکو.',
    ar: '🎮 <b>مركز الألعاب</b>: كل الألعاب برسومات كاملة، بالإضافة إلى 🚀 Crash و🔴 Plinko.',
    ru: '🎮 <b>Игровой хаб</b>: все игры с полной графикой, плюс 🚀 Crash и 🔴 Plinko.',
    es: '🎮 <b>Centro de juegos</b>: todos los juegos con gráficos completos, más 🚀 Crash y 🔴 Plinko.',
  },
  open_hub: { en: '🎮 Open game hub', fa: '🎮 باز کردن هاب بازی', ar: '🎮 فتح مركز الألعاب', ru: '🎮 Открыть игровой хаб', es: '🎮 Abrir el centro de juegos' },
  hub_private: {
    en: 'Every game, with full graphics, lives in the game hub:', fa: 'همهٔ بازی‌ها با گرافیک کامل توی هاب بازی‌ان:',
    ar: 'كل الألعاب برسومات كاملة في مركز الألعاب:', ru: 'Все игры с полной графикой — в игровом хабе:',
    es: 'Todos los juegos, con gráficos completos, están en el centro de juegos:',
  },
  choose_stake: {
    en: '<b>{title}</b>\n{about}\n\nYour balance: {chips}\nChoose a stake:',
    fa: '<b>{title}</b>\n{about}\n\nموجودی تو: {chips}\nمبلغ شرط رو انتخاب کن:',
    ar: '<b>{title}</b>\n{about}\n\nرصيدك: {chips}\nاختر الرهان:',
    ru: '<b>{title}</b>\n{about}\n\nТвой баланс: {chips}\nВыбери ставку:',
    es: '<b>{title}</b>\n{about}\n\nTu saldo: {chips}\nElige una apuesta:',
  },
  back: { en: '« Back', fa: '« برگشت', ar: '« رجوع', ru: '« Назад', es: '« Atrás' },
  needs_players: {
    en: '{title} needs other players. Pick a chat to send it to:', fa: '{title} بازیکن‌های دیگه لازم داره. یه چت انتخاب کن تا بفرستمش:',
    ar: '{title} تحتاج لاعبين آخرين. اختر محادثة لإرسالها إليها:', ru: 'Для игры {title} нужны другие игроки. Выбери чат, куда её отправить:',
    es: '{title} necesita más jugadores. Elige un chat al que enviarlo:',
  },
  send_game: { en: '📤 Send {title}', fa: '📤 فرستادن {title}', ar: '📤 إرسال {title}', ru: '📤 Отправить {title}', es: '📤 Enviar {title}' },

  // Wallet
  wallet: {
    en: '<b>{name}</b>\n💰 Balance: <b>{chips}</b>\n🎮 Games: {played} · 🏆 Wins: {wins}\n🎲 Wagered: {wagered} · 🌟 Best win: {best}',
    fa: '<b>{name}</b>\n💰 موجودی: <b>{chips}</b>\n🎮 بازی‌ها: {played} · 🏆 بردها: {wins}\n🎲 کل شرط‌ها: {wagered} · 🌟 بیشترین برد: {best}',
    ar: '<b>{name}</b>\n💰 الرصيد: <b>{chips}</b>\n🎮 الألعاب: {played} · 🏆 الانتصارات: {wins}\n🎲 مجموع الرهانات: {wagered} · 🌟 أكبر ربح: {best}',
    ru: '<b>{name}</b>\n💰 Баланс: <b>{chips}</b>\n🎮 Игр: {played} · 🏆 Побед: {wins}\n🎲 Поставлено: {wagered} · 🌟 Лучший выигрыш: {best}',
    es: '<b>{name}</b>\n💰 Saldo: <b>{chips}</b>\n🎮 Partidas: {played} · 🏆 Victorias: {wins}\n🎲 Apostado: {wagered} · 🌟 Mejor premio: {best}',
  },
  daily_got: {
    en: '🎁 +{daily}! Balance: <b>{chips}</b>', fa: '🎁 +{daily}! موجودی: <b>{chips}</b>', ar: '🎁 +{daily}! الرصيد: <b>{chips}</b>',
    ru: '🎁 +{daily}! Баланс: <b>{chips}</b>', es: '🎁 ¡+{daily}! Saldo: <b>{chips}</b>',
  },
  daily_wait: {
    en: '⏳ Next bonus in {h}h. Balance: {chips}', fa: '⏳ جایزهٔ بعدی تا {h} ساعت دیگه. موجودی: {chips}',
    ar: '⏳ المكافأة التالية بعد {h} ساعة. الرصيد: {chips}', ru: '⏳ Следующий бонус через {h} ч. Баланс: {chips}',
    es: '⏳ Próximo bono en {h} h. Saldo: {chips}',
  },
  top_title: { en: '🏆 Richest players', fa: '🏆 پولدارترین بازیکن‌ها', ar: '🏆 أغنى اللاعبين', ru: '🏆 Самые богатые игроки', es: '🏆 Jugadores más ricos' },
  banned: {
    en: '🚫 You are banned from playing.', fa: '🚫 تو از بازی محروم شدی.', ar: '🚫 أنت ممنوع من اللعب.',
    ru: '🚫 Тебе запрещено играть.', es: '🚫 Tienes prohibido jugar.',
  },
  room_invite: {
    en: "🎮 You're invited to a game room:", fa: '🎮 به یه اتاق بازی دعوت شدی:', ar: '🎮 أنت مدعو إلى غرفة لعب:',
    ru: '🎮 Тебя пригласили в игровую комнату:', es: '🎮 Te invitaron a una sala de juego:',
  },
  open_room: { en: '▶️ Open the room', fa: '▶️ باز کردن اتاق', ar: '▶️ فتح الغرفة', ru: '▶️ Открыть комнату', es: '▶️ Abrir la sala' },
  old_invite: {
    en: 'That old invite has expired — start a new game from 🎮 Games or the game hub.',
    fa: 'اون دعوت قدیمی منقضی شده — از «🎮 بازی‌ها» یا هاب بازی یه بازی جدید شروع کن.',
    ar: 'انتهت صلاحية تلك الدعوة القديمة — ابدأ لعبة جديدة من «🎮 الألعاب» أو مركز الألعاب.',
    ru: 'Это старое приглашение истекло — начни новую игру через «🎮 Игры» или игровой хаб.',
    es: 'Esa invitación antigua caducó: empieza una partida nueva desde «🎮 Juegos» o el centro de juegos.',
  },
  use_buttons: {
    en: 'Use the buttons below 👇', fa: 'از دکمه‌های پایین استفاده کن 👇', ar: 'استخدم الأزرار بالأسفل 👇',
    ru: 'Пользуйся кнопками внизу 👇', es: 'Usa los botones de abajo 👇',
  },
  group_hello: {
    en: '🎲 Tap a game to start it here. Anyone can also type <code>@{bot}</code> to drop one in.',
    fa: '🎲 روی یه بازی بزن تا همین‌جا شروع بشه. هر کسی هم می‌تونه <code>@{bot}</code> رو تایپ کنه تا یه بازی بندازه.',
    ar: '🎲 اضغط على لعبة لبدئها هنا. ويمكن لأي شخص كتابة <code>@{bot}</code> لإسقاط لعبة.',
    ru: '🎲 Нажми на игру, чтобы начать её здесь. Ещё можно набрать <code>@{bot}</code>, чтобы бросить игру.',
    es: '🎲 Pulsa un juego para empezarlo aquí. Cualquiera puede escribir <code>@{bot}</code> para soltar uno.',
  },
  chips_n: { en: '{title} · {n} chips', fa: '{title} · {n} چیپ', ar: '{title} · {n} رقاقة', ru: '{title} · {n} фишек', es: '{title} · {n} fichas' },
  something_wrong: {
    en: 'Something went wrong — try again.', fa: 'مشکلی پیش اومد — دوباره امتحان کن.', ar: 'حدث خطأ — حاول مجددًا.',
    ru: 'Что-то пошло не так — попробуй ещё раз.', es: 'Algo salió mal; inténtalo de nuevo.',
  },
  dead_button: {
    en: 'This button no longer works.', fa: 'این دکمه دیگه کار نمی‌کنه.', ar: 'هذا الزر لم يعد يعمل.',
    ru: 'Эта кнопка больше не работает.', es: 'Este botón ya no funciona.',
  },

  // 💎 Buy chips (lib/shop.js)
  shop: {
    en: '<b>💎 Buy chips</b>\nYour balance: <b>{chips}</b>\n\nPay with Telegram Stars ⭐. Chips arrive right after payment.\nChips are for play only: they can\'t be sold, sent to others or cashed out.\nProblem with a payment? /paysupport',
    fa: '<b>💎 خرید چیپ</b>\nموجودی تو: <b>{chips}</b>\n\nبا استارز تلگرام ⭐ پرداخت کن. چیپ‌ها بلافاصله بعد از پرداخت میان.\nچیپ‌ها فقط برای بازی‌ان: نه فروخته می‌شن، نه به کسی منتقل و نه نقد.\nمشکلی با پرداخت داری؟ /paysupport',
    ar: '<b>💎 شراء رقائق</b>\nرصيدك: <b>{chips}</b>\n\nادفع بنجوم تيليجرام ⭐. تصل الرقائق فور الدفع.\nالرقائق للعب فقط: لا تُباع ولا تُرسل لآخرين ولا تُصرف.\nمشكلة في الدفع؟ /paysupport',
    ru: '<b>💎 Купить фишки</b>\nТвой баланс: <b>{chips}</b>\n\nОплата в Telegram Stars ⭐. Фишки приходят сразу после оплаты.\nФишки только для игры: их нельзя продать, передать или обналичить.\nПроблема с оплатой? /paysupport',
    es: '<b>💎 Comprar fichas</b>\nTu saldo: <b>{chips}</b>\n\nPaga con Telegram Stars ⭐. Las fichas llegan justo después del pago.\nLas fichas son solo para jugar: no se venden, no se envían a otros y no se cobran.\n¿Problema con un pago? /paysupport',
  },
  pack_btn: { en: '{chips} · ⭐ {stars}', fa: '{chips} · ⭐ {stars}', ar: '{chips} · ⭐ {stars}', ru: '{chips} · ⭐ {stars}', es: '{chips} · ⭐ {stars}' },
  pack_title: { en: '{chips} chips', fa: '{chips} چیپ', ar: '{chips} رقاقة', ru: '{chips} фишек', es: '{chips} fichas' },
  pack_desc: {
    en: '{chips} play chips for Chth Games. Chips are for play only and can\'t be cashed out.',
    fa: '{chips} چیپ بازی برای چث گیمز. چیپ‌ها فقط برای بازی‌ان و نقد نمی‌شن.',
    ar: '{chips} رقاقة لعب في Chth Games. الرقائق للعب فقط ولا تُصرف.',
    ru: '{chips} игровых фишек для Chth Games. Фишки только для игры и не обналичиваются.',
    es: '{chips} fichas de juego para Chth Games. Son solo para jugar y no se pueden cobrar.',
  },
  paid: {
    en: '✅ Thanks! <b>+{n}</b> added.\nBalance: <b>{chips}</b>',
    fa: '✅ ممنون! <b>+{n}</b> اضافه شد.\nموجودی: <b>{chips}</b>',
    ar: '✅ شكرًا! أُضيفت <b>+{n}</b>.\nالرصيد: <b>{chips}</b>',
    ru: '✅ Спасибо! Начислено <b>+{n}</b>.\nБаланс: <b>{chips}</b>',
    es: '✅ ¡Gracias! Se añadieron <b>+{n}</b>.\nSaldo: <b>{chips}</b>',
  },
  pay_failed: {
    en: '⚠️ Your payment went through but the chips couldn\'t be added. An admin has been told — or write /paysupport.',
    fa: '⚠️ پرداختت انجام شد ولی چیپ‌ها اضافه نشد. به ادمین خبر دادیم — یا /paysupport بنویس.',
    ar: '⚠️ تم الدفع لكن تعذّرت إضافة الرقائق. أُبلغ المشرف — أو اكتب /paysupport.',
    ru: '⚠️ Оплата прошла, но фишки не начислились. Админ уже знает — или напиши /paysupport.',
    es: '⚠️ El pago se hizo pero no se pudieron añadir las fichas. Ya avisamos a un admin; o escribe /paysupport.',
  },
  pay_refunded: {
    en: '↩️ Your payment of ⭐ {stars} was refunded and {n} were removed. Balance: <b>{chips}</b>',
    fa: '↩️ پرداخت ⭐ {stars} تو برگشت داده شد و {n} کم شد. موجودی: <b>{chips}</b>',
    ar: '↩️ أُعيدت دفعتك ⭐ {stars} وأُزيلت {n}. الرصيد: <b>{chips}</b>',
    ru: '↩️ Платёж ⭐ {stars} возвращён, списано {n}. Баланс: <b>{chips}</b>',
    es: '↩️ Se reembolsó tu pago de ⭐ {stars} y se retiraron {n}. Saldo: <b>{chips}</b>',
  },
  pay_start_first: {
    en: 'Open the bot and press Start first.', fa: 'اول ربات رو باز کن و Start رو بزن.', ar: 'افتح البوت واضغط Start أولًا.',
    ru: 'Сначала открой бота и нажми Start.', es: 'Abre el bot y pulsa Start primero.',
  },
  pay_stale: {
    en: 'This offer has changed — open 💎 Buy chips again.', fa: 'این پیشنهاد عوض شده — دوباره «💎 خرید چیپ» رو باز کن.',
    ar: 'تغيّر هذا العرض — افتح «💎 شراء رقائق» مجددًا.', ru: 'Предложение изменилось — открой «💎 Купить фишки» снова.',
    es: 'Esta oferta cambió: abre «💎 Comprar fichas» otra vez.',
  },
  paysupport: {
    en: '<b>💬 Payment support</b>\nFor a problem with a purchase, send <code>/paysupport</code> followed by what happened, e.g. <code>/paysupport I paid but got no chips</code>. An admin will get back to you here.\n\nYour recent payments:\n{list}',
    fa: '<b>💬 پشتیبانی پرداخت</b>\nبرای مشکل خرید، <code>/paysupport</code> رو با توضیح ماجرا بفرست، مثلاً <code>/paysupport پرداخت کردم ولی چیپ نیومد</code>. ادمین همین‌جا جوابت رو می‌ده.\n\nپرداخت‌های اخیرت:\n{list}',
    ar: '<b>💬 دعم المدفوعات</b>\nلمشكلة في عملية شراء، أرسل <code>/paysupport</code> متبوعًا بما حدث، مثل <code>/paysupport دفعت ولم تصلني رقائق</code>. سيرد عليك مشرف هنا.\n\nمدفوعاتك الأخيرة:\n{list}',
    ru: '<b>💬 Поддержка платежей</b>\nЕсли с покупкой что-то не так, отправь <code>/paysupport</code> и опиши проблему, например <code>/paysupport оплатил, но фишек нет</code>. Админ ответит здесь.\n\nТвои последние платежи:\n{list}',
    es: '<b>💬 Soporte de pagos</b>\nSi tienes un problema con una compra, envía <code>/paysupport</code> y lo que pasó, p. ej. <code>/paysupport pagué y no recibí fichas</code>. Un admin te responderá aquí.\n\nTus pagos recientes:\n{list}',
  },
  paysupport_none: { en: '— none —', fa: '— هیچی —', ar: '— لا شيء —', ru: '— нет —', es: '— ninguno —' },
  paysupport_sent: {
    en: '✅ Sent to the admins. They\'ll answer here.', fa: '✅ برای ادمین‌ها فرستاده شد. همین‌جا جواب می‌دن.',
    ar: '✅ أُرسلت إلى المشرفين. سيردّون هنا.', ru: '✅ Отправлено админам. Они ответят здесь.',
    es: '✅ Enviado a los admins. Te responderán aquí.',
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
};

export const t = makeT(strings);
