// Renders CVE cards and alerts from real NVD records in every language and
// checks them against Telegram's limits; also checks every string is translated.
//   node --import ./test/register.mjs test/render.mjs [--print]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCve } from '../tgcloud/lib/nvd.js';
import { cveCard, alertMessage, digestMessage, followUpdateMessage } from '../tgcloud/lib/format.js';
import { LOCALES } from '../tgcloud/lib/i18n.js';
import { t } from '../tgcloud/lib/strings.js';
import {
  mainKeyboard, matchButton, categoriesView, settingsView, levelView, deliveryView, watchView, watchPromptView,
  managedView, linkPromptView,
} from '../tgcloud/lib/views.js';
import { ADMIN_IDS } from '../tgcloud/lib/config.js';
import { deflateSync } from 'node:zlib';
import { cveWidget, cveListWidget, cvssMetrics, band, products, tagLine, cveHtml, DESC_MAX } from '../tgcloud/lib/cvewidget.js';
import { bytes } from '../tgcloud/lib/widgets/index.js';

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
  for (const row of markup?.inline_keyboard ?? []) {
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
    cardFollowing: cveCard(log4j, locale, { kev, back: 'ls:c.memory:12', following: true }),
    cardFollow: cveCard(xz, locale, { following: false }),
    digest: digestMessage(Array.from({ length: 40 }, (_, i) => ({
      cve: { ...(i % 2 ? log4j : xz), id: `CVE-2026-${String(10000 + i)}` }, kinds: i % 3 ? ['new'] : ['new', 'trending'],
    })), 'weekly', locale),
    digestOne: digestMessage([{ cve: noScore, kinds: ['trending'] }], 'daily', locale),
    followScore: followUpdateMessage(xz.id, { score: null, kev: false, poc: false },
      { score: 9.8, severity: 'CRITICAL', kev: true, poc: true }, ['score', 'kev', 'poc'], locale),
    followRescore: followUpdateMessage(xz.id, { score: 7.5 }, { score: 9.8, severity: 'CRITICAL' }, ['score'], locale),
  };
  for (const [name, { text, reply_markup }] of Object.entries(outputs)) {
    checkHtml(text, `${locale}/${name}`);
    checkMarkup(reply_markup, `${locale}/${name}`);
    if (print && (locale === 'en' || locale === 'fa')) console.log(`\n--- ${locale}/${name} (${visible(text).length} chars)\n${text}`);
  }
}

