// ⭐ Tip the developer with Telegram Stars, from the ℹ️ About screen. A tip buys nothing:
// no chips, features or perks, just a thank-you. Flow: the About screen's ⭐ Tip button
// (callback `tip`) swaps its buttons for the four treats below, each a Stars invoice link
// → handlers/pre_checkout_query.js checks it with validTip → message.successful_payment
// → thankTip. `tip:back` puts the About buttons back. 🤖 More bots (callback `tip:more`)
// swaps them for links to the developer's other bots, the same way.
//
// Every bot in this repo carries the same copy of this file; keep them identical.

import { api } from 'sdk';

// The invoice payload carries the treat and its price, so a price edited after the link
// was made is refused instead of charged.
export const TIPS = [
  { key: 'coffee', ico: '☕', stars: 50 },
  { key: 'fries', ico: '🍟', stars: 100 },
  { key: 'burger', ico: '🍔', stars: 250 },
  { key: 'pizza', ico: '🍕', stars: 500 },
];

// The developer's public bots, for 🤖 More bots. The bot showing the list leaves itself out.
export const BOTS = [
  { user: 'chthgamesbot', ico: '🎰', name: { en: 'Games', fa: 'بازی‌ها', ar: 'ألعاب', ru: 'Игры', es: 'Juegos' } },
  { user: 'chthvpnbot', ico: '🛡', name: { en: 'Community VPN', fa: 'وی‌پی‌ان اشتراکی', ar: 'VPN مجتمعي', ru: 'VPN сообщества', es: 'VPN comunitaria' } },
  { user: 'chthbrbot', ico: '🎭', name: { en: 'Anonymous messages', fa: 'پیام ناشناس', ar: 'رسائل مجهولة', ru: 'Анонимные сообщения', es: 'Mensajes anónimos' } },
  { user: 'chthapibot', ico: '🧰', name: { en: 'Multi-tool', fa: 'ابزار همه‌کاره', ar: 'أدوات متعددة', ru: 'Мультитул', es: 'Multiherramienta' } },
  { user: 'chsbrbot', ico: '🚨', name: { en: 'CVE alerts', fa: 'هشدار CVE', ar: 'تنبيهات CVE', ru: 'Оповещения CVE', es: 'Alertas CVE' } },
  { user: 'chthmusicbot', ico: '🎧', name: { en: 'Music sync', fa: 'همگام‌سازی موسیقی', ar: 'مزامنة الموسيقى', ru: 'Синхронизация музыки', es: 'Sincronizar música' } },
  { user: 'chthgrambot', ico: '🤵', name: { en: 'AI secretary', fa: 'منشی هوش مصنوعی', ar: 'سكرتير ذكي', ru: 'ИИ-секретарь', es: 'Secretario IA' } },
];

const S = {
  tip: { en: '⭐ Tip the developer', fa: '⭐ حمایت از سازنده', ar: '⭐ ادعم المطوّر', ru: '⭐ Поддержать разработчика', es: '⭐ Invita al desarrollador' },
  source: { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },
  more: { en: '🤖 More bots', fa: '🤖 بات‌های دیگه', ar: '🤖 بوتات أخرى', ru: '🤖 Другие боты', es: '🤖 Más bots' },
  back: { en: '« Back', fa: '« برگشت', ar: '« رجوع', ru: '« Назад', es: '« Atrás' },
  coffee: { en: 'Coffee', fa: 'قهوه', ar: 'قهوة', ru: 'Кофе', es: 'Café' },
  fries: { en: 'Fries', fa: 'سیب‌زمینی', ar: 'بطاطا مقلية', ru: 'Картошка фри', es: 'Papas fritas' },
  burger: { en: 'Burger', fa: 'همبرگر', ar: 'برغر', ru: 'Бургер', es: 'Hamburguesa' },
  pizza: { en: 'Pizza', fa: 'پیتزا', ar: 'بيتزا', ru: 'Пицца', es: 'Pizza' },
  desc: {
    en: 'A tip for the developer of this free bot. It doesn\'t unlock anything, it just says thanks. ❤️',
    fa: 'یه انعام برای سازندهٔ این بات رایگان. چیزی رو باز نمی‌کنه، فقط یه تشکره. ❤️',
    ar: 'إكرامية لمطوّر هذا البوت المجاني. لا تفتح أي ميزة، إنها مجرد شكر. ❤️',
    ru: 'Чаевые разработчику этого бесплатного бота. Ничего не открывают, просто спасибо. ❤️',
    es: 'Una propina para el desarrollador de este bot gratuito. No desbloquea nada, solo da las gracias. ❤️',
  },
  thanks: {
    en: '{ico} Thank you for the treat! Your tip keeps this bot going. ❤️',
    fa: '{ico} مرسی بابت مهمونی! حمایتت این بات رو سرپا نگه می‌داره. ❤️',
    ar: '{ico} شكرًا على الضيافة! إكراميتك تُبقي هذا البوت مستمرًا. ❤️',
    ru: '{ico} Спасибо за угощение! Твоя поддержка помогает боту жить. ❤️',
    es: '{ico} ¡Gracias por la invitación! Tu propina mantiene vivo este bot. ❤️',
  },
};

