# Search Filters

Reference for `easykol kol search` and `easykol kol search-filter`. Always confirm
exact flag names with `easykol schema kol search`; this file documents intent.

## Core filters

| Filter        | Example                          | Notes                                  |
|---------------|----------------------------------|----------------------------------------|
| `--platform`  | `youtube` / `tiktok` / `instagram` | Required. One platform per search.   |
| `--niche`     | `tech`, `beauty`, `gaming`       | Free-text tag(s); comma-separated.     |
| `--followers` | `100000-500000`                  | Follower / subscriber range.           |
| `--region`    | `US`, `JP`, `SEA`                | ISO country code or region group.      |
| `--language`  | `en`, `ja`, `zh`                 | Content language.                      |
| `--limit`     | `50`                             | Max results (each returned creator costs quota). |

## Narrowing with `search-filter`

`easykol kol search-filter` applies post-filters to an existing result set, e.g.:

- de-duplicate creators already in a list / campaign,
- drop creators below an engagement-rate threshold,
- keep only creators with visible contact info.

## Tips

- Keep `--limit` tight first; every returned creator consumes quota.
- For "creators like X", prefer `easykol kol lookalikes` over guessing niche tags.
