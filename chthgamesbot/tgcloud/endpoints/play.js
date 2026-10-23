// endpoints/play.js — every chat game, driven from the Mini App through the same game
// modules (same rules, same money handling). Ops:
//   { op: 'open', game }                      personal table/solo game → its state
//   { op: 'deal', game, bet, variant }        start a solo game (server builds the signed lobby)
//   { op: 'create', game, bet }               new multiplayer room → { room }
//   { op: 'room', room }                      room info + state
//   { op: 'act', game | room, data }          press a button (callback data)
// The caller is always ctx.initData.user (verified); state goes out only through each
// game's `view`, which hides decks, mines, other players' cards and so on.

import { EndpointError } from 'sdk';
import { appCtx, loadSession, createSession, getPlayer } from '../lib/engine.js';
import { BY_KEY } from '../lib/games/index.js';
import { GameError, nameOf, BETS } from '../lib/ui.js';
import { caller } from '../lib/mini.js';
import { newGameId } from '../lib/game.js';
import { MAX_BET, BOT_USERNAME } from '../lib/config.js';

const PERSONAL = new Set(['casino', 'solo']);
const fail = (msg, code = 'BAD_INPUT') => { throw new EndpointError(msg, { code }); };

function gameOf(key) {
  const g = BY_KEY[key];
  if (!g || typeof g.view !== 'function') fail('Unknown game');
  return g;
}

function stakeFor(g, bet) {
  if (!g.defaultBet) return 0;
  const n = Number(bet);
  if (!Number.isInteger(n) || n < 1 || n > MAX_BET) fail(`Stake must be 1–${MAX_BET}`);
  return n;
}

async function state(g, key, uid) {
  const row = await loadSession(key);
  if (!row || row.kind !== g.key) return null;
  return g.view(row.state, uid);
}

async function dispatch(g, key, user, data) {
  if (typeof data !== 'string' || data.length > 64 || data.split(':')[0] !== g.key) fail('Bad action');
  const ctx = appCtx(user, key, g.key);
  try {
    await g.handle(ctx, data.split(':').slice(1));
  } catch (e) {
    if (e instanceof GameError) throw new EndpointError(e.message, { code: 'GAME' });
    throw e;
  }
  const me = await getPlayer(user.id);
  return { view: await state(g, key, user.id), toast: ctx.out.toast, alert: ctx.out.alert, result: ctx.out.result, chips: me.chips };
}

// The platform can't serialise objects with numeric keys (game states key players by
// user id), so the payload travels as a JSON string: the app does JSON.parse(res.json).
export default async function (input, ctx) {
  return { json: JSON.stringify(await run(input, ctx)) };
}

async function run(input, ctx) {
  const me = await caller(ctx);
  const user = ctx.initData.user;

  switch (input.op) {
    case 'open': {
      const g = gameOf(input.game);
      if (!PERSONAL.has(g.group)) fail('Use a room for this game');
      return { view: await state(g, `app:${me.id}:${g.key}`, me.id), chips: me.chips, bets: BETS };
    }

    case 'deal': {
      const g = gameOf(input.game);
      if (g.group !== 'solo') fail('Not a solo game');
      const bet = stakeFor(g, input.bet);
      const lobby = await g.lobby({ creator: { id: me.id, name: nameOf(user) }, bet });
      const want = `d${input.variant ?? ''}`;
      const button = lobby.markup.inline_keyboard.flat().find((b) => b.callback_data?.split(':')[1] === want);
      if (!button) fail('Unknown option');
      return dispatch(g, `app:${me.id}:${g.key}`, user, button.callback_data);
    }

    case 'create': {
      const g = gameOf(input.game);
      if (PERSONAL.has(g.group)) fail('This game has no rooms');
      const bet = stakeFor(g, input.bet ?? g.defaultBet);
      const lobby = await g.lobby({ creator: { id: me.id, name: nameOf(user) }, bet });
      const buttons = lobby.markup.inline_keyboard.flat().filter((b) => b.callback_data).map((b) => ({ text: b.text, data: b.callback_data }));
      for (let i = 0; i < 5; i++) {
        const room = newGameId();
        const rec = { game: g.key, bet, creator: { id: me.id, name: nameOf(user) }, buttons };
        if (await createSession(`room:${room}`, 'room', rec)) {
          return { room, link: `https://t.me/${BOT_USERNAME}?start=room_${room}` };
        }
      }
      throw new Error('could not allocate a room id');
    }

    case 'room': {
      const rec = await roomRecord(input.room);
      const g = gameOf(rec.game);
      return { ...rec, link: `https://t.me/${BOT_USERNAME}?start=room_${input.room}`, view: await state(g, `app:r:${input.room}`, me.id), chips: me.chips, me: me.id };
    }

    case 'act': {
      if (input.room != null) {
        const rec = await roomRecord(input.room);
        const g = gameOf(rec.game);
        return dispatch(g, `app:r:${input.room}`, user, input.data);
      }
      const g = gameOf(input.game);
      if (!PERSONAL.has(g.group)) fail('Use a room for this game');
      return dispatch(g, `app:${me.id}:${g.key}`, user, input.data);
    }

    default:
      fail('Unknown op');
  }
}

async function roomRecord(room) {
  if (typeof room !== 'string' || !/^[a-z0-9]{8}$/.test(room)) fail('Bad room');
  const row = await loadSession(`room:${room}`);
  if (!row || row.kind !== 'room') fail('Room not found', 'NOT_FOUND');
  return row.state;
}
