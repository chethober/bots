# Contributing

Thanks for helping! Bug reports, new data sources and new hub features are all welcome.

## Before you start

- Read [AGENTS.md](AGENTS.md) for the platform's module rules: relative imports end in `.js`,
  there are no npm packages at runtime, and every DB call is `await`ed.
- Read the "Runtime facts" section of the [README](README.md): no `setTimeout` or `URL`, fetches
  are aborted after about 5 s, and a run gets about 3 s of CPU and about 30 s of wall time.
- New upstream APIs must be free, need no key (or have an optional key stored with
  `endpoints/setConfig`), and work **from the platform**. Add a probe to `tgcloud/lib/health.js`
  and run `npx tgcloud run endpoints/healthcheck '{}'` to confirm that.

## Code layout and conventions

- Each hub lives in `tgcloud/lib/hubs/<hub>.js` and exports `commands`, `callbacks` (keyed by a
  short callback prefix), `inputs` (answers to `ask()` prompts) and a `home` menu. Register it in
  `lib/hubs/index.js`.
- Callback data must fit Telegram's 64-byte limit; use `fits()` from `lib/ui.js` for anything
  built from external ids.
- Everything from an external API goes through `esc()` before it goes into an HTML message.
- Navigation menus use `menu()`: a reply keyboard in private chats, inline buttons in groups.
  Each label's action is remembered per chat, so labels must be unique within one menu. Lists and
  item screens use `show()` (edit in place when pressed from an inline button); content cards use
  `send()` (new message).
- Anything that changes chat state calls `requireManage(ctx)` first (group admins only).
- New notification kinds use `registerKind()`; scheduled pushes use `registerSchedule()`.
- Match the surrounding style: small functions, short comments explaining *why*.

## Testing your change

1. Copy `scripts/e2e.js` to `tgcloud/endpoints/zz_e2e.js` and add scenarios for your feature.
2. Run the parts against your own bot (see the header of `scripts/e2e.js`).
3. **Delete `tgcloud/endpoints/zz_e2e.js` before `tgcloud push`**; it must not be deployed.

## Pull requests

- Keep each PR focused, and say how you tested it (which e2e parts, plus a screenshot from
  Telegram if the UI changed).
- Never commit tokens, API keys or chat IDs. Configuration lives in the bot's database.
