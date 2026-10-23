// 🍽 Food & drinks hub. Callback prefix `fd`.
//   fd:r recipes menu · fd:rr random · fd:ra areas · fd:rA:<area> · fd:rc categories · fd:rC:<cat>
//   fd:rs search · fd:rf fridge · fd:rq shuffle last query · fd:ro:<id> open · fd:sl:<id> → shopping list
//   fd:c cocktails menu · fd:cr random · fd:cb spirits · fd:cB:<spirit> · fd:cn non-alcoholic · fd:cs search · fd:co:<id>
//   fd:k coffee · fd:kc[:<method>] calculator · fd:ka[…] log a brew · fd:kM:<m> · fd:kR:<1-5> · fd:kl:<page> log
//   fd:kx:<id>:<page> delete · fd:kb best · fd:kT:<h> cold brew reminder · fd:kp photo
//   fd:s:<page> shopping list · fd:st:<id>:<page> tick · fd:sa add · fd:sx clear ticked · fd:sX / fd:sXy clear all
//   fd:b breweries · fd:bc by city · fd:o barcode · fd:dn dinner idea schedule
import { db } from 'sdk';
import { eq, and, desc } from 'sdk/db';
import { shoppingList, brewLog } from '../../schema.js';
import { getRandomRecipe, getRandomCocktail } from '../apis/random.js';
import {
  mealsWhere, mealAreas, mealCategories, mealById, drinksWhere, drinkById, SPIRITS, shuffle,
  product, breweriesNear, breweriesInCity, coffeePhoto, km,
} from '../apis/food.js';
import { recipeCard, cocktailCard } from '../cards.js';
import { brew, BREW_METHODS } from '../coffee.js';
import { getPrefs, putCache, getCache } from '../store.js';
import { registerSchedule, createNotification, upsertSchedule, findSchedule, deleteNotification } from '../notify.js';
import { registerSavedKind, rememberItem } from './saved.js';
import { parseSchedule, describePattern, whenLocal } from '../time.js';
import { btn, menu, show, send, notice, ask, requireManage, pagerRow, homeRow, fits, navRow } from '../ui.js';
import { esc, link } from '../format.js';

const BACK = [btn('⬅️ Food & drinks', 'm:food')];
const SHOP_PAGE = 12;
const LOG_PAGE = 8;
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// ── entry points ──────────────────────────────────────────────────────────

export function home(ctx) {
  return menu(ctx, {
    text: '🍽 <b>Food &amp; drinks</b>\n\nRecipes, cocktails, coffee, your shopping list, breweries nearby and barcode lookups.',
    keyboard: [
      // Cook & drink · shop & look up · yours
      [btn('🍲 Recipes', 'fd:r'), btn('🍸 Cocktails', 'fd:c'), btn('☕️ Coffee', 'fd:k')],
      [btn('🛒 Shopping list', 'fd:s:0'), btn('🏷 Barcode', 'fd:o'), btn('🍺 Breweries', 'fd:b')],
      [btn('♥ Saved', 'sv:l:food:0'), btn('🗓 Dinner idea', 'fd:dn')],
      [btn('🔔 Notifications', 'n:l:food:0'), btn('🏠 Main menu', 'm:home')],
    ],
  });
}

export const commands = {
  food: (ctx, args) => (args.length ? searchRecipes(ctx, args.join(' ')) : home(ctx)),
  recipe: (ctx, args) => (args.length ? searchRecipes(ctx, args.join(' ')) : randomRecipe(ctx)),
  cocktail: (ctx, args) => (args.length ? searchDrinks(ctx, args.join(' ')) : randomDrink(ctx)),
  async brew(ctx, [method, amount, ratio]) {
    if (!method) return calcMenu(ctx);
    if (/^\d/.test(method)) [method, amount, ratio] = ['v60', method, amount];
    return brewResult(ctx, method, amount, ratio);
  },
  coldbrew: (ctx, [amount, ratio]) => brewResult(ctx, 'coldbrew', amount, ratio),
  shopping: (ctx) => shoppingCard(ctx, 0, send),
  list: (ctx) => shoppingCard(ctx, 0, send),
  brewlog: (ctx) => logCard(ctx, 0, send),
  barcode: (ctx, [code]) => (code ? barcodeCard(ctx, code) : askBarcode(ctx)),
  breweries: (ctx, args) => (args.length ? breweriesCard(ctx, args.join(' ')) : breweriesCard(ctx)),
};

