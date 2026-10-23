# Redesign plan

Agreed 2026-10-21. Four category hubs, each with saved items, follows and notifications.

## Shape

- Telegram's `/` menu: `/crypto /sports /food /random /daily /notifications /settings /help`.
  Old shortcuts (`/book`, `/recipe`, `/f1`, `/brew`, …) keep working and are listed in `/help`.
- Hub menus **edit one message in place** (⬅️ Back). Content (a recipe, a coin, a scoreboard) is
  sent as a **new card** with an action row: ♥ Save · 🔄 Another · 🔔 Notify · ⬅️ Menu.
- Free-text input after a button (🔎 Search) uses ForceReply plus a `pending_input` row that
  expires after 10 minutes. Command arguments (`/crypto pepe`) work too.
- State belongs to the **chat**. In groups only admins change settings, follows and
  notifications; anyone can browse.
- English only.

## Shared framework

- ♥ **Saved**: per category, 8 per page, at most 200.
- ⭐ **Following**: caps per chat: 30 coins, 20 teams/leagues, 50 notifications.
- 🔔 **Notifications** (`notifications` table, one row per alert/schedule/reminder):
  - Alerts fire once and deactivate, with a 🔁 Re-arm button. A % move alert fires at most
    once per day per coin and stays active.
  - Scheduled pushes: local time + `daily | weekdays | weekends | mon…sun`.
  - Reminders always fire, even in quiet hours.
  - `/notifications` lists everything (pause/resume, delete); each hub shows its own slice.
- **Time zone** per chat (shared location → timeapi.io, or `/timezone Europe/Berlin`).
- **Quiet hours** per chat hold scheduled pushes and alerts; reminders are exempt.
- **Mute** per category.
- Scheduler: GitHub Actions every 10 min → `endpoints/tick`. Times are approximate.
- `config` table (TMDB key, admin chat id), writable only via the CLI (`endpoints/setConfig`).
- `endpoints/healthcheck` probes every API from the platform; a daily workflow reports
  failures to the admin chat.

## Hubs

- **💰 Crypto**: markets (top 10 / watchlist), trending, 24h gainers/losers, coin lookup card
  (⭐ follow, 🔔 alert, 💼 add), watchlist, alerts (price above/below, ±X% in 24h, Fear & Greed),
  portfolio (one position per coin, optional average buy price → profit/loss), global stats +
  BTC network fees, scheduled summary. Data: CoinGecko → CoinPaprika/Coinlore fallback,
  Binance, alternative.me, mempool.space.
- **🏆 Sports**: soccer (many leagues), NBA, WNBA, NFL, NCAA, MLB, NHL, UFC, ATP/WTA, PGA,
  NASCAR, IndyCar, cricket, rugby, F1. Scores/fixtures/standings/news. Follow teams (browse or
  search a weekly team index). Kickoff reminder (15/30/60 min/1 day, default 30), match
  started, halftime, final score + Scorebat highlight. Data: ESPN (`site.web.api.espn.com`),
  OpenF1, Jolpica.
- **🍽 Food & drinks**: recipes (random, search, cuisine, category, fridge mode), cocktails
  (random, by spirit, non-alcoholic, search), coffee (calculator, saved recipes, brew log with
  ratings, drawdown reminder, photos), breweries near location, barcode → Nutri-Score,
  shopping list from recipes, "dinner idea" push.
- **🎲 Random**: tools (Telegram dice, NdM dice, coin, range, pick, shuffle, team split,
  yes/no/8-ball, cards); discover (books, movies via TMDB or Apple chart in limited mode,
  series/TVmaze, anime/Kitsu, games, albums, radio, art, Pokémon); fun (fact, joke, quote,
  advice, Wikipedia, word of the day, xkcd, pets, "bored?"); trivia quiz polls with a per-chat
  leaderboard and streaks.
- **☀️ /daily**: per-chat section toggles. Default on: weather, crypto watchlist, my teams,
  recipe idea, trending book.

## Platform facts (tested from the runtime)

- No `setTimeout`, `URL`, `atob`, `AbortController`; `Intl` time zones and
  `crypto.getRandomValues` work.
- ESPN's `site.api.espn.com` returns 403 to the platform; use `site.web.api.espn.com`.
- Blocked/dead from the platform: CoinCap, CryptoCompare (key), Ergast, OpenLigaDB, Squiggle,
  TheSportsDB (free key disabled), balldontlie (key), football-data.org, NBA CDN, Sofascore,
  FotMob, Jikan, PunkAPI, Foodish, Quotable, Numbers API.

## Rollout

1. Framework + Crypto hub
2. Sports
3. Food & drinks
4. Random
5. `/daily` + settings wiring, cleanup
