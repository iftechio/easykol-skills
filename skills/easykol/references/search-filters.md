# Search Filters

Parameters for `easykol parse`, `easykol more-words`, and `easykol search`. Confirm
the live set with `easykol schema <cmd>`.

## Required (parse / more-words / search)

| Flag           | Values                          | Notes                                  |
|----------------|---------------------------------|----------------------------------------|
| `--sentence`   | free text (≤ 500 chars)         | Natural-language description.           |
| `--platform`   | `TIKTOK` / `YOUTUBE` / `INSTAGRAM` | One platform per call.               |

## Shared filters (all three commands)

| Flag                 | Example      | Notes                                       |
|----------------------|--------------|---------------------------------------------|
| `--regions`          | `US,GB`      | Comma-separated ISO Alpha-2 country codes.  |
| `--languages`        | `en,zh`      | Comma-separated BCP-47 language codes.       |
| `--min-subscribers`  | `100000`     | Min follower / subscriber count.            |
| `--max-subscribers`  | `500000`     | Max follower / subscriber count.            |
| `--avg-min`          | `1000`       | Min avg views (TT/YT) or avg likes (IG).    |
| `--avg-max`          | `100000`     | Max avg views (TT/YT) or avg likes (IG).    |

## `more-words` only

| Flag        | Example                  | Notes                                    |
|-------------|--------------------------|------------------------------------------|
| `--exclude` | `tech review,unboxing`   | Keywords already shown; AI avoids them.  |

## `search` only

| Flag            | Example                     | Notes                                          |
|-----------------|-----------------------------|------------------------------------------------|
| `--limit`       | `20`                        | 1–50, default 20. Results, not quota multiplier.|
| `--tags`        | `tech reviewer,gadgets`     | Confirmed canonical tags from `parse`.         |
| `--keywords`    | `tech review,gadget review` | Confirmed keywords from `parse`/`more-words`.  |
| `--has-contact` | (flag)                      | Only creators with contact info.               |
| `--gender`      | `male` / `female`           | Gender filter.                                 |

## Tips

- Always run `parse` first (free) and pass the user-approved `--tags` / `--keywords`
  into `search` so results match what the user saw.
- `parse` returns per-tag / per-keyword creator counts and an `estimatedTotal` — use
  them to set expectations before spending quota.
