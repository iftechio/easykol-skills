# Search Filters

Parameters for `easykol parse-v2`, `easykol more-words`, and `easykol search-v2`. Confirm
the live set with `easykol schema <cmd>`.

V2 supports fast / standard / beta with the same public filter names. Read
[search-modes.md](search-modes.md) for mode and task semantics. `more-words`,
`search` and `parse` explicitly use V1.

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
| --has-tk-shop | Require stored TikTok Shop presence; TikTok only, not a live shop check |
| --gender | Creator male / female; not audience gender |
| --skin-colors / --age-range | Creator code keys (`white`, `youngAdult`) or numeric age range |
| --main-category / --sub-category | Content taxonomy code keys such as `beauty` / `makeup` |
| --tone | Content-tone code key such as `authoritative` |
| --face-on-camera | Require the creator to appear on camera |
| --format-tags / --scene-tags | Comma-separated content-format / scene code keys |
| --last-published-days | Require activity in the last 1–365 days |
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

The API and CLI use stable English taxonomy code keys. The backend translates them
to stored taxonomy values only at worker execution and returns the public code keys
in `effectiveParameters`. Do not send stored Chinese values when a documented code
key exists. `search-next` reuses the exact translated task parameters.

Passing `--keywords ''` explicitly sends `keywords: []`: this disables only keyword
recall and keeps canonical-tag and semantic recall active. Omitting `--keywords`
allows the parser to generate keywords. Do not treat an empty array by itself as a
zero-recall diagnosis; inspect the saved effective parameters and recall funnel.

## Filter Priority by User Intent

| Intent | Key flags |
|--------|-----------|
| Niche sourcing | `--sentence`, `--platform` |
| Regional targeting | `--regions` |
| Budget-constrained | `--min-subscribers`, `--max-subscribers` |
| Outreach-ready | `--has-contact` |
| Audience language | `--languages` |
| Performance floor | `--avg-min` |
| TikTok storefront | `--has-tk-shop` |
| Recent activity | `--last-published-days` |

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

## Using `parse-v2` and legacy `more-words`

`parse-v2 --mode` previews V2 preparation and quote; search obtains this preparation
automatically. `more-words` is a legacy V1 utility, not part of V2 execution.

```bash
# Preview tags + keywords before committing to a search
easykol parse-v2 --sentence "fitness creators US" --platform YOUTUBE

# Get more keyword suggestions, excluding what you already have
easykol more-words --sentence "fitness creators US" --platform YOUTUBE \
  --exclude "home workouts,home fitness"
```

Use `parse-v2` output (`canonicalTags`, `keywords`) to populate `--tags` and `--keywords`
in a subsequent `search-v2` call if you want to steer the results.
