// Global module-level memory cache to prevent duplicate alerts during worker instance lifetime
const globalMemoryNotifiedSet = new Set();
const globalMemoryTrendingNotifiedSet = new Set();
let cachedCisaKevData = null;
let lastKevFetchTime = 0;
const KEV_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in-memory cache

// Helper to escape HTML characters for Telegram HTML parse mode
export function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// --- i18n (core surfaces: /start, /help, /language, source link) -----------
export const SOURCE_URL = 'https://github.com/chethober/bots/tree/main/chsbrbot';
export const I18N_LOCALES = ['en', 'fa', 'ar', 'ru', 'es'];
const I18N_NAMES = { en: 'English', fa: 'فارسی', ar: 'العربية', ru: 'Русский', es: 'Español' };
const I18N_FLAGS = { en: '🇬🇧', fa: '🇮🇷', ar: '🇸🇦', ru: '🇷🇺', es: '🇪🇸' };

export function normLocale(code) {
  const b = String(code || '').toLowerCase().split(/[-_]/)[0];
  return I18N_LOCALES.includes(b) ? b : 'en';
}

const I18N = {
  welcome: {
    en: '🛡️ <b>CVE Security Alert Bot</b> (@chsbrbot)\n\nWelcome <b>{name}</b>! Real-time vulnerability notifications and exploit intelligence.\n\n✅ <b>Status:</b> Subscribed to High &amp; Critical alerts (&ge; CVSS {minCvss}) and trending zero-day advisories.\n\n⌨️ <b>Buttons &amp; Keyboard:</b> Quick menu active below. Use the buttons for fast navigation!',
    fa: '🛡️ <b>ربات هشدار امنیتی CVE</b> (@chsbrbot)\n\nخوش اومدی <b>{name}</b>! اعلان لحظه‌ای آسیب‌پذیری‌ها و اطلاعات اکسپلویت.\n\n✅ <b>وضعیت:</b> مشترک هشدارهای High و Critical (CVSS ≥ {minCvss}) و هشدارهای زیرودی پرسروصدا.\n\n⌨️ <b>دکمه‌ها:</b> منوی سریع پایین فعاله. برای پیمایش سریع از دکمه‌ها استفاده کن!',
    ar: '🛡️ <b>بوت تنبيهات أمن CVE</b> (@chsbrbot)\n\nمرحبًا <b>{name}</b>! تنبيهات فورية للثغرات ومعلومات الاستغلال.\n\n✅ <b>الحالة:</b> مشترك في تنبيهات High وCritical (CVSS ≥ {minCvss}) وتحذيرات الثغرات الرائجة.\n\n⌨️ <b>الأزرار:</b> القائمة السريعة مفعّلة بالأسفل. استخدم الأزرار للتنقل السريع!',
    ru: '🛡️ <b>Бот оповещений о CVE</b> (@chsbrbot)\n\nДобро пожаловать, <b>{name}</b>! Оповещения об уязвимостях и данные об эксплойтах в реальном времени.\n\n✅ <b>Статус:</b> подписка на High и Critical (CVSS ≥ {minCvss}) и трендовые 0-day.\n\n⌨️ <b>Кнопки:</b> быстрое меню ниже. Используй кнопки для навигации!',
    es: '🛡️ <b>Bot de alertas CVE</b> (@chsbrbot)\n\n¡Bienvenido <b>{name}</b>! Alertas de vulnerabilidades e inteligencia de exploits en tiempo real.\n\n✅ <b>Estado:</b> suscrito a alertas High y Critical (CVSS ≥ {minCvss}) y avisos de 0-day en tendencia.\n\n⌨️ <b>Botones:</b> menú rápido abajo. ¡Usa los botones para navegar!',
  },
  help: {
    en: '🛡️ <b>CVE Security Alert Bot</b>\n\nI send real-time alerts for newly disclosed High &amp; Critical vulnerabilities and trending zero-days.\n\nCommands:\n/start – open the menu and subscribe\n/language – change language\n\nJust type a keyword (e.g. <code>Apache</code>, <code>RCE</code>) or a CVE ID to search.',
    fa: '🛡️ <b>ربات هشدار امنیتی CVE</b>\n\nهشدارهای لحظه‌ای برای آسیب‌پذیری‌های جدید High و Critical و زیرودی‌های پرسروصدا می‌فرستم.\n\nدستورها:\n/start – باز کردن منو و اشتراک\n/language – تغییر زبان\n\nکافیه یه کلیدواژه (مثل <code>Apache</code> یا <code>RCE</code>) یا یه شناسهٔ CVE بفرستی.',
    ar: '🛡️ <b>بوت تنبيهات أمن CVE</b>\n\nأرسل تنبيهات فورية للثغرات الجديدة High وCritical والثغرات الرائجة.\n\nالأوامر:\n/start – فتح القائمة والاشتراك\n/language – تغيير اللغة\n\nاكتب كلمة مفتاحية (مثل <code>Apache</code> أو <code>RCE</code>) أو معرّف CVE للبحث.',
    ru: '🛡️ <b>Бот оповещений о CVE</b>\n\nОтправляю оповещения в реальном времени о новых уязвимостях High и Critical и трендовых 0-day.\n\nКоманды:\n/start – открыть меню и подписаться\n/language – сменить язык\n\nПросто введи ключевое слово (например <code>Apache</code>, <code>RCE</code>) или ID CVE.',
    es: '🛡️ <b>Bot de alertas CVE</b>\n\nEnvío alertas en tiempo real de nuevas vulnerabilidades High y Critical y 0-day en tendencia.\n\nComandos:\n/start – abrir el menú y suscribirse\n/language – cambiar idioma\n\nEscribe una palabra clave (p. ej. <code>Apache</code>, <code>RCE</code>) o un ID de CVE para buscar.',
  },
  choose_language: {
    en: '🌐 Choose your language:', fa: '🌐 زبان خود را انتخاب کنید:', ar: '🌐 اختر لغتك:',
    ru: '🌐 Выберите язык:', es: '🌐 Elige tu idioma:',
  },
  language_set: {
    en: '✅ Language set to {name}.', fa: '✅ زبان به {name} تغییر کرد.', ar: '✅ تم ضبط اللغة على {name}.',
    ru: '✅ Язык изменён на {name}.', es: '✅ Idioma cambiado a {name}.',
  },
  source: { en: '🔗 Source code', fa: '🔗 کد منبع', ar: '🔗 الكود المصدري', ru: '🔗 Исходный код', es: '🔗 Código fuente' },
};

export function tr(locale, key, vars) {
  let s = (I18N[key] && (I18N[key][locale] ?? I18N[key].en)) || key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

export function languageInlineKeyboard() {
  return { inline_keyboard: I18N_LOCALES.map((c) => [{ text: `${I18N_FLAGS[c]} ${I18N_NAMES[c]}`, callback_data: `lang:${c}` }]) };
}

// Per-subscriber UI locale, stored in the subscribers table.
async function getUserLocale(chatId, env, fallbackCode) {
  const db = env?.DB;
  if (db) {
    try {
      await ensureD1Tables(db);
      const row = await db.prepare('SELECT locale FROM subscribers WHERE chat_id = ?').bind(String(chatId)).first();
      if (row?.locale && I18N_LOCALES.includes(row.locale)) return row.locale;
    } catch { /* fall through to auto-detect */ }
  }
  return normLocale(fallbackCode);
}

async function setUserLocale(chatId, locale, env) {
  const db = env?.DB;
  if (!db) return;
  try {
    await ensureD1Tables(db);
    await db.prepare('UPDATE subscribers SET locale = ?, updated_at = ? WHERE chat_id = ?')
      .bind(locale, Date.now(), String(chatId)).run();
  } catch (e) { console.error('setUserLocale failed:', e.message); }
}

// Helper to get severity emoji
export function getSeverityEmoji(severity) {
  if (!severity) return '⚪';
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return '🔴';
    case 'HIGH':
      return '🟠';
    case 'MEDIUM':
      return '🟡';
    case 'LOW':
      return '🟢';
    default:
      return '⚪';
  }
}

// Mapping of common CWE IDs to human-readable bug types
export const CWE_MAP = {
  'CWE-20': 'Improper Input Validation',
  'CWE-22': 'Path Traversal',
  'CWE-74': 'Improper Neutralization of Special Elements (Injection)',
  'CWE-77': 'Command Injection',
  'CWE-78': 'OS Command Injection',
  'CWE-79': 'Cross-Site Scripting (XSS)',
  'CWE-89': 'SQL Injection (SQLi)',
  'CWE-94': 'Code Injection / RCE',
  'CWE-119': 'Buffer Overflow / Memory Corruption',
  'CWE-120': 'Classic Buffer Overflow',
  'CWE-125': 'Out-of-bounds Read',
  'CWE-190': 'Integer Overflow / Underflow',
  'CWE-200': 'Exposure of Sensitive Information',
  'CWE-269': 'Improper Privilege Management / Privilege Escalation',
  'CWE-287': 'Improper Authentication / Auth Bypass',
  'CWE-295': 'Improper Certificate Validation',
  'CWE-306': 'Missing Authentication for Critical Function',
  'CWE-352': 'Cross-Site Request Forgery (CSRF)',
  'CWE-400': 'Uncontrolled Resource Consumption (DoS)',
  'CWE-416': 'Use After Free (UAF)',
  'CWE-434': 'Unrestricted File Upload / Arbitrary File Write',
  'CWE-476': 'NULL Pointer Dereference',
  'CWE-502': 'Deserialization of Untrusted Data',
  'CWE-601': 'URL Redirection / Open Redirect',
  'CWE-611': 'XML External Entity (XXE) Injection',
  'CWE-639': 'Insecure Direct Object Reference (IDOR)',
  'CWE-770': 'Allocation of Resources Without Limits (DoS)',
  'CWE-787': 'Out-of-bounds Write',
  'CWE-862': 'Missing Authorization',
  'CWE-863': 'Incorrect Authorization',
  'CWE-918': 'Server-Side Request Forgery (SSRF)',
  'CWE-1236': 'CSV / Formula Injection'
};

export function getBugTypeFromCwe(cweId) {
  if (!cweId) return null;
  const clean = cweId.trim().toUpperCase();
  if (CWE_MAP[clean]) {
    return CWE_MAP[clean];
  }
  return cweId.trim();
}

// Helper to extract CWE categories / weaknesses (uses weakness names)
export function extractCwes(cve) {
  const cwes = [];
  if (cve.weaknesses && Array.isArray(cve.weaknesses)) {
    for (const w of cve.weaknesses) {
      if (w.description && Array.isArray(w.description)) {
        for (const desc of w.description) {
          if (desc.lang === 'en' && desc.value) {
            const rawVal = desc.value.trim();
            const weaknessName = getBugTypeFromCwe(rawVal) || rawVal;
            if (!cwes.includes(weaknessName)) {
              cwes.push(weaknessName);
            }
          }
        }
      }
    }
  }
  return cwes;
}

// Helper to extract affected software / systems from CPE match criteria
export function extractAffectedSoftware(cve) {
  const softwareSet = new Set();
  
  if (cve.configurations && Array.isArray(cve.configurations)) {
    for (const config of cve.configurations) {
      if (config.nodes && Array.isArray(config.nodes)) {
        for (const node of config.nodes) {
          const matches = node.cpeMatch || [];
          for (const match of matches) {
            if (match.criteria) {
              const parts = match.criteria.split(':');
              // Format: cpe:2.3:part:vendor:product:version:...
              if (parts.length >= 5) {
                const vendor = parts[3] !== '*' && parts[3] !== '-' ? parts[3] : '';
                const product = parts[4] !== '*' && parts[4] !== '-' ? parts[4] : '';
                const version = parts[5] && parts[5] !== '*' && parts[5] !== '-' ? parts[5] : '';
                
                if (product) {
                  let formatted = vendor ? `${vendor}/${product}` : product;
                  if (version) {
                    formatted += ` v${version}`;
                  } else if (match.versionStartIncluding || match.versionEndIncluding || match.versionEndExcluding || match.versionStartExcluding) {
                    const bounds = [
                      match.versionStartIncluding ? `>=${match.versionStartIncluding}` : '',
                      match.versionStartExcluding ? `>${match.versionStartExcluding}` : '',
                      match.versionEndIncluding ? `<=${match.versionEndIncluding}` : '',
                      match.versionEndExcluding ? `<${match.versionEndExcluding}` : ''
                    ].filter(Boolean).join(', ');
                    if (bounds) formatted += ` (${bounds})`;
                  }
                  softwareSet.add(formatted.replace(/_/g, ' '));
                }
              }
            }
          }
        }
      }
    }
  }
  
  return Array.from(softwareSet);
}

// Parse CVE item from NVD API JSON
export function parseCveData(item) {
  const cve = item.cve || {};
  const id = cve.id;
  
  // Find English description
  const descriptionObj = cve.descriptions?.find(d => d.lang === 'en') || cve.descriptions?.[0];
  const description = descriptionObj ? descriptionObj.value : 'No description available.';
  
  // Extract CVSS metrics
  let score = 'N/A';
  let severity = 'UNKNOWN';
  let vector = '';
  
  const metrics = cve.metrics || {};
  // Priority: CVSS v4.0 -> CVSS v3.1 -> CVSS v3.0 -> CVSS v2.0
  const metricKeys = ['cvssMetricV40', 'cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2'];
  
  for (const key of metricKeys) {
    if (metrics[key] && metrics[key].length > 0) {
      const metric = metrics[key].find(m => m.type === 'Primary') || metrics[key][0];
      const data = metric.cvssData || {};
      
      if (data.baseScore !== undefined) score = data.baseScore;
      severity = data.baseSeverity || metric.baseSeverity || severity;
      vector = data.vectorString || vector;
      break;
    }
  }
  
  // Find PoC / Exploit references (case-insensitive tags check)
  const pocRefs = [];
  if (cve.references) {
    for (const ref of cve.references) {
      if (ref.tags && ref.tags.some(tag => tag.toLowerCase() === 'exploit')) {
        pocRefs.push(ref.url);
      }
    }
  }

  // Extract Categories (CWEs), Bug Types, and Affected Software (CPEs)
  const categories = extractCwes(cve);
  const bugTypes = categories.map(cwe => getBugTypeFromCwe(cwe)).filter(Boolean);
  const affectedSoftware = extractAffectedSoftware(cve);
  const published = cve.published || item.published || null;
  
  return {
    id,
    description,
    score,
    severity,
    vector,
    pocRefs,
    categories,
    bugTypes,
    affectedSoftware,
    published
  };
}

// Send standard message via Telegram sendMessage API
export async function sendTelegramMessage(chatId, text, env, options = {}) {
  const token = env?.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parse_mode || 'HTML',
    link_preview_options: {
      is_disabled: options.disable_preview !== false
    }
  };

  if (options.reply_markup) {
    body.reply_markup = options.reply_markup;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403 || errorText.includes('bot was blocked') || errorText.includes('chat not found') || errorText.includes('user is deactivated')) {
      await unsubscribeChat(chatId, env).catch(() => {});
    }
    throw new Error(`Telegram API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

// Edit message in-place via Telegram editMessageText API
export async function editTelegramMessage(chatId, messageId, text, env, options = {}) {
  const token = env?.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing');

  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: options.parse_mode || 'HTML',
    link_preview_options: {
      is_disabled: options.disable_preview !== false
    }
  };

  if (options.reply_markup) {
    body.reply_markup = options.reply_markup;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes('message is not modified')) {
      return { ok: true, not_modified: true };
    }
    throw new Error(`Telegram editMessageText error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

// Answer callback query to dismiss loading state or show toast/popup alert
export async function answerTelegramCallback(callbackQueryId, env, options = {}) {
  const token = env?.TELEGRAM_BOT_TOKEN;
  if (!token || !callbackQueryId) return;

  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  const body = {
    callback_query_id: callbackQueryId,
    text: options.text || '',
    show_alert: options.show_alert || false
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('Error in answerTelegramCallback:', e.message);
  }
}

// Reply Keyboard (Mobile-friendly main menu - collapsible via native Telegram keyboard icon)
export function getMainMenuKeyboard(isAdmin = false) {
  const keyboard = [
    [{ text: '🔍 Search CVEs' }, { text: '🆕 Latest CVEs' }],
    [{ text: '🔥 Trending Exploits' }, { text: '⚡ Quick Categories' }],
    [{ text: '📊 My Status' }, { text: '📖 Help' }]
  ];
  if (isAdmin) {
    keyboard.push([{ text: '👑 Admin Panel' }]);
  }
  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: false, // Allows native Telegram keyboard icon to collapse/open
    one_time_keyboard: false,
    input_field_placeholder: '🔍 Search CVE or tap a button below...'
  };
}

