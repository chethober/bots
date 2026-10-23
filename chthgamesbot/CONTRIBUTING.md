# Contributing

Thanks for helping! Issues and pull requests are welcome.

## Setup

```sh
npm install
cp secrets.example.js tgcloud/lib/secrets.js
npm test
```

`npm test` needs no network and no bot. It covers the game rules, Telegram's message limits,
the house edge, poker hand ranking and side pots, hidden-state leaks, and fuzzed play with
chip conservation. Run `npm run test:ui` when you change anything in `public/`.

## Adding a game

1. **Write the chat game.** Add `tgcloud/lib/games/<name>.js`.
   - Keep it pure: no `sdk` imports. Use the `ctx` it is given.
   - Start from one of the factories (`table`, `solo`, `duel`, `pot`, `board`) when one fits.
   - Export `view(state, viewerId)`, and hide anything the viewer must not see.
2. **Register it** in `tgcloud/lib/games/index.js`.
3. **Add the Mini App screen:** `public/js/games/<key>.js`, plus an entry in `GAMES` in
   `public/js/app.js`.
4. **Extend the tests.** `npm test` fuzzes every registered game automatically. Add specific
   checks to `test/validate.js` for the game's rules, and add a scenario to `test/ui.js`.

## Rules for chip-moving code

- Take stakes with `ctx.debit`. It fails rather than going negative.
- Pay only after the `ctx.mutate` that ends the game has succeeded, and pay exactly once.
  Use the `prev` and `state` it returns, or collect payouts in the state the way
  `holdem.js` uses `payq`.
- Handlers must never throw. A redelivered update must not move chips twice.
- Keep chips earn-only: no transfers between players.

## Style

Match the surrounding code: ES modules, two-space indent, single quotes, and short comments
that explain why rather than what.
