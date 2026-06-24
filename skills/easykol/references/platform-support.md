# Platform Support

| Capability                        | YouTube | TikTok | Instagram |
|-----------------------------------|:-------:|:------:|:---------:|
| `parse` (preview)                 | ✅      | ✅     | ✅        |
| `more-words`                      | ✅      | ✅     | ✅        |
| `search`                          | ✅      | ✅     | ✅        |

Platform values: `YOUTUBE`, `TIKTOK`, `INSTAGRAM` (one per call).

## Field notes per platform

- **`averagePlayCount`** is populated for YouTube / TikTok; `null` for Instagram.
- **`averageLikeCount`** is populated for Instagram; `null` for YouTube / TikTok.
- **`region`** comes from the platform sub-profile; YouTube creators have **no region**
  (always `null`). `language` is available on all three.
- **`email`** may be an empty string when no contact is on file.

## Not yet exposed via the CLI

profile (`/kol`), lookalikes (`/similar`), contacts (`/kol-emails`), and video
(`/video`) exist on the backend across the same three platforms but are not in the
v0.1.0 CLI. See the SKILL Roadmap.

## Host environments

Claude Code, Cursor, Codex are supported. **ChatGPT is not** (no CLI execution).
