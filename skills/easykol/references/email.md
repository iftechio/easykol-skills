# Email templates and outreach

Requires a backend release supporting `/external/v1/email` and a CLI exposing
`email-template-list`. Check `easykol schema <command>` before execution. A 404
means unavailable endpoint or inaccessible template; distinguish only when verified.
Never silently switch to browser authentication or another account.
Use the configured API key and email; never print credentials.

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
  Saving does not send email. Do not duplicate templates to bypass count limits.
  Template deletion is not exposed.

Example update: `{"subject":"A collaboration idea for {{nickname}}","content":"Hi {{nickname}}, ..."}`.
Draft or rewrite locally, then save within the user's authorized scope.

## Automatic follow-ups

Read `email-followups-get --id` first. `email-followups-set --id --body-file ...`
accepts `followupEmails: [{"content":"...","daysAfter":3}]` and requires
`--confirm-scheduled-changes`. Saving synchronizes pending scheduled emails,
including adding future follow-ups to active threads. Explain this impact and get
authorization for the concrete sequence before setting the flag. Existing authorization
applies; do not ask again when it already covers the change. Replacing the sequence
can cancel removed pending steps; an empty array clears it. Explain that effect
when it applies.
Subjects stay `Re: <first email subject>`; per-follow-up subjects are unsupported.
Sequence access follows the web template access rules; enterprise members can
configure accessible shared sequences, which also affects team pending schedules.

## Sending

`email-senders` lists connected mailboxes without credentials. New mailbox binding
and reauthorization still use the web flow; do not claim API binding is supported.
`email-sender-default --id` sets an owned connected mailbox as default.
`email-sender-nickname --id --body-file` accepts `{"nickname":"Name"}`.
`email-sender-limit --id --body-file` accepts `{"autoEmailDailyLimit":50}`;
0 disables automatic sending on that mailbox, and the web maximum still applies.
The limit concerns automatic emails, not a new cap on manual sends.

Before `email-send --body-file ... --confirm-send`, show the actual recipient,
sender, subject, content, cc/bcc from the template and automatic follow-up sequence.
Authorization must cover actual delivery. Permission to draft or save is not
permission to send. Fields: email, usingEmail, templateId or followUpTemplateId,
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
No automatic send retry is implemented; there is no idempotent-send guarantee.
No extra API task points are added; existing web email rules and limits apply.
Do not expose internal model/provider names in copy or explanations.
