// Turns API data into cards ({ text, image?, keyboard? }) for lib/telegram.js.
import { esc, link, truncate } from './format.js';
import { saveBtn } from './hubs/saved.js';

const UNAVAILABLE = (what) => ({ text: `⚠️ ${what} is unavailable right now. Try again in a minute.` });
const btn = (text, data) => ({ text, callback_data: data });

export function recipeCard(r) {
  if (!r) return UNAVAILABLE('TheMealDB');
  const meta = [r.category, r.area].filter(Boolean).map(esc).join(' · ');
  const links = [r.video && link(r.video, '▶️ Video'), r.source && link(r.source, '🔗 Source')].filter(Boolean).join('  ');
  return {
    text: [
      `🍲 <b>${esc(r.name)}</b>`,
      meta && `<i>${meta}</i>`,
      '',
      '<b>Ingredients</b>',
      ...r.ingredients.map((i) => `• ${esc(i)}`),
      '',
      '<b>Method</b>',
      esc(truncate(r.instructions, 2600)),
      links && `\n${links}`,
    ].filter((l) => l !== null && l !== undefined && l !== false).join('\n'),
    image: r.image,
    keyboard: [[saveBtn('recipe', r.id), btn('🛒 Ingredients', `fd:sl:${r.id}`)].filter(Boolean), [btn('🎲 Another', 'fd:rr'), btn('⬅️ Recipes', 'fd:r')]],
  };
}

export function cocktailCard(d) {
  if (!d) return UNAVAILABLE('TheCocktailDB');
  const meta = [d.category, d.alcoholic, d.glass && `serve in a ${d.glass.toLowerCase()}`].filter(Boolean).map(esc).join(' · ');
  return {
    text: [
      `🍸 <b>${esc(d.name)}</b>`,
      meta && `<i>${meta}</i>`,
      '',
      '<b>Ingredients</b>',
      ...d.ingredients.map((i) => `• ${esc(i)}`),
      '',
      '<b>Preparation</b>',
      esc(truncate(d.instructions, 2600)),
    ].filter((l) => l !== null && l !== undefined && l !== false).join('\n'),
    image: d.image,
    keyboard: [[saveBtn('cocktail', d.id), btn('🎲 Another', 'fd:cr')].filter(Boolean), [btn('⬅️ Cocktails', 'fd:c')]],
  };
}
