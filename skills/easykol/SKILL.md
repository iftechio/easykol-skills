---
name: easykol
description: >-
  Use when the user wants to discover creators / KOLs / influencers on YouTube,
  TikTok, or Instagram — e.g. "find tech reviewers on YouTube", "who makes skincare
  content on TikTok", "find creators in the US with 100k+ followers". Drives the
  `easykol` CLI to preview a search (tags, keywords, estimated reach) for free, then
  run it for results.
metadata:
  requires: easykol
  install: npm install -g @easykol/cli@latest
  version: 0.1.0
---

# EasyKOL

EasyKOL discovers creators (KOLs / influencers) on YouTube, TikTok, and Instagram.
This skill drives the `easykol` CLI on the user's behalf — the user describes who they
want in natural language, and you run the right commands and report the results.

## When to Use

- **Discover creators** — "find tech YouTubers in the US with 100k–500k subscribers",
  "who makes skincare content on TikTok", "Instagram fitness creators in the UK".
- **Preview before spending** — show the user the canonical tags, keywords, and
  estimated reach (free) before running the billed search.

## What This Skill Does Not Do

- It does **not** post content, send DMs, or scrape platforms — all data comes from
  the EasyKOL backend.
- It does **not** work in ChatGPT (no CLI execution environment). Use Claude Code,
  Cursor, or Codex.
- It does **not** guess or invent creator data. If the CLI returns nothing, say so.
- Profile / audience / contacts / lookalikes are **not in v0.1.0** — see Roadmap.

## Core Principles (Agent Behavior)

1. **Agent-first, silent execution.** The user does not run the CLI — you do. Run
   commands yourself and report the *results* in plain language. Don't paste raw
   commands at the user unless they ask.
2. **Never expose the API key.** The key never appears in a command argument, in
   logs, or in your messages. Configure it once via `easykol auth --key-stdin`.
3. **Preview before you spend.** Discovery is two-phase: `parse` / `more-words` are
   **free** and let the user confirm tags/keywords/reach; `search` **costs quota**.
   Always run `parse` first, show the user, get a thumbs-up, then `search`.
4. **Surface quota honestly.** On `exit code 3` (quota insufficient), stop, tell the
   user, and share `action.url` only if the CLI returns one.
5. **Don't memorize parameters — ask the CLI.** Use `easykol schema <cmd>` to read a
   command's parameters instead of guessing flags.

## CLI Self-Description

The CLI is self-describing — you never need to memorize its interface:

```
easykol schema --all        # full command tree (run once after install to verify)
easykol schema <cmd>         # parameters for a single command
easykol exit-codes           # meaning of every exit code
```

## Getting Started

First time in a session, run in order:

```
easykol doctor      # CLI version, config presence, API connectivity
easykol quota       # remaining credits / plan
```

If `doctor` shows `hasApiKey: false`, authenticate. The API uses a key + email pair
(`ek-api-key` / `ek-api-email`); have the user provide both, then:

```
printf '%s' "<API_KEY>" | easykol auth --key-stdin --email <user-email>
```

Config is saved at `~/.easykol/config.json` (mode 600). There is **no browser login**
in v0.1.0 — the key is issued from the EasyKOL backend and configured manually.

## Creator Discovery (the core loop)

1. **Preview (free).** Translate the user's request into a sentence + platform +
   filters, then:
   ```
   easykol parse --sentence "tech product review channels" --platform YOUTUBE
   ```
   This returns `canonicalTags` (with counts), `keywords` (with counts), and
   `estimatedTotal`. Show the user the tags/keywords and the estimated reach.

2. **Optionally widen (free).** If the user wants more angles:
   ```
   easykol more-words --sentence "<same>" --platform YOUTUBE --exclude "tech review,unboxing"
   ```

3. **Search (costs 1 quota).** Once the user confirms, run the search, passing back
   the tags/keywords they approved:
   ```
   easykol search --sentence "tech product review channels" --platform YOUTUBE \
     --keywords "tech review,gadget review" --limit 20 --regions US,GB
   ```
   Returns `{ total, data[] }`; each creator has nickname, username, profileUrl,
   followerCount, avg views/likes, region, language, email, relevanceScore, reason.

Platforms are `TIKTOK`, `YOUTUBE`, `INSTAGRAM`. Filters: `--regions` (ISO Alpha-2),
`--languages` (BCP-47), `--min-subscribers` / `--max-subscribers`, `--avg-min` /
`--avg-max`, `--has-contact`, `--gender`. Check `easykol schema search` for the full set.

## Error Handling

Exit codes drive recovery (`easykol exit-codes` for the list):

| Code | Meaning            | What you do                                              |
|------|--------------------|----------------------------------------------------------|
| 0    | Success            | Report results.                                          |
| 2    | Not authenticated  | Run `easykol auth --key-stdin --email <email>`.          |
| 3    | Quota insufficient | Tell the user; share `action.url` (top-up) if present.   |
| 4    | Not permitted      | Feature not in their plan — explain.                     |
| 5    | Network error      | Retry once, then report the outage.                      |
| 6    | Bad parameters     | Re-check `easykol schema <cmd>` and fix the flags.       |
| 7    | Rate limited       | Back off and retry; tell the user if it persists.        |

The CLI always prints JSON: `{ status, data, action? }`. Read `action.hint` /
`action.url` only when present — never fabricate a URL.

## Roadmap (not yet in the CLI)

The EasyKOL backend already exposes these; CLI commands will follow:

- **profile** — `GET /external/v1/kol?url=` (look up a creator by link)
- **lookalikes** — `POST /external/v1/similar` (find similar creators)
- **contacts** — `POST /external/v1/kol-emails` (bulk email extraction)
- **video** — `GET /external/v1/video?url=` (normalized video data)
- **quota** — `GET /external/v1/quota` is **pending**; until deployed, `easykol quota`
  reports `available: false`.

## References

Read these for detail when needed (under `{baseDir}/references/`):

- `references/search-filters.md` — every parse/search parameter explained.
- `references/quota-heuristics.md` — what costs quota and what's free.
- `references/error-codes.md` — full error-code handling guide.
- `references/platform-support.md` — what's available per platform.