// Inline Keyboard for quick threat categories
export function getQuickCategoriesKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔴 Critical RCE', callback_data: 'cat:rce' },
        { text: '⚡ Zero-Days / KEV', callback_data: 'cat:kev' }
      ],
      [
        { text: '🌐 Web & SSRF', callback_data: 'cat:ssrf' },
        { text: '🔐 Auth Bypass', callback_data: 'cat:auth' }
      ],
      [
        { text: '💻 SQL Injection', callback_data: 'cat:sqli' },
        { text: '📦 File Upload', callback_data: 'cat:upload' }
      ],
      [
        { text: '🔍 Search Keyword', callback_data: 'menu:search' },
        { text: '🏠 Main Menu', callback_data: 'menu:home' }
      ]
    ]
  };
}

// Inline Keyboard for interactive Admin Panel
export function getAdminPanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📊 System Stats', callback_data: 'admin:stats' },
        { text: '🏓 Latency Ping', callback_data: 'admin:ping' }
      ],
      [
        { text: '⚡ Trigger Scan', callback_data: 'admin:trigger' },
        { text: '📋 Alert History', callback_data: 'admin:history' }
      ],
      [
        { text: '📢 Channels', callback_data: 'admin:channels' },
        { text: '🧪 Test Alert', callback_data: 'admin:test' }
      ],
      [
        { text: '⚙️ Sync Bot Profile & Commands', callback_data: 'admin:setup' }
      ]
    ]
  };
}

// Slash commands are admin-only; regular users navigate with keyboard buttons
export const ADMIN_COMMANDS = [
  { command: 'start', description: '🚀 Open main menu' },
  { command: 'admin', description: '👑 Admin dashboard' },
  { command: 'stats', description: '📊 System statistics' },
  { command: 'broadcast', description: '📢 Broadcast to subscribers (/broadcast [channel] <msg>)' },
  { command: 'setup', description: '⚙️ Sync bot profile & commands' }
];

export function getAdminIds(env) {
  const adminIds = (env?.TELEGRAM_ADMIN_ID ? String(env.TELEGRAM_ADMIN_ID).split(',') : [])
    .map(s => s.trim())
    .filter(Boolean);
  if (!adminIds.includes('8028710032')) adminIds.push('8028710032');
  if (!adminIds.includes('6330862227')) adminIds.push('6330862227');
  return adminIds;
}

// Sync Bot Description, Short Description, and Commands with Telegram Bot API
export async function syncBotProfileAndCommands(env) {
  const token = env?.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing');

  const description = [
    '🛡️ Real-time CVE Security Alert & Zero-Day Intelligence Bot (@chsbrbot)',
    '',
    'Automated vulnerability monitoring, threat correlation, and instant security advisories:',
    '• 🚨 High & Critical CVE notifications (NVD API v2.0)',
    '• 🔥 Zero-Day & KEV tracker (CISA Known Exploited Vulnerabilities)',
    '• 📈 EPSS exploit probability forecasting',
    '• 💻 Automated GitHub PoC discovery',
    '• 🔍 Fast interactive CVE lookup & keyword search',
    '• 📱 Collapsible button keyboard & channel broadcast support',
    '',
    'Tap START below to begin monitoring!'
  ].join('\n');

  const shortDescription = 'Real-time CVE alerts, CISA KEV zero-day intelligence, EPSS exploit scores & GitHub PoC detection.';

  const descRes = await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description })
  }).then(r => r.json());

  const shortRes = await fetch(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ short_description: shortDescription })
  }).then(r => r.json());

  // Regular users get a minimal command menu; richer commands are scoped to each admin's private chat.
  const clearRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: { type: 'default' },
      commands: [
        { command: 'start', description: 'Open the menu and subscribe' },
        { command: 'help', description: 'How the bot works' },
        { command: 'language', description: 'Change language' },
      ],
    })
  }).then(r => r.json());

  const adminResults = [];
  for (const adminId of getAdminIds(env)) {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: ADMIN_COMMANDS, scope: { type: 'chat', chat_id: adminId } })
    }).then(r => r.json());
    adminResults.push(res);
  }

  const failed = [clearRes, ...adminResults].find(r => !r.ok);
  const cmdRes = failed || { ok: true, result: true };

  return {
    description: descRes,
    shortDescription: shortRes,
    commands: cmdRes
  };
}

// Format a comprehensive, high-contrast Telegram HTML security card for a CVE
export function formatCveRichCard(cve, options = {}) {
  const emoji = getSeverityEmoji(cve.severity);
  const scoreBadge = cve.score ? `<b>CVSS ${cve.score}</b>` : (cve.severity || 'Score pending');
  const severityTag = cve.severity ? `[${cve.severity.toUpperCase()}]` : '';

  // Format Bug Type / Category
  const bugTypesFormatted = cve.bugTypes && cve.bugTypes.length > 0
    ? cve.bugTypes.map(bt => `• <code>${escapeHtml(bt)}</code>`).join('\n')
    : (cve.categories && cve.categories.length > 0
        ? cve.categories.map(cat => `• <code>${escapeHtml(cat)}</code>`).join('\n')
        : '• <i>Unclassified</i>');

  // Format Affected Software
  let softwareFormatted = '• <i>Not specified</i>';
  if (cve.affectedSoftware && cve.affectedSoftware.length > 0) {
    const displayList = cve.affectedSoftware.slice(0, 6);
    softwareFormatted = displayList.map(sw => `• <code>${escapeHtml(sw)}</code>`).join('\n');
    if (cve.affectedSoftware.length > 6) {
      softwareFormatted += `\n• <i>+ ${cve.affectedSoftware.length - 6} more</i>`;
    }
  }

  // Format PoC links
  const allPocs = cve.pocRefs || [];
  let pocsFormatted = '• <i>No PoC links verified yet</i>';
  if (allPocs.length > 0) {
    const displayPocs = allPocs.slice(0, 3);
    pocsFormatted = displayPocs.map(url => `• <a href="${url}">${escapeHtml(url)}</a>`).join('\n');
    if (allPocs.length > 3) {
      pocsFormatted += `\n• <i>+ ${allPocs.length - 3} more exploit links</i>`;
    }
  }

  const publishedStr = cve.published ? cve.published.replace('T', ' ').slice(0, 19) + ' UTC' : 'Recent';
  const desc = escapeHtml(cve.description || 'No description provided.');
  const cleanDesc = desc.length > 850 ? desc.slice(0, 850) + '... <i>[Truncated]</i>' : desc;

  const lines = [
    `${emoji} <b><a href="https://nvd.nist.gov/vuln/detail/${cve.id}">${cve.id}</a></b> ${severityTag} (${scoreBadge})`,
    `🕒 Disclosed: <code>${publishedStr}</code>`,
    '━━━━━━━━━━━━━━━━━━━━━',
    `🐛 <b>Classification:</b>\n${bugTypesFormatted}`,
    '',
    `📝 <b>Description:</b>\n${cleanDesc}`,
    '',
    `📦 <b>Affected Products:</b>\n${softwareFormatted}`,
    '',
    `📊 <b>CVSS Vector:</b>\n<code>${cve.vector || 'N/A'}</code>`,
    '',
    `⚡ <b>Exploits & PoCs:</b>\n${pocsFormatted}`
  ];

  const text = lines.join('\n');

  // Build interactive buttons
  const shareText = encodeURIComponent(`🚨 Security Advisory: ${cve.id} (${cve.severity || 'CVSS ' + cve.score})\n${cve.description ? cve.description.slice(0, 120) + '...' : ''}\n\nVia @chsbrbot`);
  const shareUrl = `https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fchsbrbot%3Fstart%3D${cve.id}&text=${shareText}`;

  const inline_keyboard = [
    [
      { text: '🌐 NVD Advisory', url: `https://nvd.nist.gov/vuln/detail/${cve.id}` },
      { text: '💻 GitHub PoCs', url: `https://github.com/search?q=${encodeURIComponent(cve.id)}+poc&type=repositories` }
    ]
  ];

  if (options.backToQuery !== undefined) {
    inline_keyboard.push([
      { text: '⬅️ Back to Results', callback_data: `back:${encodeURIComponent(options.backToQuery)}:${options.backToPage || 0}` },
      { text: '📤 Share Alert', url: shareUrl }
    ]);
  } else {
    inline_keyboard.push([
      { text: '🔍 New Search', callback_data: 'menu:search' },
      { text: '📤 Share Alert', url: shareUrl }
    ]);
  }

  inline_keyboard.push([
    { text: '⚡ Categories', callback_data: 'menu:categories' },
    { text: '🏠 Main Menu', callback_data: 'menu:home' }
  ]);

  return { text, reply_markup: { inline_keyboard } };
}

// Retrieve all active subscriber chat IDs
export async function getAllActiveSubscribers(env) {
  const subscribers = new Set();
  
  if (env?.TELEGRAM_ADMIN_ID) {
    for (const id of String(env.TELEGRAM_ADMIN_ID).split(',')) {
      const clean = id.trim();
      if (clean) subscribers.add(clean);
    }
  }
  subscribers.add('8028710032');
  subscribers.add('6330862227');
  if (env?.TELEGRAM_CHAT_ID) subscribers.add(String(env.TELEGRAM_CHAT_ID));
  if (env?.TELEGRAM_CHANNEL_ID) subscribers.add(String(env.TELEGRAM_CHANNEL_ID));

  const db = getDb(env);
  if (db) {
    try {
      await ensureD1Tables(db);
      const rows = await db.prepare("SELECT chat_id FROM subscribers WHERE is_active = 1").all();
      if (rows && rows.results) {
        for (const row of rows.results) {
          if (row.chat_id) subscribers.add(String(row.chat_id));
        }
      }
    } catch (err) {
      console.error('Error querying subscribers from D1:', err);
    }
  } else {
    try {
      if (typeof process !== 'undefined' && process?.versions?.node) {
        const path = await import('node:path');
        const fs = await import('node:fs');
        const { DatabaseSync } = await import('node:sqlite');
        const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
        if (fs.existsSync(dbPath)) {
          const localDb = new DatabaseSync(dbPath);
          const rows = localDb.prepare("SELECT chat_id FROM subscribers WHERE is_active = 1").all();
          for (const row of rows) {
            if (row.chat_id) subscribers.add(String(row.chat_id));
          }
        }
      }
    } catch (e) {}
  }

  return Array.from(subscribers);
}

// Upsert a subscriber record into D1 or local SQLite
export async function upsertSubscriber(chat, env, minScore = null) {
  const chatId = String(chat.id || chat.chat_id);
  const username = chat.username || null;
  const firstName = chat.first_name || null;
  const lastName = chat.last_name || null;
  const chatType = chat.type || chat.chat_type || 'private';
  const now = Date.now();

  const db = getDb(env);
  if (db) {
    await ensureD1Tables(db);
    await db.prepare(`
      INSERT INTO subscribers (chat_id, username, first_name, last_name, chat_type, is_active, min_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        chat_type = excluded.chat_type,
        is_active = 1,
        min_score = COALESCE(excluded.min_score, subscribers.min_score),
        updated_at = excluded.updated_at
    `).bind(chatId, username, firstName, lastName, chatType, minScore, now, now).run();
    return true;
  } else {
    try {
      if (typeof process !== 'undefined' && process?.versions?.node) {
        const path = await import('node:path');
        const fs = await import('node:fs');
        const { DatabaseSync } = await import('node:sqlite');
        const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
        if (fs.existsSync(dbPath)) {
          const localDb = new DatabaseSync(dbPath);
          localDb.prepare(`
            INSERT INTO subscribers (chat_id, username, first_name, last_name, chat_type, is_active, min_score, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
              username = excluded.username,
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              chat_type = excluded.chat_type,
              is_active = 1,
              min_score = COALESCE(excluded.min_score, subscribers.min_score),
              updated_at = excluded.updated_at
          `).run(chatId, username, firstName, lastName, chatType, minScore, now, now);
          return true;
        }
      }
    } catch (e) {}
  }
  return false;
}

// Unsubscribe a chat
export async function unsubscribeChat(chatId, env) {
  const idStr = String(chatId);
  const now = Date.now();
  const db = getDb(env);
  if (db) {
    await ensureD1Tables(db);
    await db.prepare("UPDATE subscribers SET is_active = 0, updated_at = ? WHERE chat_id = ?").bind(now, idStr).run();
    return true;
  } else {
    try {
      if (typeof process !== 'undefined' && process?.versions?.node) {
        const path = await import('node:path');
        const fs = await import('node:fs');
        const { DatabaseSync } = await import('node:sqlite');
        const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
        if (fs.existsSync(dbPath)) {
          const localDb = new DatabaseSync(dbPath);
          localDb.prepare("UPDATE subscribers SET is_active = 0, updated_at = ? WHERE chat_id = ?").run(now, idStr);
          return true;
        }
      }
    } catch (e) {}
  }
  return false;
}

// Send Telegram notification for a single CVE (broadcasts to all active subscribers or a specific target)
export async function sendTelegramNotification(cve, env, targetChatId = null) {
  const token = env?.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is missing.');
  }

  let recipients = [];
  if (targetChatId) {
    recipients = [String(targetChatId)];
  } else {
    recipients = await getAllActiveSubscribers(env);
  }

  if (recipients.length === 0) {
    console.warn('No active Telegram subscribers found to receive notification.');
    return { sent: 0, failed: 0, total: 0 };
  }
  
  const emoji = getSeverityEmoji(cve.severity);
  const escapedDesc = escapeHtml(cve.description);

  // Format Bug Type / Category
  const bugTypesFormatted = cve.bugTypes && cve.bugTypes.length > 0
    ? cve.bugTypes.map(bt => `• <code>${escapeHtml(bt)}</code>`).join('\n')
    : (cve.categories && cve.categories.length > 0
        ? cve.categories.map(cat => `• <code>${escapeHtml(cat)}</code>`).join('\n')
        : '• <i>Unclassified / Not specified by NVD yet</i>');

  // Format Affected Software (limit to top 8 items to fit Telegram limit)
  let softwareFormatted = '• <i>Not specified by NVD yet</i>';
  if (cve.affectedSoftware && cve.affectedSoftware.length > 0) {
    const displayList = cve.affectedSoftware.slice(0, 8);
    const hasMore = cve.affectedSoftware.length > 8;
    softwareFormatted = displayList.map(sw => `• <code>${escapeHtml(sw)}</code>`).join('\n');
    if (hasMore) {
      softwareFormatted += `\n• <i>+ ${cve.affectedSoftware.length - 8} more products</i>`;
    }
  }
  
  const textLines = [
    `${emoji} <b>New CVE Detected: <a href="https://nvd.nist.gov/vuln/detail/${cve.id}">${cve.id}</a></b>`,
    '',
    `🐛 <b>Bug Type / Category:</b>`,
    bugTypesFormatted,
    '',
    `📝 <b>Description:</b>`,
    escapedDesc,
    '',
    `📦 <b>Affected Software:</b>`,
    softwareFormatted,
    '',
    `📊 <b>Impact:</b>`,
    `• <b>Severity:</b> ${cve.severity}`,
    `• <b>CVSS Score:</b> ${cve.score}`,
    cve.vector ? `• <b>Vector:</b> <code>${cve.vector}</code>` : '',
    '',
    `⚡ <b>Proof of Concept (PoC) / Exploit Links:</b>`,
    cve.pocRefs && cve.pocRefs.length > 0 
      ? cve.pocRefs.map(url => `• <a href="${url}">${escapeHtml(url)}</a>`).join('\n') 
      : '• <i>No PoC links classified by NVD yet.</i>'
  ];

  let payloadText = textLines.filter(line => line !== null && line !== undefined).join('\n');
  
  // Telegram limits messages to 4096 characters. Truncate description if needed.
  if (payloadText.length > 4000) {
    const truncatedDesc = escapedDesc.substring(0, 1000) + '... [Truncated]';
    payloadText = [
      `${emoji} <b>New CVE Detected: <a href="https://nvd.nist.gov/vuln/detail/${cve.id}">${cve.id}</a></b>`,
      '',
      `🐛 <b>Bug Type / Category:</b>`,
      bugTypesFormatted,
      '',
      `📝 <b>Description:</b>`,
      truncatedDesc,
      '',
      `📦 <b>Affected Software:</b>`,
      softwareFormatted,
      '',
      `📊 <b>Impact:</b>`,
      `• <b>Severity:</b> ${cve.severity}`,
      `• <b>CVSS Score:</b> ${cve.score}`,
      cve.vector ? `• <b>Vector:</b> <code>${cve.vector}</code>` : '',
      '',
      `⚡ <b>Proof of Concept (PoC) / Exploit Links:</b>`,
      cve.pocRefs && cve.pocRefs.length > 0 
        ? cve.pocRefs.map(url => `• <a href="${url}">${escapeHtml(url)}</a>`).join('\n') 
        : '• <i>No PoC links classified by NVD yet.</i>'
    ].filter(line => line !== null && line !== undefined).join('\n');
  }

  const shareText = encodeURIComponent(`🚨 Security Advisory: ${cve.id} (${cve.severity || 'CVSS ' + cve.score})\n${cve.description ? cve.description.slice(0, 120) + '...' : ''}\n\nVia @chsbrbot`);
  const shareUrl = `https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fchsbrbot%3Fstart%3D${cve.id}&text=${shareText}`;

  const alertKeyboard = {
    inline_keyboard: [
      [
        { text: '🌐 NVD Advisory', url: `https://nvd.nist.gov/vuln/detail/${cve.id}` },
        { text: '💻 GitHub PoCs', url: `https://github.com/search?q=${encodeURIComponent(cve.id)}+poc&type=repositories` }
      ],
      [
        { text: '🔍 Full Details', callback_data: `cve:${cve.id}` },
        { text: '📤 Share', url: shareUrl }
      ]
    ]
  };

  let sentCount = 0;
  let failedCount = 0;

  for (const recipientId of recipients) {
    try {
      await sendTelegramMessage(recipientId, payloadText, env, { reply_markup: alertKeyboard });
      sentCount++;
      if (recipients.length > 1) {
        await new Promise(r => setTimeout(r, 40));
      }
    } catch (err) {
      failedCount++;
      console.error(`Failed sending CVE alert to recipient ${recipientId}:`, err.message);
    }
  }

  return { sent: sentCount, failed: failedCount, total: recipients.length };
}

