<p align="center">
  <img src="assets/description.jpg" alt="anonm" width="480">
</p>

<h1 align="center">anonm</h1>

<p align="center">
  A personal anonymous-message link bot for Telegram — get a link, share it, receive anonymous messages and reply to them anonymously.<br>
  Runs serverless on <a href="https://cloud.telegram.org">tgcloud</a>, Telegram's platform for bots. No server, no npm packages at runtime.
</p>

<p align="center">
  <a href="https://t.me/chthbrbot">Try it: @chthbrbot</a> · <a href="LICENSE">MIT License</a>
</p>

---

The bot's interface is in **Persian**. Every user-facing string is in one file
([`tgcloud/lib/texts.js`](tgcloud/lib/texts.js)), so translating it doesn't touch any logic.

## Features

**For link owners**
- A personal deep link (`t.me/<bot>?start=<code>`) to put in a bio, a story or a group.
- A **QR code** of the link (`/qr`), generated in pure JS, for stories and print.
- Your own **invitation text** (`/text`), shown to everyone who opens your link.
- Choose which **message kinds** you accept (`/types`): text, photo, video, GIF, video note, voice, audio, sticker, file.
- **Reply anonymously** with a button or a native swipe-reply. Threads continue in both directions.
- **Reactions are mirrored** both ways. The bot is the one who reacts, so no identity leaks.
- **Block** a sender with one tap. **Unblock** from `/blocked`, which shows each block by time only, never identity.
- **Report** a message. It is copied (not forwarded) to the bot's admins, who can ban the sender from the whole bot.
- `/pause` / `/resume`, `/stats`.
- `/newlink` makes the old link stop working, for when it reached the wrong people.
- `/delete` erases your data (see [Privacy](#privacy) for exactly what that covers).
- Inline mode: type `@<bot>` in any chat to share your link with your invitation, or with custom text.

**For senders**
- Any message kind the owner accepts. **Albums** are delivered as a whole.
- **Unsend** (within an hour by default): removes the message from the owner's chat.
- **Edit**: editing your message updates the owner's copy, within the same window.
- A **Send another** button, so you don't need to reopen the link.

**Safety**
- A keyword filter for text and captions ([`lib/filter.js`](tgcloud/lib/filter.js)), applied to edits as well.
- A blocked or banned sender gets the same answers as anyone else (*delivered*, *unsent*, filter notices), so a block can't be detected.
- An unfinished send, reply or edit expires after 30 minutes. An old pending send can't swallow an unrelated message days later.

**For admins** (the ids in `ADMIN_IDS`)
- Every report arrives with the reported message, the link owner, and how many earlier reports the same sender has, plus **Ban** / **Dismiss** buttons. Admins never see the sender's identity.
- `/admin`: a bot-wide dashboard (users, new users, messages by status, replies, open reports, bans) with buttons for reports and bans.
- `/reports` resends the open reports, so a report you missed isn't lost.
- `/bans` lists bot-wide bans with unban buttons. `/ban <id>` and `/unban <id>` take a Telegram user id directly.
- `/broadcast` sends one message (any kind) to everyone who has used the bot, after a preview and a confirmation. Progress is stored, so an interrupted run resumes where it stopped and never sends to anyone twice. It is paced under Telegram's flood limits.
- The admin commands appear in the command menu only in admins' chats. For everyone else they don't exist.

## Privacy

No message text, captions or media are stored. Telegram copies messages between chats directly.
The database holds Telegram ids, statuses, timestamps, the owner's first name and their own invitation text.
The owner never sees the sender's id or name, and the client never sees it either (for example in callback data).
[`tgcloud/schema.js`](tgcloud/schema.js) is the complete list, and the bot's `/privacy` command describes it to users.

`/delete` removes the user's link, their settings, the messages they received, their replies, the blocks they made and the reports they filed.
Rows where the user is the **sender** are kept: messages they sent to others, and blocks, reports and bans against them. Those belong to the recipients and to moderation, and deleting them would let someone escape a ban.

## Commands

| Command    | What it does                                       |
|------------|----------------------------------------------------|
| `/start`   | Get your link (or, with a code, start sending)     |
| `/text`    | Set your invitation text                           |
| `/types`   | Choose which kinds of messages you accept          |
| `/qr`      | QR code of your link                               |
| `/pause` · `/resume` | Stop / resume receiving                  |
| `/blocked` | List blocked senders and unblock them              |
| `/stats`   | Counts of received, replied, blocked, filtered     |
| `/newlink` | Replace your link; the old one stops working       |
| `/privacy` | What is stored                                     |
| `/delete`  | Delete your data                                   |
| `/cancel`  | Cancel a pending send, reply or edit               |

Admin only:

| Command      | What it does                                       |
|--------------|----------------------------------------------------|
| `/admin`     | Bot-wide dashboard                                 |
| `/reports`   | Resend open reports with Ban / Dismiss buttons     |
| `/bans`      | List bot-wide bans and lift them                   |
| `/ban <id>` · `/unban <id>` | Ban / unban a Telegram user id      |
| `/broadcast` | Send a message to every user                       |

## Run your own

You need Node.js 18+ and a bot from [@BotFather](https://t.me/BotFather).

```sh
git clone https://github.com/chethober/anonm && cd anonm
npm install
npx tgcloud login            # link the project to your bot
```

1. Edit [`tgcloud/lib/config.js`](tgcloud/lib/config.js):
   - `BOT_USERNAME`: your bot's username. Set it to `'YOUR_BOT_USERNAME'` to look it up automatically.
   - `ADMIN_IDS`: the numeric Telegram user ids of the bot's admins (e.g. `[123456789]`), who receive reports and get the admin commands. Each admin must press Start in the bot first. `[]` turns report forwarding off.
   - Edit and unsend windows, state timeout and accepted kinds.
2. Deploy, then create the database:
   ```sh
   npm run deploy               # = npx tgcloud push
   npx tgcloud migrate          # applies tgcloud/schema.js to the database
   ```
3. Set the bot's description, command menu (plus the admin commands in admins' chats) and, optionally, its photo. Run it again after changing `ADMIN_IDS`:
   ```sh
   npx tgcloud run endpoints/setup "{ photo: '$(base64 -w0 assets/avatar.jpg)' }"
   ```
4. Optional: turn on inline mode in BotFather (`/setinline`) for `@<bot>` sharing.
   The webhook is managed for you; `npx tgcloud webhook` checks it.

Deploying never touches the database. After changing `schema.js`, run `npx tgcloud migrate`.

## How it works

```
tgcloud/
├── schema.js                  tables: users, messages, replies, blocks, reports, bans, broadcasts, states
├── handlers/                  one module per Telegram update type
│   ├── message.js             commands, sending, replying, native replies, albums
│   ├── edited_message.js      mirrors a sender's edit to the owner's copy
│   ├── callback_query.js      every inline button (reply/block/report, unsend, admin, broadcast, …)
│   ├── message_reaction.js    mirrors reactions across the pair of chats
│   └── inline_query.js        @bot sharing
├── endpoints/setup.js         one-off: applies the bot profile
└── lib/
    ├── delivery.js            the anonymous relay: send, album items, unsend, reply
    ├── users.js               owners, link codes, conversation state, /delete
    ├── manage.js              /qr and /blocked
    ├── admin.js               reports, bans, /admin dashboard, broadcasts
    ├── qr.js                  QR encoder + 1-bit PNG writer (no dependencies)
    ├── texts.js               all user-facing strings (Persian)
    ├── config.js · filter.js · content.js · util.js
```

Every relayed message exists twice: the original in one chat and the bot's `copyMessage` copy in the other.
The `messages` and `replies` tables map one to the other. That is what makes replies, reactions, edits and unsends work in both directions without storing any content.

See [`AGENTS.md`](AGENTS.md) for the platform's module rules and [`docs/tgcloud-sdk.md`](docs/tgcloud-sdk.md) for the SDK reference.

## Contributing

Issues and pull requests are welcome. Please keep the privacy guarantees intact:
- Never store message content.
- Never put a Telegram id in callback data.
- Update `/privacy` in `texts.js` whenever `schema.js` changes.

## License

[MIT](LICENSE)
