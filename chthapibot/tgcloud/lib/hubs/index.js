// Hub registry: routes commands, button presses and pending text input to hubs.
// Importing this module also registers every notification/saved/schedule kind.
import * as main from './main.js';
import * as crypto from './crypto.js';
import * as sports from './sports.js';
import * as food from './food.js';
import * as saved from './saved.js';
import * as random from './random.js';
import '../daily.js';
import { registerSource } from '../widgets/index.js';
import { getPrefs } from '../store.js';
import { normalizeLocale } from '../i18n.js';

const HOMES = {
  home: main.home,
  crypto: crypto.home,
  sports: sports.home,
  food: food.home,
  random: random.home,
  daily: (ctx) => main.commands.daily(ctx),
};

const COMMANDS = {
  ...random.commands,
  ...crypto.commands,
  ...sports.commands,
  ...food.commands,
  ...main.commands,
};

const ALIASES = { magic8: '8ball', eightball: '8ball', movies: 'movie', books: 'book', otd: 'onthisday', score: 'scores', teams: 'myteams', recipes: 'recipe', cocktails: 'cocktail', shop: 'shopping', brewery: 'breweries', reminder: 'remind', setting: 'settings', notification: 'notifications', tz: 'timezone', portfolios: 'portfolio' };

const CALLBACKS = {
  ...saved.callbacks,
  ...random.callbacks,
  ...crypto.callbacks,
  ...sports.callbacks,
  ...food.callbacks,
  ...main.callbacks,
  // m:<hub> opens a hub menu (in place when pressed from a menu).
  async m(ctx, parts) {
    const home = HOMES[parts[0]];
    if (!home) return main.callbacks.m(ctx, parts);
    await ctx.answer();
    return home(ctx);
  },
  noop: (ctx) => ctx.answer(),
  // Cards sent before the food hub existed carried more:recipe / more:cocktail.
  more(ctx, parts) {
    if (parts[0] === 'recipe') return food.callbacks.fd(ctx, ['rr']);
    if (parts[0] === 'cocktail') return food.callbacks.fd(ctx, ['cr']);
    return CALLBACKS.go(ctx, parts);
  },
  // Cards sent before the random hub existed carried go:book / go:fact / more:book / more:fact.
  go(ctx, [what]) {
    if (what === 'book') return random.callbacks.rd(ctx, ['x', 'b', 'trend']);
    if (what === 'fact') return random.callbacks.rd(ctx, ['f', 'fact']);
    if (what === 'recipe') return food.callbacks.fd(ctx, ['rr']);
    if (what === 'cocktail') return food.callbacks.fd(ctx, ['cr']);
    return ctx.answer();
  },
};

const INPUTS = { main: main.inputs, crypto: crypto.inputs, sports: sports.inputs, food: food.inputs, random: random.inputs };

export function findCommand(name) {
  name = name.toLowerCase();
  return COMMANDS[ALIASES[name] ?? name] ?? null;
}

export function runCallback(ctx, data) {
  const [prefix, ...parts] = String(data ?? '').split(':');
  const fn = CALLBACKS[prefix];
  return fn ? fn(ctx, parts) : ctx.answer();
}

export function runInput(ctx, pending, text) {
  const [hub, action] = pending.action.split('.');
  const fn = INPUTS[hub]?.[action];
  return fn ? fn(ctx, text, pending.data ?? {}) : null;
}

// Free text with no pending prompt: hubs may recognise it (e.g. a barcode).
export function runFallbackText(ctx, text) {
  return food.maybeBarcode(ctx, text);
}

// o:c:<coin> · o:g:<league>:<game> — a tap in a widget opens that item as a new card
// in the widget's chat. The widget gets an empty answer.
registerSource('o', async ([what, a, b], q) => {
  const chatId = q.chat?.id ?? q.from.id;
  const ctx = {
    chatId, chatType: q.chat?.type ?? (chatId > 0 ? 'private' : 'group'), userId: q.from.id, userName: q.from.first_name,
    locale: (await getPrefs(chatId)).locale || normalizeLocale(q.from.language_code), message: null, answer: async () => {},
  };
  if (what === 'c' && a) await crypto.openCoin(ctx, a);
  else if (what === 'g' && a && b) await sports.openGame(ctx, a, b);
  return null;
});

export { saveLocation } from './main.js';
export { recordAnswer } from './random.js';