export const callbacks = {
  async fd(ctx, [op, a, b, c]) {
    if (!['sl', 'st', 'kR', 'kT'].includes(op)) await ctx.answer();
    switch (op) {
      case 'r': return recipesMenu(ctx);
      case 'rr': return randomRecipe(ctx);
      case 'ra': return areasMenu(ctx);
      case 'rA': return listMeals(ctx, { area: a }, `🌍 ${esc(a)}`);
      case 'rc': return categoriesMenu(ctx);
      case 'rC': return listMeals(ctx, { category: a }, `📂 ${esc(a)}`);
      case 'rs': return ask(ctx, 'food.rsearch', '🔎 Search recipes by name or ingredient, e.g. <code>pasta</code> or <code>salmon</code>', { placeholder: 'pasta' });
      case 'rf': return ask(ctx, 'food.fridge', '🧊 What’s in your fridge? Up to 4 ingredients, comma-separated: <code>chicken, garlic, rice</code>', { placeholder: 'chicken, garlic' });
      case 'rq': return rerunQuery(ctx);
      case 'ro': return openMeal(ctx, a);
      case 'sl': return addRecipeToList(ctx, a);
      case 'c': return drinksMenu(ctx);
      case 'cr': return randomDrink(ctx);
      case 'cb': return spiritsMenu(ctx);
      case 'cB': return listDrinks(ctx, { spirit: a }, `🥃 With ${esc(a)}`);
      case 'cn': return listDrinks(ctx, { nonAlcoholic: true }, '🧃 Non-alcoholic');
      case 'cs': return ask(ctx, 'food.csearch', '🔎 Search cocktails by name or ingredient, e.g. <code>margarita</code> or <code>mint</code>', { placeholder: 'mojito' });
      case 'co': return openDrink(ctx, a);
      case 'k': return coffeeMenu(ctx);
      case 'kc': return a ? askBrew(ctx, a) : calcMenu(ctx);
      case 'ka': return startLog(ctx, a, b, c);
      case 'kM': return logMethod(ctx, a);
      case 'kR': return logRating(ctx, +a);
      case 'kl': return logCard(ctx, +a || 0, a === undefined ? send : show);
      case 'kx': return deleteLog(ctx, +a, +b || 0);
      case 'kb': return bestCard(ctx);
      case 'kT': return coldReminder(ctx, +a);
      case 'kp': return photoCard(ctx);
      case 's': return shoppingCard(ctx, +a || 0, a === undefined ? send : show);
      case 'st': return toggleItem(ctx, +a, +b || 0);
      case 'sa': return (await requireManage(ctx)) && ask(ctx, 'food.sadd', '🛒 Add items, comma-separated: <code>milk, eggs, 2 lemons</code>', { placeholder: 'milk, eggs' });
      case 'sx': return clearList(ctx, true);
      case 'sX': return confirmClear(ctx);
      case 'sXy': return clearList(ctx, false);
      case 'b': return breweriesCard(ctx);
      case 'bc': return ask(ctx, 'food.bcity', '🍺 Which city? e.g. <code>Portland</code>, <code>Berlin</code>', { placeholder: 'Portland' });
      case 'o': return askBarcode(ctx);
      case 'dn': return dinnerMenu(ctx);
      case 'dnset': return (await requireManage(ctx)) && ask(ctx, 'food.dinner', '🗓 When should a dinner idea arrive? e.g. <code>17:00</code>, <code>17:30 weekdays</code>', { placeholder: '17:00' });
      case 'dnoff': return dinnerOff(ctx);
    }
  },
};

export const inputs = {
  rsearch: (ctx, text) => searchRecipes(ctx, text),
  fridge: (ctx, text) => fridge(ctx, text),
  csearch: (ctx, text) => searchDrinks(ctx, text),
  brew: (ctx, text, data) => {
    const [amount, ratio] = /^\s*default\s*$/i.test(text) ? [] : text.trim().split(/\s+/);
    return brewResult(ctx, data.key, amount, ratio);
  },
  logbean: (ctx, text) => logBean(ctx, text),
  logdose: (ctx, text) => logDose(ctx, text),
  sadd: (ctx, text) => addItems(ctx, text),
  bcity: (ctx, text) => breweriesCard(ctx, text),
  barcode: (ctx, text) => barcodeCard(ctx, text.trim()),
  dinner: (ctx, text) => dinnerSet(ctx, text),
};

// Plain digits in a private chat look like a barcode.
export function maybeBarcode(ctx, text) {
  if (ctx.chatType === 'private' && /^\d{8,14}$/.test(text.trim())) return barcodeCard(ctx, text.trim());
  return null;
}

