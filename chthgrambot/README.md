<h1 align="center">Secretary</h1>

<p align="center">
  An AI secretary for Telegram Business: it answers your private chats on your behalf, with replies from Cloudflare Workers AI (free tier).<br>
  Runs serverless on <a href="https://core.telegram.org/bots/serverless">Telegram Serverless (tgcloud)</a>, Telegram's platform for bots. No server to host.
</p>

<p align="center">
  <a href="https://t.me/chthgrambot">Try it: @chthgrambot</a> · <a href="../LICENSE">MIT License</a>
</p>

---

**@chthgrambot is public**: anyone can use it for their own account. Press Start, connect your own free Cloudflare
Workers AI key with 🔑 Connect AI (the bot walks you through it), then add the bot in Telegram Settings → Telegram
Business → Chatbots. Each user's key, settings, chats and style are their own. Telegram Business needs Telegram Premium.

The bot uses **Telegram Business chatbot mode** ("secretary"). A Mini App panel lets you tune mood, emoji style,
temperature, length, language, knowledge, schedule and more.

In your private chat with the bot, the interface follows the [shared style](../README.md#how-they-work).
Everything is a button, in English, Persian, Arabic, Russian or Spanish (your Telegram language, or
🌐 Language): **📊 Status** (with pause/resume), **⚙️ Settings** (one-tap settings and the panel),
**🪞 Teach my style**, **🔑 Connect AI**, **🌐 Language**, **❓ Help** and **ℹ️ About** (🔗 Source code and ⭐ Tip the developer). `/start`
is the only command. Button taps are deleted and each screen replaces the previous one, so the chat
keeps only relayed messages and previews. Any other text gets a **preview** of how the secretary would
answer. The panel itself is in English.

## Features

### Panel options

| Section | Settings |
|---|---|
| Personality | mood (9 presets + custom), emoji style (none/minimal/balanced/expressive/kaomoji/old-school/custom set), reply length, formality, language (auto-detect or fixed), assistant name |
| Creativity | model, temperature, top-p, presence penalty, max tokens |
| Knowledge | facts about you, extra instructions, signature, AI label, fallback reply |
| Behavior | context memory, reply delay (with typing indicator and burst merging), stepping back after you reply yourself, quoting, marking as read, reply-hours window and time zone |
| Chats | mute single chats, resume paused chats, clear stored context |

### Speak as me: learning from chat exports

In the panel, choose Voice → **Speak as me**, then **📥 Import result.json**. To get the file: Telegram Desktop →
open a chat → ⋮ → Export chat history → JSON. The file is parsed in your browser. Only "their message → your
reply" pairs are uploaded, with links and phone/card numbers removed. For every incoming message, the bot shows
the model the most similar past exchanges (keyword match) plus random ones, and a style guide and samples.
Replies in this mode never get the 🤖 label.

### Photos, voice messages and files

The AI can't see or hear media. By default, non-text messages from contacts (photos, voice, video,
stickers, files, locations, contacts and so on) are **forwarded to you** in your chat with the bot, with
**✍️ Reply / 🤖 Let AI answer / 🙈 Ignore** buttons. Reply to one with anything: text, a photo, a voice
message, a sticker. The bot sends it to the contact from your account, quoting their message. You can
change this in the panel (Behavior → Photos, voice, files & stickers): forward to me, let the AI guess
from a description, or ignore.

## Run your own

You need Node.js 18+ and a bot from [@BotFather](https://t.me/BotFather).

1. **Create the bot.** In @BotFather, create a bot, then:
   - *Bot Settings → Business Mode → Turn on*
   - open the bot → *Serverless* → enable it
2. **Install and link:**
   ```sh
   git clone https://github.com/chethober/bots && cd bots/chthgrambot
   npm install
   npx tgcloud init      # adds .tgcloud/ state; it never overwrites existing files
   npx tgcloud login     # paste the app token from BotFather → Serverless
   ```
3. **Deploy:**
   ```sh
   npx tgcloud push      # deploys handlers, endpoints and the web/ panel; prints the Mini App URL
   npx tgcloud migrate   # creates the database tables
   ```
4. **Configure.** Put the printed Mini App URL (`https://app<id>.tgcloud.ai/`) in
   `PANEL_URL` in `tgcloud/lib/config.js`. Leave `ALLOWED_USER_IDS` empty for a public bot where every user brings
   their own Cloudflare key (like @chthgrambot), or list Telegram user IDs to keep yours private. Then run
   `npx tgcloud push` again.
5. **Connect Cloudflare AI.** Send `/start` to your bot, then tap **🔑 Connect AI**. The bot walks you through
   it with links: open the [Workers AI dashboard](https://dash.cloudflare.com/?to=/:account/ai/workers-ai)
   → **Use REST API** → paste the **Account ID** → **Create a Workers AI API Token** → paste the token.
   It deletes the token message, tests the key and saves it. The panel's *AI provider* section has the
   same guide and a manual form.
6. **Connect to your account.** In Telegram, go to *Settings → Telegram Business → Chatbots*, add your bot, and allow
   **Reply to messages**. (Optionally, allow **Mark messages as read** too.)

Deploying never touches the database. After updating, run `npx tgcloud migrate` (the `ui` table holds each chat's
language and live screens).

## How it works

- `handlers/business_connection.js` stores the connection and its rights.
- `handlers/business_message.js` → `lib/secretary.js`. Messages you send yourself are saved
  as context and pause the bot in that chat. Messages from contacts get an AI reply, sent
  with `business_connection_id`.
- `lib/relay.js` forwards non-text messages to you and delivers your answers back.
- `lib/ai.js` builds the system prompt from your settings. It calls
  `POST api.cloudflare.com/client/v4/accounts/{id}/ai/run/{model}`.
- `endpoints/*` are the panel's backend. The platform verifies Mini App init data before
  they run.
- Conversation context is stored in the bot's database. It is pruned after 7 days, and only
  messages from the last 3 days are sent to the model.

### Limits

- Telegram Serverless has no environment variables or secrets, so Cloudflare tokens are stored in
  the bot's database. `GLOBAL_CF_*` in `config.js` is an optional shared fallback, used
  only by users listed in `ALLOWED_USER_IDS`.
- The free tier allows 10,000 neurons per day, and the quota resets at 00:00 UTC. The 70B model
  costs the most per reply. Use Llama 3.1 8B or Gemma for high volume. When the quota runs out,
  the bot DMs you, at most once per hour.
- Telegram only lets business bots reply in chats that had an incoming message in the last 24 hours.

See [`AGENTS.md`](AGENTS.md) for the platform's module rules and [`docs/tgcloud-sdk.md`](docs/tgcloud-sdk.md) for the SDK reference.

## Contributing

Issues and pull requests are welcome.

## License

[MIT](../LICENSE)
