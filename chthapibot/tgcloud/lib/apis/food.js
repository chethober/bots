// Food & drink data: TheMealDB, TheCocktailDB, Open Food Facts, Open Brewery DB.
//
// The free TheMealDB/TheCocktailDB keys cap filter endpoints (a cocktail ingredient
// filter returns a single drink), so both catalogues are indexed weekly from the
// first-letter listings and filtered locally.
import { getJson, safely } from '../http.js';
import { cached } from '../store.js';
import { mealFromApi, drinkFromApi } from './random.js';

const MEAL = 'https://www.themealdb.com/api/json/v1/1';
const DRINK = 'https://www.thecocktaildb.com/api/json/v1/1';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

const ingredientsLower = (item, max) => {
  const out = [];
  for (let i = 1; i <= max; i++) {
    const v = item[`strIngredient${i}`]?.trim().toLowerCase();
    if (v) out.push(v);
  }
  return out;
};

async function buildIndex(base, key, toRow) {
  const rows = [];
  for (let i = 0; i < LETTERS.length; i += 6) {
    const pages = await Promise.all(LETTERS.slice(i, i + 6).map((l) => safely(() => getJson(`${base}/search.php?f=${l}`))));
    for (const p of pages) for (const item of p?.[key] ?? []) rows.push(toRow(item));
  }
  const seen = new Set();
  return rows.filter((r) => !seen.has(r[0]) && seen.add(r[0]));
}

// [id, name, area, category, ingredients[]]
export function mealIndex() {
  return cached('food:mealindex', 7 * 86400, async () => {
    const rows = await buildIndex(MEAL, 'meals', (m) => [m.idMeal, m.strMeal, m.strArea ?? '', m.strCategory ?? '', ingredientsLower(m, 20)]);
    return rows.length > 50 ? rows : null;
  });
}

// [id, name, alcoholic, category, ingredients[]]
export function drinkIndex() {
  return cached('food:drinkindex', 7 * 86400, async () => {
    const rows = await buildIndex(DRINK, 'drinks', (d) => [d.idDrink, d.strDrink, d.strAlcoholic ?? '', d.strCategory ?? '', ingredientsLower(d, 15)]);
    return rows.length > 50 ? rows : null;
  });
}

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ── meals ─────────────────────────────────────────────────────────────────

export async function mealAreas() {
  const idx = (await mealIndex()) ?? [];
  return [...new Set(idx.map((m) => m[2]).filter((a) => a && a !== 'Unknown'))].sort();
}

export async function mealCategories() {
  const idx = (await mealIndex()) ?? [];
  return [...new Set(idx.map((m) => m[3]).filter(Boolean))].sort();
}

export async function mealsWhere({ area, category, text, ingredients } = {}) {
  const idx = await mealIndex();
  if (!idx) return null;
  const q = norm(text);
  const ings = (ingredients ?? []).map(norm).filter(Boolean);
  return idx.filter((m) => (!area || m[2] === area) && (!category || m[3] === category)
    && (!q || norm(m[1]).includes(q) || m[4].some((i) => i.includes(q)))
    && ings.every((want) => m[4].some((have) => have.includes(want))));
}

export function mealById(id) {
  return cached(`food:meal:${id}`, 7 * 86400, () => safely(async () => {
    const m = (await getJson(`${MEAL}/lookup.php?i=${encodeURIComponent(id)}`)).meals?.[0];
    return m ? mealFromApi(m) : null;
  }));
}

// ── drinks ────────────────────────────────────────────────────────────────

export const SPIRITS = ['Gin', 'Vodka', 'Rum', 'Tequila', 'Whiskey', 'Bourbon', 'Scotch', 'Brandy', 'Champagne', 'Wine', 'Amaretto', 'Kahlua'];