// ── recipes ───────────────────────────────────────────────────────────────

function recipesMenu(ctx) {
  return menu(ctx, {
    text: '🍲 <b>Recipes</b>\n\nAbout 600 recipes from TheMealDB.',
    keyboard: [
      [btn('🎲 Surprise me', 'fd:rr'), btn('🔎 Search', 'fd:rs'), btn('🧊 Fridge mode', 'fd:rf')],
      [btn('🌍 By cuisine', 'fd:ra'), btn('📂 By category', 'fd:rc'), btn('♥ Saved', 'sv:l:food:0')],
      navRow('⬅️ Food & drinks', 'm:food'),
    ],
  });
}

async function randomRecipe(ctx) {
  const r = await getRandomRecipe();
  if (r) await rememberItem('recipe', r.id, r);
  return send(ctx, recipeCard(r));
}

async function openMeal(ctx, id) {
  const r = await mealById(id);
  if (!r) return notice(ctx, '⚠️ Couldn’t load that recipe.');
  await rememberItem('recipe', r.id, r);
  return send(ctx, recipeCard(r));
}

async function areasMenu(ctx) {
  const areas = await mealAreas();
  if (!areas.length) return notice(ctx, '⚠️ Recipe catalogue unavailable right now.');
  const rows = [];
  for (let i = 0; i < areas.length; i += 3) rows.push(areas.slice(i, i + 3).filter((a) => fits(`fd:rA:${a}`)).map((a) => btn(a, `fd:rA:${a}`)));
  return menu(ctx, { text: '🌍 <b>Pick a cuisine</b>', keyboard: [...rows, navRow('⬅️ Recipes', 'fd:r')] });
}

async function categoriesMenu(ctx) {
  const cats = await mealCategories();
  if (!cats.length) return notice(ctx, '⚠️ Recipe catalogue unavailable right now.');
  const rows = [];
  for (let i = 0; i < cats.length; i += 3) rows.push(cats.slice(i, i + 3).filter((a) => fits(`fd:rC:${a}`)).map((a) => btn(a, `fd:rC:${a}`)));
  return menu(ctx, { text: '📂 <b>Pick a category</b>', keyboard: [...rows, navRow('⬅️ Recipes', 'fd:r')] });
}

async function searchRecipes(ctx, text) {
  return listMeals(ctx, { text: text.slice(0, 40) }, `🔎 “${esc(text.slice(0, 40))}”`);
}

