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
| Find creators matching a description | `search` (+ optionally `parse` / `more-words` to preview) |
| Find creators similar to a URL | `similar` |
| Get a creator's profile by URL | `kol` |
| Get a creator's audience breakdown | `audience` |
| Get emails for a list of creator URLs | `emails` |
| Analyze a video / post by URL | `video` |
| Check remaining credits | `quota` |
| Setup / diagnostics | `auth`, `doctor` |

For exact flags always run `easykol schema <cmd>` first.

---

## 1. Getting Started

Run `easykol doctor` at the start of a session and fix only what is missing:

1. **CLI missing** → ask the user to run `npm install -g @easykol/cli@latest`.
2. **No API key** (`hasApiKey: false`) → ask the user for their key and email, then:
   ```
   printf '%s' "<KEY>" | easykol auth --key-stdin --email <email>
   ```
   Never pass the key as a positional argument or log it.
3. **Configured** → run `easykol quota` and report any blocking issues.

---

## 2. Discovering Creators

Turn a natural-language request into a shortlist of relevant creators.

### Direct Search

Run `easykol search` directly. **Do not run `parse` first by default** — the backend
handles tag and keyword selection internally.

Infer required parameters from the user's message before asking:

- **`--platform`**: infer from context ("YouTube/YT/video" → `YOUTUBE`,
  "TikTok/TT/short video" → `TIKTOK`, "Instagram/IG/Reels" → `INSTAGRAM`).
  If ambiguous, ask once.
- **`--regions`**: infer from geography ("US", "UK" → `GB`, "SEA" → `SG,TH,ID,VN,PH,MY`,
  "Europe" → `GB,DE,FR,ES,IT`). Required. Ask if not mentioned.
- **`--min-subscribers`**: infer from creator-tier language
  (nano → `1000`, micro → `10000`, mid → `100000`, macro → `500000`).
  Default `10000` if unspecified.
- **`--avg-min`**: default `0` unless user mentions "high engagement" or "viral".

Only ask for one missing critical piece at a time. Once you have platform and regions,
search immediately.

Present results as a readable list — name, handle, followers, avg performance, URL,
email if non-empty. Offer one natural refinement after showing results.

See `{baseDir}/references/search-filters.md` for optional filters (language, gender,
follower cap, contact filter).

### Multi-Niche Requests

When one request clearly spans **≥2 distinct creator niches** (e.g. "AI creators,
career/workplace creators, and Study-with-Me creators in Korea"), do **not** cram them
into a single `--sentence`. A blurry multi-niche description collapses semantic recall —
you get a shallow, drifting shortlist that under-serves every niche.

Instead run **one `search` per niche**, each with its own focused `--sentence` and the
**same shared filters** (platform, regions, min-subscribers, avg-min), then merge:

- Split only genuinely different niches. A single niche with several descriptors
  ("fun, high-energy gaming creators") stays one search.
- **Exclusion clauses are not niches** — "no crypto", "exclude finance" are filters that
  apply to every sub-search, never a search of their own.
- After the sub-searches return, **dedup by handle / profile URL** (the same creator can
  surface under two niches) and present results grouped by niche, or as one merged list
  with each creator labelled by the niche that matched.
- **Quota**: each sub-search bills separately (N credits per N results returned). Divide
  `--limit` across niches (e.g. 3 niches × `--limit 10` ≈ 30 total) or confirm the
  intended total with the user before running them.

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

---

## 4. Retrieving Emails

**Important distinction**: `easykol kol` already returns the creator's visible email
from the platform profile. Do NOT run `easykol emails` just because the user asks about
a creator's email or contact info for a single creator — `kol` covers that.

Use `easykol emails` only when the user explicitly wants to **bulk-extract** contact
emails for a list of creator URLs, or wants an exported Excel file of contacts. This is
async (~60s).

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
like count, publish date, author name, author follower count.

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

For async commands (`similar`, `emails`, `audience`), if the command times out
(exit 1 with "timed out"), tell the user the task is taking longer than expected and
suggest retrying with `--timeout 300`.

Run `easykol doctor` as a first diagnostic when the cause is unclear.

## References

- `{baseDir}/references/search-filters.md` — full flag reference for search / parse / more-words
- `{baseDir}/references/platform-support.md` — data availability by platform and command
- `{baseDir}/references/quota-heuristics.md` — billing details per command
- `{baseDir}/references/async-tasks.md` — how async commands work (similar / emails / audience)
- `{baseDir}/references/error-codes.md` — exit codes and output envelope
