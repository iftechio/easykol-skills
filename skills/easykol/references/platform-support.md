# Platform Support

Platform values passed to CLI: `YOUTUBE`, `TIKTOK`, `INSTAGRAM` (one per call).

## Command Availability by Platform

| Command | YouTube | TikTok | Instagram |
|---------|:-------:|:------:|:---------:|
| `search` | ✅ | ✅ | ✅ |
| `parse` | ✅ | ✅ | ✅ |
| `more-words` | ✅ | ✅ | ✅ |
| `kol` | ✅ | ✅ | ✅ |
| `similar` | ✅ | ✅ | ✅ |
| `audience` | ✅ | ✅ | ✅ |
| `emails` | ✅ | ✅ | ✅ |
| `video` | ✅ | ✅ | ✅ (posts/reels) |

## Field Notes by Command

### `search` / `kol` result fields

| Field | YouTube | TikTok | Instagram |
|-------|---------|--------|-----------|
| `followerCount` | ✅ | ✅ | ✅ |
| `averagePlayCount` | ✅ (views) | ✅ (views) | `null` |
| `averageLikeCount` | `null` | `null` | ✅ (likes) |
| `region` | `null` (not available) | ✅ | ✅ |
| `language` | ✅ | ✅ | ✅ |
| `email` | may be empty string | may be empty string | may be empty string |

> YouTube creators do not have a `region` field — always `null`. Use `language` for
> language targeting instead.

### `audience` result fields

| Field | YouTube | TikTok | Instagram |
|-------|---------|--------|-----------|
| Portrait (age/gender) | ✅ | ✅ | ✅ |
| Region breakdown | ✅ | ✅ | ✅ |
| Fake-follower rate | ✅ | ✅ | Limited |

> `suspectedFakeRate` may be less reliable for Instagram due to smaller sample sizes.

### Important verification limits

- Search filters describe the **creator/account**, not the creator's audience. The
  `gender` filter means creator gender; it does not mean female audience share.
- Audience analysis is returned per profile and is not a search filter. The age buckets
  (`under18`, `18–25`, `25–45`, `above45`) cannot prove an exact `25–40` threshold.
- There is no TikTok Shop fulfilment-rate field or filter in the CLI/API.
- `hasContactInfo` means EasyKOL has a contact record. It is not a guarantee that the
  email is public, current, deliverable, or non-empty in every returned row.
- Search returns the current response only, with a maximum `limit` of 50. A parse
  `estimatedTotal` is an estimate and must not be described as a complete candidate
  pool.

### `video` supported URL types

| Platform | Supported |
|----------|-----------|
| YouTube (`youtube.com/watch?v=...`) | ✅ |
| TikTok (`tiktok.com/@.../video/...`) | ✅ |
| Instagram (`instagram.com/p/...`, `/reel/...`) | ✅ |
| Facebook (`facebook.com/.../videos/...`) | ✅ |
| Threads | ✅ |

## Host Environments

Claude Code, Cursor, Codex — supported (all have CLI execution).
**ChatGPT — not supported** (no shell access).
