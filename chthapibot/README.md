# chthapibot

A multi-utility Telegram bot that runs entirely on [Telegram Serverless](https://core.telegram.org/bots/serverless).
It covers crypto prices and alerts, scores and match alerts for about 50 competitions, recipes and
coffee tools, dice, discovery and trivia, and a configurable daily briefing.

To try it, open **[@chthapibot](https://t.me/chthapibot)** and send `/start`.

The bot uses only free, public APIs, most of them listed in
[public-apis/public-apis](https://github.com/public-apis/public-apis). Each one was tested from
the Telegram Serverless runtime itself. See [API sources](#api-sources).

## Features

Features are grouped into four hubs. Each hub has ♥ **saved items**, ⭐ **follows** where they
make sense, and 🔔 **notifications**: alerts, scheduled pushes and reminders. In private chats,
the main menu, hub menus and sub-menus appear as keyboard buttons under the text field. Content
arrives as cards with buttons attached for that item: ♥ Save · 🔄 Another · Follow · ⬅️ Back.
The keyboard can be collapsed with the ⌨️ toggle or removed with **✖️ Hide menu**; `/menu`
brings it back.
Groups use buttons attached to messages throughout, because with privacy mode on, Telegram
doesn't deliver keyboard taps from groups to the bot.

| Hub | What's in it |
|---|---|
| 💰 **Crypto** `/crypto` | Top-10 markets, watchlist, trending coins, 24h gainers and losers, coin cards, global stats with BTC fees, Fear & Greed. Alerts for a price above or below a level, a ±X% move in 24h, or Fear & Greed. Portfolio with average buy price and profit/loss. Scheduled market summary. |
| 🏆 **Sports** `/sports` | Soccer (24 competitions), NBA, WNBA, NCAA, NFL, MLB, NHL, rugby (8 competitions), cricket, ATP/WTA, golf (4 tours), UFC, F1, NASCAR, IndyCar. Scores, fixtures, standings, news. Follow teams (browse or search) for kickoff reminders and start, halftime and full-time alerts with highlight links. Follow F1, tennis, golf, UFC or motorsport for event reminders and results. F1 session times, driver and constructor standings, calendar. |
| 🍽 **Food & drinks** `/food` | About 600 recipes (random, search, cuisine, category, 🧊 fridge mode) and about 500 cocktails (by spirit, non-alcoholic, search). Coffee brew calculator (V60, AeroPress, inverted, cold brew), saved brew recipes, and a brew log with ratings. Shopping list filled from recipes. Breweries near you. Barcode lookup for Nutri-Score, NOVA and nutrition. Scheduled dinner ideas. |
| 🎲 **Random** `/random` | Tools: Telegram dice, dice notation like `3d6+2`, coin flip, number in a range, pick one, shuffle, team splitter, 8-ball, cards. Discover: books, movies (TMDB, by genre and decade), series, anime, games, deals and giveaways, albums, radio, art, Pokémon, pets. Fun: facts, jokes, quotes, advice, Wikipedia, on this day, word of the day, xkcd. 🧠 Trivia quiz polls with a per-chat leaderboard and daily streaks. Scheduled picks, e.g. a movie every Friday at 20:00. |

Across the bot:

- **☀️ `/daily` briefing.** Ten sections you can switch on or off (weather, crypto, my teams, F1,
  book, movie, recipe, quote, fact, word), delivered at a time and on days you choose.
- **🔔 `/notifications`** lists everything scheduled, with pause, resume and delete.
- **⚙️ `/settings`** covers time zone (typed or from a shared location), 🌙 quiet hours and
  🔕 per-category mute.
- **Groups:** anyone can browse; only group admins can change settings, follows and notifications.

`/help` lists every shortcut command.

## How it works

The bot is a set of JavaScript modules that Telegram runs in a V8 isolate. There is no server.

```
tgcloud/
  schema.js                 SQLite tables: prefs, follows, saved_items, notifications, pending_input,
                            config, cache, portfolio, shopping_list, brew_log, trivia_scores
  handlers/                 one module per Telegram update type
    message.js              commands, replies to prompts, location messages, barcodes
    callback_query.js       inline buttons
    poll_answer.js          trivia quiz answers → scores and streaks
  endpoints/                CLI-only functions (they refuse Mini App calls)
    tick.js                 one scheduler run: alerts, schedules, reminders, match events
    healthcheck.js          probes every upstream API from the platform; warms search indexes
    setConfig.js            bot configuration (TMDB key, admin chat id)
  lib/
    hubs/                   index.js routes commands, callbacks (`prefix:…`) and typed input;
                            main.js, crypto.js, sports.js, food.js, random.js, saved.js
    notify.js               notification kinds registry and schedules
    scheduler.js            evaluates due notifications (mute, quiet hours, DB claims, time budget)
    daily.js                the ☀️ briefing
    store.js                config, cache, prefs, follows, saved items, pending input, portfolio
    time.js                 time zones, schedules, quiet-hour windows
    ui.js                   in-place menus, prompts, group-admin checks
    rng.js                  crypto-backed randomness, dice notation, cards, teams
    http.js                 JSON fetch with one retry
    apis/                   upstream clients: crypto, espn, f1, food, fun, random, weather
    health.js               the probe list used by the healthcheck
```

Design notes:

- **Notifications are rows; kinds are code.** Each hub registers its notification kinds (`price`,
  `pct`, `fng`, `team`, `event`, …), each with a `describe` and an `evaluate` function. The
  scheduler loads due rows, skips muted categories, holds alerts during quiet hours, and asks each
  kind what should fire. It records each send in the database before sending, so overlapping runs
  never send twice. When you follow a team, the first run only records what has already happened,
  so you don't get yesterday's results.
- **The platform has no cron.** `.github/workflows/tick.yml` runs `tgcloud run endpoints/tick`
  every 10 minutes, so all times are approximate.
- **It stays within free tiers.** Upstream responses are cached in the `cache` table, and
  CoinGecko falls back to Coinlore and Binance. Some catalogues can't be filtered fully on free
  keys (TheMealDB, TheCocktailDB) or are spread across many endpoints (ESPN team lists), so they
  are indexed weekly and searched locally.

### Runtime facts (measured on Telegram Serverless)

- `setTimeout`, `URL`, `atob` and `AbortController` don't exist. Full `Intl` time zones and
  `crypto.getRandomValues` are available.
- Each fetch is aborted after about 5 s, and `lib/http.js` retries once. A run gets about 3 s of
  CPU and about 30 s of wall time. `Date.now()` doesn't advance during synchronous code. The
  scheduler stops starting new sends after 20 s and leaves the rest for the next run.
- `site.api.espn.com` returns 403 to the platform; `site.web.api.espn.com` works. Kitsu requires
  `Accept: application/vnd.api+json`. CheapShark and Radio Browser want a descriptive `User-Agent`.

## Run your own copy

You need a bot linked to Telegram Serverless, and Node.js 20 or later.

```sh
git clone https://github.com/chethober/chthapibot && cd chthapibot
npm install                     # installs the tgcloud CLI
npx tgcloud login               # link this folder to your bot (or export TGCLOUD_TOKEN)
npx tgcloud push                # deploy the modules
npx tgcloud migrate             # create the tables
npx tgcloud run endpoints/healthcheck '{}'    # check every API from the platform
```

Optional configuration. It's stored in the bot's database, never in the repo:

```sh
# TMDB v3 API key: full movie catalogue with genre and decade filters.
# Without it, movies come from Apple's US top-100 chart.
npx tgcloud run endpoints/setConfig '{ tmdb_key: "…" }'
# Your Telegram user ID: daily healthcheck failures are sent to you.
npx tgcloud run endpoints/setConfig '{ admin_chat_id: "123456789" }'
# Show the current configuration (keys are masked)
npx tgcloud run endpoints/setConfig '{}'
```

**Scheduling:** push the repo to GitHub and add a repository secret `TGCLOUD_TOKEN` containing
your project token. `tick.yml` then runs the scheduler every 10 minutes, and `health.yml` runs the
API healthcheck daily. GitHub pauses scheduled workflows after 60 days without repository
activity. Any other timer works too, such as a crontab line that runs
`npx tgcloud run endpoints/tick '{}'`.

> `tgcloud push` (CLI 0.2.0) may crash *after* uploading, while it saves its local snapshot. The
> deploy itself succeeds; run `npx tgcloud fetch` to re-sync.

## Testing

[`scripts/e2e.js`](scripts/e2e.js) drives the real handlers on the platform, against the real
database, with Bot API calls stubbed out so nothing is sent to Telegram. It checks the HTML and
button data of every outgoing message, runs the scheduler, and cleans up after itself. It covers
about 270 scenarios in 12 parts; the header of the file explains how to run it.

## API sources

| Area | APIs |
|---|---|
| Crypto | CoinGecko, Coinlore, CoinPaprika, Binance, alternative.me (Fear & Greed), mempool.space |
| Sports | ESPN site API, OpenF1, Jolpica (Ergast successor), Scorebat |
| Food | TheMealDB, TheCocktailDB, Open Food Facts, Open Brewery DB, coffee.alexflipnote.dev |
| Random | Open Library, Gutendex, TMDB, Apple RSS charts, TVmaze, Kitsu, FreeToGame, CheapShark, GamerPower, Radio Browser, Art Institute of Chicago, PokéAPI, Dog CEO, TheCatAPI, uselessfacts, JokeAPI, icanhazdadjoke, ZenQuotes, Advice Slip, Wikipedia/Wikimedia, Free Dictionary, random-word-api, xkcd, Bored API, Open Trivia DB |
| Utility | Open-Meteo, timeapi.io |

The data belongs to its providers; check each API's terms before heavy use. This project isn't
affiliated with any of them.

## Contributing

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). To report a
security issue, see [SECURITY.md](SECURITY.md). The original design and rollout plan is in
[docs/PLAN.md](docs/PLAN.md). [AGENTS.md](AGENTS.md) and [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md)
describe the platform SDK.

## License

[MIT](LICENSE)
