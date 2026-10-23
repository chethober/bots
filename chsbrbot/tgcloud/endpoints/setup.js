// endpoints/setup.js — one-off: applies the bot profile. Descriptions in every
// language, no command menu for users (they have the reply keyboard) and the
// admin commands in each admin's chat (ADMIN_IDS).
//
//   npx tgcloud run endpoints/setup '{}'
//
// Only for `tgcloud run`: calls from a Mini App carry initData and are refused.

import { api, EndpointError } from 'sdk';
import { ADMIN_IDS } from '../lib/config.js';
import { ADMIN_COMMANDS } from '../lib/views.js';

const PROFILE = {
  en: ['🛡️ Real-time CVE alerts. I post newly published High and Critical vulnerabilities from NVD, and CVEs that CISA lists as exploited in the wild or that have a public exploit on GitHub, with EPSS scores. Search any CVE by product, bug type or ID. Add me to a channel or group to post the alerts there.',
    'Real-time CVE alerts: new High/Critical CVEs, exploited and trending vulnerabilities, CVE search.'],
  fa: ['🛡️ هشدار لحظه‌ای CVE. آسیب‌پذیری‌های تازهٔ High و Critical را از NVD می‌فرستم، به‌علاوهٔ CVEهایی که CISA آن‌ها را اکسپلویت‌شده در عمل می‌داند یا در گیت‌هاب اکسپلویت عمومی دارند، همراه با امتیاز EPSS. هر CVE را با نام محصول، نوع باگ یا شناسه جستجو کن. من را به کانال یا گروه اضافه کن تا هشدارها آن‌جا هم بیایند.',
    'هشدار لحظه‌ای CVE: آسیب‌پذیری‌های تازهٔ High/Critical، CVEهای اکسپلویت‌شده و داغ، جستجوی CVE.'],
  ar: ['🛡️ تنبيهات CVE فورية. أنشر الثغرات الجديدة من فئتي High وCritical من NVD، والثغرات التي تصنّفها CISA مستغلة فعليًا أو التي لها استغلال منشور على GitHub، مع درجات EPSS. ابحث عن أي ثغرة باسم المنتج أو نوعها أو معرّفها. أضفني إلى قناة أو مجموعة لنشر التنبيهات فيها.',
    'تنبيهات CVE فورية: ثغرات High/Critical الجديدة، والثغرات المستغلة والرائجة، والبحث عن CVE.'],
  ru: ['🛡️ Оповещения о CVE в реальном времени. Присылаю новые уязвимости High и Critical из NVD, а также CVE, которые CISA отмечает как эксплуатируемые или для которых есть публичный эксплойт на GitHub, с оценкой EPSS. Ищи любую CVE по продукту, типу уязвимости или ID. Добавь меня в канал или группу, чтобы оповещения приходили туда.',
    'Оповещения о CVE: новые High/Critical, эксплуатируемые и трендовые уязвимости, поиск CVE.'],
  es: ['🛡️ Alertas de CVE en tiempo real. Publico vulnerabilidades nuevas de nivel High y Critical de NVD, y CVE que CISA marca como explotadas o que tienen un exploit público en GitHub, con su puntuación EPSS. Busca cualquier CVE por producto, tipo de fallo o ID. Añádeme a un canal o grupo para publicar allí las alertas.',
    'Alertas de CVE en tiempo real: CVE High/Critical nuevas, vulnerabilidades explotadas y en tendencia, búsqueda de CVE.'],
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
