<h1 align="center">bots</h1>

<p align="center">
  A collection of small, self-hosted Telegram bots by <a href="https://github.com/chethober">@chethober</a>.<br>
  They run serverless on <a href="https://core.telegram.org/bots/serverless">Telegram Serverless (tgcloud)</a>, Telegram's platform for bots. No server to host.
</p>

<p align="center">
  <a href="#the-bots">The bots</a> · <a href="#how-they-work">How they work</a> · <a href="LICENSE">MIT License</a>
</p>

---

On tgcloud you write JavaScript modules (schema, shared libs, update handlers) and the platform runs them in a V8
isolate. Each bot is a standalone project in its own folder with its own README, dependencies and deploy
instructions. Clone the repo, `cd` into the one you want, and follow its README.

## The bots

| Folder | Bot | What it does |
|---|---|---|
| [`chsbrbot`](chsbrbot) | [CVE alerts](https://t.me/chsbrbot) | Posts new High/Critical CVEs and trending ones (CISA KEV, GitHub PoCs, EPSS), with CVE search |
| [`chthapibot`](chthapibot) | [Multi-utility bot](https://t.me/chthapibot) | Crypto prices, sports, food & drinks, random pickers and a daily briefing |
| [`chthbrbot`](chthbrbot) | [anonm](https://t.me/chthbrbot) | Personal anonymous-message link bot: people message you without seeing who you are |
| [`chthgamesbot`](chthgamesbot) | [Games](https://t.me/chthgamesbot) | Casino, poker, Persian card games (Hokm, Shelem) and party games: chat games, inline mode and a graphic Mini App. Play chips (buyable with Stars, never cashed out) |
| [`chthgrambot`](chthgrambot) | Secretary | Telegram Business secretary assistant, powered by Cloudflare Workers AI |
| [`chtht2sbot`](chtht2sbot) | t2s | Watches a forum's topics and files every posted track into a per-topic Spotify playlist |
| [`chthvpnbot`](chthvpnbot) | [Community VPN](https://t.me/chthvpnbot) | A directory of VPNs shared by their owners: public listings, private invites with passwords, anonymous memberships. Works best with [xtune](https://github.com/chethober/xtune) public profiles (an account per member), and manages xtune servers' users through management links |

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

## Run your own

Every bot keeps its secrets out of git. Before deploying one, copy its example config
(`secrets.example.js`, …) to the real filename and fill it in; each README says which.
Nothing in this repo contains live credentials.

The workflow is the same for every bot:

```sh
git clone https://github.com/chethober/bots && cd bots/<bot>
npm install
npx tgcloud login     # link the project to your bot
npx tgcloud push      # deploy the code
npx tgcloud migrate   # apply schema changes to the database
```

Most bots also have a one-off setup endpoint or script that applies the bot profile (descriptions,
command menus); see each README.

### CI/CD

Each bot has a GitHub Actions workflow, `.github/workflows/<bot>-ci.yml`. It runs the bot's tests
(or a syntax check of its modules) on every pull request and push to `main` that touches the bot's
folder. On `main`, it then deploys with `tgcloud push` and applies the safe schema changes with
`tgcloud migrate --safe`. Destructive schema changes are only listed in the job log, so apply those
by hand with `npx tgcloud migrate`. You can also run a workflow by hand from the Actions tab.

The workflows read these repository secrets:

| Bot | Secrets |
|---|---|
| every bot | `<BOT>_TGCLOUD_TOKEN`, the bot's tgcloud project token (e.g. `CHTHVPNBOT_TGCLOUD_TOKEN`) |
| `chsbrbot` | `CHSBRBOT_NVD_API_KEY`, `CHSBRBOT_GITHUB_TOKEN` (both optional) |
| `chthgamesbot` | `CHTHGAMESBOT_BUTTON_SECRET`, `CHTHGAMESBOT_ADMIN_IDS` (a JSON array such as `[12345]`) |
| `chtht2sbot` | `CHTHT2SBOT_SPOTIFY_CLIENT_ID`, `CHTHT2SBOT_SPOTIFY_CLIENT_SECRET` |

See [`<bot>/AGENTS.md`](chthapibot/AGENTS.md) in any bot for the platform's module rules and
`<bot>/docs/tgcloud-sdk.md` for the SDK reference.

## License

[MIT](LICENSE) © 2026 chethober. Each bot may carry its own `LICENSE`; where it does, that
file governs that folder.
