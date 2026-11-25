# Async Tasks

`search-v2`, `search-next`, `similar`, `emails`, and `audience` are asynchronous. Search
recovery and result-page semantics are specified in [search-modes.md](search-modes.md).
After polling stops, continue reading the existing search or audience task by ID.

## Behaviour

```
node "{baseDir}/scripts/api.cjs" similar --url <url>          # ~30s, polls until done
node "{baseDir}/scripts/api.cjs" emails --yt-urls <url1,url2> # ~60s, polls until done
node "{baseDir}/scripts/api.cjs" audience --url <url>         # instant on cache hit; polls for up to 120s on miss
```

The API helper blocks until the task completes or times out, then emits the standard
`{ "status": "ok", "data": { ... } }` envelope.

## Timeouts

| Command | Default timeout | Override |
|---------|----------------|---------|
| `similar` | 120s | `--timeout <seconds>` |
| `emails` | 180s | `--timeout <seconds>` |
| `audience` | 120s | `--timeout <seconds>` |

If a task times out, report that it may still be running. A polling timeout alone
does not establish that the submission failed.

## Resume an audience report

```bash
node "{baseDir}/scripts/api.cjs" audience --url <url> --submit-only
node "{baseDir}/scripts/api.cjs" audience-result --task-id <id>
```

Submit-only returns `taskId`, `status`, and any immediately available `result`.
The normal `audience` command prints the task ID to stderr before polling and
keeps its usual result on stdout. Each `audience-result` reads the same task once
for free. Check again about every 5 seconds for `PENDING` or `PROCESSING` while
the user is waiting. Stop on `COMPLETED` or `FAILED` and keep the task ID if the
user wants to come back later. Query with the account that started the task.

## `audience` Cache Behaviour

`audience` can reuse a completed report from the past **30 days** at the same or a
higher tier. A cache hit is free. On a compatible deployment a new analysis
costs **1, 2, or 6 AI credits** depending on `--data-multiplier` (default 2).
The helper checks release support for 1× or 6× using a free quota read before
submitting a paid analysis. Requesting a higher tier can create a new paid
analysis even if a lower-tier report exists.

## Telling the User

For `similar` and `emails`, tell the user once before running that this may take up to
~30–60s. Do not spam updates during polling. Report the result when done.

For `audience`, skip the warning on a cache hit (it's instant). Only warn if the
command is taking more than a few seconds.

## Environment Requirement

Async commands create tasks on the EasyKOL production server. The API helper must be able
to reach `https://app.easykol.com`. If running behind a proxy or firewall, exit code 5
(network error) will appear immediately — check connectivity first with `node "{baseDir}/scripts/api.cjs" doctor`.
