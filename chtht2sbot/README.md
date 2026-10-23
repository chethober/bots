# t2s — Telegram topics → Spotify playlists

Serverless Telegram bot (@chtht2sbot) running on Telegram Serverless (tgcloud).
It watches the topics of forum `-1002906907652`. Each topic gets its own Spotify playlist.

- **Recognized music:** Spotify track links and URIs; YouTube, Apple Music, Deezer, SoundCloud, Tidal and song.link links (resolved through song.link); and audio files (looked up by their title and performer tags).
- **New tracks:** added to the topic's playlist, and the post gets a 👌 reaction.
- **Duplicates:** if every track in a post is already in the topic's playlist, the post is deleted and the bot replies to the original post.
- **Unlinked topics:** the first track posted in a topic links it to the Spotify playlist with the same name, creating one if none exists. `/playlist <link>` overrides this.

## One-time setup

1. **Add the bot to the forum as an admin** with the *Delete messages* right. Admins receive every message even when privacy mode is on.
2. **Create a Spotify app** at https://developer.spotify.com/dashboard and add the redirect URI `http://127.0.0.1:8888/callback`.
3. Copy `secrets.example.js` to `tgcloud/lib/secrets.js` and fill in the app's client id/secret, then get a refresh token:
   ```
   node scripts/spotify-auth.mjs
   ```
   Then send the printed `/spotify …` command to the bot in a **private chat**. Only forum admins can do this, and the bot deletes the message after saving it.

## Commands

All management happens in the **private chat with the bot** (admins only); commands posted in the forum are ignored.

| Command | |
|---|---|
| `/start` | help, and whether Spotify is connected |
| `/status` | every topic's playlist link and track count |
| `/playlist <topic> <spotify playlist link>` | link a topic to an existing playlist and import its tracks |
| `/dedupe <topic>` | remove duplicate tracks from a topic's playlist, keeping the first position of each |
| `/reaction [on\|off\|<emoji>]` | toggle the reaction on added posts, or change its emoji |
| `/spotify <refresh>` | connect Spotify |

Every playlist's description is `<topic>@chthbr`; it's set when a topic is linked and updated when the topic is renamed.

Admins are forum admins plus the user ids in `ADMIN_IDS`. Other settings (auto-deleting duplicates, the default reaction emoji, playlist visibility) are in `tgcloud/lib/config.js`; the Spotify app credentials are in the git-ignored `tgcloud/lib/secrets.js`.

## Deploy

```
export NODE_USE_ENV_PROXY=1          # only needed behind an HTTP proxy
npx tgcloud login                    # app token: app8767992285:…
npx tgcloud push                     # deploy code
npx tgcloud migrate                  # apply schema.js changes
```