// Send Telegram notification specifically formatted for a Trending Vulnerability
export async function sendTrendingTelegramNotification(cve, env, targetChatId = null) {
  const token = env?.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is missing.');
  }

  let recipients = [];
  if (targetChatId) {
    recipients = [String(targetChatId)];
  } else {
    recipients = await getAllActiveSubscribers(env);
  }

  if (recipients.length === 0) {
    console.warn('No active Telegram subscribers found to receive trending notification.');
    return { sent: 0, failed: 0, total: 0 };
  }

  const emoji = getSeverityEmoji(cve.severity);
  const escapedDesc = escapeHtml(cve.description);

  // Format Trending Signals
  const signals = cve.trendingSignals || {};
  const triggerLines = [];

  if (signals.cisaKev) {
    triggerLines.push(`• 🚨 <b>CISA KEV Catalog:</b> Confirmed active exploitation in the wild (Added: <code>${signals.cisaKev.dateAdded || 'Recent'}</code>)`);
  }
  if (signals.epss && signals.epss.score !== null) {
    const prob = (signals.epss.score * 100).toFixed(1);
    const rank = signals.epss.percentile !== null ? ` (Top ${(100 - signals.epss.percentile * 100).toFixed(1)}% percentile)` : '';
    triggerLines.push(`• 📈 <b>EPSS Exploitation Score:</b> <code>${prob}%</code>${rank}`);
  }
  if (signals.githubPocs && signals.githubPocs.length > 0) {
    const topGh = signals.githubPocs.slice(0, 3).map(p => {
      const starText = p.stars ? ` (⭐ ${p.stars})` : '';
      return `• 💻 <b>GitHub PoC:</b> <a href="${p.url}">${escapeHtml(p.repo)}</a>${starText}`;
    });
    triggerLines.push(...topGh);
  }

  const triggersFormatted = triggerLines.length > 0
    ? triggerLines.join('\n')
    : '• ⚡ <i>Detected high exploit activity & community attention</i>';

  // Format Bug Type / Category
  const bugTypesFormatted = cve.bugTypes && cve.bugTypes.length > 0
    ? cve.bugTypes.map(bt => `• <code>${escapeHtml(bt)}</code>`).join('\n')
    : (cve.categories && cve.categories.length > 0
        ? cve.categories.map(cat => `• <code>${escapeHtml(cat)}</code>`).join('\n')
        : '• <i>Unclassified / Not specified</i>');

  // Format Affected Software (limit to 6)
  let softwareFormatted = '• <i>Not specified</i>';
  if (cve.affectedSoftware && cve.affectedSoftware.length > 0) {
    const displayList = cve.affectedSoftware.slice(0, 6);
    const hasMore = cve.affectedSoftware.length > 6;
    softwareFormatted = displayList.map(sw => `• <code>${escapeHtml(sw)}</code>`).join('\n');
    if (hasMore) {
      softwareFormatted += `\n• <i>+ ${cve.affectedSoftware.length - 6} more products</i>`;
    }
  }

  // Format PoC links
  const allPocs = cve.pocRefs || [];
  let pocsFormatted = '• <i>No direct PoC links archived yet</i>';
  if (allPocs.length > 0) {
    const displayPocs = allPocs.slice(0, 4);
    pocsFormatted = displayPocs.map(url => `• <a href="${url}">${escapeHtml(url)}</a>`).join('\n');
    if (allPocs.length > 4) {
      pocsFormatted += `\n• <i>+ ${allPocs.length - 4} more exploit links</i>`;
    }
  }

  // Remediation
  let remediationBlock = '';
  if (signals.cisaKev && signals.cisaKev.requiredAction) {
    remediationBlock = [
      '',
      `🛡️ <b>CISA Required Action / Remediation:</b>`,
      `• ${escapeHtml(signals.cisaKev.requiredAction)}`,
      signals.cisaKev.dueDate ? `• <b>Due Date:</b> <code>${signals.cisaKev.dueDate}</code>` : ''
    ].filter(Boolean).join('\n');
  }

  const textLines = [
    `🔥 <b>TRENDING VULNERABILITY ALERT: <a href="https://nvd.nist.gov/vuln/detail/${cve.id}">${cve.id}</a></b> ${emoji}`,
    '',
    `⚡ <b>Threat Signals:</b>`,
    triggersFormatted,
    '',
    `🐛 <b>Bug Type / Category:</b>`,
    bugTypesFormatted,
    '',
    `📝 <b>Description:</b>`,
    escapedDesc,
    '',
    `📦 <b>Affected Software:</b>`,
    softwareFormatted,
    '',
    `📊 <b>Impact:</b>`,
    `• <b>Severity:</b> ${cve.severity}`,
    `• <b>CVSS Score:</b> ${cve.score}`,
    cve.vector ? `• <b>Vector:</b> <code>${cve.vector}</code>` : '',
    remediationBlock,
    '',
    `⚡ <b>PoC / Exploit Links:</b>`,
    pocsFormatted
  ];

  let payloadText = textLines.filter(line => line !== null && line !== undefined).join('\n');

  // Truncate description if overall message is too long for Telegram (limit 4096 chars)
  if (payloadText.length > 4000) {
    const truncatedDesc = escapedDesc.substring(0, 800) + '... [Truncated]';
    textLines[8] = truncatedDesc;
    payloadText = textLines.filter(line => line !== null && line !== undefined).join('\n');
  }

  const shareTrendText = encodeURIComponent(`🔥 Trending Exploit Alert: ${cve.id} (${cve.severity || 'CVSS ' + cve.score})\nActive in-the-wild exploitation / KEV detected.\n\nVia @chsbrbot`);
  const shareTrendUrl = `https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fchsbrbot%3Fstart%3D${cve.id}&text=${shareTrendText}`;

  const trendKeyboard = {
    inline_keyboard: [
      [
        { text: '🌐 NVD Advisory', url: `https://nvd.nist.gov/vuln/detail/${cve.id}` }
      ]
    ]
  };
  if (signals.cisaKev) {
    trendKeyboard.inline_keyboard[0].push({
      text: '🚨 CISA KEV',
      url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'
    });
  }
  trendKeyboard.inline_keyboard.push([
    { text: '💻 View PoCs', url: `https://github.com/search?q=${encodeURIComponent(cve.id)}+poc&type=repositories` },
    { text: '🔍 Full Details', callback_data: `cve:${cve.id}` }
  ]);
  trendKeyboard.inline_keyboard.push([
    { text: '📤 Share Threat', url: shareTrendUrl }
  ]);

  let sentCount = 0;
  let failedCount = 0;

  for (const recipientId of recipients) {
    try {
      await sendTelegramMessage(recipientId, payloadText, env, { reply_markup: trendKeyboard });
      sentCount++;
      if (recipients.length > 1) {
        await new Promise(r => setTimeout(r, 40));
      }
    } catch (err) {
      failedCount++;
      console.error(`Failed sending trending CVE alert to recipient ${recipientId}:`, err.message);
    }
  }

  return { sent: sentCount, failed: failedCount, total: recipients.length };
}

// Fetch a page of vulnerabilities from NVD API
export async function fetchCvesPage(env, options = {}) {
  const params = new URLSearchParams();
  if (options.resultsPerPage) params.set('resultsPerPage', options.resultsPerPage);
  if (options.startIndex !== undefined) params.set('startIndex', options.startIndex);
  if (options.pubStartDate) params.set('pubStartDate', options.pubStartDate);
  if (options.pubEndDate) params.set('pubEndDate', options.pubEndDate);

  const queryString = params.toString();
  const nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0${queryString ? '?' + queryString : ''}`;

  const headers = {
    'User-Agent': 'CF-Worker-CVE-Telegram-Notifier/1.0 (Cloudflare Worker; CVE fetcher)'
  };

  if (env.NVD_API_KEY) {
    headers['apiKey'] = env.NVD_API_KEY;
  }

  console.log(`Querying NVD API: ${nvdUrl}`);
  const response = await fetch(nvdUrl, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`NVD API error ${response.status}: ${errorText}`);
    err.status = response.status;
    throw err;
  }

  return await response.json();
}

// Fetch vulnerabilities from NVD (supports custom options and lookback)
export async function fetchRecentCves(env, options = {}) {
  const lookbackMinutes = options.lookbackMinutes || 1440; // 24 hours default
  const now = new Date();
  const startDate = options.pubStartDate || new Date(now.getTime() - lookbackMinutes * 60 * 1000).toISOString().replace('Z', '');
  const endDate = options.pubEndDate || now.toISOString().replace('Z', '');
  
  const data = await fetchCvesPage(env, { 
    pubStartDate: startDate, 
    pubEndDate: endDate,
    resultsPerPage: options.resultsPerPage || 100
  });
  return data.vulnerabilities || [];
}

// Helper to filter parsed CVE lists dynamically
export function filterCveList(cveList, filters = {}) {
  if (!Array.isArray(cveList)) return [];

  const limit = parseInt(filters.limit || '50', 10);
  const severity = filters.severity?.toUpperCase();
  const weakness = filters.weakness?.toLowerCase();
  const query = filters.q?.toLowerCase().trim();
  const days = filters.days && filters.days !== 'all' ? parseInt(filters.days, 10) : null;
  const cutoffDate = days ? new Date(Date.now() - days * 86400000) : null;

  const results = [];

  for (const cve of cveList) {
    if (results.length >= limit) break;

    if (severity && severity !== 'ALL' && (cve.severity || '').toUpperCase() !== severity) continue;

    if (weakness && weakness !== 'all') {
      const matchWeakness = (cve.categories || []).some(w => w.toLowerCase().includes(weakness)) ||
                            (cve.bugTypes || []).some(b => b.toLowerCase().includes(weakness));
      if (!matchWeakness) continue;
    }

    if (cutoffDate) {
      const pubDateStr = cve.published || (cve.raw && cve.raw.cve && cve.raw.cve.published);
      if (pubDateStr && new Date(pubDateStr) < cutoffDate) continue;
    }

    if (query) {
      const matchId = (cve.id || '').toLowerCase().includes(query);
      const matchDesc = (cve.description || '').toLowerCase().includes(query);
      const matchSw = (cve.affectedSoftware || []).some(s => s.toLowerCase().includes(query));
      const matchWeak = (cve.categories || []).some(w => w.toLowerCase().includes(query));
      if (!matchId && !matchDesc && !matchSw && !matchWeak) continue;
    }

    results.push(cve);
  }

  return results;
}

// Helper to get D1 database instance from environment
export function getDb(env) {
  return env?.DB || env?.CVE_DB || null;
}

let tablesInitialized = false;

// Ensure SQLite tables and indexes exist on cold start
export async function ensureD1Tables(db) {
  if (!db || tablesInitialized) return;
  try {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS cves (
          id TEXT PRIMARY KEY,
          description TEXT,
          score REAL,
          severity TEXT,
          vector TEXT,
          poc_refs TEXT,
          categories TEXT,
          bug_types TEXT,
          affected_software TEXT,
          published TEXT,
          data TEXT,
          created_at INTEGER,
          updated_at INTEGER
        )
      `),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_cves_published ON cves(published DESC)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves(severity)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_cves_score ON cves(score DESC)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_cves_updated_at ON cves(updated_at DESC)`),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS notified_alerts (
          cve_id TEXT NOT NULL,
          alert_type TEXT NOT NULL DEFAULT 'standard',
          notified_at INTEGER NOT NULL,
          PRIMARY KEY (cve_id, alert_type)
        )
      `),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_notified_alerts_type ON notified_alerts(alert_type, notified_at DESC)`),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS subscribers (
          chat_id TEXT PRIMARY KEY,
          username TEXT,
          first_name TEXT,
          last_name TEXT,
          chat_type TEXT DEFAULT 'private',
          is_active INTEGER DEFAULT 1,
          min_score REAL DEFAULT NULL,
          locale TEXT DEFAULT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(is_active)`),
      db.prepare(`
        INSERT OR IGNORE INTO subscribers (chat_id, username, first_name, chat_type, is_active, created_at, updated_at)
        VALUES ('8028710032', 'chethober', 'Cheth', 'private', 1, 1710000000000, 1710000000000)
      `),
      db.prepare(`
        INSERT OR IGNORE INTO subscribers (chat_id, username, first_name, chat_type, is_active, created_at, updated_at)
        VALUES ('6330862227', 'chesober', '🐈‍⬛', 'private', 1, 1710000000000, 1710000000000)
      `)
    ]);
    // Backfill the locale column on databases created before it existed.
    try { await db.prepare('ALTER TABLE subscribers ADD COLUMN locale TEXT').run(); } catch { /* column already exists */ }
    tablesInitialized = true;
  } catch (err) {
    console.error('Error ensuring D1 tables:', err);
  }
}

// Save or update CVE payloads in Cloudflare D1 SQLite database
export async function saveCvesToD1(cves, env) {
  const db = getDb(env);
  if (!db || !Array.isArray(cves) || cves.length === 0) return;

  try {
    await ensureD1Tables(db);
    const now = Date.now();
    const statements = [];

    for (const cve of cves) {
      if (!cve || !cve.id) continue;
      const scoreVal = typeof cve.score === 'number' ? cve.score : parseFloat(cve.score);
      const numScore = isNaN(scoreVal) ? null : scoreVal;

      statements.push(
        db.prepare(`
          INSERT INTO cves (
            id, description, score, severity, vector, poc_refs, categories, bug_types, affected_software, published, data, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            description = excluded.description,
            score = excluded.score,
            severity = excluded.severity,
            vector = excluded.vector,
            poc_refs = excluded.poc_refs,
            categories = excluded.categories,
            bug_types = excluded.bug_types,
            affected_software = excluded.affected_software,
            published = excluded.published,
            data = excluded.data,
            updated_at = excluded.updated_at
        `).bind(
          cve.id,
          cve.description || '',
          numScore,
          (cve.severity || 'UNKNOWN').toUpperCase(),
          cve.vector || '',
          JSON.stringify(cve.pocRefs || []),
          JSON.stringify(cve.categories || []),
          JSON.stringify(cve.bugTypes || []),
          JSON.stringify(cve.affectedSoftware || []),
          cve.published || null,
          JSON.stringify(cve),
          now,
          now
        )
      );
    }

    if (statements.length > 0) {
      // Execute in chunks of 50 to respect D1 batch limits
      const CHUNK_SIZE = 50;
      for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
        const chunk = statements.slice(i, i + CHUNK_SIZE);
        await db.batch(chunk);
      }
      console.log(`[D1 Database] Successfully saved ${statements.length} CVE records to SQLite.`);
    }
  } catch (err) {
    console.error('Failed to save CVEs to D1 database:', err);
  }
}

