# Quota Heuristics

Confirm live pricing with `easykol pricing`. This table is the default model.

| Operation                  | Credits | Notes                                  |
|----------------------------|---------|----------------------------------------|
| Search — per creator returned | 1    | Only returned rows are charged, not the total match count. |
| Profile (basic)            | 1       | Cheap; safe to call freely.            |
| Audience demographics      | 5       | Heavier dataset.                       |
| Contact info               | 10      | Most expensive — **confirm first**.    |
| Lookalikes — per creator   | 1       | Same as search.                        |

## Free tier

New users get **100 free credits** on signup.

## Budgeting rules for the agent

- Estimate cost before bulk calls: `limit × per-creator cost`. If it would consume a
  large share of remaining quota, confirm with the user first.
- Read the `quota` block on every response; warn when `remaining` is low.
- On exit code `3` (quota insufficient), stop, report, and share `action.url` only if
  the CLI returned one.
