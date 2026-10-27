<p align="center">
  <img src="assets/description.jpg" alt="anonm" width="480">
</p>

<h1 align="center">anonm</h1>

<p align="center">
  A personal anonymous-message link bot for Telegram — get a link, share it, receive anonymous messages and reply to them anonymously.<br>
  Runs serverless on <a href="https://core.telegram.org/bots/serverless">Telegram Serverless (tgcloud)</a>, Telegram's platform for bots. No server to host, no npm packages at runtime.
</p>

<p align="center">
  <a href="https://t.me/chthbrbot">Try it: @chthbrbot</a> · <a href="LICENSE">MIT License</a>
</p>

---

The bot speaks **Persian, English, Arabic, Russian and Spanish**, picked from the user's Telegram
language or the 🌐 Language button. Every user-facing string is in one file
([`tgcloud/lib/texts.js`](tgcloud/lib/texts.js)), one table per language.

The interface follows the [shared style](../README.md#how-they-work). Everything a user does is a button: a reply
keyboard (🎭 My link · 📊 Stats · ⚙️ Settings · 🌐 Language · 🔒 Privacy · 🔗 Source code) and inline buttons under
each screen. The chat stays clean: button taps are deleted, and each screen replaces the previous one. Slash commands
are only `/start` and the admin commands.

## Features

**For link owners**
- A personal deep link (`t.me/<bot>?start=<code>`) to put in a bio, a story or a group.
- A **QR code** of the link, generated in pure JS, for stories and print.
- Your own **invitation text**, shown to everyone who opens your link.
- Choose which **message kinds** you accept: text, photo, video, GIF, video note, voice, audio, sticker, file.
- **Reply anonymously** with a button or a native swipe-reply. Threads continue in both directions.
- **📣 Answer publicly**: post a question you received, with your answer and a button to your link, into any chat,
  group or channel (through inline mode). The question is read from the message when you tap the button and is never stored.
- **🔤 Hidden words**: your own list of words and phrases. Messages containing them are dropped silently (the sender
  is told it was delivered, as with a block).
- **🔧 Options**, each off by default:
  - 🙈 *Blur photos and videos*: photos, videos and GIFs arrive under a spoiler.
  - 🔐 *Protect my replies*: your replies are sent with `protect_content`, so they can't be forwarded or saved.
  - 👀 *Seen receipts*: bots get no read receipts, so "seen" means you did something in the bot's chat after the
    message arrived. The sender then finds a 👀 reaction on their message. Your own reaction replaces it.
  - ✍️ *Show when I reply*: tapping ↩️ Reply shows "typing…" in the sender's chat for a few seconds.
- **Reactions are mirrored** both ways. The bot is the one who reacts, so no identity leaks.
- **Block** a sender with one tap. **Unblock** from ⚙️ Settings → 🚫 Blocked senders, which shows each block by time only, never identity.
- **Report** a message. It is copied (not forwarded) to the bot's admins, who can ban the sender from the whole bot.
- Pause / resume receiving, and 📊 Stats: received today / this week, different senders, how many you answered,
  your busiest weekday, and what was filtered or hidden.
- 🔄 New link makes the old link stop working, for when it reached the wrong people.
- 🗑 Delete my data erases your data (see [Privacy](#privacy) for exactly what that covers).
- Inline mode: type `@<bot>` in any chat to share your link with your invitation, or with custom text.

**For senders**
- Any message kind the owner accepts. **Albums** are delivered as a whole.
- **Unsend** (within an hour by default): removes the message from the owner's chat.
- **Edit**: editing your message updates the owner's copy, within the same window.
- A **Send another** button, so you don't need to reopen the link.

**Safety**
- A keyword filter for text and captions ([`lib/filter.js`](tgcloud/lib/filter.js)), applied to edits as well.
  Each owner can add their own on top (🔤 Hidden words).
- **Automatic ban**: once `AUTO_BAN_REPORTERS` different owners (3 by default) have reported a sender, the sender is
  banned bot-wide. Admins get the report marked as an automatic ban, with an Unban button. Dismissed reports don't count.
- A blocked or banned sender gets the same answers as anyone else (*delivered*, *unsent*, filter notices), so a block can't be detected.
- An unfinished send, reply or edit expires after 30 minutes. An old pending send can't swallow an unrelated message days later.

**For admins** (the ids in `ADMIN_IDS`, see [Admins](#admins))
- Every report arrives with the reported message, the link owner, and how many earlier reports the same sender has, plus **Ban** / **Dismiss** buttons (or **Unban**, after an automatic ban). Admins never see the sender's identity.
- `/admin`: a bot-wide dashboard (users, new users, messages by status, replies, open reports, bans) with buttons for reports and bans.
- `/reports` resends the open reports, so a report you missed isn't lost.
- `/bans` lists bot-wide bans with unban buttons. `/ban <id>` and `/unban <id>` take a Telegram user id directly.
- `/broadcast` sends one message (any kind) to everyone who has used the bot, after a preview and a confirmation. Progress is stored, so an interrupted run resumes where it stopped and never sends to anyone twice. It is paced under Telegram's flood limits.
- The admin commands appear in the command menu only in admins' chats. For everyone else they don't exist.

## Buttons

| Button             | What it does                                                        |
|--------------------|---------------------------------------------------------------------|
| 🎭 My link         | Your link, with Share and QR code buttons                           |
| 📊 Stats           | Counts of received, replied, blocked, filtered                      |
| ⚙️ Settings        | Pause/resume, invitation text, message types, hidden words, options, QR code, blocked senders, new link, delete my data |
| 🌐 Language        | Persian, English, Arabic, Russian, Spanish                          |
| 🔒 Privacy         | What is stored                                                      |
| 🔗 Source code     | This repository                                                     |

A pending send, reply or edit has a ✖️ Cancel button. `/start` (with a code: start sending) is the
only user command.

## Admins

The ids in `ADMIN_IDS` get these commands in their own command menu:

| Command      | What it does                                       |
|--------------|----------------------------------------------------|
| `/admin`     | Bot-wide dashboard                                 |
| `/reports`   | Resend open reports with Ban / Dismiss buttons     |
| `/bans`      | List bot-wide bans and lift them                   |
| `/ban <id>` · `/unban <id>` | Ban / unban a Telegram user id      |
| `/broadcast` | Send a message to every user                       |

## Privacy

No message text, captions or media are stored. Telegram copies messages between chats directly.
The database holds Telegram ids, statuses, timestamps, the owner's first name, their own invitation text, hidden words and
option switches, plus each chat's language and the ids of the bot's two live menu messages (to delete stale ones).
The owner never sees the sender's id or name, and the client never sees it either (for example in callback data).
[`tgcloud/schema.js`](tgcloud/schema.js) is the complete list, and the bot's 🔒 Privacy button describes it to users.

Records of anonymous messages and their replies are deleted after `RETENTION_DAYS` (365 by default), unless a report
still points at them; dismissed reports go after the same time. The platform has no scheduler, so the cleanup
([`lib/retention.js`](tgcloud/lib/retention.js)) runs from the message handler, at most once an hour.

🗑 Delete my data removes the user's link, their settings, the messages they received, their replies, the blocks they made and the reports they filed.
Rows where the user is the **sender** are kept: messages they sent to others, and blocks, reports and bans against them. Those belong to the recipients and to moderation, and deleting them would let someone escape a ban.

## Run your own

You need Node.js 18+ and a bot from [@BotFather](https://t.me/BotFather).

```sh
git clone https://github.com/chethober/bots && cd bots/chthbrbot
npm install
npx tgcloud login            # link the project to your bot
```

1. Edit [`tgcloud/lib/config.js`](tgcloud/lib/config.js):
   - `BOT_USERNAME`: your bot's username. Set it to `'YOUR_BOT_USERNAME'` to look it up automatically.
   - `ADMIN_IDS`: the numeric Telegram user ids of the bot's admins (e.g. `[123456789]`), who receive reports and get the admin commands. Each admin must press Start in the bot first. `[]` turns report forwarding off.
   - Edit and unsend windows, state timeout, accepted kinds, the automatic-ban threshold (`AUTO_BAN_REPORTERS`)
     and how long message records are kept (`RETENTION_DAYS`).
2. Deploy, then create the database:
   ```sh
   npm run deploy               # = npx tgcloud push
   npx tgcloud migrate          # applies tgcloud/schema.js to the database
   ```
3. Set the bot's description (in every language), command menu (empty for users; the admin commands in admins' chats) and, optionally, its photo. Run it again after changing `ADMIN_IDS`:
   ```sh
   npx tgcloud run endpoints/setup "{ photo: '$(base64 -w0 assets/avatar.jpg)' }"
   ```
4. Optional but recommended: turn on inline mode in BotFather (`/setinline`) for `@<bot>` sharing and 📣 Answer publicly.
   Without it, 📣 sends the owner a question card to forward instead.
   The webhook is managed for you; `npx tgcloud webhook` checks it.

Deploying never touches the database. After changing `schema.js`, run `npx tgcloud migrate`.

## Tests

```sh
npm test      # unit tests for the pure modules (Node 22+), including that every language has every string
```

## How it works

```
tgcloud/
├── schema.js                  tables: users, messages, replies, blocks, reports, bans, broadcasts, states, chats
├── handlers/                  one module per Telegram update type
│   ├── message.js             keyboard buttons, /start, sending, replying, native replies, albums, admin commands
│   ├── edited_message.js      mirrors a sender's edit to the owner's copy
│   ├── callback_query.js      every inline button (reply/block/report, unsend, settings, admin, broadcast, …)
│   ├── message_reaction.js    mirrors reactions across the pair of chats
│   └── inline_query.js        @bot sharing and 📣 question-and-answer cards
├── endpoints/setup.js         one-off: applies the bot profile
└── lib/
    ├── delivery.js            the anonymous relay: send, album items, unsend, reply
    ├── users.js               owners, link codes, conversation state, data deletion
    ├── chats.js               each chat's language, clean chat (home + screen), the reply keyboard
    ├── manage.js              home, My link, QR code, Stats, Settings and its sub-screens
    ├── admin.js               reports, bans (and automatic bans), /admin dashboard, broadcasts
    ├── receipts.js            seen receipts (👀) and the typing indicator
    ├── answer.js              📣 Answer publicly: the inline query that carries the question
    ├── retention.js           deletes old message records (RETENTION_DAYS)
    ├── state.js               conversation state encoding
    ├── qr.js                  QR encoder + 1-bit PNG writer (no dependencies)
    ├── texts.js               all user-facing strings, one table per language
    ├── i18n.js                supported languages
    ├── config.js · filter.js · content.js · util.js
test/                          unit tests for the pure modules: npm test
```

Every relayed message exists twice: the original in one chat and the bot's `copyMessage` copy in the other.
The `messages` and `replies` tables map one to the other. That is what makes replies, reactions, edits and unsends work in both directions without storing any content.

See [`AGENTS.md`](AGENTS.md) for the platform's module rules and [`docs/tgcloud-sdk.md`](docs/tgcloud-sdk.md) for the SDK reference.

## Contributing

Issues and pull requests are welcome. Please keep the privacy guarantees intact:
- Never store message content.
- Never put a Telegram id in callback data.
- Update the privacy text in `texts.js` (every language) whenever `schema.js` changes.
- Run `npm test` before sending a change.

## License

[MIT](LICENSE)
