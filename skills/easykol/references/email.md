# Email templates and outreach

Requires a backend release supporting `/external/v1/email` and the bundled
API script exposing `email-template-list`. Check `node "{baseDir}/scripts/api.cjs" schema <command>` before execution. A 404
means unavailable endpoint or inaccessible template; distinguish only when verified.
Use the configured API key and email. For web-only actions or a verified API
availability issue, use the [email web workflow](email-web.md) under the intended
account. Keep credentials out of prompts, logs and output.
Apply the [email action scope](../SKILL.md#easykol-email-outreach) to both API
and web operations. Pass a confirmation flag only for the user-authorized
action after verifying its scope. The API helper stops on redirects for email
writes. If a change returns a redirect, check the current state before another
attempt.

## Templates

- `email-template-list`, `email-template-get --id`: read existing content first.
- `email-template-create`, `email-template-update --id`: JSON via `--body-file`
  (or `--body-file -` and stdin). Fields: name, subject, content, tags, cc,
  aiPersonalizedOpeningEnabled. Owner, enterprise and record state cannot be changed.
- `--shared` selects the authenticated email's enterprise. Writes require its
  administrator. Never reuse a previous customer's enterprise.
- `email-followup-template-list [--stage]`, `email-followup-template-create`,
  `email-followup-template-update --id`: stage-specific copy. Fields: stage, name,
  subject, content, cc, bcc, sortOrder; create also accepts shared (administrator).
  Only the creator can update a follow-up template.
- Supported variable: `{{nickname}}`. Preserve variables when rewriting.
  Pending batch plans load the saved template at delivery. Before updating
  an existing template via API, check its queued use in the web send plans.
  Save changes only within the scope the user authorized and respect template
  count limits.

Example update: `{"subject":"A collaboration idea for {{nickname}}","content":"Hi {{nickname}}, ..."}`.
Draft or rewrite locally, then save within the user's authorized scope.

## Automatic follow-ups

Read `email-followups-get --id` first. `email-followups-set --id --body-file ...`
accepts `followupEmails: [{"content":"...","daysAfter":3}]` with whole days >= 1 and requires
`--confirm-scheduled-changes`. Saving synchronizes pending scheduled emails,
including adding future follow-ups to active threads. Explain this impact and get
authorization for the concrete sequence before setting the flag. Existing authorization
applies when it already covers the change. A replacement can cancel pending steps.
The helper verifies the returned template and saved sequence. If the result is
uncertain, read the saved sequence and review pending plans before considering
another change.
Apply the environment’s data-deletion rules before changing or clearing a
sequence. EasyKOL runs the scheduled sequence and checks for replies in the
original conversation. Check the thread and mailbox status in the web workflow
when a plan is paused or a reply has not synced.
Subjects stay `Re: <first email subject>`; per-follow-up subjects are unsupported.
Sequence access follows the web template access rules; enterprise members can
configure accessible shared sequences, which also affects team pending schedules.

## Sending a single email

Use the [web batch workflow](email-web.md#personalized-bulk-sending) for groups.

`email-senders` lists connected mailboxes without credentials. New mailbox binding
and reauthorization still use the web flow; do not claim API binding is supported.
`email-sender-default --id` sets an owned connected mailbox as default.
`email-sender-nickname --id --body-file` accepts `{"nickname":"Name"}`.
`email-sender-limit --id --body-file` accepts `{"autoEmailDailyLimit":50}`;
0 disables automatic sending on that mailbox, and the web maximum still applies.
The limit must be an integer and applies to automatic emails. Change mailbox
settings only when the user requests that setting change.

Before `email-send --body-file ... --confirm-send`, verify the actual recipient,
sender, subject, content, CC/BCC and automatic follow-up sequence. Use the
verified addresses in `email` and `usingEmail` so delivery uses the addresses
the user authorized. Fields also include templateId or followUpTemplateId,
kolId, projectId, subject, content, replyToEmailRecordId. Custom subject+content
can replace template selection. Supplying a project and creator can also mark that
creator as liked, matching web sending; include this effect in the review.

Never retry sending automatically: a network error may occur after delivery. Check
mailbox/web records and report uncertain delivery before considering another send.
Use `email-record --id <returned-record-id>` to check a result. `submissionState=ACCEPTED`
means a persisted `sentAt` confirms submission; it does not guarantee inbox delivery.
`UNCONFIRMED` means `sentAt` is missing, even if legacy `status` says SENT. Do not
claim success or resend based on status alone. `isRead` / `isReplied` are stored
tracking signals, not proof of human reading or live polling.
`email-records [--page 1 --page-size 20 --to ... --template-id ...]` lists records
in the web template-owner scope and own follow-ups. Shared-template API sends can
also be read individually by their sender using `email-record`; keep returned IDs.
The list supports recipient and template filters. For read/reply filters, date
ranges, batch progress, CSV, or enterprise totals, use [web reporting](email-web.md#records-replies-and-reporting).
Existing web email rules and limits apply, with no additional API AI credits.
Do not expose internal model/provider names in copy or explanations.
