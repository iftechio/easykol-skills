---
name: easykol
description: >-
  Use when the user wants to discover, analyze, or reach out to creators / KOLs /
  influencers — finding creators by platform, niche, audience size or region;
  pulling a creator's profile, audience demographics, or recent content; finding
  lookalike creators; or managing outreach campaigns. Supports YouTube, TikTok,
  and Instagram. Triggers on intents like "find creators for…", "analyze this
  channel", "who is similar to…", "get this creator's audience".
metadata:
  requires: easykol
  install: npm install -g @easykol/cli@latest
  version: 0.1.0
---

# EasyKOL

EasyKOL helps you discover, analyze, and reach out to creators (KOLs / influencers)
across YouTube, TikTok, and Instagram. This skill drives the `easykol` CLI on the
user's behalf — the user describes what they want in natural language, and you run
the right commands and report the results.

## When to Use

Use this skill when the user wants to:

- **Discover creators** — "find tech YouTubers in the US with 100k–500k subscribers",
  "who makes skincare content on TikTok", "find creators like @mkbhd".
- **Analyze a creator** — basic profile, audience demographics, recent content,
  engagement quality, contact info for outreach.
- **Manage outreach** — build creator lists / pools, track campaigns, export results
  (Phase 2 features).

## What This Skill Does Not Do

- It does **not** post content, send DMs through platform APIs, or scrape platforms
  directly — all data comes from the EasyKOL backend.
- It does **not** work in ChatGPT (no CLI execution environment). Use Claude Code,
  Cursor, or Codex.
- It does **not** guess or invent creator data. If the CLI returns nothing, say so.

## Core Principles (Agent Behavior)

1. **Agent-first, silent execution.** The user does not run the CLI — you do. Run
   commands yourself and report only the *results* in plain language. Do not paste
   raw commands at the user unless they ask to see them.
2. **Never expose the API key.** The key never appears in a command argument, in
   logs, or in your messages. Authenticate via `easykol login` or
   `easykol auth --key-stdin`.
3. **Confirm before write/spend-heavy actions.** Any action that sends a message,
   changes campaign state, or consumes a large amount of quota (e.g. bulk contacts)
   follows: **dry-run → show the user → get confirmation → execute.**
4. **Surface quota honestly.** Every CLI call returns a `quota` block. If quota is
   low or insufficient, tell the user and only share a top-up link when the CLI
   returns one in `action.url`.
5. **Don't memorize parameters — ask the CLI.** Use `easykol schema <cmd>` to read a
   command's parameter schema instead of guessing flags.

## CLI Self-Description

The CLI is self-describing. You never need to memorize its interface:

```
easykol schema --all        # full command tree (run once after install to verify)
easykol schema <cmd>         # parameter schema for a single command
easykol agent exit-codes     # meaning of every exit code
easykol pricing              # quota cost per operation
```

## Getting Started

Run these in order the first time in a session:

```
easykol doctor      # verify CLI version, key presence, network connectivity
easykol login       # opens the browser, reuses the EasyKOL session, provisions a key
easykol quota       # remaining credits, plan, expiry
```

If `easykol doctor` reports the CLI is missing, install it:
`npm install -g @easykol/cli@latest`. If there's no browser (headless), use
`easykol auth --key-stdin` and have the user paste their key via stdin.

## Creator Discovery

Workflow:

1. Translate the user's request into filters (platform, niche/tags, follower range,
   region, language). Check `easykol schema kol search` for exact flags.
2. Run `easykol kol search …`.
3. Optionally narrow with `easykol kol search-filter …` (e.g. de-dupe creators the
   user has already worked with).
4. For "find creators like X", use `easykol kol lookalikes --seed <handle|id>`.

Report the top results with the fields that matter to the user (name, platform,
followers, niche, engagement) and the quota consumed.

## Creator Analysis

Before reaching out, evaluate a creator:

```
easykol kol profile   --id <id>   # basic profile (cheap)
easykol kol audience  --id <id>   # audience demographics (heavier)
easykol kol content   --id <id>   # recent videos / posts
easykol kol contacts  --id <id>   # visible contact info (most expensive — confirm first)
```

Always confirm before `easykol kol contacts` because it consumes the most quota.

## Outreach Management (Phase 2)

```
easykol list list|get             # creator pools / lists
easykol campaign list|get|create  # campaigns
easykol export create|get|download
```

These follow the same dry-run → confirm → execute rule for any write.

## Error Handling

Exit codes drive your recovery (`easykol agent exit-codes` for the full list):

| Code | Meaning            | What you do                                              |
|------|--------------------|----------------------------------------------------------|
| 0    | Success            | Report results.                                          |
| 2    | Not authenticated  | Run `easykol login` (or ask for a key via `--key-stdin`).|
| 3    | Quota insufficient | Tell the user; share `action.url` (top-up) if present.   |
| 4    | Not permitted      | Feature not in their plan — explain, share upgrade link. |
| 5    | Network error      | Retry once, then report the outage.                      |
| 6    | Bad parameters     | Re-check `easykol schema <cmd>` and fix the flags.       |
| 7    | Rate limited       | Back off and retry; tell the user if it persists.        |

The CLI always outputs JSON: `{ status, data, quota, action? }`. Read `action.hint`
and `action.url` only when present — never fabricate a URL.

## References

Read these for detail when needed (under `{baseDir}/references/`):

- `references/search-filters.md` — every search/filter parameter explained.
- `references/quota-heuristics.md` — quota cost per operation and budgeting tips.
- `references/error-codes.md` — full error-code handling guide.
- `references/platform-support.md` — what's available per platform.