async function fridge(ctx, text) {
  const ingredients = text.split(/[,;\n]+|\band\b/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
  if (!ingredients.length) return notice(ctx, 'Send ingredients like <code>chicken, garlic</code>.');
  return listMeals(ctx, { ingredients }, `🧊 With ${ingredients.map(esc).join(' + ')}`);
}

// Sends up to 10 random matches as buttons; 🔀 re-rolls the same query.
async function listMeals(ctx, query, title) {
  const all = await mealsWhere(query);
  if (!all) return notice(ctx, '⚠️ Recipe catalogue unavailable right now.');
  await putCache(`food:lastq:${ctx.chatId}`, { type: 'meal', query, title }, 3600);
  if (!all.length) return notice(ctx, `${title}\n\nNo recipes found. Try fewer or simpler ingredients.`);
  const pick = shuffle(all).slice(0, 10);
  return send(ctx, {
    text: `${title}\n\n${all.length} recipe${all.length === 1 ? '' : 's'}${all.length > 10 ? ' — here are 10' : ''}. Tap one:`,
    keyboard: [...pick.map((m) => [btn(`${m[1].slice(0, 40)}${m[2] ? ` · ${m[2]}` : ''}`, `fd:ro:${m[0]}`)]),
      [...(all.length > 10 ? [btn('🔀 Shuffle', 'fd:rq')] : []), btn('⬅️ Recipes', 'fd:r')]],
  });
}

async function rerunQuery(ctx) {
  const last = await getCache(`food:lastq:${ctx.chatId}`);
  if (!last) return notice(ctx, 'That list expired — search again.');
  return last.type === 'meal' ? listMeals(ctx, last.query, last.title) : listDrinks(ctx, last.query, last.title);
}

// ── cocktails ─────────────────────────────────────────────────────────────

function drinksMenu(ctx) {
  return menu(ctx, {
    text: '🍸 <b>Cocktails</b>',
    keyboard: [
      [btn('🎲 Surprise me', 'fd:cr'), btn('🔎 Search', 'fd:cs')],
      [btn('🥃 By spirit', 'fd:cb'), btn('🧃 Non-alcoholic', 'fd:cn'), btn('♥ Saved', 'sv:l:food:0')],
      navRow('⬅️ Food & drinks', 'm:food'),
    ],
  });
}

function spiritsMenu(ctx) {
  const rows = [];
  for (let i = 0; i < SPIRITS.length; i += 3) rows.push(SPIRITS.slice(i, i + 3).map((s) => btn(s, `fd:cB:${s}`)));
  return menu(ctx, { text: '🥃 <b>Pick a spirit</b>', keyboard: [...rows, navRow('⬅️ Cocktails', 'fd:c')] });
}

async function randomDrink(ctx) {
  const d = await getRandomCocktail();
  if (d) await rememberItem('cocktail', d.id, d);
  return send(ctx, cocktailCard(d));
}

async function openDrink(ctx, id) {
  const d = await drinkById(id);
  if (!d) return notice(ctx, '⚠️ Couldn’t load that cocktail.');
  await rememberItem('cocktail', d.id, d);
  return send(ctx, cocktailCard(d));
}

function searchDrinks(ctx, text) {
  return listDrinks(ctx, { text: text.slice(0, 40) }, `🔎 “${esc(text.slice(0, 40))}”`);
}

async function listDrinks(ctx, query, title) {
  const all = await drinksWhere(query);
  if (!all) return notice(ctx, '⚠️ Cocktail catalogue unavailable right now.');
  await putCache(`food:lastq:${ctx.chatId}`, { type: 'drink', query, title }, 3600);
  if (!all.length) return notice(ctx, `${title}\n\nNo cocktails found.`);
  const pick = shuffle(all).slice(0, 10);
  return send(ctx, {
    text: `${title}\n\n${all.length} cocktail${all.length === 1 ? '' : 's'}${all.length > 10 ? ' — here are 10' : ''}. Tap one:`,
    keyboard: [...pick.map((d) => [btn(d[1].slice(0, 48), `fd:co:${d[0]}`)]),
      [...(all.length > 10 ? [btn('🔀 Shuffle', 'fd:rq')] : []), btn('⬅️ Cocktails', 'fd:c')]],
  });
}

// ── coffee ────────────────────────────────────────────────────────────────

function coffeeMenu(ctx) {
  return menu(ctx, {
    text: '☕️ <b>Coffee</b>\n\nBrew calculator, your brew log and saved recipes.',
    keyboard: [
      [btn('⚖️ Calculator', 'fd:kc'), btn('🧊 Cold brew', 'fd:kc:coldbrew'), btn('♥ Saved recipes', 'sv:l:food:0')],
      [btn('➕ Log a brew', 'fd:ka'), btn('📓 Brew log', 'fd:kl'), btn('⭐ Best brews', 'fd:kb')],
      [btn('📸 Coffee photo', 'fd:kp')],
      navRow('⬅️ Food & drinks', 'm:food'),
    ],
  });
}

function calcMenu(ctx) {
  return menu(ctx, {
    text: '⚖️ <b>Brew calculator</b>\nPick a method:',
    keyboard: [[btn('Hario V60', 'fd:kc:v60'), btn('AeroPress', 'fd:kc:aeropress')], [btn('AeroPress inverted', 'fd:kc:inverted'), btn('Cold brew', 'fd:kc:coldbrew')], navRow('⬅️ Coffee', 'fd:k')],
  });
}

function askBrew(ctx, key) {
  if (!BREW_METHODS.includes(key)) return null;
  return ask(ctx, 'food.brew', '⚖️ How much? Water like <code>300</code>, a dose like <code>18g</code>, optionally a ratio: <code>18g 1:15</code>. Or <code>default</code>.', { data: { key }, placeholder: '300' });
}

export function brewCard(r) {
  const ref = `${r.key}-${r.coffee}-${r.water}`;
  const keyboard = [[btn('♥ Save recipe', `sv:a:brew:${ref}`), btn('📓 Log this brew', `fd:ka:${r.key}:${r.coffee}:${r.water}`)]];
  if (r.key === 'coldbrew') keyboard.push([btn('⏰ Ready in 14 h', 'fd:kT:14'), btn('⏰ 18 h', 'fd:kT:18')]);
  keyboard.push([btn('⬅️ Coffee', 'fd:k')]);
  return { text: r.html, keyboard: keyboard.map((row) => row.filter((x) => fits(x.callback_data))) };
}

async function brewResult(ctx, method, amount, ratio) {
  const r = brew(method, amount, ratio);
  if (!r.ok) return notice(ctx, `⚠️ ${esc(r.error)}\nUsage: <code>/brew [${BREW_METHODS.join('|')}] [300ml|18g] [1:16]</code>`);
  await rememberItem('brew', `${r.key}-${r.coffee}-${r.water}`, r);
  return send(ctx, brewCard(r));
}

async function coldReminder(ctx, hours) {
  if (!(await requireManage(ctx))) return;
  const at = Math.floor(Date.now() / 1000) + hours * 3600;
  const id = await createNotification(ctx.chatId, 'food', 'reminder', { text: '🧊 Your cold brew is ready — filter it and dilute 1:1.' }, at);
  const { tz } = await getPrefs(ctx.chatId);
  await ctx.answer(id === 'limit' ? 'Too many notifications' : `⏰ Reminder at ${whenLocal(at * 1000, tz)}`);
}

async function photoCard(ctx) {
  const url = await coffeePhoto();
  if (!url) return notice(ctx, '⚠️ No coffee photo right now.');
  return send(ctx, { text: `📸 <i>Coffee break</i> · ${link(url, 'full size')}`, image: url, keyboard: [[btn('📸 Another', 'fd:kp'), btn('⬅️ Coffee', 'fd:k')]] });
}

// Brew log: a short multi-step flow with a draft kept for an hour.
const draftKey = (ctx) => `food:draft:${ctx.chatId}:${ctx.userId}`;
const METHOD_NAMES = { v60: 'V60', aeropress: 'AeroPress', inverted: 'AeroPress (inv.)', coldbrew: 'Cold brew', espresso: 'Espresso', frenchpress: 'French press', moka: 'Moka pot', chemex: 'Chemex', other: 'Other' };

async function startLog(ctx, method, coffee, water) {
  if (!(await requireManage(ctx))) return;
  const draft = method ? { method: METHOD_NAMES[method] ?? method, dose: +coffee || null, water: +water || null } : {};
  await putCache(draftKey(ctx), draft, 3600);
  return ask(ctx, 'food.logbean', '📓 Which beans? e.g. <code>Ethiopia Guji — Onyx</code>', { placeholder: 'Ethiopia Guji' });
}

async function logBean(ctx, text) {
  const draft = (await getCache(draftKey(ctx))) ?? {};
  draft.bean = text.trim().slice(0, 80);
  await putCache(draftKey(ctx), draft, 3600);
  if (draft.method && draft.dose) return askRating(ctx, draft);
  const keys = Object.keys(METHOD_NAMES);
  const rows = [];
  for (let i = 0; i < keys.length; i += 3) rows.push(keys.slice(i, i + 3).map((k) => btn(METHOD_NAMES[k], `fd:kM:${k}`)));
  return send(ctx, { text: `📓 <b>${esc(draft.bean)}</b> — brewed how?`, keyboard: rows });
}

async function logMethod(ctx, key) {
  const draft = await getCache(draftKey(ctx));
  if (!draft?.bean) return notice(ctx, 'That log entry expired — start again with ➕ Log a brew.');
  draft.method = METHOD_NAMES[key] ?? key;
  await putCache(draftKey(ctx), draft, 3600);
  return ask(ctx, 'food.logdose', '📓 Dose and water in grams, plus optional notes: <code>15 250</code> or <code>15 250 grind 24, floral</code>', { placeholder: '15 250' });
}

async function logDose(ctx, text) {
  const draft = await getCache(draftKey(ctx));
  if (!draft?.bean) return notice(ctx, 'That log entry expired — start again with ➕ Log a brew.');
  const m = /^\s*(\d+(?:\.\d+)?)\s*g?\s*[/:\s]\s*(\d+(?:\.\d+)?)\s*(?:g|ml)?\b[\s,.-]*(.*)$/i.exec(text);
  if (!m) return notice(ctx, 'Send dose and water like <code>15 250</code>.');
  Object.assign(draft, { dose: +m[1], water: +m[2], note: m[3]?.trim().slice(0, 200) || null });
  await putCache(draftKey(ctx), draft, 3600);
  return askRating(ctx, draft);
}

function askRating(ctx, draft) {
  return send(ctx, {
    text: `📓 <b>${esc(draft.bean)}</b> · ${esc(draft.method)} · ${draft.dose} g → ${draft.water} g\nHow was it?`,
    keyboard: [[1, 2, 3, 4, 5].map((n) => btn(`${n}★`, `fd:kR:${n}`))],
  });
}

async function logRating(ctx, rating) {
  const draft = await getCache(draftKey(ctx));
  if (!draft?.bean) return ctx.answer('That log entry expired.');
  if (!(await requireManage(ctx))) return;
  await db.insert(brewLog).values({ chatId: ctx.chatId, bean: draft.bean, method: draft.method ?? 'Other', dose: draft.dose, water: draft.water, rating: Math.min(5, Math.max(1, rating)), note: draft.note ?? null }).run();
  await putCache(draftKey(ctx), null, 1);
  await ctx.answer('Logged ☕️');
  return show(ctx, { text: `📓 Logged <b>${esc(draft.bean)}</b> ${stars(rating)}`, keyboard: [[btn('📓 Brew log', 'fd:kl'), btn('⭐ Best brews', 'fd:kb')]] });
}

function logLine(e, tz) {
  const ratio = e.dose && e.water ? ` (1:${(e.water / e.dose).toFixed(1)})` : '';
  const day = whenLocal(e.createdAt * 1000, tz).split(',')[0];
  return `${stars(e.rating ?? 0)} <b>${esc(e.bean)}</b> — ${esc(e.method)} ${e.dose ?? '?'}g/${e.water ?? '?'}g${ratio} · ${day}${e.note ? `\n   <i>${esc(e.note)}</i>` : ''}`;
}

async function logCard(ctx, page, out) {
  const where = eq(brewLog.chatId, ctx.chatId);
  const [rows, total, { tz }] = await Promise.all([
    db.select().from(brewLog).where(where).orderBy(desc(brewLog.id)).limit(LOG_PAGE).offset(page * LOG_PAGE).all(),
    db.$count(brewLog, where),
    getPrefs(ctx.chatId),
  ]);
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE));
  return out(ctx, {
    text: ['📓 <b>Brew log</b>', '', ...(rows.length ? rows.map((e) => logLine(e, tz)) : ['<i>No brews logged yet.</i>'])].join('\n'),
    keyboard: [
      ...(rows.length ? [rows.map((e, i) => btn(`🗑 ${page * LOG_PAGE + i + 1}`, `fd:kx:${e.id}:${page}`)).slice(0, 8)] : []),
      ...pagerRow(page, pages, (p) => `fd:kl:${p}`),
      [btn('➕ Log a brew', 'fd:ka'), btn('⭐ Best', 'fd:kb'), btn('⬅️ Coffee', 'fd:k')],
    ],
  });
}

