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
| Continue a Smart Search Pro task / fetch its next batch | Read `references/pro-pagination.md`; verify that configured tooling supports mode 7 continuation |
| Find creators matching a description | `search` (+ optionally `parse` / `more-words` to preview) |
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

### Choose the Search Contract

For **Smart Search Pro / mode 7**, an existing Pro result link, or “下一批 / 再来一批”
for that task, read `{baseDir}/references/pro-pagination.md` first. Pro permits only
one batch per request, at most 50 creators, and requires sequential task continuation.
Do not turn “fetch 150” into `batchCount=3` or launch parallel pages.

The CLI in this repository uses the separate synchronous `/intelligent-search`
endpoint. Its `search` already caps `--limit` at 50, but exposes no Pro task-continuation
command. Check `easykol schema --all` for the installed capabilities; never invent a
`next` command or silently replace continuation with another paid `search`. Updating
this skill alone does not add that CLI capability or deploy the Pro backend.

### Direct Search (current CLI)

Before running a search, perform a capability preflight. Separate the user's
requirements into:

- **Verifiable search filters**: platform, creator region, creator language, creator
  gender, follower range, average performance, and contact-info presence.
- **Verifiable only per creator**: audience age/gender/region and suspected fake rate
  via `audience`; visible email via `kol` or bulk `emails`.
- **Unsupported**: metrics or filters not exposed by the CLI/API, including TikTok
  Shop fulfilment rate and exact audience age ranges that do not match the returned
  buckets.

If an unsupported requirement is stated as a hard requirement, do not claim that the
request is fully completed. Explain the unsupported fields, run only the supported
part if useful, and label the output as a partial candidate list. Never turn an
unsupported condition into a sentence keyword and present the result as if it were
verified.

Run `easykol search` directly after the preflight. **Do not run `parse` first by
default** — the backend handles tag and keyword selection internally.

Infer required parameters from the user's message before asking:

- **`--platform`**: infer from context ("YouTube/YT/video" → `YOUTUBE`,
  "TikTok/TT/short video" → `TIKTOK`, "Instagram/IG/Reels" → `INSTAGRAM`).
  If ambiguous, ask once.
- **`--regions`**: infer from geography ("US", "UK" → `GB`, "SEA" → `SG,TH,ID,VN,PH,MY`,
  "Europe" → `GB,DE,FR,ES,IT`). Required. Ask if not mentioned.
  **Put every target country in one comma-separated `--regions` list.** Do **not**
  run one search per country unless the user explicitly asks for separate lists.
- **`--limit`**: use the user's requested count when stated (e.g. "找 30 个" → `30`).
  Default `20` if unspecified. Cap at `30` unless the user approves a larger page,
  and never exceed the hard per-call maximum of `50`. For more than 50, explain the
  need for separate authorized requests; do not pretend the CLI offers Pro pagination.
- **`--min-subscribers`**: infer from creator-tier language
  (nano → `1000`, micro → `10000`, mid → `100000`, macro → `500000`).
  Default `10000` if unspecified.
- **`--avg-min`**: default `0` unless user mentions "high engagement" or "viral".

Only ask for one missing critical piece at a time. Once platform and regions are known,
search immediately only if all hard requirements are supported **and** the spend plan
passes the Budget Control rules below. Otherwise disclose the limitation / ask for
budget approval first.

Present results as a readable list — name, handle, followers, avg performance, URL,
language, region, and email status. Treat `has-contact` as “EasyKOL has a contact
record”, not proof that the address is public or deliverable. If the user requires
every result to have an email, count non-empty emails after the search and report the
actual coverage; do not silently fill or fabricate missing addresses.

For a hard-filter request, run a postcondition check before saying “completed”:

1. Verify every returned row against every supported hard filter.
2. Count rows that pass all supported filters and separately count unsupported fields.
3. If any hard condition is unverified, use “partial results” or “候选结果（待复核）”,
   never “fully matched” or “已完成名单”.

Offer one natural refinement after showing results.

See `{baseDir}/references/search-filters.md` for optional filters (language, gender,
follower cap, contact filter).

### Budget Control (current CLI; mandatory)

Paid search can burn quota fast. Follow these rules on every discovery request:

1. **Default path**: run **exactly one** `easykol search` with
   `--limit` = requested count (or 20), and all countries in one `--regions`.
2. **Estimate before you spend**: planned cost ≈ sum of `--limit` across the searches
   you are about to run (worst case = full pages returned).
3. **Hard stop — ask the user first** when any of these is true:
   - planned cost **>** the user's requested result count
   - planned cost **> 50**
   - you want **> 3** sub-searches
   - you want to **re-run / expand** after already searching (new sentence, new country
     split, higher limit, brand-name variants, etc.)
   - CLI returns **exit code 8** (session budget / `--limit` soft cap)
4. Never pass `--confirm-spend` unless the user just approved more spend in this turn.
5. After you already have enough candidates for the user's N, **stop searching**.
   Dedup and present; do not keep exploring "to be thorough".
6. On exit code 8: explain spent vs budget in plain language, offer the current partial
   shortlist, and ask whether to continue. Do not silently retry.

See `{baseDir}/references/quota-heuristics.md` for CLI session-budget details.

### Multi-Niche Requests

When one request clearly spans **≥2 distinct creator niches** (e.g. "AI creators,
career/workplace creators, and Study-with-Me creators in Korea"), do **not** cram them
into a single `--sentence`. A blurry multi-niche description collapses semantic recall —
you get a shallow, drifting shortlist that under-serves every niche.

Instead run **one `search` per niche**, each with its own focused `--sentence` and the
**same shared filters** (platform, regions, min-subscribers, avg-min), then merge:

- Split only genuinely different niches. A single niche with several descriptors
  ("fun, high-energy gaming creators") stays one search.
- **Countries are not niches** — keep them in shared `--regions` (e.g. `DE,FR,IT`).
  Do not multiply niches × countries into a cartesian product of searches.
- **Exclusion clauses are not niches** — "no crypto", "exclude finance" are filters that
  apply to every sub-search, never a search of their own.
- After the sub-searches return, **dedup by handle / profile URL** (the same creator can
  surface under two niches) and present results grouped by niche, or as one merged list
  with each creator labelled by the niche that matched.
- Do not call the response “the complete candidate pool” unless the API explicitly
  provides a complete, paginated dataset and pagination has been exhausted. The search
  API returns only the current response (maximum 50); `estimatedTotal` from `parse` is
  an estimate, not a list of candidates.
- **Quota (mandatory)**: each sub-search bills separately. **Always divide** the user's
  requested N across niches (e.g. want 30 with 3 niches → three `--limit 10` calls).
  If niches > 3, or divided limits still sum to more than N / 50, **confirm with the
  user before running any sub-search**.

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
like count, comment count, share/reshare count when the platform supplies it,
publish date, author name, and author follower count. The response field is
`shareCount`; `null` means the upstream platform endpoint did not provide a
share metric (it is not a measured zero).

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