const tr = (locale, key, vars = {}) =>
  (S[key][locale] ?? S[key].en).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const isTipCallback = (data) => data === 'tip' || data === 'tip:back' || data === 'tip:more';

// The About screen's buttons: the bot's own rows (if any), then 🔗 Source code, ⭐ Tip and
// 🤖 More bots.
export function aboutKeyboard(locale, sourceUrl, rows = []) {
  return {
    inline_keyboard: [
      ...rows,
      [{ text: tr(locale, 'source'), url: sourceUrl }],
      [{ text: tr(locale, 'tip'), callback_data: 'tip' }, { text: tr(locale, 'more'), callback_data: 'tip:more' }],
    ],
  };
}

// The other bots, one link per row. `self` is this bot's username.
export function moreKeyboard(locale, self) {
  const others = BOTS.filter((b) => b.user.toLowerCase() !== String(self ?? '').toLowerCase());
  return {
    inline_keyboard: [
      ...others.map((b) => [{ text: `${b.ico} ${b.name[locale] ?? b.name.en}`, url: `https://t.me/${b.user}` }]),
      [{ text: tr(locale, 'back'), callback_data: 'tip:back' }],
    ],
  };
}

// The treats, two per row, each opening its Stars invoice. One reusable link per treat.
export async function tipKeyboard(locale) {
  const links = await Promise.all(TIPS.map((x) => api.createInvoiceLink({
    title: `${x.ico} ${tr(locale, x.key)}`,
    description: tr(locale, 'desc'),
    payload: `tip:${x.key}:${x.stars}`,
    currency: 'XTR',
    prices: [{ label: `${x.ico} ${tr(locale, x.key)}`, amount: x.stars }],
  })));
  const buttons = TIPS.map((x, i) => ({ text: `${x.ico} ${tr(locale, x.key)} · ⭐ ${x.stars}`, url: links[i] }));
  return {
    inline_keyboard: [buttons.slice(0, 2), buttons.slice(2), [{ text: tr(locale, 'back'), callback_data: 'tip:back' }]],
  };
}

// The `tip` / `tip:more` / `tip:back` callbacks: swap the About message's buttons in place.
// The About message is the bot's own, so its sender names the bot for moreKeyboard.
export async function onTipCallback(q, locale, aboutMarkup) {
  await api.answerCallbackQuery({ callback_query_id: q.id }).catch(() => {});
  const reply_markup = q.data === 'tip' ? await tipKeyboard(locale)
    : q.data === 'tip:more' ? moreKeyboard(locale, q.message.from?.username)
    : aboutMarkup;
  await api.editMessageReplyMarkup({ chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup })
    .catch(() => {}); // "message is not modified" on a double tap
}

// The treat a payment (pre-checkout query or successful_payment) is for, or null.
export function validTip(p) {
  const [tag, key, stars] = String(p?.invoice_payload ?? '').split(':');
  const tip = TIPS.find((x) => x.key === key);
  if (tag !== 'tip' || !tip || tip.stars !== Number(stars)) return null;
  return p.currency === 'XTR' && p.total_amount === tip.stars ? tip : null;
}

export const isTipPayment = (p) => String(p?.invoice_payload ?? '').startsWith('tip:');

// A successful tip: thank the tipper and tell the admins.
export async function thankTip(message, locale, adminIds = []) {
  const pay = message.successful_payment;
  const tip = validTip(pay) ?? { ico: '⭐' };
  await api.sendMessage({ chat_id: message.chat.id, text: tr(locale, 'thanks', { ico: tip.ico }) })
    .catch((e) => console.warn('tip thanks failed', e.description));
  const from = message.from;
  const name = esc([from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || from.id);
  const text = `${tip.ico} <b>Tip</b>: ⭐ ${pay.total_amount} from ${name} (<code>${from.id}</code>)\n<code>${esc(pay.telegram_payment_charge_id)}</code>`;
  for (const id of adminIds) {
    await api.sendMessage({ chat_id: id, text, parse_mode: 'HTML' }).catch((e) => console.warn('tip notify failed', id, e.description));
  }
}

// handlers/pre_checkout_query.js for a bot whose only payments are tips.
export async function answerTipCheckout(q) {
  await api.answerPreCheckoutQuery(validTip(q)
    ? { pre_checkout_query_id: q.id, ok: true }
    : { pre_checkout_query_id: q.id, ok: false, error_message: 'This tip button is out of date. Open ℹ️ About again.' });
}