async function deleteLog(ctx, id, page) {
  if (!(await requireManage(ctx))) return;
  await db.delete(brewLog).where(and(eq(brewLog.chatId, ctx.chatId), eq(brewLog.id, id))).run();
  return logCard(ctx, page, show);
}

async function bestCard(ctx) {
  const [rows, { tz }] = await Promise.all([
    db.select().from(brewLog).where(eq(brewLog.chatId, ctx.chatId)).orderBy(desc(brewLog.rating), desc(brewLog.id)).limit(10).all(),
    getPrefs(ctx.chatId),
  ]);
  return send(ctx, {
    text: ['⭐ <b>Best brews</b>', '', ...(rows.length ? rows.map((e) => logLine(e, tz)) : ['<i>Log a few brews first.</i>'])].join('\n'),
    keyboard: [[btn('📓 Brew log', 'fd:kl'), btn('⬅️ Coffee', 'fd:k')]],
  });
}

// ── shopping list ─────────────────────────────────────────────────────────

async function addRecipeToList(ctx, id) {
  if (!(await requireManage(ctx))) return;
  const r = (await getCache(`item:recipe:${id}`)) ?? (await mealById(id));
  if (!r) return ctx.answer('Couldn’t load that recipe.');
  const existing = new Set((await db.select({ item: shoppingList.item }).from(shoppingList)
    .where(and(eq(shoppingList.chatId, ctx.chatId), eq(shoppingList.source, r.name), eq(shoppingList.done, 0))).all()).map((x) => x.item));
  const items = r.ingredients.filter((i) => !existing.has(i)).slice(0, 30);
  if (items.length) await db.insert(shoppingList).values(items.map((item) => ({ chatId: ctx.chatId, item: item.slice(0, 100), source: r.name }))).run();
  await ctx.answer(items.length ? `🛒 Added ${items.length} items` : 'Already on your list');
}

