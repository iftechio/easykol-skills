# Quota Heuristics

EasyKOL bills against your membership quota (same credits as the web app).

## Cost per Command

| Command | Cost | Notes |
|---------|------|-------|
| `doctor` | free | Local + connectivity check |
| `auth` | free | Saves API key and email |
| `quota` | free | Shows remaining credits |
| `schema` / `exit-codes` | free | CLI self-description |
| `parse` | free | Preview tags + keywords + estimated total |
| `more-words` | free | More keyword suggestions |
| `search` | **N quota** | N = creators returned; **0 results = free** |
| `kol` | 1 per 5 calls | Accumulates; charged every 5th call |
| `video` | 1 per 5 calls | Accumulates; charged every 5th call |
| `similar` | **10 quota** | Per call, regardless of result count |
| `emails` | **1 per 5 URLs** | Rounded up; 1 URL = 1 quota, 6 URLs = 2 quota |
| `audience` | **20 quota** | New analysis only; free if cached within 30 days |

## Search Session Budget (CLI hard guard)

The CLI tracks rolling search spend in `~/.easykol/search-session.json` (2h window).

| Rule | Default |
|------|---------|
| Session budget | **50** quota (`EASYKOL_SEARCH_SESSION_BUDGET` overrides) |
| Single `--limit` | **≤ 30** without `--confirm-spend` |
| Exceed budget / limit | exit code **8** — stop and ask the user |

Planned cost for the guard uses `--limit` (worst case). After success, actual spend
is `total` results returned.

`--confirm-spend` is allowed **only after the user explicitly approves** more spend.
Never invent approval.

## Agent Rules

- **Do not run `parse` before `search` by default.** The `/intelligent-search` backend
  handles tag/keyword selection internally. Only use `parse` when the user explicitly
  wants to inspect tags, or for debugging.
- Prefer **one** `search` with `--limit` = the user's requested count (cap 30).
- Multi-country → one `--regions` list, not one call per country.
- Multi-niche → divide `--limit` across niches; confirm if planned total > requested N
  or > 50, or if niches > 3.
- Never re-run a near-duplicate search to "improve" results without user confirmation.
- `search` returning **zero results is not charged**.
- `audience` costs 20 quota for a new analysis; cache hit within 30 days is free.
- On **exit code 3** (quota exhausted): stop immediately, tell the user, share
  `action.url` if the CLI returned one.
- On **exit code 8** (session budget): stop, show spent vs budget, ask whether to
  continue; only then retry with `--confirm-spend`.
- `kol` and `video` use accumulate billing — you may call them a few times before
  quota is deducted. Do not rely on this for cost planning; treat each call as
  potentially costing 1 quota.

## Checking Quota

Run `easykol quota` when the user asks, at session start, and before any plan that
may cost more than the user's requested result count. The response shows total,
used, remaining, and daily limits.
