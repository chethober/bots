# bots

A collection of small, self-hosted Telegram bots by [@chethober](https://github.com/chethober).

Most run on **[Telegram Serverless (tgcloud)](https://tgcloud.ai)** — you write JavaScript
modules (schema, shared libs, update handlers) and the platform runs them in a V8 isolate,
no server to host. One (`chsbrbot`) runs on a **Cloudflare Worker**.

Each bot is a standalone project in its own folder with its own README, dependencies, and
deploy instructions. Clone the repo, `cd` into the one you want, and follow its README.

## The bots

| Folder | Bot | What it does | Stack |
|---|---|---|---|
| [`chthapibot`](chthapibot) | Multi-utility bot | Crypto prices, sports, food & drinks, random pickers and a daily briefing | tgcloud |
| [`chthbrbot`](chthbrbot) | anonm | Personal anonymous-message link bot — people message you without seeing who you are | tgcloud |
| [`chthgamesbot`](chthgamesbot) | Games | Casino, poker and party games — chat games, inline mode and a graphic Mini App. Play-money only | tgcloud |
| [`chthgrambot`](chthgrambot) | Secretary | Telegram Business secretary assistant, powered by Cloudflare Workers AI | tgcloud |
| [`chtht2sbot`](chtht2sbot) | t2s | Watches a forum's topics and files every posted track into a per-topic Spotify playlist | tgcloud |
| [`chsbrbot`](chsbrbot) | CVE notifier | Fetches newly published CVEs and posts them to Telegram | Cloudflare Worker |

## Setup, in general

Every bot keeps its secrets out of git. Before deploying one, copy its example config
(`secrets.example.js`, `.env.example`, …) to the real filename and fill it in — each
README says which. Nothing in this repo contains live credentials.

For the tgcloud bots the workflow is the same everywhere:

```sh
cd <bot>
npm install
npx tgcloud login     # link the project to your bot
npx tgcloud push      # deploy the code
npx tgcloud migrate   # apply schema changes to the database
```

See [`<bot>/AGENTS.md`](chthapibot/AGENTS.md) in any tgcloud bot for the platform's
module rules and SDK reference.

## License

[MIT](LICENSE) © 2026 chethober. Each bot may carry its own `LICENSE`; where it does, that
file governs that folder.
