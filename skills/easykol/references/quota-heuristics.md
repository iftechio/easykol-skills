# Quota Heuristics

EasyKOL bills against your membership quota (the same credits the web app uses). In
v0.1.0, only **`search`** consumes quota.

| Command       | Cost              | Notes                                              |
|---------------|-------------------|----------------------------------------------------|
| `doctor`      | free              | Local + connectivity check.                        |
| `auth`        | free              | Saves key + email.                                 |
| `quota`       | free              | Remaining credits on the account.                  |
| `parse`       | free              | Preview tags + keywords + estimated total.         |
| `more-words`  | free              | More keyword suggestions.                          |
| `search`      | **N** (see below) | N = number of creators returned; **0 results = free**. |

## Rules for the agent

- **Do not run `parse` before `search` by default.** `/intelligent-search` handles
  tag/keyword selection internally. Call `parse` only when debugging or when the user
  explicitly wants to inspect tags before searching.
- A search that returns **zero results is not charged**.
- On `exit code 3` (quota insufficient), stop, report, and share `action.url` only if
  the CLI returned one.

## Roadmap costs (not yet in the CLI)

When profile / lookalikes / contacts land, expect heavier operations (e.g. contact
extraction) to cost more per call. Always check `easykol schema <cmd>` and the returned
`action` hint for the authoritative cost.
