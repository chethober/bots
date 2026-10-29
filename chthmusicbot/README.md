<h1 align="center">Music sync</h1>

<p align="center">
  A Telegram bot that syncs Spotify, YouTube Music and Apple Music playlists with groups, forum topics and channels, both ways.<br>
  Runs serverless on <a href="https://core.telegram.org/bots/serverless">Telegram Serverless (tgcloud)</a>, Telegram's platform for bots. No server to host.
</p>

<p align="center">
  @chthmusicbot · <a href="../LICENSE">MIT License</a>
</p>

---

Anyone can use it with their own accounts: connect a music service, pick a chat, pick a playlist.

## Features

- **🎧 Accounts.** Each user connects their own Spotify, YouTube Music or Apple Music. Spotify and Apple Music
  sign in through the bot's Mini App; YouTube Music with a code typed at google.com/device. Spotify users can
  also bring their own Spotify app's Client ID (the login page walks them through it), which gets around
  Spotify's per-app user limit.
- **➕ New sync.** Pick a group, forum or channel with Telegram's chat picker (the bot is added as an admin),
  then a playlist: one of yours, a new one named after the chat, or any playlist link. Forums sync as a whole,
  one playlist per topic (found by name or created), or a single topic (post `/sync` in it).
- **Directions.**
  - 💬 → 🎧 **Chat to playlist, live:** every track posted in the chat is added to the playlist and the post
    gets a 👌. Recognized: Spotify, YouTube / YouTube Music and Apple Music links; Deezer, SoundCloud, Tidal,
    Amazon Music and other links song.link knows; audio files (by their tags). Optionally, reposts of a track
    already in the playlist are deleted.
  - 🎧 → 💬 **Playlist to chat, on demand:** 🔄 Sync now posts the playlist's tracks the chat hasn't seen yet,
    20 at a time (Telegram's per-group flood limit), with a "Listen anywhere" song.link page, and its audio file
    from **@chethoberbot** follows as a reply (🎵 Audio files, on by default). When the sync is created you choose
    whether the tracks already there get posted too.
  - 🔄 **Both ways.**
- **❤️ ➕ 🎵 under every song the bot posts**, in groups, topics, channels and the private chat. They act for whoever
  taps them, on their own accounts: ❤️ Like saves the song to their liked songs on every service they connected
  (Spotify Liked Songs, a 👍 on YouTube Music, ❤️ and the library on Apple Music), ➕ Add opens the song in their
  private chat to add it to any of their playlists, 🎵 Audio gets the file from @chethoberbot and posts it under the
  song. Someone who hasn't connected an account is sent to the bot to do it.
- **⏮ Add old songs.** A sync only sees posts from after it was created, and a bot can't read a chat's history, so
  the user brings it: forward old posts to the bot (up to 100 at a time), or send the chat's history export
  (Telegram Desktop → ⋮ → Export chat history → JSON, no media → `result.json`). Their tracks are added to the
  playlist oldest first, skipping ones it has, and count for `/top`. An export is checked against the sync's chat
  and worked through 25 posts per ⏩ Continue. For a single forum topic only forwards work, since an export mixes
  every topic. Not available for "every topic" syncs.
- **🔗 My syncs.** Sync now, change the direction, toggle the reaction, repost deletion and audio files, add old
  songs, open or remove.
  Tracks that couldn't be added (an expired login, a quota) are retried by Sync now; the owner gets a private
  message when a sync fails (at most once an hour).
- **In groups, topics and channels** (anyone can use them; the bot answers in the same topic):
  - `/playlist` lists the playlists synced with the chat, with their track counts and 🎧 open buttons. In a forum's
    General topic it shows every topic's playlist.
  - `/top` ranks who posted the most tracks that made it into those playlists (a channel's signed posts count too).
  - `/random` posts a random track from one of them (once every 30 seconds per chat), with its audio.
  - `/song <name>` finds a song and posts it with its audio (once every 10 seconds per chat).
  - Tracks posted by 🔄 Sync now carry a 🎧 Open playlist button (except Apple Music library playlists, which
    only their owner can open).
- **🔎 Find music.** Send a song name, a link or an audio file in the private chat: its audio arrives from
  **@chethoberbot** (over bot-to-bot messages), and you can like it, add it to any of your playlists (synced ones
  also post it in their chat) or play it next on your Spotify. Songs are found by name with the iTunes Search API and mapped to each service by song.link.
- **🎶 Group player.** `/player` in a group shares the sender's Spotify: the card shows what's playing and
  what's next with ⏮ ⏯ ⏭ (host and admins). Anyone queues songs by posting a link or audio file, or with
  inline mode (`@chthmusicbot song name`, also behind the card's ➕ button).
- Five languages, buttons instead of commands, clean chat, ℹ️ About with ⭐ tips, like the other bots here.

### Limits

- **Spotify** apps in development mode only work for a few users the app's owner adds in the Spotify dashboard
  (Spotify gives the extended quota only to registered businesses). That's what the bring-your-own-app option is for.
  Controlling playback (the group player, "play next") needs Spotify Premium and an open Spotify device.
- **YouTube** gives a project 10,000 API units a day: adding a track costs 50 and a search 100, so roughly 200
  added tracks a day across all users. Tracks are matched through song.link first to save quota.
- **Apple Music** lets apps add tracks to library playlists but not remove them. A user's sign-in lasts about six
  months. MusicKit's sign-in popup can be blocked inside Telegram: the page then offers to finish in the browser.
- **No live audio:** bots can't join Telegram voice chats, so the group player controls the host's Spotify
  instead of streaming into the chat.
- **@chethoberbot** gets plain "Artist - Title" messages and its replies are copied back: everything to a private
  chat, only the file to a group or channel. A reply is matched to its request by `reply_to_message`, else by the
  file's title, else to the oldest open request (given up after 5 minutes). If it answers with buttons, those can't
  be pressed by a bot. Both bots need bot-to-bot communication on in @BotFather: otherwise Telegram refuses with
  `USER_BOT_TO_BOT_DISABLED` and the bot says it can't reach @chethoberbot.
- **❤️ Like on Spotify** needs the `user-library-modify` permission: accounts connected before it was added must be
  connected again (the bot says so).

## Run your own

You need Node.js 18+ and a bot from [@BotFather](https://t.me/BotFather). In BotFather, also turn on
**inline mode** (`/setinline`) and **bot-to-bot communication** (to reach @chethoberbot).

1. **Deploy:**
   ```sh
   git clone https://github.com/chethober/bots && cd bots/chthmusicbot
   npm install
   cp secrets.example.js tgcloud/lib/secrets.js   # fill in what you have (all optional)
   npx tgcloud login                              # link the project to your bot
   npx tgcloud push                               # deploy code and the Mini App (web/)
   npx tgcloud migrate                            # apply schema.js changes
   npx tgcloud run endpoints/setup '{}'           # descriptions and group commands
   ```
2. **Set the Mini App's address.** `push` prints it (`https://app<id>.tgcloud.ai`): put it in `MINIAPP_URL`
   in `tgcloud/lib/config.js` and push again.
3. **Services** (in `tgcloud/lib/secrets.js`; a service without credentials shows as unavailable):
   - **Spotify:** create an app at https://developer.spotify.com/dashboard with the redirect URI
     `<MINIAPP_URL>/callback` and the Web API, and set `SPOTIFY_CLIENT_ID` (no secret: the login uses
     PKCE). Add your testers' Spotify emails under *User Management*. Without it, users bring their own app.
   - **YouTube Music:** in Google Cloud, enable the *YouTube Data API v3* and create an OAuth client of type
     *TVs and Limited Input devices*; set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
   - **Apple Music:** needs an Apple Developer account. Create a key with MusicKit enabled, then
     `node scripts/apple-token.mjs AuthKey_XXXX.p8 <KEY_ID> <TEAM_ID>` and set `APPLE_MUSIC_DEVELOPER_TOKEN`
     (renew it every 6 months).
   - **song.link:** works without a key (10 requests a minute); `SONGLINK_API_KEY` raises the limit.

CI deploys `main` when the repository secret `CHTHMUSICBOT_TGCLOUD_TOKEN` is set, writing `secrets.js` from
the optional `CHTHMUSICBOT_SPOTIFY_CLIENT_ID`, `CHTHMUSICBOT_GOOGLE_CLIENT_ID`, `CHTHMUSICBOT_GOOGLE_CLIENT_SECRET`,
`CHTHMUSICBOT_APPLE_MUSIC_DEVELOPER_TOKEN` and `CHTHMUSICBOT_SONGLINK_API_KEY` secrets.

## How it works

```
tgcloud/
├── schema.js                 accounts, logins, chats, topics, links, link_tracks, backfill_items, drafts, finds, songs, relays, players
├── handlers/
│   ├── message.js            private chat (buttons, wizard, find), group posts and commands, @chethoberbot replies
│   ├── channel_post.js       channel posts feed the channel's syncs; channel commands
│   ├── callback_query.js     every inline button
│   ├── inline_query.js       "@bot song" search
│   ├── my_chat_member.js     added to / removed from a chat
│   └── pre_checkout_query.js ⭐ tips
├── endpoints/
│   ├── getState.js · spotifyStart.js · spotifyFinish.js · appleStart.js · appleFinish.js   the Mini App's logins
│   └── setup.js              one-off: descriptions and group commands
└── lib/
    ├── providers/            spotify.js · youtube.js · apple.js: one shape (playlists, search, links, player)
    ├── sync.js               links: chat → playlist on post, playlist → chat on Sync now
    ├── chatcmds.js           /playlist, /top, /random and /song in groups, topics and channels
    ├── tracks.js · songlink.js · itunes.js   recognizing songs and matching them across services
    ├── songs.js              posted songs and their ❤️ ➕ 🎵 buttons (handled in find.js)
    ├── backfill.js           ⏮ Add old songs: forwarded posts and chat exports
    ├── wizard.js · views.js · find.js · player.js · relay.js · login.js
    └── accounts.js · chats.js · drafts.js · http.js · errors.js · strings.js · i18n.js · screen.js · tips.js
web/
├── index.html                Mini App: Spotify (PKCE, own-app option) and Apple Music (MusicKit JS) sign-in
└── callback.html             Spotify's redirect target
scripts/apple-token.mjs       makes the Apple Music developer token
```

The platform has no cron, so nothing runs on a timer: chat → playlist reacts to posts, and playlist → chat runs
when someone taps 🔄 Sync now. `link_tracks` remembers every track a sync has seen on either side, so nothing
is added or posted twice.

See [`AGENTS.md`](AGENTS.md) for the platform's module rules and [`docs/tgcloud-sdk.md`](docs/tgcloud-sdk.md) for the SDK reference.

## License

[MIT](../LICENSE)
