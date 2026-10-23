# CVE alerts (@chsbrbot)

Telegram bot that posts new and trending vulnerabilities, running on Telegram Serverless (tgcloud).

- **New CVEs:** every CVE that NVD publishes with a CVSS base score above **7.6** (`MIN_CVSS`).
- **Trending CVEs:** CVEs added to the [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) catalog in the last 30 days, and CVEs named by recently updated GitHub proof-of-concept repositories. The alert says why each one is trending (KEV, the FIRST EPSS score, the PoC repositories) and gives CISA's required action.
- **Who gets alerts:** everyone who pressed Start (they can switch alerts off in ⚙️ Settings), and every group or channel that adds the bot. In a channel the bot has to be an admin who can post messages. Alerts are in each chat's language; channels get English.
- **Search:** in the private chat, type a product, vendor, bug type or CVE id. The 🆕 Latest, 🔥 Trending and ⚡ Categories buttons open lists, and a CVE opens as a card with its bug types, affected products, CVSS vector, KEV status and exploit links.

The interface follows the [shared style](../README.md#how-they-work): buttons only, five languages, clean chat.

## How it runs

Telegram Serverless has no cron, so [`.github/workflows/chsbrbot-tick.yml`](../.github/workflows/chsbrbot-tick.yml)
runs `endpoints/tick` every 10 minutes. The platform stops a run after about 30 s, so each run does a bounded
amount of work and leaves the rest for the next one ([`lib/scheduler.js`](tgcloud/lib/scheduler.js)):

1. reload the CISA KEV catalog (twice a day);
2. fetch the CVEs NVD published since the last run and queue an alert for each one above the threshold;
3. queue an alert for each new trending CVE;
4. fetch NVD details and EPSS scores for queued trending alerts;
5. deliver queued alerts chat by chat. Each alert remembers the last chat it reached, so delivery picks up where the last run stopped.

Without an NVD API key, NVD allows 5 requests per 30 s, so a run makes at most 3 NVD requests. With a key in
`tgcloud/lib/secrets.js` it makes up to 20, which clears a backlog of trending CVEs faster.

**The first run sends nothing.** It records the CVEs and trending entries already out there as `seeded`, so
switching on a new deployment doesn't flood every chat. Alerts start with the next CVE published after that.

## Layout

| Path | |
|---|---|
| `tgcloud/schema.js` | tables: `chats`, `cves`, `kev`, `alerts` (the queue), `settings` |
| `tgcloud/lib/scheduler.js` | the five steps above |
| `tgcloud/lib/nvd.js`, `feeds.js` | NVD, CISA KEV, EPSS and GitHub |
| `tgcloud/lib/cves.js` | the CVE store: lookups, search, lists |
| `tgcloud/lib/views.js`, `format.js`, `strings.js` | screens, cards and alerts, translated texts |
| `tgcloud/handlers/` | private chat (`message`), its buttons (`callback_query`), joining and leaving chats (`my_chat_member`) |
| `tgcloud/endpoints/` | `tick` (the scheduler), `setup` (bot profile), `importChats` (switch-over) |
| `test/` | `npm test`: renders real NVD records in every language and checks Telegram's limits |
| `worker/` | the previous Cloudflare Worker, kept until the switch-over is done |

Thresholds and admin ids are in `tgcloud/lib/config.js`. The optional NVD API key and GitHub token go in the
git-ignored `tgcloud/lib/secrets.js` (copy `secrets.example.js`).

## Admins

Admins (`ADMIN_IDS`) get these commands in their own command menu. The same tools are in ⚙️ Settings → 👑 Admin dashboard.

| Command | |
|---|---|
| `/admin` | dashboard: last scheduler run, stats, alert history, groups and channels, a test alert, run the scheduler now |
| `/stats` | subscribers by type, alerts sent and queued, CVEs stored |
| `/broadcast [channel] <text>` | message every subscribed chat (or only channels). Queued like an alert, so it reaches everyone across runs |

Admins are also told when the bot is added to or removed from a group or channel.

## Deploy

```sh
npm install
cp secrets.example.js tgcloud/lib/secrets.js   # keys optional, the file is required
npx tgcloud login                              # link the project to @chsbrbot
npx tgcloud push                               # deploy code
npx tgcloud migrate                            # create the tables
npx tgcloud run endpoints/setup '{}'           # descriptions and command menus
npx tgcloud run endpoints/tick '{}'            # first run: records what's already out there
```

Then add the repository secret `CHSBRBOT_TGCLOUD_TOKEN` (the project's tgcloud token). The workflow runs
from the default branch only.

### Switching over from the Worker

1. Stop the Worker's cron so it can't send alerts alongside this bot: remove the `[triggers]` block from
   `worker/wrangler.toml` and run `npm run deploy` in `worker/`, or disable the trigger in the Cloudflare
   dashboard.
2. Deploy as above. `tgcloud push` points the bot's webhook at tgcloud, away from the Worker.
3. Copy the subscribers: `npx wrangler login` in `worker/`, then `node scripts/import-from-d1.mjs` here.
4. Once it works, delete `worker/` and the Worker in Cloudflare.