async function addItems(ctx, text) {
  if (!(await requireManage(ctx))) return;
  const items = text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 30);
  if (!items.length) return notice(ctx, 'Send items like <code>milk, eggs</code>.');
  await db.insert(shoppingList).values(items.map((item) => ({ chatId: ctx.chatId, item: item.slice(0, 100), source: null }))).run();
  return shoppingCard(ctx, 0, send);
}

async function shoppingCard(ctx, page, out) {
  const all = await db.select().from(shoppingList).where(eq(shoppingList.chatId, ctx.chatId)).orderBy(shoppingList.done, shoppingList.source, shoppingList.id).all();
  const pages = Math.max(1, Math.ceil(all.length / SHOP_PAGE));
  page = Math.min(page, pages - 1);
  const slice = all.slice(page * SHOP_PAGE, (page + 1) * SHOP_PAGE);
  const ticked = all.filter((i) => i.done).length;
  const sources = [...new Set(all.filter((i) => !i.done && i.source).map((i) => i.source))];
  const text = all.length
    ? `🛒 <b>Shopping list</b>\n\n${all.length - ticked} to buy · ${ticked} ticked${sources.length ? `\nFor: ${sources.map(esc).join(', ')}` : ''}\n<i>Tap an item to tick it.</i>`
    : '🛒 <b>Shopping list</b>\n\n<i>Empty. Add items, or tap 🛒 on a recipe.</i>';
  return out(ctx, {
    text,
    keyboard: [
      ...slice.map((i) => [btn(`${i.done ? '✅' : '⬜️'} ${i.item.slice(0, 50)}`, `fd:st:${i.id}:${page}`)]),
      ...pagerRow(page, pages, (p) => `fd:s:${p}`),
      [btn('➕ Add', 'fd:sa'), ...(ticked ? [btn('🧹 Clear ticked', 'fd:sx')] : []), ...(all.length ? [btn('🗑 Clear all', 'fd:sX')] : [])],
      BACK,
    ],
  });
}