// Backward-compatible alias for existing callers
export async function saveCvesToKvCache(cves, env) {
  const db = getDb(env);
  if (db) {
    return await saveCvesToD1(cves, env);
  }
  if (!env || !env.CVE_KV || !Array.isArray(cves) || cves.length === 0) return;

  try {
    let existingList = [];
    try {
      const rawCache = await env.CVE_KV.get('CACHED_CVE_LIST');
      if (rawCache) {
        existingList = JSON.parse(rawCache);
      }
    } catch (e) {
      existingList = [];
    }

    const cveMap = new Map();
    for (const item of existingList) {
      if (item && item.id) cveMap.set(item.id, item);
    }

    for (const cve of cves) {
      if (!cve || !cve.id) continue;
      cveMap.set(cve.id, cve);
      try {
        await env.CVE_KV.put(`cve:${cve.id}`, JSON.stringify(cve), { expirationTtl: 7776000 });
      } catch (err) {}
    }

    const updatedCacheList = Array.from(cveMap.values())
      .sort((a, b) => (b.id || '').localeCompare(a.id || ''))
      .slice(0, 1000);

    await env.CVE_KV.put('CACHED_CVE_LIST', JSON.stringify(updatedCacheList));
  } catch (err) {
    console.error('Failed to update KV database cache:', err);
  }
}

// Query CVE records from Cloudflare D1 with SQL filtering and indexing
export async function queryCvesFromD1(env, filters = {}) {
  const db = getDb(env);
  if (!db) return null;

  try {
    await ensureD1Tables(db);

    let querySql = 'SELECT data FROM cves WHERE 1=1';
    const params = [];

    if (filters.severity && filters.severity !== 'ALL') {
      querySql += ' AND severity = ?';
      params.push(filters.severity.toUpperCase());
    }

    if (filters.days && filters.days !== 'all') {
      const daysNum = parseInt(filters.days, 10);
      if (!isNaN(daysNum)) {
        const cutoffDate = new Date(Date.now() - daysNum * 86400000).toISOString();
        querySql += ' AND published >= ?';
        params.push(cutoffDate);
      }
    }

    if (filters.weakness && filters.weakness !== 'all') {
      querySql += ' AND (categories LIKE ? OR bug_types LIKE ?)';
      params.push(`%${filters.weakness}%`, `%${filters.weakness}%`);
    }

    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      querySql += ' AND (id LIKE ? OR description LIKE ? OR affected_software LIKE ? OR categories LIKE ?)';
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    querySql += ' ORDER BY published DESC, id DESC LIMIT ?';
    params.push(Math.min(parseInt(filters.limit || '50', 10), 100));

    const stmt = db.prepare(querySql);
    const res = await stmt.bind(...params).all();
    const rows = res.results || [];

    return rows.map(r => {
      try {
        return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  } catch (err) {
    console.error('Failed to query CVEs from D1 database:', err);
    return null;
  }
}

// Look up a single CVE by ID across D1, local SQLite, or NVD API fallback
export async function getCveById(cveId, env) {
  if (!cveId) return null;
  let cleanId = String(cveId).trim().toUpperCase();
  if (!cleanId.startsWith('CVE-')) {
    cleanId = `CVE-${cleanId}`;
  }

  // 1. Try D1 SQLite Database
  const db = getDb(env);
  if (db) {
    try {
      await ensureD1Tables(db);
      const row = await db.prepare('SELECT data FROM cves WHERE id = ?').bind(cleanId).first();
      if (row && row.data) {
        return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      }
    } catch (err) {
      console.error('Error in getCveById from D1:', err.message);
    }
  }

  // 2. Try Local SQLite (Node dev environment)
  try {
    if (typeof process !== 'undefined' && process?.versions?.node) {
      const path = await import('node:path');
      const fs = await import('node:fs');
      const { DatabaseSync } = await import('node:sqlite');
      const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
      if (fs.existsSync(dbPath)) {
        const localDb = new DatabaseSync(dbPath);
        const row = localDb.prepare('SELECT data FROM cves WHERE id = ?').get(cleanId);
        if (row && row.data) {
          return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        }
      }
    }
  } catch (e) {}

  // 3. Try Cloudflare KV Database Cache (fallback)
  if (env?.CVE_KV) {
    try {
      const rawKv = await env.CVE_KV.get(`cve:${cleanId}`);
      if (rawKv) {
        return JSON.parse(rawKv);
      }
    } catch (e) {}
  }

  // 4. Fallback: Query NVD API v2.0 directly
  try {
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cleanId)}`;
    const headers = { 'User-Agent': 'Cloudflare-Worker-CVE-Bot/2.0' };
    if (env?.NVD_API_KEY) {
      headers['apiKey'] = env.NVD_API_KEY;
    }
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data?.vulnerabilities && data.vulnerabilities.length > 0) {
        const parsed = parseCveData(data.vulnerabilities[0]);
        if (db) {
          saveCvesToD1([parsed], env).catch(() => {});
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to fetch CVE directly from NVD API:', err.message);
  }

  return null;
}

// Search CVEs across D1 and local SQLite with fallback to NVD keywordSearch
export async function searchCves(query, env, options = {}) {
  const limit = Math.min(parseInt(options.limit || '10', 10), 30);
  const offset = parseInt(options.offset || '0', 10);
  const cleanQ = (query || '').trim();

  // 1. Query Cloudflare D1
  const db = getDb(env);
  if (db) {
    try {
      await ensureD1Tables(db);
      let querySql = 'SELECT data FROM cves WHERE 1=1';
      const params = [];

      if (options.severity && options.severity !== 'ALL') {
        querySql += ' AND severity = ?';
        params.push(options.severity.toUpperCase());
      }
      if (options.weakness) {
        querySql += ' AND (categories LIKE ? OR bug_types LIKE ?)';
        params.push(`%${options.weakness}%`, `%${options.weakness}%`);
      }
      if (cleanQ) {
        const pattern = `%${cleanQ}%`;
        querySql += ' AND (id LIKE ? OR description LIKE ? OR affected_software LIKE ? OR categories LIKE ?)';
        params.push(pattern, pattern, pattern, pattern);
      }

      querySql += ' ORDER BY published DESC, id DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare(querySql);
      const res = await stmt.bind(...params).all();
      const rows = res.results || [];
      const list = rows.map(r => {
        try {
          return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      if (list.length > 0) {
        return list;
      }
    } catch (err) {
      console.error('Error querying D1 in searchCves:', err.message);
    }
  }

  // 2. Query Local SQLite (Node dev environment)
  try {
    if (typeof process !== 'undefined' && process?.versions?.node) {
      const path = await import('node:path');
      const fs = await import('node:fs');
      const { DatabaseSync } = await import('node:sqlite');
      const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
      if (fs.existsSync(dbPath)) {
        const localDb = new DatabaseSync(dbPath);
        let querySql = 'SELECT data FROM cves WHERE 1=1';
        const params = [];
        if (options.severity && options.severity !== 'ALL') {
          querySql += ' AND severity = ?';
          params.push(options.severity.toUpperCase());
        }
        if (cleanQ) {
          const pattern = `%${cleanQ}%`;
          querySql += ' AND (id LIKE ? OR description LIKE ? OR affected_software LIKE ? OR categories LIKE ?)';
          params.push(pattern, pattern, pattern, pattern);
        }
        querySql += ' ORDER BY published DESC, id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const rows = localDb.prepare(querySql).all(...params);
        const list = rows.map(r => {
          try {
            return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
        if (list.length > 0) {
          return list;
        }
      }
    }
  } catch (e) {}

  // 3. Fallback: Search NVD API if specific keyword given
  if (cleanQ && cleanQ.length >= 3) {
    try {
      const isCvePattern = /^CVE-\d{4}-\d+$/i.test(cleanQ);
      const url = isCvePattern
        ? `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cleanQ.toUpperCase())}`
        : `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(cleanQ)}&resultsPerPage=${limit}`;
      const headers = { 'User-Agent': 'Cloudflare-Worker-CVE-Bot/2.0' };
      if (env?.NVD_API_KEY) {
        headers['apiKey'] = env.NVD_API_KEY;
      }
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.vulnerabilities && data.vulnerabilities.length > 0) {
          const parsedList = data.vulnerabilities.map(item => parseCveData(item));
          if (db) {
            saveCvesToD1(parsedList, env).catch(() => {});
          }
          return parsedList;
        }
      }
    } catch (err) {
      console.error('Failed keyword search from NVD:', err.message);
    }
  }

  return [];
}

// Core Orchestrator function
export async function processCveAlerts(env) {
  const rawVulnerabilities = await fetchRecentCves(env, { lookbackMinutes: 120 });
  console.log(`Fetched ${rawVulnerabilities.length} recent CVEs from NVD.`);
  
  const allParsedCves = rawVulnerabilities.map(item => parseCveData(item));
  const db = getDb(env);

  // Save to D1 SQLite database (or KV fallback)
  if (db && allParsedCves.length > 0) {
    await saveCvesToD1(allParsedCves, env);
  } else if (env.CVE_KV && allParsedCves.length > 0) {
    await saveCvesToKvCache(allParsedCves, env);
  }
  
  // Populate notified set from global in-memory cache
  const notifiedSet = new Set(globalMemoryNotifiedSet);
  
  // Read notified list from D1 SQLite database if available
  if (db) {
    try {
      await ensureD1Tables(db);
      const rows = await db.prepare("SELECT cve_id FROM notified_alerts WHERE alert_type = 'standard'").all();
      if (rows.results && Array.isArray(rows.results)) {
        for (const row of rows.results) {
          if (row.cve_id) notifiedSet.add(row.cve_id);
        }
      }
    } catch (e) {
      console.error('Failed to read notified alerts from D1:', e);
    }
  } else if (env.CVE_KV) {
    try {
      const raw = await env.CVE_KV.get('NOTIFIED_CVES');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            notifiedSet.add(id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to read from KV:', e);
    }
  } else {
    console.warn('⚠️ No database binding (DB) found in wrangler.toml. Using in-memory deduplication fallback.');
  }
  
  const notifiedThisRun = [];
  const errors = [];
  
  const minScoreThreshold = parseFloat(env?.MIN_CVSS_SCORE ?? 6.5);
  
  for (const item of rawVulnerabilities) {
    const cve = parseCveData(item);
    
    // Filter out CVEs with CVSS score <= minScoreThreshold (or N/A)
    const scoreVal = typeof cve.score === 'number' ? cve.score : parseFloat(cve.score);
    if (isNaN(scoreVal) || scoreVal <= minScoreThreshold) {
      console.log(`Skipping CVE ${cve.id}: CVSS score (${cve.score}) is not > ${minScoreThreshold}`);
      continue;
    }
    
    // 1. Check in-memory set
    if (notifiedSet.has(cve.id)) {
      console.log(`Skipping already notified CVE: ${cve.id}`);
      continue;
    }

    // 2. Check direct database entry
    if (db) {
      try {
        const existing = await db.prepare("SELECT 1 FROM notified_alerts WHERE cve_id = ? AND alert_type = 'standard'").bind(cve.id).first();
        if (existing) {
          notifiedSet.add(cve.id);
          globalMemoryNotifiedSet.add(cve.id);
          console.log(`Skipping already notified CVE (found in D1): ${cve.id}`);
          continue;
        }
      } catch (e) {
        // ignore read error
      }
    } else if (env.CVE_KV) {
      try {
        const directKey = await env.CVE_KV.get(`notified:${cve.id}`);
        if (directKey) {
          notifiedSet.add(cve.id);
          globalMemoryNotifiedSet.add(cve.id);
          console.log(`Skipping already notified CVE (found via KV key): ${cve.id}`);
          continue;
        }
      } catch (e) {
        // ignore KV read error
      }
    }
    
    console.log(`Sending alert for new CVE: ${cve.id}`);
    try {
      await sendTelegramNotification(cve, env);
      
      // Update tracking sets
      notifiedSet.add(cve.id);
      globalMemoryNotifiedSet.add(cve.id);
      notifiedThisRun.push(cve.id);

      // Save alert to D1 SQLite database
      if (db) {
        try {
          await db.prepare("INSERT OR IGNORE INTO notified_alerts (cve_id, alert_type, notified_at) VALUES (?, 'standard', ?)").bind(cve.id, Date.now()).run();
        } catch (e) {
          console.error(`Failed to record alert in D1 for ${cve.id}:`, e);
        }
      } else if (env.CVE_KV) {
        try {
          await env.CVE_KV.put(`notified:${cve.id}`, '1', { expirationTtl: 2592000 });
        } catch (e) {
          console.error(`Failed to store individual KV key for ${cve.id}:`, e);
        }
      }
      
      // Add a small delay (100ms) to respect Telegram's rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`Error notifying CVE ${cve.id}:`, err);
      errors.push({ id: cve.id, error: err.message });
    }
  }
  
  // Persist KV backup list if KV is being used
  if (env.CVE_KV && notifiedThisRun.length > 0) {
    try {
      const updatedList = Array.from(notifiedSet).slice(-1000);
      await env.CVE_KV.put('NOTIFIED_CVES', JSON.stringify(updatedList));
      console.log(`Updated KV store list. Total tracking: ${updatedList.length} items.`);
    } catch (e) {
      console.error('Failed to write list to KV:', e);
    }
  }
  
  return {
    totalChecked: rawVulnerabilities.length,
    notifiedCount: notifiedThisRun.length,
    notifiedList: notifiedThisRun,
    errors
  };
}

// Fetch official CISA Known Exploited Vulnerabilities (KEV) catalog
export async function fetchCisaKevCatalog(options = {}) {
  const now = Date.now();
  if (cachedCisaKevData && (now - lastKevFetchTime) < KEV_CACHE_TTL_MS && !options.forceRefresh) {
    return cachedCisaKevData;
  }

  const url = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CF-Worker-CVE-Telegram-Notifier/1.0 (Cloudflare Worker; CISA KEV Fetcher)'
      }
    });
    if (!response.ok) {
      console.warn(`Failed to fetch CISA KEV catalog: HTTP ${response.status}`);
      return cachedCisaKevData || { vulnerabilities: [] };
    }
    const data = await response.json();
    cachedCisaKevData = data;
    lastKevFetchTime = now;
    return data;
  } catch (err) {
    console.error('Error fetching CISA KEV catalog:', err);
    return cachedCisaKevData || { vulnerabilities: [] };
  }
}

// Fetch Exploit Prediction Scoring System (EPSS) scores from FIRST.org in batches
export async function fetchEpssScores(cveIds) {
  if (!Array.isArray(cveIds) || cveIds.length === 0) return {};

  const epssMap = {};
  const batchSize = 50;

  for (let i = 0; i < cveIds.length; i += batchSize) {
    const batch = cveIds.slice(i, i + batchSize);
    const cveParam = batch.join(',');
    const url = `https://api.first.org/data/v1/epss?cve=${encodeURIComponent(cveParam)}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CF-Worker-CVE-Telegram-Notifier/1.0 (Cloudflare Worker; EPSS Fetcher)'
        }
      });
      if (response.ok) {
        const json = await response.json();
        if (json.data && Array.isArray(json.data)) {
          for (const item of json.data) {
            if (item.cve) {
              const scoreNum = parseFloat(item.epss);
              const percentileNum = parseFloat(item.percentile);
              epssMap[item.cve] = {
                score: !isNaN(scoreNum) ? scoreNum : null,
                percentile: !isNaN(percentileNum) ? percentileNum : null,
                date: item.date || null
              };
            }
          }
        }
      } else {
        console.warn(`EPSS API returned HTTP status ${response.status}`);
      }
    } catch (err) {
      console.error('Error querying EPSS API:', err);
    }
  }

  return epssMap;
}

