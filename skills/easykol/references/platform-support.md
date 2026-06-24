# Platform Support

| Capability            | YouTube | TikTok | Instagram |
|-----------------------|:-------:|:------:|:---------:|
| Search / discovery    | ✅      | ✅     | ✅        |
| Lookalikes            | ✅      | ✅     | ✅        |
| Profile (basic)       | ✅      | ✅     | ✅        |
| Audience demographics | ✅      | ✅     | ✅        |
| Recent content        | ✅      | ✅     | ✅        |
| Contact info          | ✅      | ✅     | ✅        |

Notes:

- One search targets one platform at a time (`--platform`).
- Field availability per creator depends on what EasyKOL has crawled; missing fields
  are returned as null rather than fabricated.
- ChatGPT is **not** supported as a host environment (no CLI execution).