async function toggleItem(ctx, id, page) {
  const item = await db.select().from(shoppingList).where(and(eq(shoppingList.chatId, ctx.chatId), eq(shoppingList.id, id))).get();
  if (!item) return ctx.answer('Already removed');
  await db.update(shoppingList).set({ done: item.done ? 0 : 1 }).where(eq(shoppingList.id, id)).run();
  await ctx.answer();
  return shoppingCard(ctx, page, show);
}

function confirmClear(ctx) {
  return show(ctx, { text: '🗑 Clear the whole shopping list?', keyboard: [[btn('Yes, clear all', 'fd:sXy'), btn('Cancel', 'fd:s:0')]] });
}

async function clearList(ctx, tickedOnly) {
  if (!(await requireManage(ctx))) return;
  const where = tickedOnly ? and(eq(shoppingList.chatId, ctx.chatId), eq(shoppingList.done, 1)) : eq(shoppingList.chatId, ctx.chatId);
  await db.delete(shoppingList).where(where).run();
  return shoppingCard(ctx, 0, show);
}

// ── breweries & barcode ───────────────────────────────────────────────────

async function breweriesCard(ctx, city) {
  const p = await getPrefs(ctx.chatId);
  if (!city && p.lat == null) {
    return send(ctx, {
      text: '🍺 <b>Breweries</b>\n\nShare a 📍 location in settings to see the nearest ones, or search a city.',
      keyboard: [[btn('📍 Set location', 'st:loc'), btn('🔎 By city', 'fd:bc')], BACK],
    });
  }
  const list = city ? await breweriesInCity(city) : await breweriesNear(p.lat, p.lon);
  if (!list) return notice(ctx, '⚠️ Open Brewery DB is unavailable right now.');
  if (!list.length) return notice(ctx, `No breweries found${city ? ` in <b>${esc(city)}</b>` : ' nearby'}.`);
  const lines = list.slice(0, 10).map((b) => {
    const dist = !city && b.lat != null ? ` · ${km(p.lat, p.lon, b.lat, b.lon).toFixed(1)} km` : '';
    const name = b.url ? link(b.url, b.name) : `<b>${esc(b.name)}</b>`;
    return `🍺 ${name} — <i>${esc(b.type)}</i>\n   ${esc([b.street, b.city, b.region].filter(Boolean).join(', '))}${dist}`;
  });
  return send(ctx, {
    text: [`🍺 <b>Breweries ${city ? `in ${esc(city)}` : 'near you'}</b>`, '', ...lines].join('\n'),
    keyboard: [[btn('🔎 Another city', 'fd:bc'), btn('⬅️ Food & drinks', 'm:food')]],
  });
}

function askBarcode(ctx) {
  return ask(ctx, 'food.barcode', '🏷 Send the barcode number (8–14 digits, under the bars).', { placeholder: '3017624010701' });
}

