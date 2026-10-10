# Quota Heuristics

EasyKOL bills against your membership quota (same credits as the web app).

## V2 search billing

`search` and `search-next` reserve the server quote (same rules as the web app),
not N displayed creators. 1 task point = 10 raw quota. Currently a normal batch
usually reserves 1 point; selected advanced filters multiply it to 2. Read quote
rather than hard-coding prices. Zero delivered results are refunded in settlement;
a refund is final only when settlement.pending=false.

`task` reads stored pages for free. Changing offset/limit does not create a batch.
`search-legacy` explicitly retains the V1 per-result contract (N raw quota).

## Cost per Command

| Command | Cost | Notes |
|---------|------|-------|
| `doctor` | free | Local + connectivity check |
| `auth` | free | Saves API key and email |
| `quota` | free | Shows remaining credits |
| `schema` / `exit-codes` | free | CLI self-description |
| `parse` | free | Mode-specific preparation and task-point quote |
| `more-words` | free | More keyword suggestions |
| `search` / `search-next` | **server batch quote** | task-point reservation; excess/zero-result refunds at settlement |
| `task` | free | Existing task and stored pages |
| `search-legacy` | **N raw quota** | Explicit V1 compatibility only |
| `kol` | 1 per 5 calls | Accumulates; charged every 5th call |
| `video` | 1 per 5 calls | Accumulates; charged every 5th call |
| `similar` | **10 quota** | Per call, regardless of result count |
| `emails` | **1 per 5 URLs** | Rounded up; 1 URL = 1 quota, 6 URLs = 2 quota |
| `audience` | **20 quota** | New analysis only; free if cached within 30 days |

## Search Session Budget

The shared guard uses raw quota, default **50 quota = 5 task points** per 2-hour
window (`EASYKOL_SEARCH_SESSION_BUDGET`). V2 converts quoted points ×10, records a
reservation keyed by request identity, and reconciles actual net cost on finalized
task reads. Retrying the same request does not add another reservation. Pending
refunds conservatively remain reserved. Saved request files live in
`~/.easykol/search-tasks/`; do not delete them while submission outcome is uncertain.

V1 search-legacy retains its limit soft cap of 30 and hard max of 50. These limits
are not V2 pricing rules. V2 uses batchCount, and reading stored rows is free.

Exit 8 means the proposed spend exceeds the guard. Explain the quote and current
spend, and use --confirm-spend only with existing explicit user authorization.
Authorization persists across necessary stages and turns within the approved
scope; do not ask for the same permission repeatedly. Never silently expand scope.
On quota exhaustion (exit 3), stop paid work and report the returned top-up action.

## Checking Quota

Run `easykol quota` when the user asks, at session start, and before any plan that
may cost more than the user's requested result count. The response shows total,
used, remaining, and daily limits.
