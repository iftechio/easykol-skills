# Intelligent Search V2

Requires CLI >=0.2.0 and a deployed V2 backend. Expanded V2 filter flags such as
`--has-tk-shop` and `--last-published-days` require CLI >=0.2.1. The skill covers
all three modes; no separate skill or credential is required.

## Call chain

User requirement → CLI `search-v2 --mode` → free POST `/external/v2/intelligent-search/parse`
→ prepared parameters + task-point quote → quote-based local budget guard
→ POST `/external/v2/intelligent-search` with stable `idempotencyKey`
→ atomic quota reservation and WEB_SEARCH task creation → existing queue/worker
→ persisted results → GET `/external/v2/intelligent-search/{taskId}`
→ completed task → POST `/{taskId}/next` with a fresh key → inherited parameters.

| Mode | Internal pipeline | Behavior |
|------|-------------------|----------|
| fast (default) | mode 8 + historical | Target 60/batch; existing ES+Milvus recall, PG hard checks and Jev text relevance; refresh after delivery |
| standard | mode 8 regular | Target 50/batch; stable unified search, profile relevance, realtime hydration/pruning |
| beta | mode 7 | Target 50/batch; modern unified search, product promotion fit, optional visual screening |

Fast and standard allow 1–10 batches via `--batches`; beta accepts exactly one.
Use one batch by default. Targets are not guaranteed result counts.
Only beta accepts `--visual` and `--product`. `--audience` and `--ideal-influencer`
require `--product`; consumer demographics never become creator gender/age filters.

All modes accept the same public hard-filter fields. Taxonomy inputs use English
code keys and are translated at the API worker boundary. Fast mode runs in a
user-bound virtual project scope; it must still apply prior task candidates, user
exclusions, enterprise ratings/publications and fail closed when an exclusion read
fails. A missing physical Project row for that exact scope is expected and must not
turn the search into zero recall.

## Commands

```sh
easykol search-v2 --mode fast --platform TIKTOK --sentence 'Gaming creators in US' --regions US
easykol search-v2 --mode standard --platform TIKTOK --sentence 'US beauty creators' --regions US --main-category beauty --sub-category makeup --has-tk-shop --last-published-days 30
easykol search-v2 --mode standard --platform INSTAGRAM --sentence 'Fitness creators in UK' --regions GB
easykol search-v2 --mode beta --platform YOUTUBE --sentence 'Running equipment reviewers' --product 'Running headphones' --audience 'Runners'
easykol parse-v2 --mode fast --platform TIKTOK --sentence 'Gaming creators in US'
easykol task --task-id TASK_ID --offset 0 --limit 100
easykol search-next --task-id COMPLETED_TASK_ID --idempotency-key campaign-next-002
```

`--no-wait` returns the task immediately; `--timeout` controls the polling wait.
There is no V2 `--limit` on search creation. Use `task --limit` to read stored rows.
Present only the user's requested number; a small displayed list still costs the
whole quoted batch.

## Result contract

- `searchMode`, `pipelineVersion`, `effectiveParameters`: actual saved execution.
- `status`: persisted state, including PENDING, PROCESSING, RESULT_READY,
  COMPLETING, COMPLETED, FAILED and pause states. `resultsReady` allows reading.
- `total`, `nextOffset`: current task's delivered rows / next stored page.
- `counts`: recalled, hardFilterPassed, relevanceJudged, relevanceRejected,
  unverified, delivered. Unavailable counts are null. Failure is not zero recall.
- `data`: kolId, creator profile, current platform metrics, metricsUpdatedAt
  (platform row update timestamp), reasons/evidence, screening passed/unverified.
  Rejected creators are excluded; unknown judgments are retained.
- `quote`: taskPoints, reserved price, batchCount and targetResults.
- `settlement`: actual charged/refunded/net task points and pending flag. Wait for
  pending=false before calling a refund final. Cached metrics can refresh after
  delivery, while task membership and reasons stay pinned to the task.

## Recovery

The CLI saves exact request bodies and keys in ~/.easykol/search-tasks/ before
submitting. With a task ID, keep reading that task. If submission timed out before
an ID was received, run the same command with its printed `--idempotency-key`;
`search-v2` can recover from the journal without repeating platform/sentence flags.
The same key/body reuses the task even after completion; changed parameters return
409. The key is scoped to the authenticated user and must contain 8–128 characters.
Never recover by making a new key or switching to V1.

A continuation inherits the exact source params and batch count. Wait for
COMPLETED; follow the latest returned task ID. On 409 for an existing child, read
that child and continue from it. A failed child can be replaced with a newly
authorized continuation from its completed parent; refund status remains separate.

Original `search` / `parse` commands retain their V1 names, options and output.
The Skill chooses `search-v2` explicitly; there is no automatic command migration.
