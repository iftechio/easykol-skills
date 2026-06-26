# Search Filters

Parameters for `easykol parse`, `easykol more-words`, and `easykol search`. Confirm
the live set with `easykol schema <cmd>`.

## `search` Required Flags

| Flag | Example | Notes |
|------|---------|-------|
| `--sentence` | `"fitness creators US"` | Natural-language description, ≤500 chars |
| `--platform` | `YOUTUBE` | `TIKTOK` / `YOUTUBE` / `INSTAGRAM` — one per call |
| `--regions` | `US,GB` | Comma-separated ISO Alpha-2 codes; at least one |
| `--min-subscribers` | `10000` | Min follower / subscriber count |
| `--avg-min` | `0` | Min avg views (TT/YT) or avg likes (IG) |

## `search` Optional Flags

| Flag | Example | Notes |
|------|---------|-------|
| `--limit` | `20` | 1–50, default 20 |
| `--max-subscribers` | `500000` | Upper follower cap |
| `--languages` | `en,zh` | BCP-47 language codes |
| `--avg-max` | `100000` | Upper avg-views/likes cap |
| `--has-contact` | (flag) | Only creators with a contact email on file |
| `--gender` | `male` / `female` | Creator gender filter |
| `--tags` | `"居家健身/Home Fitness"` | Confirmed canonical tags from `parse` output |
| `--keywords` | `"home workouts,workout at home"` | Confirmed keywords from `parse` / `more-words` |

## Filter Priority by User Intent

| Intent | Key flags |
|--------|-----------|
| Niche sourcing | `--sentence`, `--platform` |
| Regional targeting | `--regions` |
| Budget-constrained | `--min-subscribers`, `--max-subscribers` |
| Outreach-ready | `--has-contact` |
| Audience language | `--languages` |
| Performance floor | `--avg-min` |

## `similar` Filters

`easykol similar` accepts these optional filters to narrow lookalike results:

| Flag | Notes |
|------|-------|
| `--regions` | ISO Alpha-2 codes |
| `--languages` | BCP-47 codes |
| `--min-subscribers` | Min follower count |
| `--max-subscribers` | Max follower count |
| `--min-avg-views` | Min avg views (TT/YT) |
| `--max-avg-views` | Max avg views (TT/YT) |
| `--min-avg-likes` | Min avg likes (IG) |
| `--max-avg-likes` | Max avg likes (IG) |
| `--dedup-days` | Skip creators seen in past N days (default 3, 0 = off) |

## Using `parse` and `more-words`

These are exposed for inspection and debugging. In normal operation `search` runs
them internally.

```bash
# Preview tags + keywords before committing to a search
easykol parse --sentence "fitness creators US" --platform YOUTUBE

# Get more keyword suggestions, excluding what you already have
easykol more-words --sentence "fitness creators US" --platform YOUTUBE \
  --exclude "home workouts,home fitness"
```

Use `parse` output (`canonicalTags`, `keywords`) to populate `--tags` and `--keywords`
in a subsequent `search` call if you want to steer the results.
