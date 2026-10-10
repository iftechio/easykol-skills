---
name: easykol
description: >-
  Use when the user wants to discover, evaluate, or research creators / KOLs /
  influencers on YouTube, TikTok, or Instagram. Covers creator discovery
  (natural-language search, lookalikes), creator profiling, audience analysis
  (age/gender/region/fake-follower rate), bulk email extraction, video analysis,
  and account setup. Use when the user mentions finding influencers, checking a
  creator's audience, getting creator emails, analyzing a video, or setting up
  EasyKOL access.
metadata: {"openclaw":{"requires":{"bins":["easykol"]},"install":[{"kind":"node","package":"@easykol/cli","bins":["easykol"]}],"homepage":"https://app.easykol.com/skills"}}
---

# EasyKOL

Full-workflow creator intelligence skill for influencer discovery, creator profiling,
audience analysis, bulk email extraction, and video analytics across YouTube, TikTok,
and Instagram.

The user interacts through natural language. Execute CLI commands yourself and report
results in plain language. Never expose raw CLI commands or JSON to the user.

## When to Use

- User wants to find creators / influencers / KOLs matching a description
- User wants to find creators similar to an existing one
- User wants to check a creator's profile, follower count, or contact info
- User wants audience demographics: age, gender, region, or fake-follower rate
- User wants to bulk-extract emails for a list of creator URLs
- User wants to analyze a video (views, likes, author)
- User needs to set up EasyKOL access or check remaining quota

## What This Skill Does Not Do

- Post content, send DMs, or interact with social platforms
- Return content not yet in the EasyKOL database
- Make final campaign-budget or partnership decisions
- Draft outreach emails or negotiation copy
- Work in ChatGPT (requires a CLI execution environment)

## Core Principles

### Agent-First

The user does not operate the CLI. You do. Run commands silently and report results
in plain language. Only share URLs when the user needs to act in a browser (top up,
authenticate).

### CLI Self-Description

The CLI documents itself — use it rather than memorising parameters:

- **Command schema**: `easykol schema <cmd>` (e.g. `schema kol`, `schema search`)
- **Full command tree**: `easykol schema --all`
- **Exit codes**: `easykol exit-codes`
- **Diagnostics**: `easykol doctor`

## Routing Cheat Sheet

| User intent | Command |
|-------------|---------|
| Read a search task / continue its next batch | `task --task-id` / `search-next --task-id` (same source mode and filters) |
| Find creators matching a description | `search --mode fast|standard|beta` (default fast); `parse --mode` for optional preview |
| Find creators similar to a URL | `similar` |
| Get a creator's profile by URL | `kol` |
| Get a creator's audience breakdown | `audience` |
| Get emails for a list of creator URLs | `emails` |
| Analyze a video / post by URL | `video` |
| Check remaining credits | `quota` |
| Setup / diagnostics | `auth`, `doctor`, `upgrade` |

For exact flags always run `easykol schema <cmd>` first.

---

## 1. Getting Started

At the **start of every EasyKOL session**, silently refresh tooling first (do not ask
the user, do not narrate unless something fails):

1. Prefer `easykol upgrade` when the CLI is already installed.
2. Otherwise run both (best-effort; continue on failure):
   ```
   npm install -g @easykol/cli@latest
   npx --yes skills update easykol -y
   ```
3. After a successful skill refresh, re-read this skill's `SKILL.md` and
   `references/quota-heuristics.md` before any paid search so the current session
   picks up budget rules.

Then run `easykol doctor` and fix only what is missing:

1. **CLI missing** → ask the user to run `npm install -g @easykol/cli@latest`.
2. **No API key** (`hasApiKey: false`) → ask the user for their key and email, then:
   ```
   printf '%s' "<KEY>" | easykol auth --key-stdin --email <email>
   ```
   Never pass the key as a positional argument or log it.
3. **Configured** → run `easykol quota` and report any blocking issues.
4. If `doctor` reports `updateAvailable: true`, run `easykol upgrade` once more before
   searching.

---

## 2. Discovering Creators

Turn a natural-language request into a shortlist of relevant creators.

### Choose a Mode

Use CLI 0.2.0 or newer and the external V2 backend. Read
`{baseDir}/references/search-modes.md` for the request / result contract.

