# @easykol/cli

Command-line client for the EasyKOL API. Drives KOL discovery from agent skills
(or your shell). Talks to `https://easykol.com/external/v1/*` with an EasyKOL API key.

## Install

```bash
npm install -g @easykol/cli@latest
easykol schema --all   # verify the command tree
```

## Authenticate

The API uses a key + email pair (`ek-api-key` / `ek-api-email`). Configure once:

```bash
# preferred — keeps the key out of shell history
printf '%s' "$EASYKOL_API_KEY" | easykol auth --key-stdin --email you@example.com

# or directly
easykol auth --key ek_xxx --email you@example.com
```

Config is stored at `~/.easykol/config.json` (mode 600). Override the base URL with
`--api-base` if needed.

## Commands (v0.1.0 — core loop)

| Command            | Billing  | What it does                                              |
|--------------------|----------|-----------------------------------------------------------|
| `doctor`           | free     | CLI version, config, API connectivity                     |
| `auth`             | free     | save API key + email                                      |
| `quota`            | free     | remaining credits / plan *(backend endpoint pending)*     |
| `schema [command]` | free     | full command tree, or one command's parameters            |
| `exit-codes`       | free     | list exit codes                                           |
| `parse`            | free     | preview a search: tags + keywords + estimated total       |
| `more-words`       | free     | suggest more keywords (excludes ones already shown)       |
| `search`           | 1 quota  | run the search, return matching creators                  |

### Discovery workflow

```bash
# 1. preview (no charge) — see tags, keywords, estimated reach
easykol parse --sentence "tech product review channels" --platform YOUTUBE

# 2. (optional) get more keywords
easykol more-words --sentence "tech product review channels" --platform YOUTUBE --exclude "tech review,unboxing"

# 3. run the search (consumes quota) with confirmed tags/keywords
easykol search --sentence "tech product review channels" --platform YOUTUBE \
  --keywords "tech review,gadget review" --limit 20 --regions US,GB
```

## Output

Every command prints JSON:

```json
{ "status": "ok", "data": { }, "action": { "url": "…", "hint": "…" } }
```

`action` appears only when you must do something (top up, authenticate). On failure:
`{ "status": "error", "error": { "code": <exit>, "message": "…" } }` and the process
exits with that code (see `easykol exit-codes`).

## Exit codes

`0` ok · `1` generic · `2` unauthenticated · `3` quota insufficient · `4` forbidden ·
`5` network · `6` bad parameters · `7` rate limited
