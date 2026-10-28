// User-facing strings, translated into the supported locales. Messages are
// sent as HTML, so these may hold tags but never a bare & < or >. CVE data
// itself (descriptions, products, severities) is NVD's English. Admin screens
// stay English.
import { makeT } from './i18n.js';

const strings = {
  // --- reply keyboard ---------------------------------------------------------
  kb_latest: { en: '🆕 Latest', fa: '🆕 تازه‌ترین‌ها', ar: '🆕 الأحدث', ru: '🆕 Новые', es: '🆕 Recientes' },
  kb_trending: { en: '🔥 Trending', fa: '🔥 داغ‌ها', ar: '🔥 الرائجة', ru: '🔥 В тренде', es: '🔥 En tendencia' },
  kb_search: { en: '🔍 Search', fa: '🔍 جستجو', ar: '🔍 بحث', ru: '🔍 Поиск', es: '🔍 Buscar' },
  kb_categories: { en: '⚡ Categories', fa: '⚡ دسته‌ها', ar: '⚡ الفئات', ru: '⚡ Категории', es: '⚡ Categorías' },
  kb_settings: { en: '⚙️ Settings', fa: '⚙️ تنظیمات', ar: '⚙️ الإعدادات', ru: '⚙️ Настройки', es: '⚙️ Ajustes' },
  kb_language: { en: '🌐 Language', fa: '🌐 زبان', ar: '🌐 اللغة', ru: '🌐 Язык', es: '🌐 Idioma' },
  kb_about: { en: 'ℹ️ About', fa: 'ℹ️ درباره', ar: 'ℹ️ حول البوت', ru: 'ℹ️ О боте', es: 'ℹ️ Acerca de' },
  // The old button About replaced; keyboards sent before still show it (lib/views.js).
  kb_source: { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },
  placeholder: {
    en: 'A product, bug type or CVE ID…', fa: 'نام محصول، نوع باگ یا شناسهٔ CVE…', ar: 'منتج أو نوع ثغرة أو معرّف CVE…',
    ru: 'Продукт, тип уязвимости или ID CVE…', es: 'Un producto, tipo de fallo o ID de CVE…',
  },

  // --- home, about, language ------------------------------------------------
  welcome: {
    en: '🛡️ <b>CVE alerts</b>\n\nHi {name}! I post newly published High and Critical vulnerabilities (CVSS above {min}) and CVEs that are exploited in the wild or have a public exploit.\n\nType a product, a bug type or a CVE ID to search, or use the buttons below.',
    fa: '🛡️ <b>هشدار CVE</b>\n\nسلام {name}! آسیب‌پذیری‌های تازهٔ High و Critical (با CVSS بالای {min}) و CVEهایی که در عمل اکسپلویت شده‌اند یا اکسپلویت عمومی دارند را می‌فرستم.\n\nبرای جستجو نام یک محصول، نوع باگ یا شناسهٔ CVE را بنویس، یا از دکمه‌های پایین استفاده کن.',
    ar: '🛡️ <b>تنبيهات CVE</b>\n\nمرحبًا {name}! أنشر الثغرات الجديدة من فئتي High وCritical (بدرجة CVSS أعلى من {min}) والثغرات المستغلة فعليًا أو التي لها استغلال منشور.\n\nاكتب اسم منتج أو نوع ثغرة أو معرّف CVE للبحث، أو استخدم الأزرار بالأسفل.',
    ru: '🛡️ <b>Оповещения о CVE</b>\n\nПривет, {name}! Я присылаю новые уязвимости уровней High и Critical (CVSS выше {min}) и CVE, которые уже эксплуатируются или имеют публичный эксплойт.\n\nНапиши продукт, тип уязвимости или ID CVE для поиска или используй кнопки ниже.',
    es: '🛡️ <b>Alertas de CVE</b>\n\n¡Hola, {name}! Publico vulnerabilidades nuevas de nivel High y Critical (CVSS mayor que {min}) y CVE que se están explotando o tienen un exploit público.\n\nEscribe un producto, un tipo de fallo o un ID de CVE para buscar, o usa los botones de abajo.',
  },
  about: {
    en: '🛡️ <b>About</b>\n\nI watch these sources:\n• <b>NVD</b> (NIST): every newly published CVE\n• <b>CISA KEV</b>: vulnerabilities exploited in the wild\n• <b>FIRST EPSS</b>: the chance a CVE gets exploited\n• <b>GitHub</b>: new proof-of-concept repositories\n\n<b>Alerts:</b> new CVEs with CVSS above {min}, and trending CVEs (in KEV or with a public PoC). In ⚙️ Settings you can turn them off, keep only critical or exploited ones, or watch only your products.\n\n<b>Channels and groups:</b> add me as an admin who can post messages and the alerts go there too.',
    fa: '🛡️ <b>درباره</b>\n\nاین منابع را زیر نظر دارم:\n• <b>NVD</b> (NIST): هر CVE تازه‌منتشرشده\n• <b>CISA KEV</b>: آسیب‌پذیری‌هایی که در عمل اکسپلویت شده‌اند\n• <b>FIRST EPSS</b>: احتمال اکسپلویت‌شدن یک CVE\n• <b>GitHub</b>: مخزن‌های تازهٔ اثبات مفهوم (PoC)\n\n<b>هشدارها:</b> CVEهای تازه با CVSS بالای {min} و CVEهای داغ (در KEV یا با PoC عمومی). در ⚙️ تنظیمات می‌توانی خاموششان کنی، فقط Critical یا اکسپلویت‌شده‌ها را نگه داری، یا فقط محصولات خودت را پایش کنی.\n\n<b>کانال و گروه:</b> من را با اجازهٔ ارسال پیام ادمین کن تا هشدارها آن‌جا هم بیایند.',
    ar: '🛡️ <b>حول البوت</b>\n\nأراقب هذه المصادر:\n• <b>NVD</b> (NIST): كل ثغرة CVE تُنشر حديثًا\n• <b>CISA KEV</b>: الثغرات المستغلة فعليًا\n• <b>FIRST EPSS</b>: احتمال استغلال الثغرة\n• <b>GitHub</b>: مستودعات إثبات المفهوم الجديدة\n\n<b>التنبيهات:</b> الثغرات الجديدة بدرجة CVSS أعلى من {min}، والثغرات الرائجة (في KEV أو لها PoC منشور). من ⚙️ الإعدادات يمكنك إيقافها، أو الاكتفاء بالحرجة أو المستغلة، أو مراقبة منتجاتك فقط.\n\n<b>القنوات والمجموعات:</b> أضفني مشرفًا يمكنه نشر الرسائل لتصل التنبيهات إليها أيضًا.',
    ru: '🛡️ <b>О боте</b>\n\nЯ слежу за источниками:\n• <b>NVD</b> (NIST): каждая новая CVE\n• <b>CISA KEV</b>: уязвимости, которые эксплуатируются\n• <b>FIRST EPSS</b>: вероятность эксплуатации CVE\n• <b>GitHub</b>: новые репозитории с PoC\n\n<b>Оповещения:</b> новые CVE с CVSS выше {min} и трендовые CVE (в KEV или с публичным PoC). В ⚙️ Настройках их можно выключить, оставить только критические или эксплуатируемые или следить только за своими продуктами.\n\n<b>Каналы и группы:</b> добавь меня админом с правом публикации, и оповещения будут приходить туда.',
    es: '🛡️ <b>Acerca de</b>\n\nVigilo estas fuentes:\n• <b>NVD</b> (NIST): cada CVE recién publicada\n• <b>CISA KEV</b>: vulnerabilidades explotadas activamente\n• <b>FIRST EPSS</b>: la probabilidad de que se explote una CVE\n• <b>GitHub</b>: repositorios nuevos con pruebas de concepto\n\n<b>Alertas:</b> CVE nuevas con CVSS mayor que {min} y CVE en tendencia (en KEV o con PoC público). En ⚙️ Ajustes puedes desactivarlas, quedarte solo con las críticas o explotadas, o seguir solo tus productos.\n\n<b>Canales y grupos:</b> añádeme como administrador con permiso para publicar y las alertas llegarán allí también.',
  },
  choose_language: {
    en: '🌐 Choose your language:', fa: '🌐 زبان خود را انتخاب کنید:', ar: '🌐 اختر لغتك:',
    ru: '🌐 Выберите язык:', es: '🌐 Elige tu idioma:',
  },
  language_set: {
    en: '✅ Language set to {name}.', fa: '✅ زبان به {name} تغییر کرد.', ar: '✅ تم ضبط اللغة على {name}.',
    ru: '✅ Язык изменён на {name}.', es: '✅ Idioma cambiado a {name}.',
  },

  // --- search and lists -----------------------------------------------------------
  search_prompt: {
    en: '🔍 <b>Search</b>\n\nType a product, vendor, bug type or CVE ID, for example <code>Ivanti</code>, <code>Chrome</code>, <code>RCE</code> or <code>CVE-2024-3094</code>.',
    fa: '🔍 <b>جستجو</b>\n\nنام محصول، سازنده، نوع باگ یا شناسهٔ CVE را بنویس؛ مثلاً <code>Ivanti</code>، <code>Chrome</code>، <code>RCE</code> یا <code>CVE-2024-3094</code>.',
    ar: '🔍 <b>بحث</b>\n\nاكتب اسم منتج أو مورّد أو نوع ثغرة أو معرّف CVE، مثل <code>Ivanti</code> أو <code>Chrome</code> أو <code>RCE</code> أو <code>CVE-2024-3094</code>.',
    ru: '🔍 <b>Поиск</b>\n\nНапиши продукт, вендора, тип уязвимости или ID CVE, например <code>Ivanti</code>, <code>Chrome</code>, <code>RCE</code> или <code>CVE-2024-3094</code>.',
    es: '🔍 <b>Buscar</b>\n\nEscribe un producto, fabricante, tipo de fallo o ID de CVE, por ejemplo <code>Ivanti</code>, <code>Chrome</code>, <code>RCE</code> o <code>CVE-2024-3094</code>.',
  },
  categories_title: {
    en: '⚡ <b>Categories</b>\n\nPick a kind of vulnerability:', fa: '⚡ <b>دسته‌ها</b>\n\nنوع آسیب‌پذیری را انتخاب کن:',
    ar: '⚡ <b>الفئات</b>\n\nاختر نوع الثغرة:', ru: '⚡ <b>Категории</b>\n\nВыбери тип уязвимости:',
    es: '⚡ <b>Categorías</b>\n\nElige un tipo de vulnerabilidad:',
  },
  cat_rce: { en: '🔴 Remote code execution', fa: '🔴 اجرای کد از راه دور', ar: '🔴 تنفيذ تعليمات عن بُعد', ru: '🔴 Удалённое выполнение кода', es: '🔴 Ejecución remota de código' },
  cat_auth: { en: '🔐 Auth bypass', fa: '🔐 دور زدن احراز هویت', ar: '🔐 تجاوز المصادقة', ru: '🔐 Обход аутентификации', es: '🔐 Evasión de autenticación' },
  cat_web: { en: '🌐 Web: SSRF, XSS, traversal', fa: '🌐 وب: SSRF، XSS، پیمایش مسیر', ar: '🌐 الويب: SSRF وXSS واجتياز المسار', ru: '🌐 Веб: SSRF, XSS, обход пути', es: '🌐 Web: SSRF, XSS, recorrido de rutas' },
  cat_sqli: { en: '💉 SQL injection', fa: '💉 تزریق SQL', ar: '💉 حقن SQL', ru: '💉 SQL-инъекции', es: '💉 Inyección SQL' },
  cat_upload: { en: '📦 File upload', fa: '📦 آپلود فایل', ar: '📦 رفع الملفات', ru: '📦 Загрузка файлов', es: '📦 Subida de archivos' },
  cat_memory: { en: '🧠 Memory corruption', fa: '🧠 خرابی حافظه', ar: '🧠 إفساد الذاكرة', ru: '🧠 Повреждение памяти', es: '🧠 Corrupción de memoria' },
  latest_title: { en: '🆕 <b>Latest CVEs</b>', fa: '🆕 <b>تازه‌ترین CVEها</b>', ar: '🆕 <b>أحدث الثغرات</b>', ru: '🆕 <b>Новые CVE</b>', es: '🆕 <b>CVE recientes</b>' },
  trending_title: {
    en: '🔥 <b>Trending</b>: exploited in the wild or with a public PoC', fa: '🔥 <b>داغ‌ها</b>: اکسپلویت‌شده در عمل یا با PoC عمومی',
    ar: '🔥 <b>الرائجة</b>: مستغلة فعليًا أو لها PoC منشور', ru: '🔥 <b>В тренде</b>: эксплуатируются или есть публичный PoC',
    es: '🔥 <b>En tendencia</b>: explotadas o con PoC público',
  },
  search_title: { en: '🔍 <b>Results for “{q}”</b>', fa: '🔍 <b>نتایج «{q}»</b>', ar: '🔍 <b>نتائج «{q}»</b>', ru: '🔍 <b>Результаты: «{q}»</b>', es: '🔍 <b>Resultados de «{q}»</b>' },
  page: { en: 'Page {n}', fa: 'صفحهٔ {n}', ar: 'صفحة {n}', ru: 'Стр. {n}', es: 'Página {n}' },
  nothing_found: {
    en: '❌ Nothing found for “{q}”. Try a product (<i>Apache</i>, <i>Ivanti</i>) or a bug type (<i>RCE</i>, <i>SSRF</i>).',
    fa: '❌ برای «{q}» چیزی پیدا نشد. نام یک محصول (<i>Apache</i>، <i>Ivanti</i>) یا نوع باگ (<i>RCE</i>، <i>SSRF</i>) را امتحان کن.',
    ar: '❌ لا نتائج لـ «{q}». جرّب اسم منتج (<i>Apache</i>، <i>Ivanti</i>) أو نوع ثغرة (<i>RCE</i>، <i>SSRF</i>).',
    ru: '❌ По запросу «{q}» ничего нет. Попробуй продукт (<i>Apache</i>, <i>Ivanti</i>) или тип уязвимости (<i>RCE</i>, <i>SSRF</i>).',
    es: '❌ No hay resultados para «{q}». Prueba un producto (<i>Apache</i>, <i>Ivanti</i>) o un tipo de fallo (<i>RCE</i>, <i>SSRF</i>).',
  },
  empty_list: { en: 'Nothing here yet.', fa: 'هنوز چیزی این‌جا نیست.', ar: 'لا شيء هنا بعد.', ru: 'Пока пусто.', es: 'Aún no hay nada aquí.' },
  cve_not_found: {
    en: '❌ {id} is neither in NVD nor in the CISA catalog.', fa: '❌ {id} نه در NVD هست و نه در فهرست CISA.',
    ar: '❌ {id} غير موجودة في NVD ولا في كتالوج CISA.', ru: '❌ {id} нет ни в NVD, ни в каталоге CISA.',
    es: '❌ {id} no está en NVD ni en el catálogo de CISA.',
  },

  // --- CVE cards and alerts ---------------------------------------------------------
  alert_new: { en: '🚨 <b>New CVE</b>', fa: '🚨 <b>CVE تازه</b>', ar: '🚨 <b>ثغرة جديدة</b>', ru: '🚨 <b>Новая CVE</b>', es: '🚨 <b>CVE nueva</b>' },
  alert_trending: { en: '🔥 <b>Trending CVE</b>', fa: '🔥 <b>CVE داغ</b>', ar: '🔥 <b>ثغرة رائجة</b>', ru: '🔥 <b>CVE в тренде</b>', es: '🔥 <b>CVE en tendencia</b>' },
  lbl_published: { en: 'Published', fa: 'انتشار', ar: 'النشر', ru: 'Опубликована', es: 'Publicada' },
  lbl_type: { en: 'Bug type', fa: 'نوع باگ', ar: 'نوع الثغرة', ru: 'Тип уязвимости', es: 'Tipo de fallo' },
  lbl_description: { en: 'Description', fa: 'توضیح', ar: 'الوصف', ru: 'Описание', es: 'Descripción' },
  lbl_affected: { en: 'Affected', fa: 'محصولات آسیب‌پذیر', ar: 'المنتجات المتأثرة', ru: 'Затронуто', es: 'Afectado' },
  lbl_vector: { en: 'CVSS vector', fa: 'بردار CVSS', ar: 'متجه CVSS', ru: 'Вектор CVSS', es: 'Vector CVSS' },
  lbl_exploits: { en: 'Exploits and PoCs', fa: 'اکسپلویت و PoC', ar: 'الاستغلال وPoC', ru: 'Эксплойты и PoC', es: 'Exploits y PoC' },
  lbl_signals: { en: 'Why it is trending', fa: 'چرا داغ است', ar: 'لماذا هي رائجة', ru: 'Почему в тренде', es: 'Por qué es tendencia' },
  lbl_action: { en: 'CISA required action', fa: 'اقدام لازم از نظر CISA', ar: 'الإجراء المطلوب من CISA', ru: 'Требуемые действия CISA', es: 'Acción requerida por CISA' },
  lbl_none: { en: 'none known', fa: 'موردی شناخته نشده', ar: 'لا شيء معروف', ru: 'неизвестны', es: 'ninguno conocido' },
  lbl_unspecified: { en: 'not specified yet', fa: 'هنوز مشخص نشده', ar: 'غير محدد بعد', ru: 'пока не указано', es: 'aún sin especificar' },
  lbl_more: { en: '+ {n} more', fa: '+ {n} مورد دیگر', ar: '+ {n} أخرى', ru: '+ ещё {n}', es: '+ {n} más' },
  lbl_due: { en: 'due {date}', fa: 'مهلت {date}', ar: 'الموعد النهائي {date}', ru: 'срок {date}', es: 'plazo {date}' },
  no_score: { en: 'no score yet', fa: 'هنوز امتیازی ندارد', ar: 'بلا تقييم بعد', ru: 'оценки пока нет', es: 'aún sin puntuación' },
  sig_kev: {
    en: '🚨 In CISA KEV: exploited in the wild (added {date})', fa: '🚨 در CISA KEV: در عمل اکسپلویت شده (افزوده‌شده {date})',
    ar: '🚨 في CISA KEV: مستغلة فعليًا (أضيفت {date})', ru: '🚨 В CISA KEV: эксплуатируется (добавлена {date})',
    es: '🚨 En CISA KEV: explotada activamente (añadida el {date})',
  },
  sig_epss: {
    en: '📈 EPSS: {pct}% chance of exploitation', fa: '📈 EPSS: احتمال اکسپلویت {pct}٪', ar: '📈 EPSS: احتمال الاستغلال {pct}٪',
    ru: '📈 EPSS: вероятность эксплуатации {pct}%', es: '📈 EPSS: {pct} % de probabilidad de explotación',
  },
  sig_poc: { en: '💻 Public PoC: {repo}', fa: '💻 PoC عمومی: {repo}', ar: '💻 PoC منشور: {repo}', ru: '💻 Публичный PoC: {repo}', es: '💻 PoC público: {repo}' },
  btn_nvd: { en: '🌐 NVD', fa: '🌐 NVD', ar: '🌐 NVD', ru: '🌐 NVD', es: '🌐 NVD' },
  btn_pocs: { en: '💻 GitHub PoCs', fa: '💻 PoCهای گیت‌هاب', ar: '💻 PoC على GitHub', ru: '💻 PoC на GitHub', es: '💻 PoC en GitHub' },
  btn_details: { en: '🔍 Details', fa: '🔍 جزئیات', ar: '🔍 التفاصيل', ru: '🔍 Подробнее', es: '🔍 Detalles' },
  btn_share: { en: '📤 Share', fa: '📤 اشتراک', ar: '📤 مشاركة', ru: '📤 Поделиться', es: '📤 Compartir' },
  btn_back: { en: '⬅️ Back', fa: '⬅️ بازگشت', ar: '⬅️ رجوع', ru: '⬅️ Назад', es: '⬅️ Volver' },
  btn_kev: { en: '🚨 CISA KEV', fa: '🚨 CISA KEV', ar: '🚨 CISA KEV', ru: '🚨 CISA KEV', es: '🚨 CISA KEV' },

  // --- settings and chats -------------------------------------------------------------
  settings_on: {
    en: '⚙️ <b>Settings</b>\n\n🟢 Alerts are <b>on</b>.\n🎚 <b>Level:</b> {level}\n👁 <b>Watchlist:</b> {watch}',
    fa: '⚙️ <b>تنظیمات</b>\n\n🟢 هشدارها <b>روشن</b> است.\n🎚 <b>سطح:</b> {level}\n👁 <b>فهرست پایش:</b> {watch}',
    ar: '⚙️ <b>الإعدادات</b>\n\n🟢 التنبيهات <b>مفعّلة</b>.\n🎚 <b>المستوى:</b> {level}\n👁 <b>قائمة المراقبة:</b> {watch}',
    ru: '⚙️ <b>Настройки</b>\n\n🟢 Оповещения <b>включены</b>.\n🎚 <b>Уровень:</b> {level}\n👁 <b>Список отслеживания:</b> {watch}',
    es: '⚙️ <b>Ajustes</b>\n\n🟢 Las alertas están <b>activadas</b>.\n🎚 <b>Nivel:</b> {level}\n👁 <b>Lista de seguimiento:</b> {watch}',
  },
  settings_off: {
    en: '⚙️ <b>Settings</b>\n\n🔴 Alerts are <b>off</b>.', fa: '⚙️ <b>تنظیمات</b>\n\n🔴 هشدارها <b>خاموش</b> است.',
    ar: '⚙️ <b>الإعدادات</b>\n\n🔴 التنبيهات <b>متوقفة</b>.', ru: '⚙️ <b>Настройки</b>\n\n🔴 Оповещения <b>выключены</b>.',
    es: '⚙️ <b>Ajustes</b>\n\n🔴 Las alertas están <b>desactivadas</b>.',
  },
  btn_alerts_off: { en: '🔕 Turn alerts off', fa: '🔕 خاموش کردن هشدارها', ar: '🔕 إيقاف التنبيهات', ru: '🔕 Выключить оповещения', es: '🔕 Desactivar alertas' },
  btn_alerts_on: { en: '🔔 Turn alerts on', fa: '🔔 روشن کردن هشدارها', ar: '🔔 تفعيل التنبيهات', ru: '🔔 Включить оповещения', es: '🔔 Activar alertas' },
  btn_level: { en: '🎚 Alert level', fa: '🎚 سطح هشدار', ar: '🎚 مستوى التنبيهات', ru: '🎚 Уровень оповещений', es: '🎚 Nivel de alertas' },
  btn_watchlist: {
    en: '👁 Watchlist ({n})', fa: '👁 فهرست پایش ({n})', ar: '👁 قائمة المراقبة ({n})',
    ru: '👁 Список отслеживания ({n})', es: '👁 Lista de seguimiento ({n})',
  },
  level_title: {
    en: '🎚 <b>Alert level</b>\n\nWhich alerts should reach you?', fa: '🎚 <b>سطح هشدار</b>\n\nکدام هشدارها برایت بیایند؟',
    ar: '🎚 <b>مستوى التنبيهات</b>\n\nأي التنبيهات تريد أن تصلك؟', ru: '🎚 <b>Уровень оповещений</b>\n\nКакие оповещения присылать?',
    es: '🎚 <b>Nivel de alertas</b>\n\n¿Qué alertas quieres recibir?',
  },
  level_all: {
    en: 'new CVEs with CVSS above {min}, and trending CVEs', fa: 'CVEهای تازه با CVSS بالای {min} و CVEهای داغ',
    ar: 'الثغرات الجديدة بدرجة CVSS أعلى من {min} والثغرات الرائجة', ru: 'новые CVE с CVSS выше {min} и трендовые CVE',
    es: 'CVE nuevas con CVSS mayor que {min} y CVE en tendencia',
  },
  level_critical: {
    en: 'new CVEs with CVSS {crit} or more, and trending CVEs', fa: 'CVEهای تازه با CVSS دست‌کم {crit} و CVEهای داغ',
    ar: 'الثغرات الجديدة بدرجة CVSS ‏{crit} أو أكثر والثغرات الرائجة', ru: 'новые CVE с CVSS от {crit} и трендовые CVE',
    es: 'CVE nuevas con CVSS de {crit} o más y CVE en tendencia',
  },
  level_exploited: {
    en: 'only CVEs exploited in the wild (CISA KEV) or with a public PoC',
    fa: 'فقط CVEهایی که در عمل اکسپلویت شده‌اند (CISA KEV) یا PoC عمومی دارند',
    ar: 'فقط الثغرات المستغلة فعليًا (CISA KEV) أو التي لها PoC منشور',
    ru: 'только CVE, которые эксплуатируются (CISA KEV) или имеют публичный PoC',
    es: 'solo CVE explotadas activamente (CISA KEV) o con PoC público',
  },
  btn_level_all: { en: '🟠 High and critical', fa: '🟠 High و Critical', ar: '🟠 High وCritical', ru: '🟠 High и Critical', es: '🟠 High y Critical' },
  btn_level_critical: { en: '🔴 Critical only', fa: '🔴 فقط Critical', ar: '🔴 Critical فقط', ru: '🔴 Только Critical', es: '🔴 Solo Critical' },
  btn_level_exploited: { en: '🔥 Exploited only', fa: '🔥 فقط اکسپلویت‌شده', ar: '🔥 المستغلة فقط', ru: '🔥 Только эксплуатируемые', es: '🔥 Solo explotadas' },
  level_set: { en: '🎚 Level saved', fa: '🎚 سطح ذخیره شد', ar: '🎚 تم حفظ المستوى', ru: '🎚 Уровень сохранён', es: '🎚 Nivel guardado' },
  watch_none: { en: 'everything', fa: 'همه چیز', ar: 'كل شيء', ru: 'всё', es: 'todo' },
  watch_some: {
    en: 'only alerts that name <i>{words}</i>', fa: 'فقط هشدارهایی که از <i>{words}</i> نام می‌برند',
    ar: 'فقط التنبيهات التي تذكر <i>{words}</i>', ru: 'только оповещения, где упоминается <i>{words}</i>',
    es: 'solo alertas que mencionan <i>{words}</i>',
  },
  watch_title_none: {
    en: '👁 <b>Watchlist</b>\n\nEmpty, so every alert reaches you.\n\nAdd the products, vendors or words you care about, for example <code>nginx</code>, <code>Fortinet</code> or <code>linux kernel</code>, and only alerts that name one of them will.',
    fa: '👁 <b>فهرست پایش</b>\n\nخالی است، پس همهٔ هشدارها برایت می‌آیند.\n\nمحصولات، سازنده‌ها یا واژه‌هایی را که برایت مهم‌اند اضافه کن، مثلاً <code>nginx</code>، <code>Fortinet</code> یا <code>linux kernel</code>، تا فقط هشدارهایی بیایند که از یکی از آن‌ها نام می‌برند.',
    ar: '👁 <b>قائمة المراقبة</b>\n\nفارغة، لذا تصلك كل التنبيهات.\n\nأضف المنتجات أو المورّدين أو الكلمات التي تهمك، مثل <code>nginx</code> أو <code>Fortinet</code> أو <code>linux kernel</code>، ولن تصلك إلا التنبيهات التي تذكر أحدها.',
    ru: '👁 <b>Список отслеживания</b>\n\nПуст, поэтому приходят все оповещения.\n\nДобавь важные для тебя продукты, вендоров или слова, например <code>nginx</code>, <code>Fortinet</code> или <code>linux kernel</code>, и будут приходить только оповещения, где упоминается одно из них.',
    es: '👁 <b>Lista de seguimiento</b>\n\nEstá vacía, así que te llegan todas las alertas.\n\nAñade los productos, fabricantes o palabras que te importan, por ejemplo <code>nginx</code>, <code>Fortinet</code> o <code>linux kernel</code>, y solo te llegarán las alertas que mencionen alguno.',
  },
  watch_title_some: {
    en: '👁 <b>Watchlist</b>\n\nOnly alerts whose affected products or description name one of these reach you:\n{words}\n\nTap one to remove it.',
    fa: '👁 <b>فهرست پایش</b>\n\nفقط هشدارهایی برایت می‌آیند که در محصولات آسیب‌پذیر یا توضیحشان یکی از این‌ها آمده باشد:\n{words}\n\nبرای حذف، روی هر کدام بزن.',
    ar: '👁 <b>قائمة المراقبة</b>\n\nلا تصلك إلا التنبيهات التي تذكر منتجاتها المتأثرة أو وصفها أحد هذه:\n{words}\n\nاضغط على أي منها لإزالته.',
    ru: '👁 <b>Список отслеживания</b>\n\nПриходят только оповещения, где одно из этого есть в затронутых продуктах или описании:\n{words}\n\nНажми на слово, чтобы убрать его.',
    es: '👁 <b>Lista de seguimiento</b>\n\nSolo te llegan las alertas cuyos productos afectados o descripción mencionan uno de estos:\n{words}\n\nToca uno para quitarlo.',
  },
  watch_prompt: {
    en: '✍️ Send the products, vendors or words to watch, separated by commas, for example <code>nginx, Fortinet, linux kernel</code>. Up to {max} in all.',
    fa: '✍️ محصولات، سازنده‌ها یا واژه‌هایی را که می‌خواهی پایش کنی با ویرگول جدا کن و بفرست، مثلاً <code>nginx, Fortinet, linux kernel</code>. روی هم حداکثر {max} مورد.',
    ar: '✍️ أرسل المنتجات أو المورّدين أو الكلمات التي تريد مراقبتها مفصولة بفواصل، مثل <code>nginx, Fortinet, linux kernel</code>. حتى {max} إجمالًا.',
    ru: '✍️ Отправь продукты, вендоров или слова через запятую, например <code>nginx, Fortinet, linux kernel</code>. Всего до {max}.',
    es: '✍️ Envía los productos, fabricantes o palabras a seguir, separados por comas, por ejemplo <code>nginx, Fortinet, linux kernel</code>. Hasta {max} en total.',
  },
  btn_watch_add: { en: '➕ Add', fa: '➕ افزودن', ar: '➕ إضافة', ru: '➕ Добавить', es: '➕ Añadir' },
  btn_watch_clear: { en: '🗑 Clear', fa: '🗑 پاک کردن همه', ar: '🗑 مسح الكل', ru: '🗑 Очистить', es: '🗑 Vaciar' },
  btn_watch_q: {
    en: '👁 Alert me only about “{q}”', fa: '👁 فقط دربارهٔ «{q}» هشدار بده', ar: '👁 نبّهني عن «{q}» فقط',
    ru: '👁 Оповещать только о «{q}»', es: '👁 Avisarme solo de «{q}»',
  },
  watch_added: {
    en: '👁 Added to your watchlist', fa: '👁 به فهرست پایش اضافه شد', ar: '👁 أضيفت إلى قائمة المراقبة',
    ru: '👁 Добавлено в список отслеживания', es: '👁 Añadido a tu lista de seguimiento',
  },
  btn_cancel: { en: '✖️ Cancel', fa: '✖️ لغو', ar: '✖️ إلغاء', ru: '✖️ Отмена', es: '✖️ Cancelar' },
  btn_admin: { en: '👑 Admin dashboard', fa: '👑 داشبورد مدیر', ar: '👑 لوحة المشرف', ru: '👑 Панель админа', es: '👑 Panel de administración' },
  alerts_on: { en: '🔔 Alerts on', fa: '🔔 هشدارها روشن شد', ar: '🔔 تم تفعيل التنبيهات', ru: '🔔 Оповещения включены', es: '🔔 Alertas activadas' },
  alerts_off: { en: '🔕 Alerts off', fa: '🔕 هشدارها خاموش شد', ar: '🔕 تم إيقاف التنبيهات', ru: '🔕 Оповещения выключены', es: '🔕 Alertas desactivadas' },
  chat_welcome: {
    en: '🛡️ <b>CVE alerts are on for this chat</b>: new CVEs with CVSS above {min} and trending CVEs. Remove me to stop them.',
    fa: '🛡️ <b>هشدارهای CVE برای این گفتگو روشن شد</b>: CVEهای تازه با CVSS بالای {min} و CVEهای داغ. برای قطعشان من را حذف کن.',
    ar: '🛡️ <b>تم تفعيل تنبيهات CVE هنا</b>: الثغرات الجديدة بدرجة CVSS أعلى من {min} والثغرات الرائجة. أزلني لإيقافها.',
    ru: '🛡️ <b>Оповещения о CVE включены для этого чата</b>: новые CVE с CVSS выше {min} и трендовые CVE. Удали меня, чтобы их остановить.',
    es: '🛡️ <b>Alertas de CVE activadas en este chat</b>: CVE nuevas con CVSS mayor que {min} y CVE en tendencia. Elimíname para detenerlas.',
  },
  admins_only: { en: '⛔ Admins only.', fa: '⛔ فقط برای مدیران.', ar: '⛔ للمشرفين فقط.', ru: '⛔ Только для админов.', es: '⛔ Solo para administradores.' },
  error: {
    en: '⚠️ Something went wrong. Please try again.', fa: '⚠️ مشکلی پیش آمد. دوباره امتحان کن.',
    ar: '⚠️ حدث خطأ. حاول مرة أخرى.', ru: '⚠️ Что-то пошло не так. Попробуй ещё раз.', es: '⚠️ Algo salió mal. Inténtalo de nuevo.',
  },
};

export const t = makeT(strings);
