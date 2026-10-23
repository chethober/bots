// Renders CVE cards and alerts from real NVD records in every language and
// checks them against Telegram's limits; also checks every string is translated.
//   node --import ./test/register.mjs test/render.mjs [--print]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCve } from '../tgcloud/lib/nvd.js';
import { cveCard, alertMessage } from '../tgcloud/lib/format.js';
import { LOCALES } from '../tgcloud/lib/i18n.js';
import { t } from '../tgcloud/lib/strings.js';

const print = process.argv.includes('--print');
const fixture = (id) => JSON.parse(readFileSync(new URL(`./fixtures/nvd-${id}.json`, import.meta.url))).vulnerabilities[0];

// Telegram counts the text after entities are parsed: tags removed, entities decoded.
const visible = (html) => html.replace(/<[^>]+>/g, '').replace(/&(lt|gt|amp|quot);/g, 'x');

function checkHtml(html, where) {
  const stack = [];
  for (const [, close, tag] of html.matchAll(/<(\/?)(b|i|code|a)\b[^>]*>/g)) {
    if (!close) stack.push(tag);
    else assert.equal(stack.pop(), tag, `${where}: </${tag}> closes the wrong tag`);
  }
  assert.equal(stack.length, 0, `${where}: unclosed <${stack.at(-1)}>`);
  assert.ok(!/&(?!(lt|gt|amp|quot);)/.test(html), `${where}: bare &`);
  assert.ok(visible(html).length <= 4096, `${where}: ${visible(html).length} characters`);
}

function checkMarkup(markup, where) {
  for (const row of markup.inline_keyboard) {
    for (const b of row) {
      if (b.callback_data) assert.ok(Buffer.byteLength(b.callback_data) <= 64, `${where}: callback_data too long`);
      else assert.match(b.url, /^https:\/\//, `${where}: button without a link`);
    }
  }
}

const xz = parseCve(fixture('CVE-2024-3094'));
assert.equal(xz.id, 'CVE-2024-3094');
assert.equal(xz.score, 10);
assert.equal(xz.severity, 'CRITICAL');
assert.ok(xz.categories.includes('CWE-506'));
assert.ok(xz.software.some((s) => s.startsWith('tukaani/xz')), xz.software.join(', '));

const log4j = parseCve(fixture('CVE-2021-44228'));
assert.ok(log4j.software.length > 6, 'Log4Shell has many affected products');
assert.ok(log4j.software.some((s) => s.startsWith('apache/log4j')), log4j.software.slice(0, 5).join(', '));
assert.ok(!log4j.software.includes('siemens/6bk1602-0aa12-0tp0'), 'hardware platforms are left out');
assert.ok(log4j.pocRefs.length > 0, 'Log4Shell has exploit references');

const kev = { cveId: 'CVE-2021-44228', dateAdded: '2021-12-10', requiredAction: 'For all affected software assets for which updates exist, the only acceptable remediation actions are: 1) Apply updates; OR 2) remove affected assets from agency networks. Temporary mitigations using one of the measures provided at https://www.cisa.gov/uscert/ed-22-02-apache-log4j-recommended-mitigation-measures are only acceptable until updates are available.', dueDate: '2021-12-24' };
const signals = {
  kev,
  epss: { score: 0.94358, percentile: 0.9996 },
  pocs: [{ repo: 'kozmer/log4j-shell-poc', url: 'https://github.com/kozmer/log4j-shell-poc', stars: 1800 }],
};
const noScore = { ...xz, id: 'CVE-2026-0001', score: null, severity: null, vector: '', software: [], bugTypes: [], pocRefs: [] };

for (const locale of LOCALES) {
  const outputs = {
    card: cveCard(log4j, locale, { kev, back: 'ls:q:12' }),
    cardNoScore: cveCard(noScore, locale),
    alertNew: alertMessage(xz, 'new', null, locale),
    alertTrending: alertMessage(log4j, 'trending', signals, locale),
  };
  for (const [name, { text, reply_markup }] of Object.entries(outputs)) {
    checkHtml(text, `${locale}/${name}`);
    checkMarkup(reply_markup, `${locale}/${name}`);
    if (print && (locale === 'en' || locale === 'fa')) console.log(`\n--- ${locale}/${name} (${visible(text).length} chars)\n${text}`);
  }
}

// Every key has all five languages, and the same {placeholders} in each.
const SAME_IN_EVERY_LANGUAGE = new Set(['btn_nvd', 'btn_kev']);
const source = readFileSync(new URL('../tgcloud/lib/strings.js', import.meta.url), 'utf8');
const keys = [...source.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);
assert.ok(keys.length > 50, `found ${keys.length} string keys`);
for (const key of keys) {
  const en = t('en', key);
  assert.notEqual(en, key, `${key} has no English text`);
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const locale of LOCALES) {
    const s = t(locale, key);
    assert.ok(locale === 'en' || s !== en || SAME_IN_EVERY_LANGUAGE.has(key), `${key} is not translated into ${locale}`);
    assert.equal(vars(s), vars(en), `${key}/${locale} placeholders differ from English`);
    checkHtml(s, `${key}/${locale}`);
  }
}

console.log(`ok: ${LOCALES.length} languages, ${keys.length} strings, cards and alerts within Telegram limits`);
