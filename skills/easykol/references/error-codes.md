# Error Codes

The CLI signals outcome via exit code and a JSON body. Get the list with
`easykol exit-codes`.

| Code | Name                 | Meaning                              | Recovery                                              |
|------|----------------------|--------------------------------------|-------------------------------------------------------|
| 0    | `OK`                 | Success                              | Use `data`.                                           |
| 1    | `GENERIC`            | Unspecified failure                  | Report message; retry if it looks transient.          |
| 2    | `UNAUTH`             | No / invalid key                     | `easykol auth --key-stdin --email <email>`.           |
| 3    | `QUOTA`              | Not enough credits                   | Stop; tell user; share `action.url` if present.       |
| 4    | `FORBIDDEN`          | Feature not in plan                  | Explain; suggest upgrade.                             |
| 5    | `NETWORK`            | Connectivity / backend down          | Retry once, then report the outage.                   |
| 6    | `PARAMS`             | Invalid arguments                    | Re-read `easykol schema <cmd>`; fix flags.            |
| 7    | `RATELIMIT`          | Too many requests                    | Back off and retry; report if it persists.            |
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
spend). Never fabricate `action.url` — surface it only when the CLI provides it.

## How the CLI maps HTTP → exit code

The backend wraps responses as `{ statusCode, error, message, data }`. The CLI maps the
HTTP status to an exit code: 401→2, 403→4, 402 / "quota" message→3, 429→7, 400→6,
5xx / network→5, other→1.

Exit code **8** is local (CLI session budget / `--limit` soft cap). It is not an HTTP
mapping — treat it as a hard stop until the user approves more spend.
