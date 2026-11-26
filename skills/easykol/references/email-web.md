# EasyKOL email on the web

Operate the user's signed-in EasyKOL session using their available browser tool.
Use the preferred browser when specified. Check the account, enterprise and
project against the request. Verify that the page has loaded real data before
reporting a result or acting. A demo, permission error or login screen requires
different handling from an empty result. Let the user complete OAuth or other
browser-owned authorization when required. Keep mailbox credentials, message
content and recipient details private.

Apply the [email action scope](../SKILL.md#easykol-email-outreach) before using
web controls. In particular, these actions have live effects:

- **发送测试邮件 / Send a test email** and the send button in the template's
  personalized-opening preview save the template before sending to the signed-in
  account's email address. The regular test also sends copies of configured
  follow-ups immediately to that address. Use the on-screen **预览 / Preview**
  view or a local draft for review. Run a test only when the user authorizes
  the template save and the actual sender, test destination and messages.
  Stop at preview when the available test would save an unapproved change
  or send extra messages.
- **确认 / Confirm** in the final batch send dialog creates plans immediately.
  With immediate delivery selected, sending can start as soon as they are
  queued. Open the dialog to check settings, then stop before confirmation
  until the verified send scope is authorized.
- The batch page's daily-limit control saves when changed. Selecting a regular
  sender in the template editor sets that mailbox as the account default.
  Select the sender in the final batch dialog for a one-time batch choice.
  If a prerequisite is missing, report it before changing account settings.

## Personalized bulk sending

Use [批量发送 / Batch Send](https://app.easykol.com/email/batchSend) or the batch
email action on the authorized project list. Batch sends use the EasyKOL queue,
which applies sender limits and runs scheduled delivery. The public `email-send`
command handles one email. A loop of single sends would lose batch controls and
reporting.

1. Prepare the recipient list from the requested project, selection or import.
   Where available, use the project's batch action to keep creator and project
   associations. Check the import preview for usable addresses and correct
   names. Merge duplicate addresses, check prior outreach and honor opt-outs.
   Check actual addresses against the requested selection, especially when a
   project action can import a wider range.
2. Choose the personal or enterprise template. Use [邮件模板 / Email
   Templates](https://app.easykol.com/email/template) to create or edit it or use
   the [API workflow](email.md#templates). Preview the rendered subject, body,
   personalization and any CC or BCC. An address-only import
   can derive a name from the address. Check names before using a personalized
   greeting. For individualized openings, preview representative recipients and
   check the source used for each claim. Generated openings can change when
   EasyKOL sends the email. If every recipient needs a different
   subject or full body, use separately reviewed single sends or supported
   template groups. The batch recipient list does not take arbitrary per-row
   subjects and bodies.
   Queued plans use the saved template and its follow-up sequence at send time.
   Before editing a template, confirm the user authorizes changes to any queued
   sends that use it. For a change limited to a new batch, use a different
   authorized template.
3. Check the final send dialog for recipient count, template, sender mode, actual
   sender addresses, scheduling and spacing. Recheck the saved template content,
   CC/BCC and follow-up sequence against what the user approved.
   The scheduling dialog takes whole hours relative to submission. Verify its
   estimated start and timezone against the requested time before proceeding.
   Stop at preview if the requested timing cannot be represented or if the
   template has an unapproved follow-up sequence.
   When a sender was named, select single-mailbox mode and verify its address.
   Rotation draws from the account's eligible mailbox pool. Use it only if the
   entire pool is authorized. Split by sender when the request assigns different
   recipients to different mailboxes.
   Check mailbox authorization and available sending limits before submission.
4. Submit once when authorization covers those recipients, content and settings.
5. In [Batch Send Details](https://app.easykol.com/email/batchSend?showDetail=1),
   match plan rows by recipient, sender, template and creation time. The account's
   summary card is an aggregate across submissions. Use matched rows to report
   queued, scheduled, sent, failed, paused and canceled counts, and identify any
   recipients you could not verify. The dialog count is an estimate before
   submission. If the outcome is uncertain, keep the original submission and
   check its receipt, plans and send records. Leave it unconfirmed until you
   can establish whether it was queued or sent. Do not create a replacement
   batch, change its settings to get past the pending submission, or use
   single sends as a fallback.

## Follow-ups and conversation handling

- Use [邮件模板](https://app.easykol.com/email/template) to view or configure an
  initial template's automatic sequence. Prefer the API read for inspection.
  Verify authorization for the text, days and sender before editing. Use the
  web editor only when it offers explicit Save and Cancel for the sequence.
  Older web releases save automatically, including when an existing step is
  opened. On those releases use the guarded API workflow for changes.
  Review the full sequence and its impact before using Save or Remove.
  Saving can modify pending steps and add steps to existing conversations,
  including teammates' schedules for a shared template. Confirm the affected
  scope before saving. EasyKOL uses synced reply status and creates follow-up
  plans after a successful first send when it can link the original conversation.
  Recheck the saved sequence and pending plans. The
  [email API](email.md#automatic-follow-ups) can also manage sequences.
- Use [跟进模板 / Follow-up Templates](https://app.easykol.com/email/follow-up-templates)
  for reusable stage-specific copy. Use [邮件跟进 / Follow-up Workbench](https://app.easykol.com/email/follow-up)
  for project-scoped conversations, stages, notes and manual or batch follow-up.
  Review thread history and preserve the thread for an authorized reply. A
  request for follow-up copy ends at draft or template save, as requested.
- Check [收件箱 / Inbox](https://app.easykol.com/email/inbox) for incoming messages
  scoped to the authorized mailbox. Use aggregate counts when the request asks
  for statistics. Count the visible unread indicators across the relevant pages
  if an unread total is unavailable. Keep inbox unread separate from send tracking.
- When the user requests a fresh sync for a specific mailbox, select it in the
  inbox and use 同步邮件. The 更新已回复状态 action in Send Details starts a sync
  across the user’s mailboxes. Use it only for an authorized account-wide
  sync. A submitted sync runs in the background. Recheck the sync time or
  affected records before reporting refreshed results.
- For authorized plan actions, verify the selected rows in
  [邮件追踪 / Send Details](https://app.easykol.com/email/sendDetails). The global
  resume and cancel controls can affect first emails and follow-ups across
  mailboxes. The global delay action changes spacing for pending and paused
  batch emails across the account. A resend starts another delivery attempt.
  Use global controls only when the requested scope covers all affected plans.

## Records, replies and reporting

- Use [邮件追踪 / Send Details](https://app.easykol.com/email/sendDetails) for
  sent-mail read/reply filters, date range, sender, template, send status/type,
  and CSV export in the personal view. Include unsent plans when checking the
  queue. For sent-mail reports, check actual send timestamps and count each
  in-scope message once.
  The export reads at most 50,000 top-level records and adds separate rows for
  their follow-ups. The page total counts top-level records. Verify the download,
  report any coverage limit and check follow-up rows before counting them toward
  a filtered result. The enterprise statistics view requires an administrator.
- For a specific email ID, use `email-record --id`. For API list reads, use
  `email-records` with the applicable recipient/template filters and paginate
  using `hasMore`. Aggregate only in-scope sent records. Disclose a partial
  sample if some pages or shared-template records are inaccessible.
- Distinguish outbound opens from unread inbox messages, and replies from
  opens. Report sent-mail “未读” as “未记录打开” when explaining results.
  Image blocking and automated image loading can affect open tracking. Reply
  status depends on mailbox sync. Note the account/project, period, timezone
  and latest available sync when relevant. State the sent denominator when
  reporting a rate and whether counts refer to messages or unique recipients.
- Use [建联看板 / Outreach Dashboard](https://app.easykol.com/email/outreach-dashboard)
  for accessible campaign-level reporting. Use the send-detail records for
  individual message or batch verification.

## Mailbox and related tools

- Use [邮箱授权配置 / Mailbox Management](https://app.easykol.com/email/manager) for
  official mailbox binding and reauthorization. Verify the mailbox shown
  afterward. The API can list senders or set the default, display nickname and
  automatic daily limit of an owned mailbox.
- Use [邮箱服务](https://app.easykol.com/email) to open 垃圾箱概率检测 (the mailbox health check)
  when it is visible. Review the page's instructions first. If a test sends a
  real email, use only the authorized test address and sender.
- Use [代理商合作查询 / Agency Cooperation](https://app.easykol.com/email/agency-cooperation)
  for agency contact context when that module is available. Follow the same
  recipient and sender checks if the user then requests outreach.