export async function drinksWhere({ spirit, nonAlcoholic, text, category } = {}) {
  const idx = await drinkIndex();
  if (!idx) return null;
  const q = norm(text);
  const s = norm(spirit);
  const hits = idx.filter((d) => (!nonAlcoholic || /non/i.test(d[2]))
    && (!category || d[3] === category)
    && (!s || d[4].some((i) => i.includes(s)))
    && (!q || norm(d[1]).includes(q) || d[4].some((i) => i.includes(q))));
  if (!q) return hits;
  // The index holds at most 25 drinks per letter; merge the API's own name search.
  const api = await cached(`food:dsearch:${q}`, 86400, () => safely(async () =>
    ((await getJson(`${DRINK}/search.php?s=${encodeURIComponent(q)}`)).drinks ?? [])
      .map((d) => [d.idDrink, d.strDrink, d.strAlcoholic ?? '', d.strCategory ?? '', ingredientsLower(d, 15)])));
  const seen = new Set(hits.map((d) => d[0]));
  return [...hits, ...(api ?? []).filter((d) => !seen.has(d[0]) && (!nonAlcoholic || /non/i.test(d[2])))];
}

export function drinkById(id) {
  return cached(`food:drink:${id}`, 7 * 86400, () => safely(async () => {
    const d = (await getJson(`${DRINK}/lookup.php?i=${encodeURIComponent(id)}`)).drinks?.[0];
    return d ? drinkFromApi(d) : null;
  }));
}

// ── products, breweries, coffee ───────────────────────────────────────────

// Open Food Facts product by barcode (cached 1 day). Returns null when not found.
export function product(code) {
  return cached(`food:off:${code}`, 86400, () => safely(async () => {
    const fields = 'product_name,brands,quantity,nutriscore_grade,nova_group,ecoscore_grade,nutriments,image_front_small_url,ingredients_text_en,allergens_tags';
    const d = await getJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`, { headers: { 'User-Agent': 'chthapibot/1.0 (Telegram bot)' } });
    if (d.status !== 1 || !d.product) return null;
    const p = d.product;
    const n = p.nutriments ?? {};
    return {
      code, name: p.product_name || 'Unnamed product', brand: p.brands ?? '', quantity: p.quantity ?? '',
      nutri: p.nutriscore_grade ?? null, nova: p.nova_group ?? null, eco: p.ecoscore_grade ?? null,
      image: p.image_front_small_url ?? null,
      per100: { kcal: n['energy-kcal_100g'], fat: n.fat_100g, sat: n['saturated-fat_100g'], carbs: n.carbohydrates_100g, sugar: n.sugars_100g, fiber: n.fiber_100g, protein: n.proteins_100g, salt: n.salt_100g },
      allergens: (p.allergens_tags ?? []).map((a) => a.replace(/^\w+:/, '')).slice(0, 8),
    };
  }));
}

export function breweriesNear(lat, lon) {
  return cached(`food:brew:${lat.toFixed(2)},${lon.toFixed(2)}`, 86400, () => safely(async () =>
    (await getJson(`https://api.openbrewerydb.org/v1/breweries?by_dist=${lat},${lon}&per_page=10`)).map(toBrewery)));
}

export function breweriesInCity(city) {
  const c = norm(city).replace(/\s+/g, '_');
  return cached(`food:brewcity:${c}`, 86400, () => safely(async () =>
    (await getJson(`https://api.openbrewerydb.org/v1/breweries?by_city=${encodeURIComponent(c)}&per_page=10`)).map(toBrewery)));
}

function toBrewery(b) {
  return {
    name: b.name, type: b.brewery_type, city: b.city, region: b.state_province ?? b.state ?? '', country: b.country,
    street: b.street ?? b.address_1 ?? '', url: b.website_url ?? null,
    lat: b.latitude != null ? +b.latitude : null, lon: b.longitude != null ? +b.longitude : null,
  };
}

export function coffeePhoto() {
  return safely(async () => (await getJson('https://coffee.alexflipnote.dev/random.json')).file ?? null);
}

// Great-circle distance in km.
export function km(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
