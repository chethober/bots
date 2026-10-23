# Cloudflare Worker CVE Telegram Notifier & Threat Intelligence Bot

A high-performance Cloudflare Worker and Telegram Bot (@chsbrbot) that automatically monitors the **NVD CVE API (v2.0)**, correlates zero-day intelligence (**CISA KEV**, **FIRST EPSS**, and active **GitHub PoCs**), and provides an interactive, button-driven Telegram interface for vulnerability alerts, searches, and threat lookups.

---

## Key Features

- **100% Dedicated Telegram Interface:** No web UI or custom domain needed. All interactions, queries, searches, and controls occur directly inside Telegram via interactive buttons and rich text cards.
- **Interactive Button Navigation:**
  - **Quick-Access Reply Keyboard:** Mobile-friendly persistent buttons for `[🔍 Search CVEs]`, `[🆕 Latest CVEs]`, `[🔥 Trending Exploits]`, `[📊 My Status]`, `[⚡ Quick Categories]`, and `[📖 Help]`.
  - **Inline Action Buttons on Alerts:** Every alert includes direct links to `[🌐 NVD Advisory]`, `[💻 GitHub PoCs]`, `[🔍 Full Details]`, and `[📤 Share]`.
  - **Paginated Search Engine:** Browse search results with `[⬅️ Prev]`, `[Page X]`, and `[Next ➡️]` buttons, plus individual buttons for each CVE.
  - **Interactive Callback Queries:** Instant message updates without spamming the chat; seamless transitions between search results, CVE deep dives, and administrative panels.
- **Real-Time Automated Alerting:** Cloudflare Cron Trigger executes every 10 minutes to scan for newly published High & Critical vulnerabilities (`CVSS >= MIN_CVSS_SCORE`).
- **Trending & Zero-Day Threat Detector:** Automatically tracks active exploits by correlating **CISA Known Exploited Vulnerabilities (KEV)**, **FIRST EPSS** probabilities, and verified **GitHub PoC repositories**.
- **On-Demand Search Engine (`/search` & `/find`):** Search CVEs by product, vendor, vulnerability keyword, or CWE bug type (e.g. `/search WordPress`, `/search Apache`, `/search RCE`, `/search SSRF`).
- **Direct CVE Lookup (`/cve`):** Instant lookup of any CVE (e.g. `/cve CVE-2024-3094`) with fallback across Cloudflare D1, local SQLite, and NVD REST API v2.0 with auto-caching.
- **Multi-Subscriber & Channel Support:** Users, groups, and Telegram channels can subscribe. Adding the bot as an administrator to any channel automatically activates broadcasts.
- **Cloudflare D1 Serverless Database:** Indexed SQLite storage (`cves`, `notified_alerts`, `subscribers`) for fast queries and deduplication.
- **Role-Based Administrator Dashboard:** Secure, button-driven management panel (`/admin`) for authorized admins with system stats, channel management, latency ping, and manual scan triggers.

---

## Telegram Bot Commands Reference

### Public Commands (All Users & Channels)

| Command | Description |
| :--- | :--- |
| `/start` | Welcome message, auto-subscribes chat, opens keyboard, and supports deep-linking (`/start CVE-XXXX`) |
| `/open` or `/menu` | Open / show the interactive buttons keyboard |
| `/close` or `/hide` | Collapse / minimize the buttons keyboard |
| `/search <query>` | Search vulnerabilities by keyword, software, or weakness (e.g. `/search Ivanti`) |
| `/cve <CVE-ID>` | View full security advisory card for a specific CVE (e.g. `/cve CVE-2024-3094`) |
| `/latest` | Display the newest vulnerabilities with interactive pagination and action buttons |
| `/trending` | Display active zero-day and KEV exploited threats |
| `/categories` | Browse vulnerabilities by threat category (RCE, Auth Bypass, SSRF, SQLi, File Upload) |
| `/status` | View personal subscription status with an inline Subscribe/Unsubscribe toggle |
| `/subscribe` | Subscribe chat or channel to automated alerts |
| `/unsubscribe` | Stop receiving notifications |
| `/channel` | Integration guide for connecting the bot to Telegram channels and groups |
| `/help` | Show complete command list and quick navigation shortcuts |
| `/about` | View detailed bot information, intelligence sources, and notification thresholds |

### Administrator Commands (Authorized Admin User IDs Only)

| Command | Description |
| :--- | :--- |
| `/admin` | Open the interactive button-driven Administrator Control Panel |
| `/admin setup` | Synchronize bot description, short description, and commands with Telegram API |
| `/admin stats` | Detailed subscriber breakdown (users, channels, groups) and database metrics |
| `/admin ping` | Check D1 database query latency and server health |
| `/admin trigger [all\|new\|trending]` | Force immediate scan and dispatch of alerts |
| `/admin history` | View recent dispatched alert log with timestamps |
| `/admin channel [list\|test\|add\|remove]` | View and manage connected channels |
| `/admin test` | Dispatch a rich test alert to your chat |
| `/broadcast <message>` | Send an announcement broadcast to all active subscribers |
| `/broadcast channel <message>` | Send an announcement broadcast to channels only |

---

### Telegram Profile & Commands Sync Tool
Sync bot description and command menu with Telegram Bot API in one command:
```bash
npm run bot:setup
```
Alternatively, trigger sync via HTTP endpoint: `GET /api/setup-bot` or via `/admin setup` inside Telegram.

---

## Setup & Deployment

### 1. Prerequisites
- **Node.js** (v18+)
- **Cloudflare Account** with Wrangler authorized (`npx wrangler login`)
- **Telegram Bot Token:** Create a bot via [@BotFather](https://t.me/BotFather) on Telegram and note the token.

### 2. Configure Cloudflare D1 Database
```bash
# 1. Create the D1 database
npm run d1:create

# 2. Update wrangler.toml with the database_id output by the command above

# 3. Initialize the database schema
npm run d1:init:remote
```

### 3. Configure Secrets & Environment
Set required credentials in Cloudflare's secure secrets storage:
```bash
# Telegram Bot API Token
npx wrangler secret put TELEGRAM_BOT_TOKEN

# Administrator Telegram User ID (comma-separated if multiple)
npx wrangler secret put TELEGRAM_ADMIN_ID

# (Optional) NVD API Key to increase API rate limits
npx wrangler secret put NVD_API_KEY
```

### 4. Deploy to Cloudflare Workers
```bash
npm run deploy
```

### 5. Set Up Telegram Webhook
Point Telegram's webhook to your deployed Cloudflare Worker endpoint:
```bash
curl -F "url=https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/webhook" \
  https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook
```
You can verify the webhook status at any time:
```bash
curl https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/getWebhookInfo
```

---

## Local Development & CLI Tools

### 1. Local Configuration (`.env`)
Create a `.env` file in the project root:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_ADMIN_ID=8028710032
TELEGRAM_CHAT_ID=8028710032
MIN_CVSS_SCORE=7.6
MIN_EPSS_SCORE=0.15
NVD_API_KEY=
```

### 2. Local CLI Utilities
```bash
# Query NVD and save CVEs to local SQLite database (data/cves.db)
npm run fetch-local

# Run trending intelligence check (CISA KEV, EPSS, GitHub PoCs)
npm run check-trending

# Dry-run trending check without sending Telegram alerts
npm run check-trending -- --dry-run
```
