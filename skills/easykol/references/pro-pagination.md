# Task-bound continuation (all V2 modes)

The bundled helper supports `task` and `search-next`. Use the full contract in
[search-modes.md](search-modes.md).

1. Read the source task with `task --task-id ID`. Validate its actual mode and
   effective parameters; do not infer them from the current conversation alone.
2. Read all existing pages using nextOffset. This is free and does not search.
3. Wait for COMPLETED before `search-next --task-id ID`. Keep its new task ID and
   stable idempotency key. Mode and filters are inherited. Use `--batches` only
   when the user has authorized a different continuation count.
4. Continue serially from the latest child task. One source permits one non-failed
   child, regardless of how many different request keys are supplied. 409 identifies
   the existing child; use it rather than retrying with new keys.

Beta (web mode 7 / Pro) defaults to one batch, currently targeting up to 30
creators per batch. It accepts 1–20 explicitly selected batches per V2 request
on a compatible deployment. Earlier backends limit beta to one. For a target of
150, five batches are needed at full yield. Respect explicit batch and spend
limits. Follow the latest completed child for additional work. Where a request
contains multiple batches, continuation inherits that count by default.

Fast currently targets 40 per batch and standard targets 30. Read
`quote.targetResults` for the current request.
A legacy V1 task cannot be continued by V2; a task ID from another owner is hidden.
For an owned website task, supply both `--task-id` and `--project-id` with
`task` and `search-next`. If the deployed endpoint cannot recognize that
scope, use the original website result page to continue the same task.
