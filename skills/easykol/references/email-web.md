# EasyKOL email on the web

Operate the user's signed-in EasyKOL session using their available browser tool.
Use the preferred browser when specified. Check the account, enterprise and
project against the request. Verify that the page has loaded real data before
reporting a result or acting. A demo, permission error or login screen requires
different handling from an empty result. Let the user complete OAuth or other
browser-owned authorization when required. Keep mailbox credentials, message
content and recipient details private.

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
2. Choose the personal or enterprise template. Use [邮件模板 / Email
   Templates](https://app.easykol.com/email/template) to create or edit it or use
   the [API workflow](email.md#templates). Preview the rendered subject, body,
   personalization and attachments or CC if applicable. An address-only import
   can derive a name from the address. Check names before using a personalized
   greeting. For individualized openings, preview representative recipients and
   check the source used for each claim. If every recipient needs a different
   subject or full body, use separately reviewed single sends or supported
   template groups. The batch recipient list does not take arbitrary per-row
   subjects and bodies.
3. Check the final send dialog for recipient count, template, sender mode, actual
   sender addresses, scheduling and spacing, and attached automated follow-ups.
   When a sender was named, select single-mailbox mode and verify its address.
   Use multi-mailbox rotation only within the authorized sender scope. Split by
   sender when the request assigns different recipients to different mailboxes.
   Check mailbox authorization and available sending limits before submission.
4. Submit once when authorization covers those actual recipients, content and
   settings. If the response is lost, search existing send records or batch
   progress for the same submission before considering any resend. Record the
   batch reference when shown, or the template, sender, submission time and
   accepted recipient count. Report queued or scheduled recipients separately
   from sent, failed, paused, canceled and skipped recipients.

## Follow-ups and conversation handling

- Use [邮件模板](https://app.easykol.com/email/template) to view or configure an
  initial template's automatic sequence. Verify text and days for each step,
  original sender, and whether saving changes already scheduled sends. EasyKOL
  handles the schedule and checks for replies. Recheck the saved sequence and
  pending status when the page exposes it. The [email API](email.md#automatic-follow-ups)
  can also manage sequences.
- Use [跟进模板 / Follow-up Templates](https://app.easykol.com/email/follow-up-templates)
  for reusable stage-specific copy. Use [邮件跟进 / Follow-up Workbench](https://app.easykol.com/email/follow-up)
  for project-scoped conversations, stages, notes and manual or batch follow-up.
  Review thread history and reply to the existing conversation where possible.
  A reusable follow-up template alone does not schedule delivery.
- Check [收件箱 / Inbox](https://app.easykol.com/email/inbox) for incoming messages
  scoped to the authorized mailbox. Use aggregate counts when the request asks
  for statistics. Count the visible unread indicators across the relevant pages
  if an unread total is unavailable. Keep inbox unread separate from send tracking.
- For authorized resumption or schedule adjustments, find the specific plan in
  [邮件追踪 / Send Details](https://app.easykol.com/email/sendDetails) and check
  the affected scope before submitting. A bulk action can include both first
  emails and follow-ups. Apply the environment's data-deletion restrictions to
  any action that removes records or clears schedules.

## Records, replies and reporting

- Use [邮件追踪 / Send Details](https://app.easykol.com/email/sendDetails) for
  sent-mail read/reply filters, date range, sender, template, send status/type,
  batch progress and CSV export where available. Verify the filter state and
  total before reporting. When exporting, verify the downloaded row count against
  the filtered total and report any coverage limit. Use the enterprise view only for authorized administrators.
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
