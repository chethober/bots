# Security policy

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's
[private vulnerability reporting](https://github.com/chethober/chthapibot/security/advisories/new)
for this repository. You'll get an answer within a few days.

Examples of what we'd like to hear about: ways to trigger the CLI-only endpoints (`tick`,
`healthcheck`, `setConfig`) without the project token, a group member changing a group's settings
without being an admin, HTML or Markdown injection into bot messages, or reading another chat's
data.

## Secrets

- The project token (`TGCLOUD_TOKEN`) only goes into your shell environment or a GitHub Actions
  secret; never commit it.
- Optional API keys (e.g. TMDB) and the admin chat ID are stored in the bot's database through
  `endpoints/setConfig`, not in the repository.
