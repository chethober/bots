<h1 align="center">CVE alerts</h1>

<p align="center">
  A Telegram bot that posts new and trending vulnerabilities to private chats, groups and channels, with CVE search.<br>
  Runs serverless on <a href="https://core.telegram.org/bots/serverless">Telegram Serverless (tgcloud)</a>, Telegram's platform for bots. No server to host.
</p>

<p align="center">
  <a href="https://t.me/chsbrbot">Try it: @chsbrbot</a> · <a href="../LICENSE">MIT License</a>
</p>

---

The bot watches NVD, the CISA KEV catalog and GitHub, and sends an alert for every serious or actively exploited
CVE. Alerts are in each chat's language; channels get English.

The interface follows the [shared style](../README.md#how-they-work): buttons only, five languages, clean chat.

## Features

- **New CVEs:** every CVE that NVD publishes with a CVSS base score above **7.6** (`MIN_CVSS`).
- **Trending CVEs:** CVEs added to the [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
  catalog in the last 30 days, and CVEs named by recently updated GitHub proof-of-concept repositories. The alert
  says why each one is trending (KEV, the FIRST EPSS score, the PoC repositories) and gives CISA's required action.
- **Who gets alerts:** everyone who pressed Start (they can switch alerts off in ⚙️ Settings), and every group or
  channel that adds the bot. In a channel the bot has to be an admin who can post messages.
- **Filters:** in the private chat, ⚙️ Settings sets which alerts arrive:
  - 🎚 **Alert level**: high and critical (the default), critical only (new CVEs from CVSS 9.0,
    `CRITICAL_CVSS`), or exploited only (trending CVEs).
  - 👁 **Watchlist**: up to 20 products, vendors or words, such as `nginx`, `Fortinet` or `linux kernel`. When it
    isn't empty, an alert arrives only if a word names one of the CVE's affected products or appears in its
    description (as a whole word). Search results offer to add the search to it. Groups and channels get every alert.
- **Search:** in the private chat, type a product, vendor, bug type or CVE id. The 🆕 Latest, 🔥 Trending and
  ⚡ Categories buttons open lists, and a CVE opens as a card with its bug types, affected products, CVSS vector,
  KEV status and exploit links.

**The first run sends nothing.** It records the CVEs and trending entries already out there as `seeded`, so
switching on a new deployment doesn't flood every chat. Alerts start with the next CVE published after that.

## Admins

Admins (`ADMIN_IDS`) get these commands in their own command menu. The same tools are in ⚙️ Settings → 👑 Admin dashboard.

| Command | What it does |
|---|---|
| `/admin` | Dashboard: last scheduler run, stats, alert history, groups and channels, a test alert, run the scheduler now |
| `/stats` | Subscribers by type, alerts sent and queued, CVEs stored |
| `/broadcast [channel] <text>` | Message every subscribed chat (or only channels). Queued like an alert, so it reaches everyone across runs |

Admins are also told when the bot is added to or removed from a group or channel.

## Run your own

You need Node.js 22+ and a bot from [@BotFather](https://t.me/BotFather).

```sh
git clone https://github.com/chethober/bots && cd bots/chsbrbot
npm install
cp secrets.example.js tgcloud/lib/secrets.js   # keys optional, the file is required
export NODE_USE_ENV_PROXY=1                    # only needed behind an HTTP proxy
npx tgcloud login                              # link the project to your bot (or set TGCLOUD_TOKEN)
npx tgcloud push                               # deploy code
npx tgcloud migrate                            # create the tables
npx tgcloud run endpoints/setup '{}'           # descriptions and command menus
npx tgcloud run endpoints/tick '{}'            # first run: records what's already out there
```

Thresholds and admin ids are in `tgcloud/lib/config.js`. The optional NVD API key and GitHub token go in the
git-ignored `tgcloud/lib/secrets.js`.

Then add the repository secret `CHSBRBOT_TGCLOUD_TOKEN` (the project's tgcloud token). The workflow runs
from the default branch only. `tgcloud run` uses the checked-out modules, so the workflow writes
`secrets.js` itself, from the optional secrets `CHSBRBOT_NVD_API_KEY` and `CHSBRBOT_GITHUB_TOKEN`.

### Switching over from the Cloudflare Worker

The bot used to be a Cloudflare Worker (`cve-telegram-notifier`, with the D1 database `cve-db`); its code is
in this repo's history before the tgcloud port.

1. Stop the Worker so it can't send alerts alongside this bot: delete it, or disable its cron trigger, in
   the Cloudflare dashboard (Workers → `cve-telegram-notifier` → Settings → Triggers).
2. Copy its subscribers: `npx wrangler login` with the account that owns `cve-db`, then
   `node scripts/import-from-d1.mjs` here.

## Tests

```sh
npm test      # renders real NVD records in every language and checks Telegram's limits; tests the alert filters
```

## How it works

Telegram Serverless has no cron, so [`.github/workflows/chsbrbot-tick.yml`](../.github/workflows/chsbrbot-tick.yml)
runs `endpoints/tick` every 10 minutes. The platform stops a run after about 30 s, so each run does a bounded
amount of work and leaves the rest for the next one ([`lib/scheduler.js`](tgcloud/lib/scheduler.js)):

1. reload the CISA KEV catalog (twice a day);
2. fetch the CVEs NVD published since the last run and queue an alert for each one above the threshold;
3. queue an alert for each new trending CVE;
4. fetch NVD details and EPSS scores for queued trending alerts;
5. deliver queued alerts chat by chat, skipping chats whose filters leave the alert out. Each alert remembers the last chat it reached, so delivery picks up where the last run stopped.

Without an NVD API key, NVD allows 5 requests per 30 s, so a run makes at most 3 NVD requests. With a key in
`tgcloud/lib/secrets.js` it makes up to 20, which clears a backlog of trending CVEs faster.

```
tgcloud/
├── schema.js              tables: chats, cves, kev, alerts (the queue), settings
├── handlers/              private chat (message), its buttons (callback_query), joining and leaving chats (my_chat_member)
├── endpoints/             tick (the scheduler), setup (bot profile), importChats (switch-over)
└── lib/
    ├── scheduler.js       the five steps above
    ├── nvd.js · feeds.js  NVD, CISA KEV, EPSS and GitHub
    ├── cves.js            the CVE store: lookups, search, lists
    ├── filters.js         each chat's alert level and watchlist
    ├── views.js · format.js · strings.js   screens, cards and alerts, translated texts
    └── config.js          thresholds and admin ids
test/                      npm test
scripts/import-from-d1.mjs one-off: copies the subscribers of the old Cloudflare Worker
```

See [`AGENTS.md`](AGENTS.md) for the platform's module rules and [`docs/tgcloud-sdk.md`](docs/tgcloud-sdk.md) for the SDK reference.

## Contributing

Issues and pull requests are welcome. Run `npm test` before sending a change.

## License

[MIT](../LICENSE)