const GRADE = { a: '🟢 A', b: '🟢 B', c: '🟡 C', d: '🟠 D', e: '🔴 E' };

async function barcodeCard(ctx, code) {
  if (!/^\d{8,14}$/.test(code)) return notice(ctx, 'A barcode is 8–14 digits.');
  const p = await product(code);
  if (!p) return notice(ctx, `No product found for <code>${esc(code)}</code> on Open Food Facts.`);
  const n = p.per100;
  const v = (x, unit = 'g') => (x == null ? '—' : `${Math.round(x * 10) / 10}${unit}`);
  const lines = [
    `🏷 <b>${esc(p.name)}</b>${p.brand ? ` — ${esc(p.brand)}` : ''}${p.quantity ? ` · ${esc(p.quantity)}` : ''}`,
    '',
    `Nutri-Score: <b>${GRADE[p.nutri] ?? '—'}</b> · NOVA: <b>${p.nova ?? '—'}</b>${p.eco && GRADE[p.eco] ? ` · Eco: ${GRADE[p.eco]}` : ''}`,
    '',
    '<b>Per 100 g / ml</b>',
    `Energy ${v(n.kcal, ' kcal')} · Protein ${v(n.protein)}`,
    `Fat ${v(n.fat)} (sat. ${v(n.sat)}) · Carbs ${v(n.carbs)} (sugar ${v(n.sugar)})`,
    `Fiber ${v(n.fiber)} · Salt ${v(n.salt)}`,
  ];
  if (p.allergens.length) lines.push('', `⚠️ Allergens: ${esc(p.allergens.join(', '))}`);
  lines.push('', link(`https://world.openfoodfacts.org/product/${code}`, 'Open Food Facts →'));
  return send(ctx, { text: lines.join('\n'), image: p.image, keyboard: [[btn('🏷 Another', 'fd:o'), btn('⬅️ Food & drinks', 'm:food')]] });
}

// ── dinner idea schedule ──────────────────────────────────────────────────

async function dinnerMenu(ctx) {
  const n = await findSchedule(ctx.chatId, 'food', 'dinner_idea');
  return menu(ctx, {
    text: `🗓 <b>Dinner idea</b>\nA random recipe at the time you choose.\n\nNow: <b>${n?.active ? `${n.params.time} ${describePattern(n.params.pattern)}` : 'off'}</b>`,
    keyboard: [[btn('⏰ Set time', 'fd:dnset'), ...(n ? [btn('🚫 Turn off', 'fd:dnoff')] : [])], navRow('⬅️ Food & drinks', 'm:food')],
  });
}

async function dinnerSet(ctx, text) {
  if (!(await requireManage(ctx))) return;
  const s = parseSchedule(text);
  if (!s) return notice(ctx, 'Usage: <code>17:00</code>, <code>17:30 weekdays</code>, <code>12:00 sun</code>');
  const { tz } = await getPrefs(ctx.chatId);
  const id = await upsertSchedule(ctx.chatId, 'food', 'dinner_idea', s.time, s.pattern, tz);
  if (id === 'limit') return notice(ctx, 'You have 50 active notifications. Remove some in /notifications.');
  return notice(ctx, `🗓 Dinner idea at <b>${s.time}</b> ${describePattern(s.pattern)} (${esc(tz)}).`);
}

async function dinnerOff(ctx) {
  if (!(await requireManage(ctx))) return;
  const n = await findSchedule(ctx.chatId, 'food', 'dinner_idea');
  if (n) await deleteNotification(ctx.chatId, n.id);
  return dinnerMenu(ctx);
}

registerSchedule('dinner_idea', {
  label: 'Dinner idea',
  async render() {
    const r = await getRandomRecipe();
    if (!r) return { text: '🍲 Dinner idea: TheMealDB is unavailable right now — try /recipe later.' };
    await rememberItem('recipe', r.id, r);
    const card = recipeCard(r);
    return { ...card, text: `🗓 <b>Dinner idea</b>\n\n${card.text}` };
  },
});

// ── saved kinds ───────────────────────────────────────────────────────────

registerSavedKind('recipe', { category: 'food', icon: '🍲', title: (r) => r.name, render: recipeCard, fetch: mealById });
registerSavedKind('cocktail', { category: 'food', icon: '🍸', title: (d) => d.name, render: cocktailCard, fetch: drinkById });
registerSavedKind('brew', { category: 'food', icon: '☕️', title: (r) => `${r.method} — ${r.coffee} g / ${r.water} g`, render: brewCard });
