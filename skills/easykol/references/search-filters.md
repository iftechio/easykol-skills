# Search Filters

Parameters for `easykol parse`, `easykol more-words`, and `easykol search`. Confirm
the live set with `easykol schema <cmd>`.

## `search` required flags

| Flag                | Values                             | Notes                                      |
|---------------------|------------------------------------|--------------------------------------------|
| `--sentence`        | free text (≤ 500 chars)            | Full natural-language description.          |
| `--platform`        | `TIKTOK` / `YOUTUBE` / `INSTAGRAM` | One platform per call.                     |
| `--regions`         | `US,GB`                            | Comma-separated ISO Alpha-2, at least one. |
| `--min-subscribers` | `10000`                            | Min follower / subscriber count.           |
| `--avg-min`         | `0`                                | Min avg views (TT/YT) or avg likes (IG).   |

## `search` optional flags

| Flag                | Example      | Notes                                        |
|---------------------|--------------|----------------------------------------------|
| `--limit`           | `20`         | 1–50, default 20.                            |
| `--max-subscribers` | `500000`     | Max follower / subscriber count.             |
| `--languages`       | `en,zh`      | Comma-separated BCP-47 language codes.        |
| `--avg-max`         | `100000`     | Max avg views (TT/YT) or avg likes (IG).     |
| `--has-contact`     | (flag)       | Only creators with a contact email.           |
| `--gender`          | `male`/`female` | Gender filter.                            |

## Advanced: `parse` and `more-words`

These run automatically inside `search`. Use them directly only to debug or inspect
intermediate results:

```
easykol parse --sentence "..." --platform YOUTUBE --regions US --min-subscribers 10000 --avg-min 0
easykol more-words --sentence "..." --platform YOUTUBE --exclude "tag1,tag2"
```
