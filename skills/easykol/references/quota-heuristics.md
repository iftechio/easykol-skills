# Quota Heuristics

EasyKOL bills against your membership quota (the same credits the web app uses). Only
the **search** consumes quota in v0.1.0; previewing is free.

| Command       | Cost     | Notes                                              |
|---------------|----------|----------------------------------------------------|
| `doctor`      | free     | Local + connectivity check.                        |
| `auth`        | free     | Saves key + email.                                 |
| `quota`       | free     | Backend endpoint pending — reports `available:false` until deployed. |
| `parse`       | **free** | Preview: tags + keywords + estimated total.        |
| `more-words`  | **free** | More keyword suggestions.                          |
| `search`      | 1 quota  | One charge per successful search call.             |

## Rules for the agent

- Preview with `parse` (free) and confirm with the user **before** calling `search`.
- A search that returns **zero results is not charged** (backend only bills successful,
  non-empty responses).
- On `exit code 3` (quota insufficient), stop, report, and share `action.url` only if
  the CLI returned one.

## Roadmap costs (not yet in the CLI)

When profile / lookalikes / contacts land, expect heavier operations (e.g. contact
extraction) to cost more per call. Always check `easykol schema <cmd>` and the returned
`action` hint for the authoritative cost.
