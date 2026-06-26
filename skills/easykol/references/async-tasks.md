# Async Tasks

Three commands are asynchronous: `similar`, `emails`, and `audience`. The CLI handles
polling internally — the agent does not need to manage task IDs or poll manually.

## Behaviour

```
easykol similar --url <url>          # ~30s, polls until done
easykol emails --yt-urls <url1,url2> # ~60s, polls until done
easykol audience --url <url>         # instant on cache hit; up to 2 min on miss
```

The CLI blocks until the task completes or times out, then emits the standard
`{ "status": "ok", "data": { ... } }` envelope.

## Timeouts

| Command | Default timeout | Override |
|---------|----------------|---------|
| `similar` | 120s | `--timeout <seconds>` |
| `emails` | 180s | `--timeout <seconds>` |
| `audience` | 120s | `--timeout <seconds>` |

If the task times out (exit 1, message contains "timed out"), tell the user the
analysis is taking longer than expected and suggest retrying with `--timeout 300`.

## `audience` Cache Behaviour

`audience` checks for any existing result within the past **30 days** before creating
a new task. On a cache hit the command returns immediately. On a miss it creates a new analysis task.
Both cost **5 quota**.

You do not need to manage cache state — the backend handles it. Run `audience` freely;
only the first call for a creator within 30 days incurs cost.

## Telling the User

For `similar` and `emails`, tell the user once before running that this may take up to
~30–60s. Do not spam updates during polling. Report the result when done.

For `audience`, skip the warning on a cache hit (it's instant). Only warn if the
command is taking more than a few seconds.

## Environment Requirement

Async commands create tasks on the EasyKOL production server. The CLI must be able
to reach `https://app.easykol.com`. If running behind a proxy or firewall, exit code 5
(network error) will appear immediately — check connectivity first with `easykol doctor`.