| User intent | Mode | Existing web pipeline | Target per batch |
|-------------|------|-----------------------|------------------|
| Quick shortlist, no specified mode | `fast` (default; tell the user) | mode 8 historical, stored data + text relevance, background refresh | 60 |
| Normal / standard search | `standard` | mode 8 regular, profile relevance + realtime refresh and hard-filter recheck | 50 |
| Beta / Pro, product promotion fit or visual screening | `beta` | mode 7, product requirements + optional visual screening | 50 |

Never silently substitute modes. Beta permits exactly one batch per request.
For existing search tasks preserve their mode and filters; read
`{baseDir}/references/pro-pagination.md` before continuation.

### Search Workflow

1. Preflight the user's hard requirements. Search supports creator platform,
   region/language, follower/performance range, creator gender and contact presence.
   Audience demographics require separate `audience` analysis; unsupported metrics
   such as TikTok Shop fulfilment rate must remain unverified. Do not convert an
   unsupported hard condition to a keyword and claim verification.
2. Infer platform, countries and requested mode from context. Ask for a critical
   missing platform once. Put all target countries in one `--regions` list; omit
   filters the user did not specify rather than inventing thresholds. Consumer
   target age/gender belongs to Beta `--product` / `--audience`, not creator filters.
3. Submit one `search` by default. The CLI obtains a free mode-specific preparation
   and quote before the paid request. `parse` is optional for showing / editing the
   plan, not a required user confirmation stage. The user's existing authorization
   applies to all necessary steps within their stated scope and budget.
4. Keep the returned `taskId` and `idempotencyKey`. `search` waits for readable
   results by default; `--no-wait` returns immediately. A timeout is not a failed
   search. Resume `task --task-id <id>` for free; if submission outcome is uncertain,
   recover `search --idempotency-key <original-key>` from the saved local journal.
   Never start a replacement paid search because polling timed out.
5. Present the requested number from the readable results, dedup by `kolId` / URL,
   and verify supported hard conditions against returned fields. Missing metrics,
   `screening=unverified`, or unsupported requirements remain unverified. Describe
   partial candidates honestly. Contact presence does not prove a public or
   deliverable email; count actual non-empty emails when required.

`RESULT_READY` means results may be read, not that processing/settlement completed.
`COMPLETED` with `settlement.pending=true` still awaits refund reconciliation.
Unknown stage counts are `null`, not zero. Never label a failed or unfinished task
as zero recall or treat unknown judgments as rejection.

### Reading More Results and Continuing

- `task --task-id <id> --offset 50 --limit 50` reads another stored page **for free**.
  Exhaust the existing task's `nextOffset` before requesting another paid batch.
- When the authorized target needs another batch, wait for `COMPLETED`, then
  `search-next --task-id <latest-id>` using a new idempotency key. It inherits mode,
  platform and filters. Continue serially from each returned child task; do not
  branch from an older parent or launch parallel continuations.
- Stop when the user's requested number is reached. A batch target is not a
  guaranteed quantity. Explain a shortfall without automatically changing modes,
  weakening filters or running unrelated searches.

### Budget Control

The CLI reserves the **server quote**, not the number of displayed rows. One task
point equals 10 raw quota. The shared rolling CLI search budget defaults to 50 raw
quota (5 points) per 2-hour window; finalized refunds reconcile on task reads.
Use `{baseDir}/references/quota-heuristics.md` for details.

Use one batch by default. For a user-authorized larger plan, sum the quoted batch
costs and continue within that authorization; do not request repeated permission
at every stage. If the plan exceeds the user's approved scope/budget or the CLI
returns exit 8, explain the extra cost and obtain approval before `--confirm-spend`.
Existing explicit approval persists across turns; never invent it.

For distinct niches, use focused sentences with shared country/filter settings,
merge and dedup the results. Every search has its own batch quote: reducing the
number shown does **not** reduce its price. Keep the combined plan within the
user's authorized budget. `estimatedTotal` is not a complete candidate pool.

### Legacy Compatibility

`search-legacy` / `parse-legacy` explicitly use V1. They do not share the V2 search
contract or support task continuation. `more-words` is also a V1 utility. Do not
silently use them when V2 returns 404 or a mode-specific request fails; report the
backend/version mismatch. Existing profile, video, emails, similar and audience
commands continue using their existing endpoints.

### Lookalike Discovery

Use `easykol similar --url <profile-url>` when the user wants creators similar to a
specific channel. This is async and takes ~30s; tell the user you are searching.

Optional filters: `--regions`, `--languages`, `--min-subscribers`, `--max-subscribers`,
`--min-avg-views`, `--max-avg-views`. `--dedup-days` (default 3) skips creators already
seen recently; set to `0` to disable.

