# Intelligent Search V2

The bundled script uses the external V2 backend. It includes fast, standard,
beta, tag and keyword. Each option requires a compatible API deployment.

## Call chain

User requirement → API helper `search-v2 --mode` → free POST `/external/v2/intelligent-search/parse`
→ prepared parameters + task-point quote → quote-based local budget guard
→ POST `/external/v2/intelligent-search` with stable `idempotencyKey`
→ atomic quota reservation and WEB_SEARCH task creation → existing queue/worker
→ persisted results → GET `/external/v2/intelligent-search/{taskId}`
→ completed task → POST `/{taskId}/next` with a fresh key → inherited parameters.

| Mode | Internal pipeline | Behavior |
|------|-------------------|----------|
| fast (default) | mode 8 + historical | Target 40/batch; stored-data recall, hard-condition checks and text relevance; refresh after delivery |
| standard | mode 8 regular | Target 30/batch; stable unified search, profile relevance, realtime hydration/pruning |
| beta | mode 7 | Target 30/batch; modern unified search, product promotion fit, optional visual screening |
| tag | mode 5 | Search by explicit `--tags`. Target 40/batch for historical data and 30/batch for realtime data |
| keyword | mode 6 | Search by explicit `--keywords`. Target 40/batch for historical data and 30/batch for realtime data |

Use one batch by default. Fast, standard, tag and keyword accept 1–10 batches.
Beta accepts 1–20 batches on a compatible deployment. Older APIs can reject
beta requests for more than one batch and the tag or keyword mode. Use
`quote.targetResults` for the current target. The delivered count depends on
available matches.

Tag and keyword modes default to historical data. Set `--search-data-mode realtime`
for realtime data. These modes accept an optional sentence and use the explicit
inputs without AI rewriting.
Only beta accepts `--visual` and `--product`. `--audience` and `--ideal-influencer`
require `--product`; consumer demographics never become creator gender/age filters.

The [filter reference](search-filters.md) lists mode and platform restrictions.
Taxonomy inputs use English code keys. Check `parameters` in preparation and
`effectiveParameters` in the saved task before claiming a filter was applied. Fast mode runs in a
user-bound virtual project scope; it must still apply prior task candidates, user
exclusions, enterprise ratings/publications and fail closed when an exclusion read
fails. A missing physical Project row for that exact scope is expected and must not
turn the search into zero recall.

## Commands

```sh
node "{baseDir}/scripts/api.cjs" search-v2 --mode fast --platform TIKTOK --sentence 'Gaming creators in US' --regions US
node "{baseDir}/scripts/api.cjs" search-v2 --mode standard --platform TIKTOK --sentence 'US beauty creators' --regions US --main-category beauty --sub-category makeup --has-tk-shop --last-published-days 30
node "{baseDir}/scripts/api.cjs" search-v2 --mode standard --platform INSTAGRAM --sentence 'Fitness creators in UK' --regions GB
node "{baseDir}/scripts/api.cjs" search-v2 --mode beta --platform YOUTUBE --sentence 'Running equipment reviewers' --product 'Running headphones' --audience 'Runners'
node "{baseDir}/scripts/api.cjs" search-v2 --mode keyword --platform YOUTUBE --keywords 'running shoes,shoe reviews' --search-data-mode realtime
node "{baseDir}/scripts/api.cjs" parse-v2 --mode fast --platform TIKTOK --sentence 'Gaming creators in US'
node "{baseDir}/scripts/api.cjs" task --task-id TASK_ID --offset 0 --limit 100
node "{baseDir}/scripts/api.cjs" task --task-id WEB_TASK_ID --project-id PROJECT_ID --attitude NORATE
node "{baseDir}/scripts/api.cjs" search-export --task-id WEB_TASK_ID --project-id PROJECT_ID --attitude LIKE --output ./favorites.xlsx
node "{baseDir}/scripts/api.cjs" search-next --task-id COMPLETED_TASK_ID --idempotency-key campaign-next-002
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

The API helper saves exact request bodies and keys in ~/.easykol/search-tasks/ before
submitting. With a task ID, keep reading that task. If submission timed out before
an ID was received, run the same command with its printed `--idempotency-key`;
`search-v2` can recover from the journal without repeating platform/sentence flags.
The same key/body reuses the task even after completion; changed parameters return
409. The key is scoped to the authenticated user and must contain 8–128 characters.
Never recover by making a new key or switching to V1.

A continuation keeps the source mode and filters. It inherits the batch count
unless the user requests and authorizes another count with `--batches`. Wait for
COMPLETED and follow the latest returned task ID. On 409 for an existing child, read
that child and continue from it. A failed child can be replaced with a newly
authorized continuation from its completed parent; refund status remains separate.

Original `search` / `parse` commands retain their V1 names, options and output.
Use `search-v2` for new intelligent searches. On a compatible deployment, use
`task`, `search-next` or `search-export` with the exact `--project-id` and task ID
for an owned website task. If a deployed API rejects a
field, follow [deployment error guidance](error-codes.md) before taking further
action.
