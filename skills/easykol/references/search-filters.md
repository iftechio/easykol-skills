# Search Filters

Parameters for `easykol parse`, `easykol more-words`, and `easykol search`. Confirm
the live set with `easykol schema <cmd>`.

V2 supports fast / standard / beta with the same public filter names. Read
[search-modes.md](search-modes.md) for mode and task semantics. `more-words`,
`search-legacy` and `parse-legacy` explicitly use V1.

## New search flags

Only --sentence and --platform are required for a new search. --mode defaults to
fast. Omit unspecified hard filters; do not invent follower or geography defaults.

| Flag | Meaning |
|------|---------|
| --mode | fast / standard / beta |
| --sentence | Creator requirement, up to 4000 characters |
| --platform | TIKTOK / YOUTUBE / INSTAGRAM |
| --regions / --languages | Creator countries / languages, comma separated |
| --min-subscribers / --max-subscribers | Follower range |
| --avg-min / --avg-max | Average views (TT/YT), average likes (IG) |
| --has-contact | Contact record present; not proof of a public/deliverable email |
| --gender | Creator male / female; not audience gender |
| --tags / --keywords / --exclude | Canonical tags, keywords and excluded topics |
| --batches | Default 1, fast/standard max 10, beta exactly 1 |
| --visual | Beta optional visual screening |
| --product | Beta product description |
| --audience / --ideal-influencer | Product audience / creator preference; require --product |
| --idempotency-key | Stable submission/recovery key |
| --no-wait / --timeout | Return immediately / polling wait in seconds |
| --confirm-spend | Use existing user approval to exceed the local session budget |

There is no V2 search --limit. `task --limit 1–100 --offset N` only reads stored
rows for free. search-next inherits source parameters and cannot accept replacement
mode/filter flags. For exact installed options use `easykol schema <command>`.

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

`parse --mode` previews V2 preparation and quote; search obtains this preparation
automatically. `more-words` is a legacy V1 utility, not part of V2 execution.

```bash
# Preview tags + keywords before committing to a search
easykol parse --sentence "fitness creators US" --platform YOUTUBE

# Get more keyword suggestions, excluding what you already have
easykol more-words --sentence "fitness creators US" --platform YOUTUBE \
  --exclude "home workouts,home fitness"
```

Use `parse` output (`canonicalTags`, `keywords`) to populate `--tags` and `--keywords`
in a subsequent `search` call if you want to steer the results.
