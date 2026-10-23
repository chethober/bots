# Telegram Games

Casino, poker and party games for Telegram, built on
[Telegram Serverless](https://core.telegram.org/bots/serverless). There's no server to run:
the bot's code, the database and the Mini App are all hosted by Telegram.

- **20 games:** Texas Hold'em, video poker, blackjack, slots, roulette, crash, plinko, mines,
  duels, trivia, hangman and more.
- **Three ways to play:**
  - in any chat, with inline keyboards
  - in chats the bot isn't in, through inline mode
  - in a full graphic **Mini App**
- **The same rules everywhere.** The Mini App drives the same game modules as the chat
  buttons, so rules and chip handling can't drift apart.
- **Play money only.** Chips are free, earn-only and can't be transferred, bought or cashed out.

Try it: [@chthgamesbot](https://t.me/chthgamesbot)

<p>
  <img src="docs/screenshots/home.png" width="180" alt="Game hub">
  <img src="docs/screenshots/poker.png" width="180" alt="Texas Hold'em">
  <img src="docs/screenshots/roulette.png" width="180" alt="Roulette">
  <img src="docs/screenshots/blackjack.png" width="180" alt="Blackjack">
</p>
<p>
  <img src="docs/screenshots/slots.png" width="180" alt="Slots">
  <img src="docs/screenshots/mines.png" width="180" alt="Mines">
  <img src="docs/screenshots/crash.png" width="180" alt="Crash">
  <img src="docs/screenshots/tictactoe.png" width="180" alt="Tic-tac-toe">
</p>

## Games

| Group | Games | Chat command |
|---|---|---|
| 🎰 Casino tables: one shared message anyone can play | Slots, Roulette, Coinflip, Over/Under 7 | `/slots` `/roulette` `/coinflip` `/dice` |
| 🃏 Solo vs the house | Blackjack, Video Poker (Jacks or Better), Mines, Hi-Lo | `/blackjack` `/videopoker` `/mines` `/hilo` `[stake]` |
| ♠️ Poker | Texas Hold'em, no-limit cash table, 2–8 players | `/poker [buy-in]` |
| ⚔️ Bet with friends | Coinflip Duel, Dice Duel, Rock-Paper-Scissors, Jackpot, Russian Roulette | `/flipduel` `/diceduel` `/rps` `/jackpot` `/roulette6` `[stake]` |
| 🎉 Party (free) | Tic-tac-toe, Connect Four, Trivia, Hangman | `/tictactoe` `/connect4` `/trivia` `/hangman` |
| 📱 Mini App only | Crash, Plinko | `/hub` or the 🎮 Play menu button |

**Mini App and inline mode:**
- Every game is also in the Mini App with real graphics: cards, dice, a spinning wheel,
  reels and a poker table.
- Multiplayer games in the app use rooms that you share with an invite link.
- In any chat, type `@yourbot [game] [stake]` to drop a game lobby in.

**Wallet commands:** `/balance`, `/daily` (a free bonus every 20 hours) and `/top`.

**Fairness.** Every house game returns less than 100%, and `npm test` checks this exactly:

| Game | Return to player |
|---|---|
| Slots | 97.6% |
| Roulette | 97.3% |
| Plinko | about 97% |
| Crash, Mines, Hi-Lo | 97% |
| Video poker (8/5 Jacks or Better) | 97.3% with perfect play (published figure) |

All randomness comes from `crypto.getRandomValues` on the server. The client only animates
results the server has already decided.

## How it works

```
tgcloud/
  schema.js              players (wallet + stats), sessions (all game state), games (legacy)
  handlers/              message (commands) · callback_query (every button) · inline_query
  endpoints/             play (every game, for the Mini App) · wallet · crash · plinko
  lib/engine.js          wallet, versioned session storage, message edits, the game `ctx`
  lib/games/*.js         one pure module per game, plus factories (table, solo, duel, pot, board)
  lib/poker.js           hand evaluator, video poker pay table
  lib/admin.js           /admin commands
public/                  the Mini App: plain ES modules, no build step
  js/app.js              shell: wallet, home, navigation, rooms
  js/kit.js              shared UI: cards, dice, stake picker, lobby buttons
  js/games/*.js          one screen per game
test/validate.js         rules, limits, house edge, leaks, chip conservation (no network)
test/ui.js               headless-browser run through every Mini App screen
scripts/setup.js         one-off bot profile setup (name, description, commands, avatar)
```

**Game modules are pure.** They never import the SDK. They talk to the platform through a
small `ctx` object: session, create, mutate, debit, credit, refund, edit and answer.
- The chat handler builds one `ctx`, where `edit` updates the Telegram message.
- The Mini App's `play` endpoint builds another, where the app re-reads the game's state.
- The tests build a third, in memory.

**Money safety:**
- Stakes are taken with a conditional `chips >= stake` update.
- Every state change is a version-checked write, retried on conflict.
- A payout happens only on the write that ended the game, so double taps, retries and two
  devices can't pay twice.
- Lobby buttons are HMAC-signed, so a modified client can't forge who created a game or
  what the stake is.
- Handlers never throw, so Telegram never redelivers an update that already moved chips.
- If a chip game sits idle for 10 minutes, the other players can call it off, so an AFK
  player can't lock everyone's stake.

**Hidden information.** State reaches the Mini App only through each game's
`view(state, viewer)`. The views hide:
- decks, mines and the bullet
- trivia answers and the hangman word
- an opponent's rock-paper-scissors pick
- Hold'em hole cards, until showdown

The tests fuzz every game and fail if any of these leak. In chat, Hold'em hole cards are
shown only in a private "👀 My cards" popup.

## Run your own

You need Node.js 18 or later and a bot from [@BotFather](https://t.me/BotFather).

1. **Turn on Serverless.** In @BotFather, open your bot → Serverless → enable. Then copy the
   **CLI access token** (`app<id>:<secret>`). This is not the bot token.
2. **Clone and install:**
   ```sh
   git clone https://github.com/chethober/games && cd games
   npm install
   cp secrets.example.js tgcloud/lib/secrets.js   # set BUTTON_SECRET and ADMIN_IDS
   ```
3. **Point the config at your bot:** set `BOT_USERNAME` in `tgcloud/lib/config.js`.
4. **Deploy:**
   ```sh
   npx tgcloud login           # paste the CLI token
   npm run deploy              # prints your Mini App URL
   npm run migrate             # creates the tables
   ```
   Put the printed URL in `WEBAPP_URL` in `tgcloud/lib/config.js`, then run `npm run deploy` again.
5. **Set up the profile:** the name, descriptions, command menus, 🎮 Play menu button and
   avatar. The command in the header of `scripts/setup.js` runs it once without deploying it.
6. **Finish in @BotFather:**
   - `/setinline` to enable inline mode
   - Bot Settings → Configure Mini App, using your app URL
   - Leave group privacy on. Bots still receive `/command@yourbot` in groups.

The npm scripts set `NODE_USE_ENV_PROXY=1`, so the CLI uses `https_proxy` when you have one set.

## Admin

The ids in `ADMIN_IDS` can use these commands:
- `/stats`
- `/user <id>`
- `/grant <id> <±amount>`
- `/setchips <id> <amount>`
- `/resetdaily <id>`
- `/ban <id>` and `/unban <id>`: a banned player is blocked in chat, inline mode and the Mini App.
- `/broadcast <text>`: sends to 40 players per run; add `from=<id>` to continue.

`/admin` lists them, and in the admin's own chat the command menu includes them too.

## Tests

```sh
npm test                 # rules, Telegram limits, house edge, poker, hidden-state leaks, fuzzing
npm run test:ui          # every Mini App screen in headless Chromium, with two players
UI_BASE=https://app<id>.tgcloud.ai/ npm run test:live-ui   # same, against your deployed site
```

The UI tests use `playwright-core`. Either install its browser with
`npx playwright-core install chromium-headless-shell`, or set `CHROME_PATH`. Add `-- --shots`
to save screenshots to `test/shots/`.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © chethober.

`AGENTS.md` and `docs/tgcloud-sdk.md` come from the `@tgcloud/cli` project template
(MIT, © Telegram Messenger).

This project is for entertainment with play-money chips. Don't adapt it for real-money
gambling.
