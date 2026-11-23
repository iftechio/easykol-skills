# Set up creator metric backfill in Feishu Bitable

Create a workflow once in the user's Bitable. Feishu then calls EasyKOL on creator URL edits and writes available metrics to the same row if its current URL still matches. Codex performs setup with the official Feishu CLI under the user's identity.

1. Reuse the intended EasyKOL account's local Skill configuration. Check it with the bundled `doctor` and `quota` commands. Reuse the intended Feishu user profile in `lark-cli`. If needed, install the [official CLI](https://github.com/larksuite/cli) with `npx @larksuite/cli@latest install` and follow its Base user authorization flow. The user completes first-time authorization and any organization approvals in Feishu.
2. Resolve the link with `lark-cli base +url-resolve --url "<url>" --as user`. Use `+table-list` and `+field-list` to confirm the target and the writable Number fields. Use the actual field ID for the creator URL. Set `urlFieldIsHyperlink` to `true` for a hyperlink field so the query uses the link target. Confirm ambiguous mappings.
3. Before creating or enabling, check **both** Feishu lists under the same user profile. Read active canvas workflows with `lark-cli base +workflow-list --base-token <base> --status enabled --as user`. Inspect relevant definitions via `+workflow-get` while projecting only step types, watched table and fields, and request address. Exclude headers and request bodies. Read Automation Center flows with `lark-cli api GET /open-apis/bitable/v1/apps/<base>/workflows --page-all --page-limit 0 --as user`. That list may only expose names and status. If it shows an enabled flow that could overlap, identify its trigger before enabling. If either list cannot be checked, resolve the missing permission or inspect the Automation Center with the user's authorized session before proceeding. With a conflict, confirm which flow to keep. Disable only the specific overlapping flow the user approves, and recheck its state. [Automation Center list](https://open.feishu.cn/document/docs/bitable-v1/app-workflow/list)
4. Confirm the mapping and two helper columns with the user in Codex. The row ID is a Formula field with expression `RECORD_ID()` and the status column is writable Text. Reuse compatible fields by name. If missing, create them once with the user's approval using the [Feishu Formula field guide](https://github.com/larksuite/cli/blob/main/skills/lark-base/references/lark-base-field-formula.md) and the documented `+field-create` syntax. The status column should be visible near the metrics. Only the per-workflow, revocable metrics credential is stored in Feishu. The script uses the local general API Key only to authenticate with EasyKOL.
5. Fill the setup JSON below without credentials. Run `node "{baseDir}/scripts/feishu-workflow.cjs" preview setup.json [profile]` and review the target, filters, and mappings. After approval, run the same command with `create` in place of `preview`. Keep the returned workflow ID and credential ID together. If the outcome is uncertain, check for the workflow before retrying. The same setup reuses the create token. Revoke a credential if its workflow was definitively never created.
6. The new workflow is disabled. If the user requested activation, run `lark-cli base +workflow-enable --base-token <base> --workflow-id <workflow> --as user` after resolving overlaps, and verify enabled status with `+workflow-list`. Use the same Feishu `--profile` throughout, including raw API calls. Only verify with a real URL edit if the user authorizes a test row. If replacing an older workflow that stored a general key, tell the user which flow held it so they can revoke or rotate the old credential through their normal process.
7. To stop using a configured workflow, disable it in Feishu and run `node "{baseDir}/scripts/feishu-workflow.cjs" revoke <credentialId>` under the issuing EasyKOL account. Revoking its parent API Key also invalidates the workflow credential. Keep credentials out of command arguments, chat, logs, and setup JSON.

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
