<h1 align="center">Community VPN</h1>

<p align="center">
  A Telegram bot for sharing VPNs with a community: a public directory, private invites with optional passwords,
  and anonymous memberships. Works best with <a href="https://github.com/chethober/xtune">xtune</a>, where every member gets their own account.<br>
  Runs serverless on <a href="https://cloud.telegram.org">tgcloud</a>, Telegram's platform for bots. No server, no npm packages at runtime.
</p>

<p align="center">
  <a href="https://github.com/chethober/xtune">xtune</a> · <a href="LICENSE">MIT License</a>
</p>

---

People who run a VPN server share it here, and people who need one join it. The bot sits in between: owners never
learn who their members are, and members never learn who the owner is.

The bot speaks **English, Persian, Arabic, Russian and Spanish**, picked from the user's Telegram language or the
🌐 Language button. Every user-facing string is in one file ([`tgcloud/lib/texts.js`](tgcloud/lib/texts.js)).
Everything is a button: a reply keyboard (🌍 Directory · 📂 My VPNs · ➕ Add VPN · 🛠 My servers · 🌐 Language ·
ℹ️ About) and inline buttons under each screen. Button taps are deleted, and each screen replaces the previous one.
Slash commands are only `/start` and the admin commands.

## Three kinds of VPN

| Kind | What the owner sends | What a member gets |
|---|---|---|
| ⭐ **xtune public profile** | the connect link from `xtune public add NAME` | **their own account** on the server, with its own subscription link, quota and expiry |
| 📡 Subscription | any subscription URL (Marzban, 3x-ui, Hiddify, …) | the same subscription URL as everyone else |
| 🔗 Share links | `vless://`, `hysteria2://`, `ss://`, … links, up to 20 | the same links as everyone else |

### Why xtune works best

