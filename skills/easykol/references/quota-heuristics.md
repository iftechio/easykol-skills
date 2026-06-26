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
| `audience` | **5 quota** | Only on cache miss; free if cached within 30 days |

## Agent Rules

- **Do not run `parse` before `search` by default.** The `/intelligent-search` backend
  handles tag/keyword selection internally. Only use `parse` when the user explicitly
  wants to inspect tags, or for debugging.
- `search` returning **zero results is not charged**.
- `audience` on a cache hit (result within 30 days) is **free** — run it freely.
- On **exit code 3** (quota exhausted): stop immediately, tell the user, share
  `action.url` if the CLI returned one.
- `kol` and `video` use accumulate billing — you may call them a few times before
  quota is deducted. Do not rely on this for cost planning; treat each call as
  potentially costing 1 quota.

## Checking Quota

Run `easykol quota` when the user asks, or proactively after receiving exit code 3.
The response shows total, used, remaining, and daily limits.