Present results the same way as `search` results.

---

## 3. Evaluating a Creator

Help the user decide whether a creator is worth pursuing. Lead with a summary, not a
wall of numbers.

### Profile

Run `easykol kol --url <profile-url>` to fetch the creator's current profile:
nickname, follower count, avg performance, region, language, and email (if on file).

This is the first thing to run when the user pastes a creator URL or asks "what can
you tell me about this creator?"

### Audience Analysis

Run `easykol audience --url <profile-url>` to fetch:

- **Portrait**: age distribution (under18 / 18–25 / 25–45 / above45) and gender split
- **Region**: top audience countries with T1/T2/T3 development level
- **Fake followers**: suspected fake rate, fake count, total sample size

Results are cached for 30 days — the command returns immediately on a cache hit.
A new analysis is async and takes up to 2 min. Tell the user you are fetching the
analysis if it takes time.

Interpret results for the user: highlight whether the audience is concentrated in T1
markets, whether the gender split fits the campaign brief, and flag if `suspectedFakeRate`
is high (>20% warrants caution, >40% is a red flag).

Do not use audience analysis to claim an exact age range that the result does not
contain. The standard buckets include `18–25` and `25–45`; they cannot establish
`25–40 ≥ 60%`. Audience analysis is a per-creator verification step, not a search
filter, unless the API explicitly supports that filter.

---

## 4. Retrieving Emails

**Important distinction**: `easykol kol` already returns the creator's visible email
from the platform profile. Do NOT run `easykol emails` just because the user asks about
a creator's email or contact info for a single creator — `kol` covers that.

Use `easykol emails` when the user explicitly wants to **bulk-extract** contact emails
for a list of creator URLs, or wants an exported Excel file of contacts. This is async
(~60s). It does not prove that every address is public, valid, or available; report
missing results and coverage after completion.

```
easykol emails --tt-urls <url1,url2,...>
easykol emails --yt-urls <url1,url2,...>
easykol emails --ins-urls <url1,url2,...>
```

Flags can be combined for mixed-platform batches. Costs 1 quota per 5 URLs (rounded up).

The command returns a `downloadUrl` for an Excel file. Tell the user the file is ready
and share the URL.

---

## 5. Analyzing a Video

Run `easykol video --url <video-url>` to fetch video metadata: title, view count,
like count, comment count, share count, Instagram Repost count when supplied,
publish date, author name, and author follower count. `shareCount` is the share
metric (the Instagram paper-plane action); `repostCount` is Instagram's distinct
double-arrow Repost metric. For Instagram, both fields are sourced from the v3
post-detail response; v5 values are not used. For either field, `null` means the
v3 endpoint did not provide that metric (it is not a measured zero). Do not
combine or substitute these fields.

Supported: YouTube videos, TikTok posts, Instagram reels/posts.

Useful when the user shares a video link and wants quick stats, or wants to check a
creator's recent content before outreach.

---

## Error Handling

For all failures, use the CLI response:
- `action.url` — where the user should go (top up, authenticate)
- `action.hint` — what to do next

| Exit code | Meaning | What to do |
|-----------|---------|------------|
| 2 | Not authenticated | Run `easykol auth --key-stdin --email <email>` |
| 3 | Quota exhausted | Stop, tell user, share `action.url` if present |
| 4 | Feature not in plan | Explain, suggest upgrade |
| 5 | Network error | Retry once, then report |
| 6 | Bad parameters | Re-read `easykol schema <cmd>`, fix flags, retry |
| 7 | Rate limit | Back off and retry |
| 8 | Search session budget | Stop, ask user; retry with `--confirm-spend` only if approved |

For async commands (`similar`, `emails`, `audience`), if the command times out
(exit 1 with "timed out"), tell the user the task is taking longer than expected and
suggest retrying with `--timeout 300`.

Run `easykol doctor` as a first diagnostic when the cause is unclear.

## References

- `{baseDir}/references/pro-pagination.md` — Pro single-page retrieval, task continuation, and CLI/API boundaries
- `{baseDir}/references/search-filters.md` — full flag reference for search / parse / more-words
- `{baseDir}/references/platform-support.md` — data availability by platform and command
- `{baseDir}/references/quota-heuristics.md` — billing details per command
- `{baseDir}/references/async-tasks.md` — how async commands work (similar / emails / audience)
- `{baseDir}/references/error-codes.md` — exit codes and output envelope
