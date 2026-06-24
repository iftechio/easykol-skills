# Error Codes

The CLI signals outcome via exit code and a JSON body. Get the authoritative list
with `easykol agent exit-codes`.

| Code | Name                 | Meaning                              | Recovery                                              |
|------|----------------------|--------------------------------------|-------------------------------------------------------|
| 0    | `OK`                 | Success                              | Use `data`.                                           |
| 1    | `GENERIC_ERROR`      | Unspecified failure                  | Report message; retry if it looks transient.          |
| 2    | `UNAUTHENTICATED`    | No / invalid key                     | `easykol login`, or `easykol auth --key-stdin`.       |
| 3    | `QUOTA_INSUFFICIENT` | Not enough credits                   | Stop; tell user; share `action.url` if present.       |
| 4    | `FORBIDDEN`          | Feature not in plan                  | Explain; share upgrade link if returned.              |
| 5    | `NETWORK_ERROR`      | Connectivity / backend down          | Retry once, then report the outage.                   |
| 6    | `BAD_PARAMS`         | Invalid arguments                    | Re-read `easykol schema <cmd>`; fix flags.            |
| 7    | `RATE_LIMITED`       | Too many requests                    | Back off and retry; report if it persists.            |

## JSON envelope

Every command prints:

```json
{
  "status": "ok",
  "data": { },
  "quota": { "used": 1, "remaining": 9999 },
  "action": { "url": "https://easykol.com/skills/dashboard#quota", "hint": "Top up credits" }
}
```

`action` appears only when the user must do something (top up, log in, request access).
Never fabricate `action.url` — surface it only when the CLI provides it.
