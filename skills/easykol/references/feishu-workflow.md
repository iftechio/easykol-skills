# Set up creator metric backfill in Feishu Bitable

Create a workflow once in the user's Bitable. Feishu then calls EasyKOL when someone edits the watched creator URL and writes any available follower count and median views to the same row. Codex can perform the setup with the official Feishu CLI under the user's identity.

1. Reuse the intended EasyKOL account's local Skill configuration. Check the API credential with the bundled `doctor` and `quota` commands. Reuse `lark-cli` and the intended Feishu user profile. If missing, install the official CLI with `npx @larksuite/cli@latest install` and follow its user authorization flow for Base permissions. The user completes first-time authorization and any organization approvals in Feishu. [Feishu CLI](https://github.com/larksuite/cli)
2. Resolve the table link with `lark-cli base +url-resolve --url "<url>" --as user`. Use `+table-list` and `+field-list` to confirm the table and exact names. Find the writable Number columns for follower count and median views. Use the actual field ID for the creator URL. For a hyperlink field set `urlFieldIsHyperlink` to `true` so the HTTP request takes the link target. Confirm ambiguous mappings. Create a missing column only with the user's authorization.
3. List existing workflows with `+workflow-list`. Avoid duplicate active workflows watching the same field. Check the proposed scope with the user in Codex. Explain that Feishu will store the EasyKOL API Key in the HTTP action and that workflow editors should be trusted with it. Obtain the user's approval for this before creation and verify that the table is the intended private workspace. Confirm whether to enable the workflow immediately.
4. Fill the setup JSON below with the verified coordinates. Keep API credentials out of it. Run `node "{baseDir}/scripts/feishu-workflow.cjs" preview setup.json [profile]`. The preview contains dummy credential values and uses the installed Feishu CLI's dry run. Review the target, field bindings, and write behavior. Then run the same command with `create` in place of `preview`. The script injects the EasyKOL credentials from the Skill's local config. It prints only a workflow ID or a sanitized failure.
5. The workflow is created disabled. Call `lark-cli base +workflow-enable --base-token <base> --workflow-id <workflow> --as user` when the user has asked for activation. Reuse the same `--profile` selection across the entire setup. Verify the ID and enabled status with `+workflow-list`. If a create response is lost, check for the workflow before retrying the same setup. The script reuses the same create token for the same target and mapping.
6. With an authorized test row, change its URL to a valid creator profile and check both metric cells by record ID. If no test row is authorized, report that the workflow is enabled and a real trigger has yet to be checked. When checking configuration, avoid printing the full `+workflow-get` response because it may contain credentials.

```json
{
  "baseToken": "bascnExample",
  "tableId": "tblExample",
  "tableName": "达人跟进",
  "urlFieldName": "URL",
  "urlFieldId": "fldExample",
  "urlFieldIsHyperlink": false,
  "followerFieldName": "粉丝数",
  "medianViewsFieldName": "播放量中位数"
}
```

Only URL edits trigger the workflow. Empty URLs are ignored. On a successful API response each present metric can be written, including zero. If a metric is missing, its cell is left as is. Feishu records an unsuccessful run when no metric can be written. Enabling affects future edits and does not backfill existing rows automatically.
