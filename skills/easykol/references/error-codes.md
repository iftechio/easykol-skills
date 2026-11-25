# Error Codes

The API helper signals outcome via exit code and a JSON body. Get the list with
`node "{baseDir}/scripts/api.cjs" exit-codes`.

| Code | Name                 | Meaning                              | Recovery                                              |
|------|----------------------|--------------------------------------|-------------------------------------------------------|
| 0    | `OK`                 | Success                              | Use `data`.                                           |
| 1    | `GENERIC`            | Unspecified failure                  | Report message. Check the original task before retrying a write.          |
| 2    | `UNAUTH`             | No / invalid key                     | `node "{baseDir}/scripts/api.cjs" auth --key-stdin --email <email>`.           |
| 3    | `QUOTA`              | Not enough credits                   | Stop; tell user; share `action.url` if present.       |
| 4    | `FORBIDDEN`          | Feature not in plan                  | Explain; suggest upgrade.                             |
| 5    | `NETWORK`            | Connectivity / backend down          | For paid searches, recover the same key/task; never replace it.                   |
| 6    | `PARAMS`             | Invalid arguments                    | Re-read `node "{baseDir}/scripts/api.cjs" schema <cmd>`; fix flags.            |
| 7    | `RATELIMIT`          | Too many requests                    | Back off for reads. Check a write outcome before repeating it.            |
| 8    | `BUDGET`             | Search session budget exceeded       | Stop; ask user; retry with `--confirm-spend` only if approved. |

## Output envelope

Success:

```json
{ "status": "ok", "data": { }, "action": { "url": "…", "hint": "…" } }
```

Failure (process also exits with the code):

```json
{ "status": "error", "error": { "code": 8, "message": "…" }, "action": { "hint": "…" } }
```

`action` appears only when the user must do something (top up, authenticate, approve
spend). Never fabricate `action.url` — surface it only when the API helper provides it.

## How the API helper maps HTTP → exit code

The backend wraps responses as `{ statusCode, error, message, data }`. The API helper maps the
HTTP status to an exit code: 401→2, 403→4, 402 / "quota" message→3, 429→7, 400→6,
5xx / network→5, other→1.

V2 404 maps to exit 6 with a deployment or ownership hint. The Skill preserves
the requested search contract.

A backend `Route ... not found` response means the deployed route is unavailable.
Distinguish it from a missing or inaccessible record on an existing route. If
validation rejects a field present in the helper schema, verify the endpoint’s
deployed contract. For an unsupported hard filter, keep the requested criterion
and report it as pending. On paid operations, use a free preparation or check the
deployed API contract where available before submitting. Confirm saved filters,
returned evidence and billing data before reporting the feature worked. An
accepted request alone may leave an older option unapplied.

409 identifies a conflicting key or existing continuation. Read that task instead of
creating a new key. Polling timeout returns the existing task with pollingTimedOut.

Exit code **8** is local (API helper quote-based session budget; legacy `--limit` soft cap). It is not an HTTP
mapping — treat it as a hard stop until the user approves more spend.