// Widgets (private chats): CVSS metrics, bands, and payloads within 1 KB in
// every language, with heights inside sendWidget's 50–600 px.
{
  const v3 = cvssMetrics('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H', 'en');
  assert.equal(v3.ver, 'CVSS 3.1');
  assert.deepEqual(v3.m[0], ['Attack vector', 'Network', 3, 3]);
  assert.deepEqual(v3.m.map((m) => m[2] / m[3]), [1, 1, 1, 1, 1, 1, 1, 1], 'the worst vector fills every bar');
  const v4 = cvssMetrics('CVSS:4.0/AV:L/AC:H/AT:P/PR:H/UI:A/VC:N/VI:L/VA:H/SC:N/SI:N/SA:N', 'en');
  assert.deepEqual(v4.m.map(([n, v, a, of]) => `${n}: ${v} ${a}/${of}`), [
    'Attack vector: Local 1/3', 'Attack complexity: High 0/1', 'Attack requirements: Present 0/1', 'Privileges: High 0/2',
    'User interaction: Active 0/2', 'Confidentiality: None 0/2', 'Integrity: Low 1/2', 'Availability: High 2/2',
  ]);
  assert.equal(cvssMetrics('AV:N/AC:L/Au:N/C:P/I:P/A:P', 'en'), null, 'v2 vectors have no bars');
  assert.equal(cvssMetrics('CVSS:3.1/AV:N/AC:L', 'en'), null, 'an incomplete vector has no bars');
  assert.deepEqual([band({ score: 9.8 }), band({ score: 7 }), band({ score: 4.3 }), band({ score: 0.1 }), band({ score: null })], [4, 3, 2, 1, -1]);
  assert.equal(band({ score: 9.3, severity: 'HIGH' }), 3, 'NVD\'s own band wins (v2)');
  assert.deepEqual(products(['apache/log4j v2.0', 'apache/log4j (>=2.1, <2.15.0)', 'cisco/ucs central']), ['apache/log4j', 'cisco/ucs central']);

  const kevSig = { dateAdded: '2021-12-10', dueDate: '2021-12-24' };
  const longCve = { ...log4j, software: log4j.software.map((s) => `${'very-long-vendor-name/'.repeat(2)}${s}`), description: 'ж'.repeat(3000) };
  for (const locale of LOCALES) {
    const tag = tagLine(t(locale, 'alert_trending'));
    for (const [name, w] of Object.entries({
      full: cveWidget(log4j, locale, { kev: kevSig, epss: signals.epss, pocAt: 1639180800, tag }),
      long: cveWidget(longCve, locale, { kev: kevSig, epss: signals.epss, pocAt: 1639180800, tag: 'x'.repeat(300) }),
      bare: cveWidget(noScore, locale),
      v4: cveWidget({ ...xz, vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N' }, locale),
      list: cveListWidget(Array.from({ length: 5 }, (_, i) => ({
        cve: i % 2 ? log4j : longCve, kev: i % 3 ? null : kevSig, epss: i % 2 ? signals.epss : null,
      })), locale, { title: t(locale, 'trending_title'), page: 3, first: 16 }),
    })) {
      assert.ok(w, `${locale}/${name}: no widget`);
      const size = bytes(JSON.stringify(w.data));
      assert.ok(size <= 1024, `${locale}/${name}: ${size} bytes`);
      assert.ok(w.height >= 50 && w.height <= 600, `${locale}/${name}: height ${w.height}`);
      // The CVE card's own pages (the description written in) fit sendWidget too.
      for (const page of w.pages ?? []) {
        const packed = deflateSync(page.html, { level: 9 }).length;
        assert.ok(Buffer.byteLength(page.html) <= 32768 && packed <= 4096, `${locale}/${name}: page ${packed} B compressed`);
        assert.ok(page.height >= w.height && page.height <= 600, `${locale}/${name}: page height ${page.height}`);
      }
      if (print) console.log(`widget ${locale}/${name}: ${size} B, ${w.height} px`);
    }
  }
  const full = cveWidget(log4j, 'en', { kev: kevSig, epss: signals.epss, pocAt: 1639180800 }).data;
  assert.equal(full.m.length, 8);
  assert.deepEqual(full.tl.map((e) => e[0]), [0, 1, 2], 'published → KEV → PoC');
  assert.ok(!cveWidget(noScore, 'en').data.k, 'no KEV badge without a KEV entry');
  // The whole description is in the card's page, cut at a word only past DESC_MAX,
  // and can't break out of the script it is written into.
  const card = cveWidget(log4j, 'en');
  assert.ok(card.pages.length && card.pages[0].html.includes(JSON.stringify(log4j.description.replace(/\s+/g, ' ').trim()).slice(1, -1)), 'the page holds the whole description');
  assert.ok(card.pages[0].height > card.height, 'the card grows with its description');
  const wordy = cveWidget({ ...log4j, description: 'lorem ipsum dolor '.repeat(400) }, 'en');
  assert.equal(wordy.pages.length, 2, 'a long description has a shorter page to fall back to');
  assert.ok(wordy.pages[0].html.includes('dolor…') && wordy.pages[0].html.length < wordy.pages[1].html.length + DESC_MAX);
  const evil = cveHtml('CVE-1-1', '</script><script>alert(1)//\u2028 $& $1');
  assert.equal(evil.match(/<\/script>/g).length, 1, 'the description cannot close the script');
  assert.ok(evil.includes('$& $1') && !evil.includes('\u2028'));
  assert.deepEqual(cveWidget({ ...noScore, description: '' }, 'en').pages, []);
  assert.equal(cveListWidget([], 'en', { title: 'x' }), null);
}

// Reply keyboard labels map back to their button in every language, and no
// two buttons share a label; the static screens fit too.
const labels = new Set();
for (const locale of LOCALES) {
  for (const row of mainKeyboard(locale).keyboard) {
    for (const { text } of row) {
      assert.ok(matchButton(text), `${locale}: “${text}” doesn't match a button`);
      labels.add(`${matchButton(text)}=${text}`);
    }
  }
  for (const [name, view] of Object.entries({
    categories: categoriesView(locale),
    settingsOn: settingsView({ active: true }, 1, locale),
    settingsOffAdmin: settingsView({ active: false }, ADMIN_IDS[0], locale),
    settingsFiltered: settingsView({ active: true, level: 'critical', watch: ['nginx', 'a&b <x>'] }, 1, locale),
    settingsChannel: settingsView({ id: -1001234567890, type: 'channel', title: 'Sec <news> & more', active: true, mode: 'weekly' }, 1, locale),
    settingsGroupOff: settingsView({ id: -1001234567891, type: 'supergroup', title: 'Ops', active: false }, 1, locale),
    level: levelView({ id: 1, level: 'exploited' }, locale),
    levelChannel: levelView({ id: -1001234567890, type: 'channel' }, locale),
    delivery: deliveryView({ id: -1001234567890, type: 'channel', mode: 'daily' }, locale),
    watchEmpty: watchView({ id: 1 }, locale),
    watchFull: watchView({ id: -1001234567890, type: 'channel', watch: Array.from({ length: 20 }, (_, i) => `${'ж'.repeat(38)}${i}`) }, locale),
    watchPrompt: watchPromptView({ id: -1001234567890 }, locale),
    managedEmpty: managedView([], locale),
    managed: managedView(Array.from({ length: 20 }, (_, i) => ({ id: -1001234567890 - i, type: i % 2 ? 'channel' : 'supergroup', title: `Chat ${i}`, active: i % 3 })), locale),
    linkPrompt: linkPromptView(locale),
  })) {
    checkHtml(view.text, `${locale}/${name}`);
    checkMarkup(view.reply_markup, `${locale}/${name}`);
  }
}
const byText = new Map();
for (const l of labels) {
  const [key, text] = l.split('=');
  assert.ok(!byText.has(text) || byText.get(text) === key, `“${text}” is used by ${key} and ${byText.get(text)}`);
  byText.set(text, key);
}

// Every key has all five languages, and the same {placeholders} in each.
// 'Local' and 'd' (days) are also Spanish.
const SAME_IN_EVERY_LANGUAGE = new Set(['btn_nvd', 'btn_kev', 'v_local', 'w_day']);
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
