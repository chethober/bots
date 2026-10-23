# bots

A collection of small, self-hosted Telegram bots by [@chethober](https://github.com/chethober).

They run on **[Telegram Serverless (tgcloud)](https://tgcloud.ai)** — you write JavaScript
modules (schema, shared libs, update handlers) and the platform runs them in a V8 isolate,
no server to host.

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
| [`chthvpnbot`](chthvpnbot) | Community VPN | A directory of VPNs shared by their owners: public listings, private invites with passwords, anonymous memberships. Works best with [xtune](https://github.com/chethober/xtune) public profiles (an account per member) | tgcloud |
| [`chsbrbot`](chsbrbot) | CVE alerts | Posts new High/Critical CVEs and trending ones (CISA KEV, GitHub PoCs, EPSS), with CVE search | tgcloud |

## How they work

The bots share one interface style:

- **Buttons, not commands.** Everything a user does is a button: a reply keyboard under the text
  field and inline buttons under each screen. Slash commands are only `/start` and the admin
  commands (shown in admins' own command menus).
- **Five languages.** English, Persian, Arabic, Russian and Spanish, picked from the user's
  Telegram language or the 🌐 Language button, including the bot descriptions.
- **Clean chat.** Button taps are deleted and each screen replaces the previous one, so the chat
  keeps only real content (messages, games, alerts).

Every bot follows it. The multi-utility bot also keeps its slash commands as typed shortcuts (and
a command menu in groups), and its hub screens are in English; some admin screens are English too.

## Setup, in general

Every bot keeps its secrets out of git. Before deploying one, copy its example config
(`secrets.example.js`, …) to the real filename and fill it in — each
README says which. Nothing in this repo contains live credentials.

For the tgcloud bots the workflow is the same everywhere:

```sh
cd <bot>
npm install
npx tgcloud login     # link the project to your bot
npx tgcloud push      # deploy the code
npx tgcloud migrate   # apply schema changes to the database
```

Some bots also have a one-off setup endpoint or script that applies the bot profile (descriptions,
command menus) — see each README.

See [`<bot>/AGENTS.md`](chthapibot/AGENTS.md) in any tgcloud bot for the platform's
module rules and SDK reference.

## License

[MIT](LICENSE) © 2026 chethober. Each bot may carry its own `LICENSE`; where it does, that
file governs that folder.
