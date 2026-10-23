// Books, meals, cocktails, trivia. Each fetcher returns a plain object, or null
// when the upstream is down, so callers can render "unavailable" instead of failing.
import { getJson, safely } from '../http.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Pulls strIngredient1..N / strMeasure1..N (TheMealDB / TheCocktailDB) into a list.
function ingredientsOf(item, max) {
  const out = [];
  for (let i = 1; i <= max; i++) {
    const name = item[`strIngredient${i}`]?.trim();
    if (!name) continue;
    const measure = item[`strMeasure${i}`]?.trim();
    out.push(measure ? `${measure} ${name}` : name);
  }
  return out;
}

export function getTrendingBook() {
  return safely(async () => {
    const data = await getJson('https://openlibrary.org/trending/daily.json');
    // Prefer works with a cover; pick among the top 10 so repeat calls vary.
    const works = (data.works ?? []).filter((w) => w.title);
    const withCover = works.filter((w) => w.cover_i);
    const w = pick((withCover.length ? withCover : works).slice(0, 10));
    if (!w) return null;
    return {
      ref: w.key.replace('/works/', ''),
      title: w.title,
      author: w.author_name?.join(', ') || 'Unknown author',
      year: w.first_publish_year ?? null,
      cover: w.cover_i ? `https://covers.openlibrary.org/b/id/${w.cover_i}-L.jpg` : null,
      url: `https://openlibrary.org${w.key}`,
    };
  });
}

export function mealFromApi(m) {
  return {
    id: m.idMeal,
    name: m.strMeal,
    category: m.strCategory,
    area: m.strArea,
    ingredients: ingredientsOf(m, 20),
    instructions: m.strInstructions?.trim() ?? '',
    image: m.strMealThumb || null,
    video: m.strYoutube || null,
    source: m.strSource || null,
  };
}

export function getRandomRecipe() {
  return safely(async () => {
    const m = (await getJson('https://www.themealdb.com/api/json/v1/1/random.php')).meals?.[0];
    return m ? mealFromApi(m) : null;
  });
}

export function drinkFromApi(d) {
  return {
    id: d.idDrink,
    name: d.strDrink,
    category: d.strCategory,
    alcoholic: d.strAlcoholic,
    glass: d.strGlass,
    ingredients: ingredientsOf(d, 15),
    instructions: d.strInstructions?.trim() ?? '',
    image: d.strDrinkThumb || null,
  };
}

export function getRandomCocktail() {
  return safely(async () => {
    const d = (await getJson('https://www.thecocktaildb.com/api/json/v1/1/random.php')).drinks?.[0];
    return d ? drinkFromApi(d) : null;
  });
}

export function getDailyFact() {
  return safely(async () => {
    const data = await getJson('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
    if (!data.text) return null;
    return { text: data.text.trim(), source: data.source_url || null };
  });
}