// Fetch recent GitHub PoC exploit repositories matching CVE patterns
export async function fetchGitHubRecentPocs(env = {}, options = {}) {
  const limit = options.limit || 30;
  const url = `https://api.github.com/search/repositories?q=CVE-+poc+in:name,description&sort=updated&order=desc&per_page=${limit}`;
  const headers = {
    'User-Agent': 'CF-Worker-CVE-Telegram-Notifier/1.0 (Cloudflare Worker; GitHub PoC Tracker)',
    'Accept': 'application/vnd.github.v3+json'
  };

  const token = env?.GITHUB_TOKEN || (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cvePocMap = {};
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('GitHub API rate limited for unauthenticated searches. (Set GITHUB_TOKEN in env for 5,000 req/hr)');
      } else {
        console.warn(`GitHub search returned status ${response.status}`);
      }
      return cvePocMap;
    }

    const json = await response.json();
    const items = json.items || [];
    const cveRegex = /CVE-\d{4}-\d{4,7}/gi;

    for (const repo of items) {
      const combined = `${repo.name || ''} ${repo.description || ''}`;
      const matches = combined.match(cveRegex);
      if (matches) {
        const uniqueMatches = [...new Set(matches.map(m => m.toUpperCase()))];
        for (const cveId of uniqueMatches) {
          if (!cvePocMap[cveId]) cvePocMap[cveId] = [];
          cvePocMap[cveId].push({
            repo: repo.full_name,
            url: repo.html_url,
            stars: repo.stargazers_count || 0,
            description: repo.description || '',
            updatedAt: repo.updated_at
          });
        }
      }
    }
  } catch (err) {
    console.error('Error fetching GitHub PoCs:', err);
  }

  return cvePocMap;
}

