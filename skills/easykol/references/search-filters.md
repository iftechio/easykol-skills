# Search Filters

Parameters for `node "{baseDir}/scripts/api.cjs" parse-v2`, `node "{baseDir}/scripts/api.cjs" more-words`, and `node "{baseDir}/scripts/api.cjs" search-v2`. Confirm
the live set with `node "{baseDir}/scripts/api.cjs" schema <cmd>`.

V2 supports fast, standard, beta, tag and keyword. Read [search modes](search-modes.md)
for mode rules. `more-words`, `search` and `parse` use the legacy V1 contract.

## New search flags

`--platform` is required for every mode. Fast, standard and beta require
`--sentence`. Tag requires `--tags`; keyword requires `--keywords`. For tag or
keyword, `--sentence` is optional. The default mode is fast. Submit the hard
filters the user chose.

| Flag | Meaning |
|------|---------|
| --mode | `fast`, `standard`, `beta`, `tag`, `keyword` |
| --search-data-mode | Tag and keyword only. `historical` (default) or `realtime` |
| --sentence | Creator requirement, up to 4000 characters |
| --locale | Response language, `en` or `zh` |
| --platform | TIKTOK / YOUTUBE / INSTAGRAM |
| --regions / --languages | Creator countries / languages, comma separated |
| --min-subscribers / --max-subscribers | Follower range |
| --avg-min / --avg-max | Average views (TikTok/YouTube), average likes (Instagram) |
| --view-min / --view-max | Separate Instagram views range |
| --use-median-play-count | Use median play count for the Instagram views range |
| --only-video-creators | Require Instagram video creators |
| --has-contact | Require a stored contact record |
| --has-direct-contact | Require a stored phone number or email |
| --has-tk-shop | Require stored TikTok Shop presence, TikTok only |
| --is-amz-partner | Require stored Amazon partner status, Instagram only |
| --has-video-cart | TikTok only. Require explicit post-level product anchors in stored data. Search V2 uses the advanced-filter price |
| --gender | Creator male / female; not audience gender |
| --skin-colors / --age-range | Creator code keys (`white`, `youngAdult`) or numeric age range |
| --main-category / --sub-category | Content taxonomy code keys such as `beauty` / `makeup` |
| --tone / --tones | One content-tone code key or a comma-separated list |
| --tone-exclude | Comma-separated list of content-tone code keys to exclude |
| --face-on-camera | Require the creator to appear on camera |
| --format-tags / --scene-tags | Comma-separated content-format / scene code keys |
| --last-published-days | Require activity in the last 1–3650 days |
| --tags / --keywords / --exclude | Canonical tags, keywords and excluded topics |
| --expanded-query | Explicit rewritten recall text instead of the generated query |
| --focus-keyword | Keyword to prioritize |
| --match-precision-mode | `strict`, `balanced` or `fuzzy` |
| --bio-only | Match the search in creator profile text |
| --batches | Default 1. Fast, standard, tag and keyword max 10. Beta max 20 on compatible deployments |
| --visual | Beta optional visual screening |
| --product | Beta product description |
| --audience / --ideal-influencer | Product audience / creator preference; require --product |
| --idempotency-key | Stable submission/recovery key |
| --no-wait / --timeout | Return immediately / polling wait in seconds |
| --confirm-spend | Use existing user approval to exceed the local session budget |

There is no V2 search --limit. `task --limit 1–100 --offset N` only reads stored
rows for free. `search-next` inherits the source mode and hard filters. Use
`--batches` to change the next batch count within the authorized scope. Use `node "{baseDir}/scripts/api.cjs" schema <command>` to
inspect the installed helper. Use free preparation and saved `effectiveParameters`
to verify deployment support and the option actually applied.

The API and API helper use stable English taxonomy code keys. The backend translates them
to stored taxonomy values only at worker execution and returns the public code keys
in `effectiveParameters`. Do not send stored Chinese values when a documented code
key exists. `search-next` reuses the exact translated task parameters.

In fast, standard and beta, passing `--keywords ''` explicitly sends `keywords: []`: this disables only keyword
recall and keeps canonical-tag and semantic recall active. Omitting `--keywords`
allows the parser to generate keywords. Do not treat an empty array by itself as a
zero-recall diagnosis; inspect the saved effective parameters and recall funnel.

For Instagram, choose either average likes (`--avg-min` / `--avg-max`) or views
(`--view-min` / `--view-max`). The view selection can use average or median.

## Filter Priority by User Intent

| Intent | Key flags |
|--------|-----------|
| Niche sourcing | `--sentence`, `--platform` |
| Regional targeting | `--regions` |
| Budget-constrained | `--min-subscribers`, `--max-subscribers` |
| Outreach-ready | `--has-contact` |
| Creator language | `--languages` |
| Performance floor | `--avg-min` |
| TikTok storefront | `--has-tk-shop` |
| Recent activity | `--last-published-days` |

## Result and export filters

Use `task --task-id <id>` to read results. For a task created on the website,
pass its exact `--task-id` and `--project-id` together. These controls require a
compatible deployment. They scope stored results and Excel output.

| Flag | Meaning |
|------|---------|
| --attitude | `NORATE` (pending review), `LIKE` (favorite), `SUPERLIKE` or `DISLIKE` (NO) |
| --include-similar-favorites | Include related similar-search favorites in the eligible favorite result scope |
| --has-email | Apply the website contact availability filter. Check the returned email field before promising an email |
| --updated-within-60-days | Only creators who posted in the last 60 days |
| --has-tk-shop | Filter stored rows for TikTok Shop presence |
| --is-amz-partner | Filter stored rows for Amazon partner status |

`task --offset` and `--limit` control the free page read. `search-export --task-id
<id> --output <path>` accepts the same result filters and `--project-id`, and
downloads the matching scope to a new `.xlsx` file for free. Creator emails are
omitted unless `--include-emails` is set. Check the generated file before
reporting the export complete.

## `similar` Filters

`node "{baseDir}/scripts/api.cjs" similar` accepts these optional filters to narrow lookalike results:

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
| `--has-video-cart` | TikTok only. Check deployment support before paying for this filter |
| `--dedup-days` | Skip creators seen in past N days (default 3, 0 = off) |

## Using `parse-v2` and legacy `more-words`

`parse-v2 --mode` previews V2 preparation and quote; search obtains this preparation
automatically. `more-words` is a legacy V1 utility, not part of V2 execution.

```bash
# Preview tags + keywords before committing to a search
node "{baseDir}/scripts/api.cjs" parse-v2 --sentence "fitness creators US" --platform YOUTUBE

# Get more keyword suggestions, excluding what you already have
node "{baseDir}/scripts/api.cjs" more-words --sentence "fitness creators US" --platform YOUTUBE \
  --exclude "home workouts,home fitness"
```

Use `parse-v2` output (`canonicalTags`, `keywords`) to populate `--tags` and `--keywords`
in a subsequent `search-v2` call if you want to steer the results.
