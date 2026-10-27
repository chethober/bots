<h1 align="center">t2s</h1>

<p align="center">
  A Telegram bot that watches a forum's topics and files every posted track into a per-topic Spotify playlist.<br>
  Runs serverless on <a href="https://core.telegram.org/bots/serverless">Telegram Serverless (tgcloud)</a>, Telegram's platform for bots. No server to host.
</p>

<p align="center">
  @chtht2sbot · <a href="../LICENSE">MIT License</a>
</p>

---

The bot watches the topics of forum `-1002906907652`. Each topic gets its own Spotify playlist.

## Features

- **Recognized music:** Spotify track links and URIs; YouTube, Apple Music, Deezer, SoundCloud, Tidal and
  song.link links (resolved through song.link); and audio files (looked up by their title and performer tags).
- **New tracks:** added to the topic's playlist, and the post gets a 👌 reaction.
- **Duplicates:** if every track in a post is already in the topic's playlist, the post is deleted and the bot
  replies to the original post.
- **Unlinked topics:** the first track posted in a topic links it to the Spotify playlist with the same name,
  creating one if none exists. `/playlist <link>` overrides this.

Every playlist's description is `<topic>@chthbr`; it's set when a topic is linked and updated when the topic is renamed.

## Admins

All management happens in the **private chat with the bot** (admins only); commands posted in the forum are ignored.
Admins are forum admins plus the user ids in `ADMIN_IDS`.

| Command | What it does |
|---|---|
| `/start` | Help, and whether Spotify is connected |
| `/status` | Every topic's playlist link and track count |
| `/playlist <topic> <spotify playlist link>` | Link a topic to an existing playlist and import its tracks |
| `/dedupe <topic>` | Remove duplicate tracks from a topic's playlist, keeping the first position of each |
| `/reaction [on\|off\|<emoji>]` | Toggle the reaction on added posts, or change its emoji |
| `/spotify <refresh>` | Connect Spotify |

## Run your own

You need Node.js 18+ and a bot from [@BotFather](https://t.me/BotFather).

1. **Add the bot to the forum as an admin** with the *Delete messages* right. Admins receive every message even
   when privacy mode is on.
2. **Create a Spotify app** at https://developer.spotify.com/dashboard and add the redirect URI
   `http://127.0.0.1:8888/callback`.
3. **Deploy:**
   ```sh
   git clone https://github.com/chethober/bots && cd bots/chtht2sbot
   npm install
   cp secrets.example.js tgcloud/lib/secrets.js   # fill in the Spotify app's client id/secret
   export NODE_USE_ENV_PROXY=1                    # only needed behind an HTTP proxy
   npx tgcloud login                              # link the project to your bot
   npx tgcloud push                               # deploy code
   npx tgcloud migrate                            # apply schema.js changes
   npx tgcloud run endpoints/setup '{}'           # descriptions and admin command menus
   ```
4. **Connect Spotify.** Get a refresh token:
   ```sh
   node scripts/spotify-auth.mjs
   ```
   Then send the printed `/spotify …` command to the bot in a **private chat**. Only forum admins can do this,
   and the bot deletes the message after saving it.

Other settings (auto-deleting duplicates, the default reaction emoji, playlist visibility) are in
`tgcloud/lib/config.js`; the Spotify app credentials are in the git-ignored `tgcloud/lib/secrets.js`.

## How it works

```
tgcloud/
├── schema.js              tables: settings, topics, tracks
├── handlers/
│   ├── message.js         watches the forum's topics for music; admin commands in the private chat
│   └── callback_query.js  language selection and the ⚙️ Settings toggles
├── endpoints/
│   ├── setup.js           one-off: bot descriptions and admin commands
│   └── backfill.js        feeds old forum posts through the same logic as live posts
└── lib/
    ├── music.js           finds the Spotify tracks a message refers to
    ├── spotify.js         Spotify Web API client (stored refresh token)
    ├── panel.js           the private-chat home and ⚙️ Settings screens
    ├── screen.js          clean chat: home and screen messages
    ├── strings.js · i18n.js   translated texts
    └── config.js · settings.js
scripts/
├── spotify-auth.mjs       gets a Spotify refresh token
└── backfill.py            one-time: reads the forum's history with a user session and sends it to endpoints/backfill
```

See [`AGENTS.md`](AGENTS.md) for the platform's module rules and [`docs/tgcloud-sdk.md`](docs/tgcloud-sdk.md) for the SDK reference.

## Contributing

Issues and pull requests are welcome.

## License

[MIT](../LICENSE)
