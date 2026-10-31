<h1 align="center">bots</h1>

<p align="center">
  A collection of small, self-hosted Telegram bots by <a href="https://github.com/chethober">@chethober</a>.<br>
  They run serverless on <a href="https://core.telegram.org/bots/serverless">Telegram Serverless (tgcloud)</a>, Telegram's platform for bots. No server to host.
</p>

<p align="center">
  <a href="https://github.com/chethober/bots/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/chethober/bots?style=flat&logo=github"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <img alt="Languages: EN FA AR RU ES" src="https://img.shields.io/badge/languages-EN%20·%20FA%20·%20AR%20·%20RU%20·%20ES-2CA5E0">
  <img alt="Free and open source" src="https://img.shields.io/badge/free-open%20source-brightgreen">
</p>

<p align="center">
  <b>Try them in Telegram:</b><br>
  <a href="https://t.me/chthgamesbot"><img alt="Games" src="https://img.shields.io/badge/🎰_Games-@chthgamesbot-2CA5E0?logo=telegram&logoColor=white"></a>
  <a href="https://t.me/chthvpnbot"><img alt="Community VPN" src="https://img.shields.io/badge/🛡_Community_VPN-@chthvpnbot-2CA5E0?logo=telegram&logoColor=white"></a>
  <a href="https://t.me/chthbrbot"><img alt="Anonymous messages" src="https://img.shields.io/badge/🎭_Anonymous_messages-@chthbrbot-2CA5E0?logo=telegram&logoColor=white"></a>
  <a href="https://t.me/chthapibot"><img alt="Multi-tool" src="https://img.shields.io/badge/🧰_Multi--tool-@chthapibot-2CA5E0?logo=telegram&logoColor=white"></a>
  <a href="https://t.me/chsbrbot"><img alt="CVE alerts" src="https://img.shields.io/badge/🚨_CVE_alerts-@chsbrbot-2CA5E0?logo=telegram&logoColor=white"></a>
  <a href="https://t.me/chthmusicbot"><img alt="Music sync" src="https://img.shields.io/badge/🎧_Music_sync-@chthmusicbot-2CA5E0?logo=telegram&logoColor=white"></a>
  <a href="https://t.me/chthgrambot"><img alt="AI secretary" src="https://img.shields.io/badge/🤵_AI_secretary-@chthgrambot-2CA5E0?logo=telegram&logoColor=white"></a>
</p>

<p align="center">
  <a href="#the-bots">The bots</a> · <a href="#how-they-work">How they work</a> · <a href="#support">Support</a> · <a href="LICENSE">MIT License</a>
</p>

---

On tgcloud you write JavaScript modules (schema, shared libs, update handlers) and the platform runs them in a V8
isolate. Each bot is a standalone project in its own folder with its own README, dependencies and deploy
instructions. Clone the repo, `cd` into the one you want, and follow its README.

## The bots