// Retrieve details for a single CVE from local storage, D1 SQLite database, KV cache, or live NVD
export async function lookupCveDetails(cveId, env = {}) {
  // 1. Try local SQLite database (data/cves.db) or legacy files if in node
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
    if (fs.existsSync(dbPath)) {
      const localDb = new DatabaseSync(dbPath);
      const row = localDb.prepare('SELECT data FROM cves WHERE id = ?').get(cveId);
      localDb.close();
      if (row && row.data) {
        return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      }
    }
    const cvesDir = path.resolve(process.cwd(), 'cves');
    const filePath = path.join(cvesDir, `${cveId}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const item = JSON.parse(raw);
      return item.raw ? parseCveData(item.raw) : (item.id && item.categories ? item : parseCveData(item));
    }
  } catch (e) {
    // Not running in Node
  }

  // 2. Try D1 SQLite Database
  const db = getDb(env);
  if (db) {
    try {
      await ensureD1Tables(db);
      const row = await db.prepare('SELECT data FROM cves WHERE id = ?').bind(cveId).first();
      if (row && row.data) {
        return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      }
    } catch (e) {
      // D1 lookup error
    }
  }

  // 3. Try KV cache (fallback)
  if (env && env.CVE_KV) {
    try {
      const cached = await env.CVE_KV.get(`cve:${cveId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // KV lookup error
    }
  }

  // 4. Fallback: Query NVD directly
  try {
    const nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`;
    const headers = {
      'User-Agent': 'CF-Worker-CVE-Telegram-Notifier/1.0 (Cloudflare Worker; CVE Lookup)'
    };
    if (env.NVD_API_KEY) {
      headers['apiKey'] = env.NVD_API_KEY;
    }
    const response = await fetch(nvdUrl, { headers });
    if (response.ok) {
      const json = await response.json();
      if (json.vulnerabilities && json.vulnerabilities.length > 0) {
        const parsed = parseCveData(json.vulnerabilities[0]);
        if (db) {
          await saveCvesToD1([parsed], env);
        } else if (env && env.CVE_KV) {
          try {
            await env.CVE_KV.put(`cve:${cveId}`, JSON.stringify(parsed), { expirationTtl: 7776000 });
          } catch (err) {}
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error(`Failed to fetch CVE ${cveId} from NVD:`, err);
  }

  return null;
}

// Detect trending vulnerabilities across CISA KEV, GitHub active PoCs, and EPSS scores
export async function detectTrendingVulnerabilities(env = {}, options = {}) {
  const minEpssScore = parseFloat(env?.MIN_EPSS_SCORE ?? options.minEpss ?? 0.15);
  const kevLookbackDays = parseInt(options.kevDays || 30, 10);

  // 1. Concurrently fetch CISA KEV catalog and GitHub active PoCs
  const [kevCatalog, githubPocs] = await Promise.all([
    fetchCisaKevCatalog(),
    fetchGitHubRecentPocs(env, { limit: options.githubLimit || 30 })
  ]);

  const kevVulnerabilities = kevCatalog.vulnerabilities || [];
  const kevMap = new Map();
  const recentKevCutoff = new Date(Date.now() - kevLookbackDays * 86400000);
  const recentKevIds = new Set();

  for (const item of kevVulnerabilities) {
    if (item && item.cveID) {
      kevMap.set(item.cveID, item);
      if (item.dateAdded) {
        const addedDate = new Date(item.dateAdded);
        if (addedDate >= recentKevCutoff) {
          recentKevIds.add(item.cveID);
        }
      }
    }
  }

  // 2. Aggregate candidate CVE IDs
  const candidateIds = new Set([...recentKevIds, ...Object.keys(githubPocs)]);

  // If specific target CVEs provided (e.g. from local storage or recent NVD items)
  if (Array.isArray(options.targetCves)) {
    for (const c of options.targetCves) {
      const cid = typeof c === 'string' ? c : c.id;
      if (cid) candidateIds.add(cid);
    }
  }

  const candidateIdList = Array.from(candidateIds).slice(0, 100);

  // 3. Query EPSS scores in batch for candidates
  const epssScores = await fetchEpssScores(candidateIdList);

  // 4. Evaluate each candidate against trending criteria
  const trendingResults = [];

  for (const cveId of candidateIdList) {
    const kevInfo = kevMap.get(cveId);
    const ghPocs = githubPocs[cveId] || [];
    const epssInfo = epssScores[cveId];

    const reasons = [];
    let isTrending = false;

    if (kevInfo) {
      isTrending = true;
      reasons.push({
        type: 'CISA_KEV',
        label: 'CISA Known Exploited Vulnerabilities Catalog',
        detail: `Confirmed active exploitation in the wild (Added: ${kevInfo.dateAdded})`
      });
    }

    if (ghPocs.length > 0) {
      isTrending = true;
      reasons.push({
        type: 'GITHUB_POC',
        label: 'Active GitHub PoC Exploit',
        detail: `${ghPocs.length} public exploit repository found (${ghPocs[0].repo}${ghPocs[0].stars ? `, ⭐ ${ghPocs[0].stars}` : ''})`
      });
    }

    if (epssInfo && epssInfo.score !== null) {
      if (epssInfo.score >= minEpssScore || (epssInfo.percentile !== null && epssInfo.percentile >= 0.90)) {
        isTrending = true;
        const pct = (epssInfo.score * 100).toFixed(1);
        const rank = epssInfo.percentile !== null ? ` (Top ${(100 - epssInfo.percentile * 100).toFixed(1)}% percentile)` : '';
        reasons.push({
          type: 'HIGH_EPSS',
          label: 'High Exploitation Probability (EPSS)',
          detail: `${pct}% exploitation probability${rank}`
        });
      }
    }

    if (isTrending) {
      // Assemble CVE details
      let details = null;
      if (options.cveLookupMap && options.cveLookupMap[cveId]) {
        details = options.cveLookupMap[cveId];
      } else {
        details = await lookupCveDetails(cveId, env);
      }

      const pocLinks = new Set(details?.pocRefs || []);
      for (const p of ghPocs) {
        if (p.url) pocLinks.add(p.url);
      }

      trendingResults.push({
        id: cveId,
        description: details?.description || kevInfo?.shortDescription || 'No description available.',
        score: details?.score ?? (kevInfo ? 9.8 : 'N/A'),
        severity: details?.severity ?? (kevInfo ? 'CRITICAL' : 'HIGH'),
        vector: details?.vector || '',
        pocRefs: Array.from(pocLinks),
        categories: details?.categories || (kevInfo?.cwes || []),
        bugTypes: details?.bugTypes || (kevInfo?.cwes?.map(c => getBugTypeFromCwe(c)).filter(Boolean) || []),
        affectedSoftware: details?.affectedSoftware?.length > 0 
          ? details.affectedSoftware 
          : (kevInfo ? [`${kevInfo.vendorProject} - ${kevInfo.product}`] : []),
        published: details?.published || null,
        isTrending: true,
        trendingSignals: {
          cisaKev: kevInfo || null,
          epss: epssInfo || null,
          githubPocs: ghPocs,
          reasons
        }
      });
    }
  }

  // Sort: CISA KEV first, then by EPSS score descending, then by PoC count
  trendingResults.sort((a, b) => {
    const aKev = a.trendingSignals.cisaKev ? 1 : 0;
    const bKev = b.trendingSignals.cisaKev ? 1 : 0;
    if (bKev !== aKev) return bKev - aKev;
    const aEpss = a.trendingSignals.epss?.score || 0;
    const bEpss = b.trendingSignals.epss?.score || 0;
    return bEpss - aEpss;
  });

  return trendingResults;
}

// Orchestrate trending vulnerability detection, deduplication, and Telegram alert dispatch
export async function processTrendingAlerts(env, options = {}) {
  const notifiedSet = new Set(globalMemoryTrendingNotifiedSet);
  const db = getDb(env);

  // Read trending notified list from D1 SQLite database if available
  if (db) {
    try {
      await ensureD1Tables(db);
      const rows = await db.prepare("SELECT cve_id FROM notified_alerts WHERE alert_type = 'trending'").all();
      if (rows.results && Array.isArray(rows.results)) {
        for (const row of rows.results) {
          if (row.cve_id) notifiedSet.add(row.cve_id);
        }
      }
    } catch (e) {
      console.error('Failed to read NOTIFIED_TRENDING_CVES from D1:', e);
    }
  } else if (env && env.CVE_KV) {
    try {
      const raw = await env.CVE_KV.get('NOTIFIED_TRENDING_CVES');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const id of parsed) notifiedSet.add(id);
        }
      }
    } catch (e) {
      console.error('Failed to read NOTIFIED_TRENDING_CVES from KV:', e);
    }
  } else {
    // Try reading local file in Node if neither D1 nor KV is present
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const stateFile = path.resolve(process.cwd(), '.notified_trending.json');
      if (fs.existsSync(stateFile)) {
        const fileData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        if (Array.isArray(fileData)) {
          for (const id of fileData) notifiedSet.add(id);
        }
      }
    } catch (e) {}
  }

  console.log('🔍 Scanning for newly trending vulnerabilities (CISA KEV, EPSS, GitHub PoCs)...');
  const trendingVulns = await detectTrendingVulnerabilities(env, options);
  console.log(`Found ${trendingVulns.length} trending vulnerabilities.`);

  const notifiedThisRun = [];
  const errors = [];

  for (const cve of trendingVulns) {
    if (notifiedSet.has(cve.id)) {
      console.log(`Skipping already notified trending CVE: ${cve.id}`);
      continue;
    }

    // Check direct individual database entry
    if (db) {
      try {
        const existing = await db.prepare("SELECT 1 FROM notified_alerts WHERE cve_id = ? AND alert_type = 'trending'").bind(cve.id).first();
        if (existing) {
          notifiedSet.add(cve.id);
          globalMemoryTrendingNotifiedSet.add(cve.id);
          console.log(`Skipping already notified trending CVE (found in D1): ${cve.id}`);
          continue;
        }
      } catch (e) {}
    } else if (env && env.CVE_KV) {
      try {
        const directKey = await env.CVE_KV.get(`notified_trend:${cve.id}`);
        if (directKey) {
          notifiedSet.add(cve.id);
          globalMemoryTrendingNotifiedSet.add(cve.id);
          console.log(`Skipping already notified trending CVE (found via KV key): ${cve.id}`);
          continue;
        }
      } catch (e) {}
    }

    console.log(`🔥 Sending Telegram alert for newly trending CVE: ${cve.id}`);
    try {
      await sendTrendingTelegramNotification(cve, env);

      notifiedSet.add(cve.id);
      globalMemoryTrendingNotifiedSet.add(cve.id);
      notifiedThisRun.push(cve.id);

      // Save alert to D1 SQLite database
      if (db) {
        try {
          await db.prepare("INSERT OR IGNORE INTO notified_alerts (cve_id, alert_type, notified_at) VALUES (?, 'trending', ?)").bind(cve.id, Date.now()).run();
        } catch (e) {
          console.error(`Failed to record trending alert in D1 for ${cve.id}:`, e);
        }
      } else if (env && env.CVE_KV) {
        try {
          await env.CVE_KV.put(`notified_trend:${cve.id}`, '1', { expirationTtl: 2592000 });
        } catch (e) {}
      }

      // Small delay between Telegram calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`Error notifying trending CVE ${cve.id}:`, err);
      errors.push({ id: cve.id, error: err.message });
    }
  }

  // Persist updated list to KV if KV is in use
  if (env && env.CVE_KV && notifiedThisRun.length > 0) {
    try {
      const updatedList = Array.from(notifiedSet).slice(-1000);
      await env.CVE_KV.put('NOTIFIED_TRENDING_CVES', JSON.stringify(updatedList));
      console.log(`Updated NOTIFIED_TRENDING_CVES in KV (${updatedList.length} items).`);
    } catch (e) {
      console.error('Failed to write NOTIFIED_TRENDING_CVES to KV:', e);
    }
  } else if (!db && notifiedThisRun.length > 0) {
    // Persist to local file in Node if neither D1 nor KV is present
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const stateFile = path.resolve(process.cwd(), '.notified_trending.json');
      fs.writeFileSync(stateFile, JSON.stringify(Array.from(notifiedSet).slice(-1000), null, 2), 'utf-8');
    } catch (e) {}
  }

  return {
    totalChecked: trendingVulns.length,
    trendingFound: trendingVulns.length,
    notifiedCount: notifiedThisRun.length,
    notifiedList: notifiedThisRun,
    errors
  };
}

// Helper to load CVE records from local SQLite database (data/cves.db) for local development
export async function loadLocalCves(filters = {}) {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const path = await import('node:path');
    const fs = await import('node:fs');

    const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
    if (fs.existsSync(dbPath)) {
      const localDb = new DatabaseSync(dbPath);
      let querySql = 'SELECT data FROM cves WHERE 1=1';
      const params = [];

      if (filters.severity && filters.severity !== 'ALL') {
        querySql += ' AND severity = ?';
        params.push(filters.severity.toUpperCase());
      }

      if (filters.days && filters.days !== 'all') {
        const daysNum = parseInt(filters.days, 10);
        if (!isNaN(daysNum)) {
          const cutoffDate = new Date(Date.now() - daysNum * 86400000).toISOString();
          querySql += ' AND published >= ?';
          params.push(cutoffDate);
        }
      }

      if (filters.weakness && filters.weakness !== 'all') {
        querySql += ' AND (categories LIKE ? OR bug_types LIKE ?)';
        params.push(`%${filters.weakness}%`, `%${filters.weakness}%`);
      }

      if (filters.q) {
        const searchPattern = `%${filters.q}%`;
        querySql += ' AND (id LIKE ? OR description LIKE ? OR affected_software LIKE ? OR categories LIKE ?)';
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      querySql += ' ORDER BY published DESC, id DESC LIMIT ?';
      params.push(Math.min(parseInt(filters.limit || '50', 10), 100));

      const rows = localDb.prepare(querySql).all(...params);
      localDb.close();

      return rows.map(r => {
        try {
          return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    }

    // Legacy fallback: Check cves directory if it exists
    const cvesDir = path.resolve(process.cwd(), 'cves');
    if (fs.existsSync(cvesDir)) {
      const files = fs.readdirSync(cvesDir);
      if (files && files.length > 0) {
        files.sort((a, b) => b.localeCompare(a));
        const results = [];
        const limit = parseInt(filters.limit || '50', 10);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          if (results.length >= limit) break;
          try {
            const raw = fs.readFileSync(path.join(cvesDir, file), 'utf-8');
            const item = JSON.parse(raw);
            const cve = item.raw ? parseCveData(item.raw) : (item.id && item.categories ? item : parseCveData(item));
            results.push(cve);
          } catch (e) {}
        }
        return results;
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Compile and format system and subscriber metrics for administrators
export async function getFormattedAdminStats(env) {
  let totalSubs = 0;
  let activeSubs = 0;
  let userSubs = 0;
  let channelSubs = 0;
  let groupSubs = 0;
  let totalCves = 0;
  let totalNotified = 0;
  let trendingNotified = 0;

  const db = getDb(env);
  if (db) {
    try {
      await ensureD1Tables(db);
      const sAll = await db.prepare("SELECT COUNT(*) as c FROM subscribers").first();
      totalSubs = sAll?.c || 0;
      const sAct = await db.prepare("SELECT COUNT(*) as c FROM subscribers WHERE is_active = 1").first();
      activeSubs = sAct?.c || 0;
      const sUser = await db.prepare("SELECT COUNT(*) as c FROM subscribers WHERE is_active = 1 AND (chat_type = 'private' OR chat_type IS NULL)").first();
      userSubs = sUser?.c || 0;
      const sChan = await db.prepare("SELECT COUNT(*) as c FROM subscribers WHERE is_active = 1 AND chat_type = 'channel'").first();
      channelSubs = sChan?.c || 0;
      const sGrp = await db.prepare("SELECT COUNT(*) as c FROM subscribers WHERE is_active = 1 AND (chat_type = 'group' OR chat_type = 'supergroup')").first();
      groupSubs = sGrp?.c || 0;

      const cRow = await db.prepare("SELECT COUNT(*) as c FROM cves").first();
      totalCves = cRow?.c || 0;
      const nRow = await db.prepare("SELECT COUNT(*) as c FROM notified_alerts WHERE alert_type = 'standard'").first();
      totalNotified = nRow?.c || 0;
      const tRow = await db.prepare("SELECT COUNT(*) as c FROM notified_alerts WHERE alert_type = 'trending'").first();
      trendingNotified = tRow?.c || 0;
    } catch (e) {
      console.error('Error fetching admin stats from D1:', e);
    }
  }

  return [
    `📊 <b>System & Bot Statistics</b>`,
    '',
    `👥 <b>Subscribers Breakdown:</b>`,
    `• 👤 Users: <code>${userSubs}</code>`,
    `• 📢 Channels: <code>${channelSubs}</code>`,
    `• 👥 Groups: <code>${groupSubs}</code>`,
    `• 🔴 Inactive / Blocked: <code>${totalSubs - activeSubs}</code>`,
    `• <b>Total Active:</b> <code>${activeSubs}</code>`,
    '',
    `💾 <b>Database (Cloudflare D1):</b>`,
    `• Total CVEs Indexed: <code>${totalCves}</code>`,
    `• Standard Alerts Sent: <code>${totalNotified}</code>`,
    `• Trending Alerts Sent: <code>${trendingNotified}</code>`,
    '',
    `⚙️ <b>Settings & Schedule:</b>`,
    `• Min CVSS Score: <code>${env?.MIN_CVSS_SCORE || '7.6'}</code>`,
    `• Min EPSS Score: <code>${env?.MIN_EPSS_SCORE || '0.15'}</code>`,
    `• Cron Trigger: <code>Every 10 minutes</code>`,
    `• Security Status: <code>Protected & Active</code>`
  ].join('\n');
}

// Render paginated CVE search results with interactive navigation buttons
export async function renderSearchResultsView(chatId, messageId, query, page = 0, env, isEdit = false) {
  const pageSize = 5;
  const offset = page * pageSize;
  const cleanQ = (query || '').trim();

  let results = [];
  const isKev = cleanQ.toUpperCase() === 'KEV' || cleanQ.toUpperCase() === 'TRENDING';

  if (isKev) {
    const db = getDb(env);
    if (db) {
      try {
        await ensureD1Tables(db);
        const rows = await db.prepare(`
          SELECT c.data FROM notified_alerts a
          JOIN cves c ON a.cve_id = c.id
          WHERE a.alert_type = 'trending'
          ORDER BY a.notified_at DESC LIMIT ? OFFSET ?
        `).bind(pageSize + 1, offset).all();
        if (rows && rows.results) {
          results = rows.results.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data).filter(Boolean);
        }
      } catch (e) {
        console.error('Error fetching trending CVEs for search:', e);
      }
    }
  } else {
    results = await searchCves(cleanQ, env, { limit: pageSize + 1, offset });
  }

  const hasNextPage = results.length > pageSize;
  const pageItems = results.slice(0, pageSize);

  if (pageItems.length === 0 && page === 0) {
    const notFoundText = `❌ No vulnerabilities found matching <code>${escapeHtml(cleanQ)}</code>.\n\nTry searching for common products (e.g. <i>WordPress</i>, <i>Apache</i>, <i>Ivanti</i>, <i>Chrome</i>, <i>Linux</i>) or weakness types (e.g. <i>RCE</i>, <i>SQLi</i>, <i>SSRF</i>).`;
    const notFoundMarkup = {
      inline_keyboard: [
        [
          { text: '⚡ Quick Categories', callback_data: 'menu:categories' },
          { text: '🔍 New Search', callback_data: 'menu:search' }
        ],
        [
          { text: '🏠 Main Menu', callback_data: 'menu:home' }
        ]
      ]
    };
    if (isEdit && messageId) {
      await editTelegramMessage(chatId, messageId, notFoundText, env, { reply_markup: notFoundMarkup });
    } else {
      await sendTelegramMessage(chatId, notFoundText, env, { reply_markup: notFoundMarkup });
    }
    return;
  }

  const title = isKev ? 'Trending Exploit Threats' : (cleanQ ? `Search: "${cleanQ}"` : 'Latest Vulnerabilities');
  const lines = [
    `🔍 <b>${escapeHtml(title)}</b>`,
    `Showing page <b>${page + 1}</b> (Items ${offset + 1} - ${offset + pageItems.length}):`,
    '━━━━━━━━━━━━━━━━━━━━━'
  ];

  const cveButtonsRow1 = [];
  const cveButtonsRow2 = [];

  for (let i = 0; i < pageItems.length; i++) {
    const item = pageItems[i];
    const emoji = getSeverityEmoji(item.severity);
    const scoreStr = item.score ? `CVSS ${item.score}` : (item.severity || 'Unrated');
    const shortDesc = escapeHtml((item.description || 'No description').slice(0, 110));

    lines.push(`<b>${i + 1}. ${emoji} <a href="https://nvd.nist.gov/vuln/detail/${item.id}">${item.id}</a></b> (${scoreStr})`);
    lines.push(`${shortDesc}...`);
    lines.push('');

    const encodedQ = encodeURIComponent(cleanQ);
    const btn = {
      text: `${i + 1}. ${item.id}`,
      callback_data: `cve:${item.id}:${encodedQ}:${page}`
    };

    if (i < 3) {
      cveButtonsRow1.push(btn);
    } else {
      cveButtonsRow2.push(btn);
    }
  }

  const paginationRow = [];
  if (page > 0) {
    paginationRow.push({
      text: '⬅️ Prev',
      callback_data: `page:${encodeURIComponent(cleanQ)}:${page - 1}`
    });
  }
  paginationRow.push({
    text: `Page ${page + 1}`,
    callback_data: 'noop'
  });
  if (hasNextPage) {
    paginationRow.push({
      text: 'Next ➡️',
      callback_data: `page:${encodeURIComponent(cleanQ)}:${page + 1}`
    });
  }

  const inline_keyboard = [];
  if (cveButtonsRow1.length > 0) inline_keyboard.push(cveButtonsRow1);
  if (cveButtonsRow2.length > 0) inline_keyboard.push(cveButtonsRow2);
  inline_keyboard.push(paginationRow);
  inline_keyboard.push([
    { text: '⚡ Categories', callback_data: 'menu:categories' },
    { text: '🔍 New Search', callback_data: 'menu:search' },
    { text: '🏠 Main Menu', callback_data: 'menu:home' }
  ]);

  const outputText = lines.join('\n');

  if (isEdit && messageId) {
    await editTelegramMessage(chatId, messageId, outputText, env, { reply_markup: { inline_keyboard } });
  } else {
    await sendTelegramMessage(chatId, outputText, env, { reply_markup: { inline_keyboard } });
  }
}

// Telegram Webhook Update Handler (Processes bot commands, callbacks, and subscriptions)
export async function handleTelegramWebhook(request, env, ctx) {
  let update;
  try {
    update = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!update) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const adminIds = getAdminIds(env);

  const db = getDb(env);

  // 1. Handle bot added/removed from Channels or Groups (my_chat_member)
  if (update.my_chat_member) {
    const chat = update.my_chat_member.chat;
    const newStatus = update.my_chat_member.new_chat_member?.status;

    if (newStatus === 'administrator' || newStatus === 'member') {
      await upsertSubscriber({
        id: chat.id,
        chat_id: chat.id,
        first_name: chat.title || chat.first_name || 'Channel',
        username: chat.username || null,
        type: chat.type || 'channel'
      }, env);

      if (chat.type === 'channel' || chat.type === 'supergroup') {
        const welcomeNotice = [
          `🛡️ <b>CVE Security Alerts Activated!</b> 🦄`,
          '',
          `This ${chat.type} will now receive real-time notifications for newly discovered High & Critical vulnerabilities and trending zero-day exploit advisories.`,
          '',
          `• <i>Threshold: CVSS &ge; ${env?.MIN_CVSS_SCORE || '7.6'}</i>`,
          `• <i>Intelligence Feeds: NVD, CISA KEV, EPSS & GitHub PoCs</i>`,
          `• <i>Powered by @chsbrbot</i>`
        ].join('\n');
        await sendTelegramMessage(chat.id, welcomeNotice, env).catch(() => {});
      }

      const notice = [
        `📢 <b>Bot Added to ${chat.type.toUpperCase()}:</b>`,
        `• <b>Title:</b> <b>${escapeHtml(chat.title || 'Untitled')}</b>`,
        `• <b>Chat ID:</b> <code>${chat.id}</code>`,
        chat.username ? `• <b>Username:</b> @${chat.username}` : '',
        `• <b>Type:</b> <code>${chat.type}</code>`,
        `• <b>Status:</b> Automatically registered for CVE alerts!`
      ].filter(Boolean).join('\n');

      for (const aId of adminIds) {
        if (String(chat.id) !== aId) {
          await sendTelegramMessage(aId, notice, env).catch(() => {});
        }
      }
    } else if (newStatus === 'left' || newStatus === 'kicked') {
      await unsubscribeChat(chat.id, env);
      for (const aId of adminIds) {
        if (String(chat.id) !== aId) {
          await sendTelegramMessage(aId, `🔕 <b>Bot Removed from ${chat.type.toUpperCase()}:</b>\n• Title: <b>${escapeHtml(chat.title || '')}</b>\n• ID: <code>${chat.id}</code>\n• Status: Removed from broadcasts.`, env).catch(() => {});
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, type: 'my_chat_member' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Handle Callback Queries from Inline Keyboards
  if (update.callback_query) {
    const cb = update.callback_query;
    const cbId = cb.id;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const userId = cb.from?.id;
    const data = cb.data || '';
    const isAdmin = adminIds.includes(String(userId)) || adminIds.includes(String(chatId));

    try {
      // 2.0 Language selection: lang:<code>
      if (data.startsWith('lang:')) {
        const code = data.slice(5);
        const locale = I18N_LOCALES.includes(code) ? code : normLocale(code);
        await setUserLocale(chatId, locale, env);
        await answerTelegramCallback(cbId, env);
        const confirm = tr(locale, 'language_set', { name: I18N_NAMES[locale] || locale });
        if (messageId) {
          await editTelegramMessage(chatId, messageId, confirm, env).catch(() => sendTelegramMessage(chatId, confirm, env));
        } else {
          await sendTelegramMessage(chatId, confirm, env);
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.1 CVE Detail View: cve:<id> or cve:<id>:<back_query>:<back_page>
      if (data.startsWith('cve:')) {
        const parts = data.split(':');
        const cveId = parts[1];
        const backQ = parts[2] ? decodeURIComponent(parts[2]) : undefined;
        const backP = parts[3] ? parseInt(parts[3], 10) : 0;

        await answerTelegramCallback(cbId, env);
        const cve = await getCveById(cveId, env);
        if (!cve) {
          await answerTelegramCallback(cbId, env, { text: `CVE ${cveId} not found.`, show_alert: true });
        } else {
          const card = formatCveRichCard(cve, {
            backToQuery: backQ,
            backToPage: backP
          });
          await editTelegramMessage(chatId, messageId, card.text, env, {
            reply_markup: card.reply_markup
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.2 Back to search results: back:<query>:<page>
      if (data.startsWith('back:')) {
        const parts = data.split(':');
        const query = parts[1] ? decodeURIComponent(parts[1]) : '';
        const page = parseInt(parts[2] || '0', 10);

        await answerTelegramCallback(cbId, env);
        await renderSearchResultsView(chatId, messageId, query, page, env, true);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.3 Pagination: page:<query>:<page>
      if (data.startsWith('page:')) {
        const parts = data.split(':');
        const query = parts[1] ? decodeURIComponent(parts[1]) : '';
        const page = parseInt(parts[2] || '0', 10);

        await answerTelegramCallback(cbId, env);
        await renderSearchResultsView(chatId, messageId, query, page, env, true);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.4 Quick Categories: cat:<category>
      if (data.startsWith('cat:')) {
        const cat = data.split(':')[1];
        await answerTelegramCallback(cbId, env);
        let query = '';
        if (cat === 'rce') query = 'Remote Code Execution';
        else if (cat === 'kev') query = 'KEV';
        else if (cat === 'ssrf') query = 'Server-Side Request Forgery';
        else if (cat === 'auth') query = 'Authentication';
        else if (cat === 'sqli') query = 'SQL Injection';
        else if (cat === 'upload') query = 'File Upload';
        else query = cat;

        await renderSearchResultsView(chatId, messageId, query, 0, env, true);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.5 Quick Category Menu prompt
      if (data === 'menu:categories') {
        await answerTelegramCallback(cbId, env);
        const text = `⚡ <b>Quick Threat Categories:</b>\n\nTap any security vulnerability category below to instantly search active threats:`;
        await editTelegramMessage(chatId, messageId, text, env, {
          reply_markup: getQuickCategoriesKeyboard()
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.6 Search prompt
      if (data === 'menu:search') {
        await answerTelegramCallback(cbId, env);
        const text = `🔍 <b>Search Vulnerabilities</b>\n\nJust type a keyword (e.g. <code>Ivanti</code>, <code>Chrome</code>, <code>RCE</code>) or a CVE ID, or tap a category below:`;
        await editTelegramMessage(chatId, messageId, text, env, {
          reply_markup: getQuickCategoriesKeyboard()
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.6.1 Main Menu prompt
      if (data === 'menu:home') {
        await answerTelegramCallback(cbId, env);
        const minCvss = env?.MIN_CVSS_SCORE || '7.6';
        const menuText = [
          `🛡️ <b>CVE Security Intelligence Main Menu</b>`,
          '',
          `• <b>Threshold:</b> CVSS &ge; <code>${minCvss}</code> & Trending Zero-Days`,
          '',
          `Select an option below:`
        ].join('\n');
        const menuMarkup = {
          inline_keyboard: [
            [
              { text: '🔍 Search CVEs', callback_data: 'menu:search' },
              { text: '🔥 Trending Threats', callback_data: 'cat:kev' }
            ],
            [
              { text: '🆕 Latest CVEs', callback_data: 'page::0' },
              { text: '⚡ Quick Categories', callback_data: 'menu:categories' }
            ],
            [
              { text: '📊 Alert Status', callback_data: 'sub:toggle' },
              { text: 'ℹ️ About Bot', callback_data: 'menu:about' }
            ],
            [
              { text: '🏠 Main Menu', callback_data: 'menu:home' }
            ]
          ]
        };
        await editTelegramMessage(chatId, messageId, menuText, env, { reply_markup: menuMarkup });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.6.2 About Bot prompt
      if (data === 'menu:about') {
        await answerTelegramCallback(cbId, env);
        const minCvss = env?.MIN_CVSS_SCORE || '7.6';
        const aboutText = [
          `🛡️ <b>About CVE Security Intelligence Bot</b> (@chsbrbot)`,
          '',
          `A dedicated threat intelligence bot providing real-time vulnerability monitoring, zero-day threat correlation, and instant alerts.`,
          '',
          `📡 <b>Data Sources:</b>`,
          `• <b>NVD (NIST):</b> REST API v2.0 for all published CVE vulnerabilities.`,
          `• <b>CISA KEV:</b> Known Exploited Vulnerabilities catalog for active exploits.`,
          `• <b>FIRST EPSS:</b> Exploit Prediction Scoring System probabilities.`,
          `• <b>GitHub PoC Radar:</b> Automated repository scanning for verified proof-of-concept exploits.`,
          `• <b>Cloudflare D1:</b> Edge database for ultra-low latency searches and indexing.`,
          '',
          `⚙️ <b>Notification Policy:</b> High & Critical (&ge; CVSS ${minCvss}) + KEV threats.`
        ].join('\n');
        const aboutMarkup = {
          inline_keyboard: [
            [
              { text: '🔍 Search CVEs', callback_data: 'menu:search' },
              { text: '🔥 Trending Threats', callback_data: 'cat:kev' }
            ],
            [
              { text: '⚡ Quick Categories', callback_data: 'menu:categories' },
              { text: '🏠 Main Menu', callback_data: 'menu:home' }
            ]
          ]
        };
        await editTelegramMessage(chatId, messageId, aboutText, env, { reply_markup: aboutMarkup });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.6.2.1 Show / collapse the reply keyboard
      if (data === 'menu:open_keyboard') {
        await answerTelegramCallback(cbId, env);
        await sendTelegramMessage(chatId, `⌨️ Keyboard opened.`, env, {
          reply_markup: getMainMenuKeyboard(isAdmin)
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      if (data === 'menu:close_keyboard') {
        await answerTelegramCallback(cbId, env);
        await sendTelegramMessage(chatId, `🔽 Keyboard collapsed. Send /start to bring it back.`, env, {
          reply_markup: { remove_keyboard: true }
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.6.3 Noop acknowledgment
      if (data === 'noop') {
        await answerTelegramCallback(cbId, env);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.7 Toggle subscription
      if (data === 'sub:toggle') {
        let isNowActive = true;
        if (db) {
          await ensureD1Tables(db);
          const current = await db.prepare("SELECT is_active FROM subscribers WHERE chat_id = ?").bind(String(chatId)).first();
          if (current && current.is_active === 1) {
            await unsubscribeChat(chatId, env);
            isNowActive = false;
          } else {
            await upsertSubscriber(cb.message.chat, env);
            isNowActive = true;
          }
        }
        await answerTelegramCallback(cbId, env, {
          text: isNowActive ? '🔔 Subscribed to alerts!' : '🔕 Unsubscribed from alerts.'
        });

        const minCvss = env?.MIN_CVSS_SCORE || '7.6';
        const updatedStatus = [
          `ℹ️ <b>Subscription Status</b>`,
          '',
          `• <b>Status:</b> ${isNowActive ? '🟢 Active (Subscribed)' : '🔴 Inactive (Unsubscribed)'}`,
          `• <b>Alert Level:</b> High & Critical Vulnerabilities (&ge; CVSS <code>${minCvss}</code>)`,
          '',
          isNowActive
            ? `You are receiving automated notifications for newly disclosed High & Critical vulnerabilities.`
            : `You are unsubscribed. Tap below anytime to re-activate alerts.`
        ].join('\n');

        const toggleMarkup = {
          inline_keyboard: [
            [
              {
                text: isNowActive ? '🔕 Unsubscribe from Alerts' : '🔔 Subscribe to Alerts',
                callback_data: 'sub:toggle'
              }
            ],
            [
              { text: '🔍 Search CVEs', callback_data: 'menu:search' },
              { text: '⚡ Categories', callback_data: 'menu:categories' }
            ]
          ]
        };

        await editTelegramMessage(chatId, messageId, updatedStatus, env, {
          reply_markup: toggleMarkup
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // 2.8 Admin Panels & Actions
      if (data.startsWith('admin:')) {
        if (!isAdmin) {
          await answerTelegramCallback(cbId, env, { text: '⛔ Access Denied: Administrator Only', show_alert: true });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const action = data.split(':')[1];

        if (action === 'panel') {
          await answerTelegramCallback(cbId, env);
          const panelText = [
            `🛡️ <b>CVE Bot Administrator Dashboard</b>`,
            '',
            `Select a management tool or action below:`
          ].join('\n');
          await editTelegramMessage(chatId, messageId, panelText, env, {
            reply_markup: getAdminPanelKeyboard()
          });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        if (action === 'setup') {
          await answerTelegramCallback(cbId, env, { text: 'Syncing profile & commands...' });
          try {
            const syncRes = await syncBotProfileAndCommands(env);
            const ok = syncRes.description?.ok && syncRes.shortDescription?.ok && syncRes.commands?.ok;
            const resultText = [
              `⚙️ <b>Telegram Bot Profile & Commands Sync</b>`,
              '',
              `• Description: ${syncRes.description?.ok ? '✅ Updated' : '❌ Failed: ' + (syncRes.description?.description || 'Error')}`,
              `• Short Description: ${syncRes.shortDescription?.ok ? '✅ Updated' : '❌ Failed: ' + (syncRes.shortDescription?.description || 'Error')}`,
              `• Command Menu: ${syncRes.commands?.ok ? `✅ Updated (${ADMIN_COMMANDS.length} admin commands)` : '❌ Failed: ' + (syncRes.commands?.description || 'Error')}`,
              '',
              ok ? `🎉 <i>All bot profile descriptions and commands are synchronized with Telegram!</i>` : `⚠️ <i>Some updates failed. Check logs.</i>`
            ].join('\n');

            const markup = {
              inline_keyboard: [
                [
                  { text: '🔄 Re-sync', callback_data: 'admin:setup' },
                  { text: '⬅️ Back to Admin', callback_data: 'admin:panel' }
                ]
              ]
            };
            await editTelegramMessage(chatId, messageId, resultText, env, { reply_markup: markup });
          } catch (err) {
            await editTelegramMessage(chatId, messageId, `❌ Failed to sync: ${escapeHtml(err.message)}`, env, {
              reply_markup: getAdminPanelKeyboard()
            });
          }
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        if (action === 'stats') {
          await answerTelegramCallback(cbId, env);
          const statsReply = await getFormattedAdminStats(env);
          const markup = {
            inline_keyboard: [
              [
                { text: '🔄 Refresh Stats', callback_data: 'admin:stats' },
                { text: '⬅️ Back to Admin', callback_data: 'admin:panel' }
              ]
            ]
          };
          await editTelegramMessage(chatId, messageId, statsReply, env, { reply_markup: markup });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        if (action === 'ping') {
          const start = Date.now();
          if (db) {
            await ensureD1Tables(db);
            await db.prepare("SELECT 1").first();
          }
          const latency = Date.now() - start;
          await answerTelegramCallback(cbId, env, { text: `Pong! ${latency}ms` });

          const pingReply = [
            `🏓 <b>Pong! System Operational</b>`,
            '',
            `• <b>D1 Latency:</b> <code>${latency}ms</code>`,
            `• <b>Bot:</b> @chsbrbot`,
            `• <b>Schedule:</b> Cron active every 10 min`,
            `• <b>Server Time:</b> <code>${new Date().toISOString()}</code>`
          ].join('\n');

          const markup = {
            inline_keyboard: [
              [
                { text: '🏓 Ping Again', callback_data: 'admin:ping' },
                { text: '⬅️ Back to Admin', callback_data: 'admin:panel' }
              ]
            ]
          };
          await editTelegramMessage(chatId, messageId, pingReply, env, { reply_markup: markup });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        if (action === 'trigger') {
          await answerTelegramCallback(cbId, env, { text: '⚡ Scan initiated in background...' });
          const [newResult, trendResult] = await Promise.all([
            processCveAlerts(env),
            processTrendingAlerts(env)
          ]);

          const report = [
            `⚡ <b>Scan & Alert Trigger Completed!</b>`,
            '',
            `• New CVEs Evaluated: <code>${newResult?.totalEvaluated || 0}</code> (Alerts Sent: <code>${newResult?.notifiedCount || 0}</code>)`,
            `• Trending Evaluated: <code>${trendResult?.trendingFound || 0}</code> (Alerts Sent: <code>${trendResult?.notifiedCount || 0}</code>)`
          ].join('\n');

          const markup = {
            inline_keyboard: [
              [
                { text: '⚡ Run Again', callback_data: 'admin:trigger' },
                { text: '⬅️ Back to Admin', callback_data: 'admin:panel' }
              ]
            ]
          };
          await editTelegramMessage(chatId, messageId, report, env, { reply_markup: markup });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        if (action === 'history') {
          await answerTelegramCallback(cbId, env);
          let alerts = [];
          if (db) {
            await ensureD1Tables(db);
            const rows = await db.prepare(`
              SELECT a.cve_id, a.alert_type, a.notified_at, c.severity, c.score
              FROM notified_alerts a
              LEFT JOIN cves c ON a.cve_id = c.id
              ORDER BY a.notified_at DESC LIMIT 6
            `).all();
            if (rows && rows.results) alerts = rows.results;
          }

          const lines = [
            `📋 <b>Recent Dispatched Alert History:</b>`,
            ''
          ];
          if (alerts.length === 0) {
            lines.push('<i>No alerts have been dispatched yet.</i>');
          } else {
            for (const a of alerts) {
              const typeIcon = a.alert_type === 'trending' ? '🔥 Trending' : '🔔 Standard';
              const timeStr = new Date(a.notified_at).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
              const scoreStr = a.score ? `(CVSS ${a.score})` : '';
              lines.push(`• <b>${a.cve_id}</b> [${typeIcon}] ${scoreStr}\n  🕒 <code>${timeStr}</code>`);
            }
          }

          const markup = {
            inline_keyboard: [
              [
                { text: '🔄 Refresh Logs', callback_data: 'admin:history' },
                { text: '⬅️ Back to Admin', callback_data: 'admin:panel' }
              ]
            ]
          };
          await editTelegramMessage(chatId, messageId, lines.join('\n'), env, { reply_markup: markup });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        if (action === 'channels') {
          await answerTelegramCallback(cbId, env);
          let channels = [];
          if (db) {
            await ensureD1Tables(db);
            const rows = await db.prepare("SELECT chat_id, first_name, username, is_active FROM subscribers WHERE chat_type = 'channel' ORDER BY created_at DESC").all();
            if (rows && rows.results) channels = rows.results;
          }
          const envChannel = env?.TELEGRAM_CHANNEL_ID ? `<code>${env.TELEGRAM_CHANNEL_ID}</code>` : '<i>None in env</i>';
          const lines = [
            `📢 <b>Connected Channels</b> (Total: <code>${channels.length}</code>):`,
            `• Env Channel: ${envChannel}`,
            ''
          ];
          if (channels.length === 0) {
            lines.push('<i>No channels enrolled yet. Add @chsbrbot as Administrator with "Post Messages" permission to enroll any channel!</i>');
          } else {
            for (const c of channels) {
              const status = c.is_active === 1 ? '🟢' : '🔴';
              lines.push(`${status} <b>${escapeHtml(c.first_name || 'Channel')}</b>\n  ID: <code>${c.chat_id}</code>${c.username ? ` (@${escapeHtml(c.username)})` : ''}`);
            }
          }

          const markup = {
            inline_keyboard: [
              [
                { text: '🧪 Test Channel Alert', callback_data: 'admin:test_chan' },
                { text: '⬅️ Back to Admin', callback_data: 'admin:panel' }
              ]
            ]
          };
          await editTelegramMessage(chatId, messageId, lines.join('\n'), env, { reply_markup: markup });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        if (action === 'test' || action === 'test_chan') {
          await answerTelegramCallback(cbId, env, { text: '🧪 Dispatched test alert!' });
          const testCve = {
            id: 'CVE-2024-TEST',
            description: 'This is an interactive test alert demonstrating rich HTML styling and inline action buttons.',
            score: 9.8,
            severity: 'CRITICAL',
            vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
            categories: ['CWE-89: SQL Injection'],
            bugTypes: ['SQL Injection'],
            affectedSoftware: ['CVE Telegram Notifier 2.0'],
            pocRefs: ['https://github.com/example/test-poc']
          };

          if (action === 'test_chan') {
            let chList = [];
            if (db) {
              await ensureD1Tables(db);
              const rows = await db.prepare("SELECT chat_id FROM subscribers WHERE chat_type = 'channel' AND is_active = 1").all();
              if (rows && rows.results) chList = rows.results.map(r => r.chat_id);
            }
            let sent = 0;
            for (const ch of chList) {
              try {
                await sendTelegramNotification(testCve, env, ch);
                sent++;
              } catch (e) {}
            }
            await sendTelegramMessage(chatId, `📢 Sent test alert to <code>${sent}</code> channels.`, env);
          } else {
            await sendTelegramNotification(testCve, env, chatId);
          }
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
      }

      await answerTelegramCallback(cbId, env);
    } catch (cbErr) {
      console.error('Error handling callback_query:', cbErr);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // 3. Handle Messages or Channel Posts
  const message = update.message || update.channel_post;
  if (!message) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const chatId = message.chat?.id;
  const userId = message.from?.id;
  const text = (message.text || '').trim();

  if (!chatId || !text) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const isAdmin = adminIds.includes(String(userId)) || adminIds.includes(String(chatId));

  const parts = text.split(/\s+/);
  const rawCmd = parts[0] || '';
  const command = rawCmd.toLowerCase().split('@')[0];
  const args = parts.slice(1);
  const argText = args.join(' ').trim();
  const lowerText = text.toLowerCase();

  try {
    // 3.1 /start
    if (command === '/start') {
      await upsertSubscriber(message.chat, env);
      const name = escapeHtml(message.from?.first_name || message.chat?.title || 'Security Analyst');
      const minCvss = env?.MIN_CVSS_SCORE || '7.6';

      // Deep linking check: e.g. /start CVE-2024-3094
      if (args[0]) {
        let target = args[0].trim();
        if (target.toUpperCase().startsWith('CVE-') || /^\d{4}-\d{4,7}$/.test(target)) {
          let cveId = target.toUpperCase();
          if (!cveId.startsWith('CVE-')) cveId = `CVE-${cveId}`;
          const cve = await getCveById(cveId, env);
          if (cve) {
            const card = formatCveRichCard(cve);
            await sendTelegramMessage(chatId, card.text, env, {
              reply_markup: card.reply_markup
            });
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          }
        }
      }

      const locale = await getUserLocale(chatId, env, message.from?.language_code);
      const welcome = tr(locale, 'welcome', { name, minCvss });

      const inlineQuick = {
        inline_keyboard: [
          [
            { text: '🔍 Search CVEs', callback_data: 'menu:search' },
            { text: '🔥 Trending Threats', callback_data: 'cat:kev' }
          ],
          [
            { text: '🆕 Latest CVEs', callback_data: 'page::0' },
            { text: '⚡ Quick Categories', callback_data: 'menu:categories' }
          ],
          [
            { text: '📊 My Status', callback_data: 'sub:toggle' },
            { text: 'ℹ️ About Bot', callback_data: 'menu:about' }
          ],
          [
            { text: tr(locale, 'source'), url: SOURCE_URL }
          ]
        ]
      };

      // 1. Establish Reply Keyboard (collapsible / openable)
      await sendTelegramMessage(chatId, welcome, env, {
        reply_markup: getMainMenuKeyboard(isAdmin)
      });

      // 2. Interactive quick-action card in the chat
      await sendTelegramMessage(chatId, `⚡ <b>Quick Threat Dashboard:</b>\nSelect an action or search query below:`, env, {
        reply_markup: inlineQuick
      });

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.2 /help
    if (command === '/help') {
      const locale = await getUserLocale(chatId, env, message.from?.language_code);
      await sendTelegramMessage(chatId, tr(locale, 'help'), env, {
        reply_markup: { inline_keyboard: [[{ text: tr(locale, 'source'), url: SOURCE_URL }]] }
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.3 /language — change the UI language
    if (command === '/language' || command === '/lang') {
      const locale = await getUserLocale(chatId, env, message.from?.language_code);
      await sendTelegramMessage(chatId, tr(locale, 'choose_language'), env, {
        reply_markup: languageInlineKeyboard()
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.4 Tapping "🔍 Search CVEs"
    if (lowerText === '🔍 search cves') {
      const prompt = `🔍 <b>CVE Vulnerability Search</b>\n\nJust type a keyword to search vulnerabilities by name, software, vendor, or bug type — or send a CVE ID for full details.\n\n<i>Examples:</i>\n• <code>Ivanti</code>\n• <code>Apache</code>\n• <code>RCE</code>\n• <code>CVE-2024-3094</code>\n\nOr tap a category below:`;
      await sendTelegramMessage(chatId, prompt, env, {
        reply_markup: getQuickCategoriesKeyboard()
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.6 "🆕 Latest CVEs"
    if (lowerText === '🆕 latest cves') {
      await renderSearchResultsView(chatId, null, '', 0, env, false);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.7 "🔥 Trending Exploits"
    if (lowerText === '🔥 trending exploits') {
      await renderSearchResultsView(chatId, null, 'KEV', 0, env, false);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.8 "⚡ Quick Categories"
    if (lowerText === '⚡ quick categories') {
      const text = `⚡ <b>Quick Threat Categories:</b>\n\nTap any security vulnerability category below to search active threats:`;
      await sendTelegramMessage(chatId, text, env, {
        reply_markup: getQuickCategoriesKeyboard()
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.10 "📊 My Status"
    if (lowerText === '📊 my status') {
      let isSubscribed = false;
      if (db) {
        await ensureD1Tables(db);
        const sub = await db.prepare("SELECT is_active FROM subscribers WHERE chat_id = ?").bind(String(chatId)).first();
        isSubscribed = sub ? sub.is_active === 1 : false;
      }
      const minCvss = env?.MIN_CVSS_SCORE || '7.6';
      const statusMsg = [
        `ℹ️ <b>Subscription Status</b>`,
        '',
        `• <b>Status:</b> ${isSubscribed ? '🟢 Active (Subscribed)' : '🔴 Inactive (Unsubscribed)'}`,
        `• <b>Alert Level:</b> High & Critical Vulnerabilities (&ge; CVSS <code>${minCvss}</code>)`,
        '',
        isSubscribed
          ? `You are receiving automated notifications for newly disclosed High & Critical vulnerabilities.`
          : `Tap below to enable automated notifications.`,
        isAdmin ? `\n👑 <b>Admin Note:</b> Tap Admin Panel for system metrics.` : ''
      ].filter(Boolean).join('\n');

      const toggleMarkup = {
        inline_keyboard: [
          [
            {
              text: isSubscribed ? '🔕 Unsubscribe from Alerts' : '🔔 Subscribe to Alerts',
              callback_data: 'sub:toggle'
            }
          ],
          [
            { text: '🔍 Search CVEs', callback_data: 'menu:search' },
            { text: '⚡ Categories', callback_data: 'menu:categories' }
          ]
        ]
      };

      await sendTelegramMessage(chatId, statusMsg, env, { reply_markup: toggleMarkup });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.12 "📖 Help"
    if (lowerText === '📖 help') {
      const helpMsg = [
        `📖 <b>CVE Notifier Help</b>`,
        '',
        `Everything works through the buttons:`,
        `• <b>🔍 Search CVEs</b> - Or just type a keyword (e.g. <code>WordPress</code>)`,
        `• <b>🆕 Latest CVEs</b> - Latest disclosed vulnerabilities`,
        `• <b>🔥 Trending Exploits</b> - Active zero-days & KEV threats`,
        `• <b>⚡ Quick Categories</b> - Browse by threat category (RCE, Auth, Web...)`,
        `• <b>📊 My Status</b> - Check & toggle alert subscription`,
        `• Send any CVE ID (e.g. <code>CVE-2024-3094</code>) for full details`,
        '',
        `📢 <b>Channels & Groups:</b> add <code>@chsbrbot</code> as an administrator with "Post Messages" permission to receive alerts there.`,
        isAdmin ? `\n👑 <b>Administrator commands:</b>\n• <code>/admin</code> - Interactive Admin Dashboard\n• <code>/stats</code> - System statistics\n• <code>/broadcast [channel] &lt;msg&gt;</code> - Announcement\n• <code>/setup</code> - Sync bot profile & commands` : ''
      ].filter(Boolean).join('\n');

      const helpMarkup = {
        inline_keyboard: [
          [
            { text: '🔍 Search', callback_data: 'menu:search' },
            { text: '🔥 Trending', callback_data: 'cat:kev' }
          ],
          [
            { text: '⚡ Categories', callback_data: 'menu:categories' },
            { text: '📊 Status', callback_data: 'sub:toggle' }
          ],
          [
            { text: '⌨️ Open Keyboard', callback_data: 'menu:open_keyboard' },
            { text: '🔽 Collapse Keyboard', callback_data: 'menu:close_keyboard' }
          ],
          [
            { text: 'ℹ️ About Bot', callback_data: 'menu:about' },
            { text: '🏠 Main Menu', callback_data: 'menu:home' }
          ]
        ]
      };

      await sendTelegramMessage(chatId, helpMsg, env, {
        reply_markup: helpMarkup
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.13 Admin commands (/admin, /stats, /broadcast, /setup) or "👑 Admin Panel"
    if (command === '/admin' || lowerText === '👑 admin panel' || command === '/stats' || command === '/broadcast' || command === '/setup') {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, `⛔ <b>Access Denied:</b> You do not have permission to execute administrator commands.`, env, {
          reply_markup: getMainMenuKeyboard(isAdmin)
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Check /admin setup or /admin sync
      if (command === '/setup' || (command === '/admin' && (args[0] === 'setup' || args[0] === 'sync'))) {
        const syncRes = await syncBotProfileAndCommands(env);
        const ok = syncRes.description?.ok && syncRes.shortDescription?.ok && syncRes.commands?.ok;
        const resultText = [
          `⚙️ <b>Telegram Bot Profile & Commands Sync</b>`,
          '',
          `• Description: ${syncRes.description?.ok ? '✅ Updated' : '❌ Failed: ' + (syncRes.description?.description || 'Error')}`,
          `• Short Description: ${syncRes.shortDescription?.ok ? '✅ Updated' : '❌ Failed: ' + (syncRes.shortDescription?.description || 'Error')}`,
          `• Command Menu: ${syncRes.commands?.ok ? `✅ Updated (${ADMIN_COMMANDS.length} admin commands)` : '❌ Failed: ' + (syncRes.commands?.description || 'Error')}`,
          '',
          ok ? `🎉 <i>All bot profile descriptions and commands are synchronized with Telegram!</i>` : `⚠️ <i>Some updates failed. Check logs.</i>`
        ].join('\n');
        await sendTelegramMessage(chatId, resultText, env, {
          reply_markup: getAdminPanelKeyboard()
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      if (command === '/stats') {
        const statsReply = await getFormattedAdminStats(env);
        await sendTelegramMessage(chatId, statsReply, env, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Refresh', callback_data: 'admin:stats' },
                { text: '👑 Admin Dashboard', callback_data: 'admin:panel' }
              ]
            ]
          }
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      if (command === '/broadcast') {
        const isChannelOnly = (args[0] || '').toLowerCase() === 'channel';
        const broadcastText = isChannelOnly ? args.slice(1).join(' ').trim() : args.join(' ').trim();
        if (!broadcastText) {
          await sendTelegramMessage(chatId, isChannelOnly ? '❓ Usage: <code>/broadcast channel &lt;message&gt;</code>' : '❓ Usage: <code>/broadcast &lt;message&gt;</code>', env, {
            reply_markup: getMainMenuKeyboard(isAdmin)
          });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        let targets = [];
        if (isChannelOnly) {
          if (db) {
            await ensureD1Tables(db);
            const rows = await db.prepare("SELECT chat_id FROM subscribers WHERE chat_type = 'channel' AND is_active = 1").all();
            if (rows && rows.results) targets = rows.results.map(r => String(r.chat_id));
          }
        } else {
          targets = await getAllActiveSubscribers(env);
        }

        const formattedBroadcast = `📢 <b>Announcement from Administrator:</b>\n\n${escapeHtml(broadcastText)}`;
        let sent = 0;
        let failed = 0;
        for (const targetId of targets) {
          try {
            await sendTelegramMessage(targetId, formattedBroadcast, env);
            sent++;
            if (targets.length > 1) await new Promise(r => setTimeout(r, 40));
          } catch (e) {
            failed++;
          }
        }

        await sendTelegramMessage(chatId, `✅ <b>Broadcast Complete (${isChannelOnly ? 'Channels Only' : 'All Subscribers'})</b>\n• Delivered: <code>${sent}</code>\n• Failed: <code>${failed}</code>\n• Total: <code>${targets.length}</code>`, env, {
          reply_markup: getMainMenuKeyboard(isAdmin)
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Default Admin Dashboard
      const panelText = [
        `🛡️ <b>CVE Bot Administrator Dashboard</b>`,
        '',
        `Select a management tool or action below:`
      ].join('\n');

      await sendTelegramMessage(chatId, panelText, env, {
        reply_markup: getAdminPanelKeyboard()
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.14 Direct CVE ID detection (e.g. user sends "CVE-2024-3094" or "2024-3094")
    const cveMatch = text.match(/\b(?:CVE-)?(20\d{2}-\d{4,7})\b/i);
    if (cveMatch) {
      const cveId = `CVE-${cveMatch[1].toUpperCase()}`;
      const cve = await getCveById(cveId, env);
      if (!cve) {
        await sendTelegramMessage(chatId, `❌ Vulnerability <code>${cveId}</code> not found in database or NVD.`, env, {
          reply_markup: getMainMenuKeyboard(isAdmin)
        });
      } else {
        const card = formatCveRichCard(cve);
        await sendTelegramMessage(chatId, card.text, env, {
          reply_markup: card.reply_markup
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 3.15 Direct text search (e.g. user sends "ivanti", "apache", "rce")
    if (!command.startsWith('/') && text.length >= 2) {
      await renderSearchResultsView(chatId, null, text, 0, env, false);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Default if unhandled command
    if (command.startsWith('/')) {
      const unknownMsg = isAdmin
        ? `❓ Unknown command: <code>${escapeHtml(command)}</code>. Admin commands: /admin, /stats, /broadcast, /setup.`
        : `💡 Commands aren't available — please use the buttons below.`;
      await sendTelegramMessage(chatId, unknownMsg, env, {
        reply_markup: getMainMenuKeyboard(isAdmin)
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Fallback: restore persistent keyboard
    await sendTelegramMessage(chatId, `💡 Select an action from the keyboard below.`, env, {
      reply_markup: getMainMenuKeyboard(isAdmin)
    });
  } catch (err) {
    console.error('Error in handleTelegramWebhook:', err);
    try {
      const errMsg = isAdmin
        ? `⚠️ Error: ${escapeHtml(err.message)}`
        : `⚠️ An error occurred while processing your request.`;
      await sendTelegramMessage(chatId, errMsg, env);
    } catch (e) {}
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default {
  // HTTP interface (Fetch event handler)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Telegram Webhook endpoint (/webhook, /api/telegram, or /telegram-webhook)
    if (path === '/webhook' || path === '/api/telegram' || path === '/telegram-webhook') {
      if (request.method === 'POST') {
        return await handleTelegramWebhook(request, env, ctx);
      }
      if (request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'ok',
          bot: 'chsbrbot',
          webhook: 'active',
          time: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 1. Service Status (GET /)
    if (path === '/' && request.method === 'GET' && !url.searchParams.has('trigger')) {
      return new Response(JSON.stringify({
        ok: true,
        service: 'cve-telegram-notifier',
        interface: 'telegram',
        bot: '@chsbrbot',
        status: 'operational',
        time: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Bot Profile & Commands Synchronization (GET or POST /api/setup-bot)
    if (path === '/api/setup-bot' || path === '/setup-bot') {
      try {
        const result = await syncBotProfileAndCommands(env);
        return new Response(JSON.stringify({ ok: true, result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }


    // 2. Single CVE direct D1/KV lookup (GET /api/cves/:id)
    if (path.startsWith('/api/cves/') && path.length > 10 && request.method === 'GET') {
      const cveId = path.split('/')[3];
      const db = getDb(env);
      if (cveId && db) {
        try {
          await ensureD1Tables(db);
          const row = await db.prepare('SELECT data FROM cves WHERE id = ?').bind(cveId).first();
          if (row && row.data) {
            const dataStr = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
            return new Response(dataStr, {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
        } catch (e) {
          // ignore lookup error
        }
      }
      if (cveId && env.CVE_KV) {
        try {
          const rawCve = await env.CVE_KV.get(`cve:${cveId}`);
          if (rawCve) {
            return new Response(rawCve, {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
        } catch (e) {
          // ignore lookup error
        }
      }
    }

    // 3. JSON API for querying vulnerabilities (GET /api/cves)
    if (path === '/api/cves' && request.method === 'GET') {
      try {
        const filters = {
          q: url.searchParams.get('q'),
          weakness: url.searchParams.get('weakness') || url.searchParams.get('cwe'),
          severity: url.searchParams.get('severity'),
          days: url.searchParams.get('days'),
          limit: url.searchParams.get('limit') || '50'
        };

        // 1. Try local dev directory (/cves)
        const localList = await loadLocalCves(filters);
        if (localList) {
          return new Response(JSON.stringify({
            success: true,
            source: 'local_cves_dir',
            count: localList.length,
            vulnerabilities: localList
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        // 2. Try Cloudflare D1 SQLite Database
        const db = getDb(env);
        if (db) {
          const d1List = await queryCvesFromD1(env, filters);
          if (d1List && d1List.length > 0) {
            return new Response(JSON.stringify({
              success: true,
              source: 'cloudflare_d1_sqlite',
              count: d1List.length,
              vulnerabilities: d1List
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
        }

        // 3. Try Cloudflare KV Database Cache (fallback)
        if (env.CVE_KV) {
          try {
            const rawKvCache = await env.CVE_KV.get('CACHED_CVE_LIST');
            if (rawKvCache) {
              const cachedList = JSON.parse(rawKvCache);
              const filtered = filterCveList(cachedList, filters);
              return new Response(JSON.stringify({
                success: true,
                source: 'cloudflare_kv_db',
                count: filtered.length,
                vulnerabilities: filtered
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
              });
            }
          } catch (e) {
            console.error('KV database cache read error:', e);
          }
        }

        // 4. Fallback: Fetch from NVD API and update database
        const rawList = await fetchRecentCves(env, { resultsPerPage: 100 });
        const parsedList = rawList.map(item => parseCveData(item));
        if (db) {
          await saveCvesToD1(parsedList, env);
        } else if (env.CVE_KV) {
          await saveCvesToKvCache(parsedList, env);
        }
        const filtered = filterCveList(parsedList, filters);

        return new Response(JSON.stringify({
          success: true,
          source: 'nvd_online_api',
          count: filtered.length,
          vulnerabilities: filtered
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 4. Trending Vulnerabilities API (GET /api/trending)
    if (path === '/api/trending' && request.method === 'GET') {
      try {
        const minEpss = url.searchParams.get('min_epss') ? parseFloat(url.searchParams.get('min_epss')) : undefined;
        const kevDays = url.searchParams.get('days') ? parseInt(url.searchParams.get('days'), 10) : undefined;
        const trending = await detectTrendingVulnerabilities(env, { minEpss, kevDays });
        return new Response(JSON.stringify({
          success: true,
          count: trending.length,
          vulnerabilities: trending
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 5. Telegram Alert Trigger (/trigger, /api/trigger, or ?trigger=true)
    if (path === '/trigger' || path === '/api/trigger' || url.searchParams.has('trigger')) {
      if (env.TRIGGER_SECRET) {
        const secret = url.searchParams.get('secret');
        if (secret !== env.TRIGGER_SECRET) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      try {
        const type = (url.searchParams.get('type') || '').toLowerCase();
        let result;
        if (type === 'trending') {
          result = await processTrendingAlerts(env);
        } else if (type === 'new') {
          result = await processCveAlerts(env);
        } else {
          const [cveResult, trendingResult] = await Promise.all([
            processCveAlerts(env),
            processTrendingAlerts(env)
          ]);
          result = { newCves: cveResult, trendingCves: trendingResult };
        }
        return new Response(JSON.stringify({ success: true, result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Default fallback: JSON Status
    return new Response(JSON.stringify({
      ok: true,
      service: 'cve-telegram-notifier',
      interface: 'telegram',
      bot: '@chsbrbot',
      status: 'operational'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  },
  
  // Cron interface (Scheduled event handler)
  async scheduled(event, env, ctx) {
    console.log(`Scheduled cron trigger started at: ${new Date().toISOString()}`);
    ctx.waitUntil(
      Promise.allSettled([
        processCveAlerts(env),
        processTrendingAlerts(env)
      ])
        .then(results => console.log('Scheduled job completed successfully:', results))
        .catch(err => console.error('Scheduled job failed:', err))
    );
  }
};
