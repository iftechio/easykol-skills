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
