# Task-bound continuation (all V2 modes)

CLI >=0.2.0 supports `task` and `search-next`. Use the full contract in
[search-modes.md](search-modes.md).

1. Read the source task with `task --task-id ID`. Validate its actual mode and
   effective parameters; do not infer them from the current conversation alone.
2. Read all existing pages using nextOffset. This is free and does not search.
3. Wait for COMPLETED before `search-next --task-id ID`. Keep its new task ID and
   stable idempotency key. Mode, filters and batch count are inherited.
4. Continue serially from the latest child task. One source permits one non-failed
   child, regardless of how many different request keys are supplied. 409 identifies
   the existing child; use it rather than retrying with new keys.

Beta (web mode 7 / Pro) accepts one batch per V2 request, target at most 50.
To obtain 150 candidates, continue up to three serial batches under the user's
existing authorization and quoted budget, stopping on sufficient results or a
shortfall. Do not set beta batchCount=3 or run parallel requests.

Fast targets 60/batch and standard 50/batch. Neither target guarantees results.
A legacy V1 task cannot be continued by V2; a task ID from another owner is hidden.
Existing web tasks are not automatically V2 tasks: use the frontend's own
continuation flow for those, preserving the exact task-bound configuration.