| Folder | Bot | What it does |
|---|---|---|
| [`chsbrbot`](chsbrbot) | [CVEs](https://t.me/chsbrbot) | Posts new High/Critical CVEs and trending ones (CISA KEV, GitHub PoCs, EPSS), with CVE search, watchlists, digests and followed CVEs |
| [`chthapibot`](chthapibot) | [APIs](https://t.me/chthapibot) | Crypto prices, sports, food & drinks, random pickers and a daily briefing |
| [`chthbrbot`](chthbrbot) | [Anonymous](https://t.me/chthbrbot) | Personal anonymous-message link bot: people message you without seeing who you are |
| [`chthgamesbot`](chthgamesbot) | [Games 🎲](https://t.me/chthgamesbot) | Casino, poker, Persian card games (Hokm, Shelem) and party games: chat games, inline mode and a graphic Mini App. Play chips (buyable with Stars, never cashed out) |
| [`chthgrambot`](chthgrambot) | [Secretary](https://t.me/chthgrambot) | An AI secretary for your Telegram Business account: answers your private chats while you're away, in your tone or your own style. Anyone can use it with their own free Cloudflare Workers AI key |
| [`chthmusicbot`](chthmusicbot) | [Music](https://t.me/chthmusicbot) | Syncs Spotify, YouTube Music and Apple Music playlists with groups, forum topics and channels, both ways; a shared Spotify queue for groups, /playlist, /top and /random in chats, and song search |
| [`chthvpnbot`](chthvpnbot) | [VPN](https://t.me/chthvpnbot) | A directory of VPNs shared by their owners: public listings, private invites with passwords, anonymous memberships. Works best with [xtune](https://github.com/chethober/xtune) public profiles (an account per member), and manages xtune servers' users through management links |

## How they work

The bots share one interface style:

- **Buttons, not commands.** Everything a user does is a button: a reply keyboard under the text
  field and inline buttons under each screen. Slash commands are only `/start` and the admin
  commands (shown in admins' own command menus).
- **Five languages.** English, Persian, Arabic, Russian and Spanish, picked from the user's
  Telegram language or the 🌐 Language button, including the bot descriptions.
- **Clean chat.** Button taps are deleted and each screen replaces the previous one, so the chat
  keeps only real content (messages, games, alerts).
- **ℹ️ About.** What the bot does, with 🔗 Source code and ⭐ Tip the developer: a ☕ coffee,
  🍟 fries, 🍔 burger or 🍕 pizza (50, 100, 250 or 500 Telegram Stars). A tip unlocks nothing; the
  bot thanks the tipper and tells its admins. ✨ More from CHTH links to the CHTH websites
  ([café](https://chth.cafe), [gym](https://chth.space), [shop](https://chth.shop)) and the other bots here.
  Each bot carries the same `tgcloud/lib/tips.js`, generated with `chth-products.js` and `report.js`
  from the shared CHTH kit; edit the kit, not these copies.

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
cp hub.secrets.example.js tgcloud/lib/hub.secrets.js   # hub reporting, off by default
npx tgcloud login     # link the project to your bot
npx tgcloud push      # deploy the code
npx tgcloud migrate   # apply schema changes to the database
```

Most bots also have a one-off setup endpoint or script that applies the bot profile (descriptions,
command menus); see each README.

### Hub reporting (optional)

Each bot can report a few events to a private CHTH hub: a `/start` (with the CHTH link that
brought the user, from `?start=src_<product>`), tips, the bot joining or leaving a group or
channel, and handler errors. Only counts and pseudonymous ids are sent, never message contents.
`tgcloud/lib/report.js` reads `HUB_URL`, `HUB_SECRET` and `HUB_SOURCE` from the git-ignored
`tgcloud/lib/hub.secrets.js`: copy `hub.secrets.example.js` there before a local deploy or
test run. Empty values (the example's default) switch reporting off, and a hub that is down
never affects the bot.

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
| every bot | `CHTH_HUB_URL` and `<BOT>_HUB_SECRET` for hub reporting (both optional) |
| `chsbrbot` | `CHSBRBOT_NVD_API_KEY`, `CHSBRBOT_GITHUB_TOKEN` (both optional) |
| `chthgamesbot` | `CHTHGAMESBOT_BUTTON_SECRET`, `CHTHGAMESBOT_ADMIN_IDS` (a JSON array such as `[12345]`) |
| `chthmusicbot` | `CHTHMUSICBOT_SPOTIFY_CLIENT_ID`, `CHTHMUSICBOT_GOOGLE_CLIENT_ID`, `CHTHMUSICBOT_GOOGLE_CLIENT_SECRET`, `CHTHMUSICBOT_APPLE_MUSIC_DEVELOPER_TOKEN`, `CHTHMUSICBOT_SONGLINK_API_KEY` (all optional) |

See [`<bot>/AGENTS.md`](chthapibot/AGENTS.md) in any bot for the platform's module rules and
`<bot>/docs/tgcloud-sdk.md` for the SDK reference.

## Support

Like the bots? The free ways to help count the most:

- ⭐ **Star this repo**, so more people find it.
- 📣 **Share a bot** with a friend or a group that would use it.
- 🐛 **Open an issue** with a bug or an idea.
- ☕ **Tip in Telegram Stars** from any bot's ℹ️ About screen.

## License

[MIT](LICENSE) © 2026 chethober. Each bot may carry its own `LICENSE`; where it does, that
file governs that folder.
