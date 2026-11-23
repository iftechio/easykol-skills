# Set up creator metric backfill in Feishu Bitable

Create a workflow once in the user's Bitable. Feishu then calls EasyKOL on creator URL edits and writes available metrics to the same row if its current URL still matches. Codex performs setup with the official Feishu CLI under the user's identity.

## First-time authorization

Run commands for the user. At first use, the user may need to approve EasyKOL and Feishu in the browser. Continue with the original table and request after each approval. Only ask them to open the official approval link or complete a sign-in, and keep passwords, API Keys, tokens, and device codes out of the conversation.

**Feishu**

1. Reuse `lark-cli` and the intended Feishu profile if available. If missing, install the [official CLI](https://github.com/larksuite/cli#quick-start-ai-agent) with `npx --yes @larksuite/cli@latest install`. Check `lark-cli auth status --json` for the intended user identity. A ready bot does not establish user authorization. Keep the same `--profile` throughout, including raw API calls.
2. If there is no suitable configured profile, start `lark-cli config init --new --name easykol-feishu` in the background and present its official browser setup link. Choose an unused name if that profile already exists. Carry the chosen name with `--profile` on subsequent requests. Once the profile is configured, start `lark-cli auth login --domain base --scope "base:workflow:read base:workflow:create base:workflow:update" --no-wait --json` if user authorization is missing. Present the official verification link, or generate a QR code with `lark-cli auth qrcode`. Keep the returned private device code in the runner and complete authorization with `lark-cli auth login --device-code <device-code>` after the user approves. Reuse the app configuration when only the user grant is missing.
3. Recheck user authorization. Verify access by resolving the supplied Base link and listing its fields and both types of flows. Feishu requires both an app permission grant and the user's authorization. For `99991672 app_scope_not_applied`, report which app permission Feishu requested and surface the official developer console or organization approval path. After the app permission is granted, refresh user authorization and retry as the same user. If the user grant alone is missing, resume that authorization flow. For a Wiki link, add only `wiki:node:retrieve` if Feishu reports it missing. Do not switch to bot identity or skip either duplicate check.

**EasyKOL**

1. Run `node "{baseDir}/scripts/feishu-workflow.cjs" status` before issuing a workflow credential. A ready existing Skill Key may be reused when it belongs to the intended account and the bundled `quota` check succeeds.
2. If there is no valid EasyKOL configuration, run `node "{baseDir}/scripts/feishu-workflow.cjs" authorize`. Show only the returned official verification link and its public confirmation code. The helper saves the private authorization state locally, so rerunning `authorize` while it is pending returns the same link. After the user approves, run `node "{baseDir}/scripts/feishu-workflow.cjs" authorize-poll`. Respect `retryAfterSeconds` while pending. If denied or expired, report the outcome and only start a new request when the user wants to continue.
3. Once ready, resume the intended operation without asking the user for an API Key. Device approval is short-lived and scoped to Feishu credential management. Start it near workflow creation when possible. The dedicated metrics credential stays valid in Feishu after the temporary approval expires. A missing scoped-authorization service or an account without EasyKOL API access blocks the operation.

## Configure the workflow

1. Resolve the link with `lark-cli base +url-resolve --url "<url>" --as user`. Use `+table-list` and `+field-list` to confirm the target and writable Number fields. Use the actual field ID for the creator URL. Set `urlFieldIsHyperlink` to `true` for a hyperlink field so the query uses the link target. Confirm ambiguous mappings.
2. Before creating or enabling, check **both** Feishu lists under the same user profile. Read active canvas workflows with `lark-cli base +workflow-list --base-token <base> --status enabled --as user`. Inspect relevant definitions via `+workflow-get` while projecting only step types, watched table and fields, and request address. Exclude headers and request bodies. Read Automation Center flows with `lark-cli api GET /open-apis/bitable/v1/apps/<base>/workflows --page-all --page-limit 0 --as user`. That list may only expose names and status. If it shows an enabled flow that could overlap, identify its trigger before enabling. If either list cannot be checked, resolve the missing permission or inspect the Automation Center with the user's authorized session before proceeding. With a conflict, confirm which flow to keep. Disable only the specific overlapping flow the user approves, and recheck its state. [Automation Center list](https://open.feishu.cn/document/docs/bitable-v1/app-workflow/list)
3. Confirm the target, column mappings, any missing or helper fields, workflow activation, and test-row scope together in Codex. The row ID helper is a Formula field with expression `RECORD_ID()` and the status helper is writable Text. Reuse compatible fields by name and keep the status column visible near the metrics. If missing, read the [Feishu Formula field guide](https://github.com/larksuite/cli/blob/main/skills/lark-base/references/lark-base-field-formula.md), then create the approved fields with `+field-create`. For a Formula field pass `--i-have-read-guide` and use `{"name":"EasyKOL 回填行 ID","type":"formula","expression":"RECORD_ID()"}`. Only the dedicated, revocable metrics credential is stored in Feishu.
4. Fill the setup JSON below without credentials. Run `node "{baseDir}/scripts/feishu-workflow.cjs" preview setup.json [profile]` and verify the target, filters, and mappings. After approval and authorization, run the same command with `create` in place of `preview`. Keep the returned workflow ID and credential ID together. If the outcome is uncertain, retain the credential ID from the error and check whether that workflow was already created. Retry only after confirming the first attempt did not create it. Revoke a credential if its workflow was definitively never created.
5. The new workflow is disabled. If the user requested activation, run `lark-cli base +workflow-enable --base-token <base> --workflow-id <workflow> --as user` after resolving overlaps, and verify enabled status with `+workflow-list`. Only verify with a real URL edit if the user authorizes a test row. If replacing an older workflow that stored a general key, tell the user which flow held it so they can revoke or rotate the old credential through their normal process.
6. To stop using a configured workflow, disable it in Feishu and run `node "{baseDir}/scripts/feishu-workflow.cjs" revoke <credentialId>` under the issuing EasyKOL account. For a credential issued with device authorization, use the same browser authorization flow if needed. Revoking its parent API Key also invalidates the workflow credential.

```json
{
  "baseToken": "bascnExample",
  "tableId": "tblExample",
  "tableName": "达人跟进",
  "urlFieldName": "URL",
  "urlFieldId": "fldExample",
  "urlFieldIsHyperlink": false,
  "followerFieldName": "粉丝数",
  "medianViewsFieldName": "播放量中位数",
  "recordIdFieldName": "EasyKOL 回填行 ID",
  "statusFieldName": "EasyKOL 回填状态"
}
```

Rows are marked pending when a non-empty URL changes. Feishu filters each update by the triggering record ID and URL. A complete response updates both metrics and clears the pending status. Partial responses label the retained missing metric as historical. If no metric is available or the request fails, the row keeps the pending status. Existing rows update after their next qualifying URL edit.