[xtune](https://github.com/chethober/xtune) finds the Xray configs that get through *your* network, deploys them and
manages users on the server. Its **public profiles** are made for this bot:

```sh
# on the server
xtune sub enable                                               # the connect link lives on the subscription server
xtune public add community --quota 20 --days 30 --devices 2 --members 100
# → connect link: https://cdn.example.com:2053/<path>/pub/<token>
```

Send the connect link to ➕ Add VPN. When someone joins, the bot asks the server for a new user named
`community-<random label>` with the pool's limits, and hands the member that user's own subscription link (with a QR
code and xtune's usage page). As a result:

- **One member can be removed** without touching anyone else. The others' links keep working.
- **Limits are per member**: quota, expiry, devices and usage resets all work as for any xtune user, and with
  `xtune peers` every server's configs are in each member's subscription.
- **The server holds no Telegram identity.** It gets only the random label. The owner sees labels with each
  member's usage and expiry in 👥 Members.
- **The member cap is enforced by the server**, which also limits joins to 30 a minute per pool, so a leaked connect
  link can't flood it. `xtune public token community` rotates the link (send the new one with 🔗 Connect link),
  `xtune public pause` stops new joins, and `xtune public del` removes the pool and its users.

With shared subscriptions or links, everyone has the same credentials. Removing a member only takes them out of the
bot, and they keep whatever they copied. To cut them off, the owner has to change the links.

## Features

**For members**
- 🌍 **Directory** of public VPNs, sorted by free slots: country, protocols, members/slots, per-member limits, and
  when the server last answered.
- **Invite links** (`t.me/<bot>?start=<code>`) for any VPN, public or private. Private VPNs can ask for a
  **password**. The message with the password is deleted at once, and 5 wrong tries lock that person out of that
  VPN for an hour.
- Connection details arrive as a message that stays in the chat: a QR code of the subscription link, or the links
  as text. 📂 My VPNs shows them again. For xtune, asking again also renews a member whose time ran out.
- 🚪 Leave (for xtune this deletes the user on the server) and 🚩 Report (illegal use, scam or selling, doesn't work).

**For owners**
- ➕ Add VPN: send the source, name it, pick a country, choose public or private, and optionally set a password.
  Up to 10 VPNs per owner.
- 🛠 My servers, per VPN: name, description, country, public/private, password, 👥 Members (labels only; tap one to
  remove that member for good), 📢 Announce (text to every member, once per 10 minutes), 🔗 replace the
  source (members of shared VPNs are told to get the new links), 🔍 Check now, ⏸ Pause (hidden, no new
  members), 🔄 New invite link, 🗑 Delete.
- Health checks every 30 minutes. After 3 failures in a row a VPN is hidden from the directory and its owner is told;
  it comes back by itself when a check passes. The bot checks from tgcloud's network, so a pass means "the server
  answers", not "it works where you are". Share links can't be checked and say so.

**For admins** (the ids in `ADMIN_IDS`)
- Reports arrive with the VPN's details and **Unlist** / **Delete** / **Ban owner** / **Dismiss** buttons. Admins
  don't see who reported it. Banning an owner deletes their VPNs (members are told) and stops them adding more.
- `/admin`: counts of VPNs, owners, memberships, open reports and bans. `/reports` resends the open reports.

## Privacy

- The database holds Telegram ids, each person's language, the VPNs they added or joined, a random label per
  membership, hashed passwords (PBKDF2-SHA256), reports and the bot's two live menu messages per chat.
  [`tgcloud/schema.js`](tgcloud/schema.js) is the complete list.
- **Owners see members only as labels.** Members see a VPN's card, never its owner. Callback data carries row ids,
  never Telegram ids.
- An xtune connect link is a secret (whoever has it can add users), so the bot deletes the message it came in and
  never shows it to anyone, admins included.
- Only use VPNs you trust: the owner of a server can see traffic that isn't otherwise encrypted. The bot's
  ℹ️ About button says so.

## Run your own

You need Node.js 18+ and a bot from [@BotFather](https://t.me/BotFather).

```sh
git clone https://github.com/chethober/bots && cd bots/chthvpnbot
npm install
npx tgcloud login            # link the project to your bot
```

1. Edit [`tgcloud/lib/config.js`](tgcloud/lib/config.js): `BOT_USERNAME` (or leave the placeholder to look it up),
   `ADMIN_IDS` (each admin must press Start in the bot first), and the limits (VPNs per owner, password lockout,
   health checks).
2. Deploy, then create the database:
   ```sh
   npm run deploy               # = npx tgcloud push
   npx tgcloud migrate          # applies tgcloud/schema.js to the database
   ```
3. Set the bot's description in every language and the admin command menu. Pass a JPEG as `photo` to set the
   profile photo too:
   ```sh
   npx tgcloud run endpoints/setup '{}'
   npx tgcloud run endpoints/setup "{ photo: '$(base64 -w0 avatar.jpg)' }"
   ```
4. Health checks: the platform has no cron, so
   [`.github/workflows/chthvpnbot-tick.yml`](../.github/workflows/chthvpnbot-tick.yml) runs
   `npx tgcloud run endpoints/tick '{}'` every 30 minutes. Add the repository secret `CHTHVPNBOT_TGCLOUD_TOKEN`
   (the project's tgcloud token). Without it, VPNs are checked only when added or on 🔍 Check now.

Deploying never touches the database. After changing `schema.js`, run `npx tgcloud migrate`.

`npm test` checks the password hashing against `node:crypto`, the link parsing, that every module's imports line
up, and that every text key exists in all five languages.

## How it works

```
tgcloud/
├── schema.js              tables: vpns, members, tries, reports, bans, chats, states
├── handlers/
│   ├── message.js         keyboard buttons, /start (invites), prompts (add, edits, password, announce), admin commands
│   └── callback_query.js  every inline button
├── endpoints/
│   ├── setup.js           one-off: bot descriptions and admin commands
│   └── tick.js            health checks, run every 30 minutes from GitHub Actions
└── lib/
    ├── flows.js           invites, joining with a password, the add wizard, owner edits, announcements
    ├── members.js         join / connection details / leave / kick, notifying members
    ├── xtune.js           the xtune connect link's API: info, join, leave
    ├── check.js           health checks
    ├── sources.js         recognising connect links, subscriptions and share links; protocols; flags
    ├── hash.js            SHA-256 and PBKDF2 in plain JS
    ├── store.js           the tables: VPNs, memberships, password tries, reports, bans, conversation state
    ├── views.js           the screens
    ├── chats.js           each chat's language, clean chat, the reply keyboard
    ├── texts.js           all user-facing strings: each language's words, and the screens composed from them
    ├── admin.js · qr.js · i18n.js · config.js · util.js
```

The xtune side is the `public` command and the `/<path>/pub/<token>` routes on xtune's subscription server
([`public.go`](https://github.com/chethober/xtune/blob/main/public.go)):

| Request | Answer |
|---|---|
| `GET <connect link>` | the pool: name, paused, active/max members, protocols, limits, and each member's label, status, usage and expiry |
| `POST <connect link>/join` `{"label"}` | that member's user (created, or the same one again): subscription link, failover config, quota, expiry |
| `POST <connect link>/leave` `{"label"}` | removes that member's user |

Labels are 4 to 16 lowercase letters and digits. A pool can only add and remove its own members.

See [`AGENTS.md`](AGENTS.md) for the platform's module rules and [`docs/tgcloud-sdk.md`](docs/tgcloud-sdk.md) for the SDK reference.

## Contributing

Issues and pull requests are welcome. Please keep the privacy guarantees intact:
- Owners never see a member's Telegram identity, and members never see the owner's.
- Never put a Telegram id in callback data, and never send an xtune connect link to anyone.
- Update the privacy text in `texts.js` (every language) whenever `schema.js` changes.

## License

[MIT](LICENSE)
