import { readFileSync } from 'node:fs'
import type { CommandDef, OptionDef } from './commands'
import { apiCall, apiRequest, emit, EXIT, fail, failHttp, loadConfig, DEFAULT_API_BASE, readStdin, required } from './core'

const bodyOptions: OptionDef[] = [{ flags: '--body-file <path>', description: 'UTF-8 JSON body; - reads stdin' }]
const idOption = { flags: '--id <id>', description: 'Template, sender or email record ID (depends on command)' }
const sharedOption = { flags: '--shared', description: 'Current enterprise shared templates; writes require administrator' }
const templatePath = (opts: Record<string, any>) => opts.shared ? '/email/enterprise/templates' : '/email/templates'
const id = (opts: Record<string, any>) => encodeURIComponent(required(opts.id, '--id'))
async function body(opts: Record<string, any>): Promise<Record<string, unknown>> {
  const path = required(opts.bodyFile, '--body-file')
  let parsed: unknown
  try { parsed = JSON.parse(path === '-' ? await readStdin() : readFileSync(path, 'utf8')) }
  catch { fail(EXIT.PARAMS, 'Body must be valid UTF-8 JSON') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(EXIT.PARAMS, 'Body must be a JSON object')
  return parsed as Record<string, unknown>
}
function command(name: string, summary: string, options: OptionDef[], run: CommandDef['run']): CommandDef {
  return { name, summary, billing: 'no extra API task points; existing web email rules apply', options, run }
}
export const EMAIL_COMMANDS: CommandDef[] = [
  command('email-template-list', 'List personal or enterprise templates', [sharedOption], async (o) => emit(await apiRequest({ path: templatePath(o) }))),
  command('email-template-get', 'Read an accessible template', [idOption], async (o) => emit(await apiRequest({ path: `/email/templates/${id(o)}` }))),
  command('email-template-create', 'Create email template', [sharedOption, ...bodyOptions], async (o) => emit(await apiRequest({ method: 'POST', path: templatePath(o), body: await body(o) }))),
  command('email-template-update', 'Update email template', [idOption, sharedOption, ...bodyOptions], async (o) => emit(await apiRequest({ method: 'PATCH', path: `${templatePath(o)}/${id(o)}`, body: await body(o) }))),
  command('email-followup-template-list', 'List visible follow-up templates', [{ flags: '--stage <stage>', description: 'Cooperation stage or all' }], async (o) => emit(await apiRequest({ path: '/email/follow-up-templates', query: { stage: o.stage } }))),
  command('email-followup-template-create', 'Create follow-up template', bodyOptions, async (o) => emit(await apiRequest({ method: 'POST', path: '/email/follow-up-templates', body: await body(o) }))),
  command('email-followup-template-update', 'Update own follow-up template', [idOption, ...bodyOptions], async (o) => emit(await apiRequest({ method: 'PATCH', path: `/email/follow-up-templates/${id(o)}`, body: await body(o) }))),
  command('email-followups-get', 'Read automatic follow-up sequence', [idOption], async (o) => emit(await apiRequest({ path: `/email/templates/${id(o)}/followups` }))),
  command('email-followups-set', 'Update sequence and pending schedules', [idOption, ...bodyOptions, { flags: '--confirm-scheduled-changes', description: 'Confirm changes affect pending scheduled emails' }], async (o) => {
    if (!o.confirmScheduledChanges) fail(EXIT.PARAMS, 'Review pending schedule impact, then use --confirm-scheduled-changes')
    emit(await apiRequest({ method: 'PUT', path: `/email/templates/${id(o)}/followups`, body: { ...await body(o), confirmScheduledChanges: true } }))
  }),
  command('email-senders', 'List connected mailboxes without credentials', [], async () => emit(await apiRequest({ path: '/email/senders' }))),
  command('email-sender-default', 'Set an owned connected mailbox as default', [idOption], async (o) => emit(await apiRequest({ method: 'POST', path: `/email/senders/${id(o)}/default` }))),
  command('email-sender-nickname', 'Update an owned sender nickname', [idOption, ...bodyOptions], async (o) => emit(await apiRequest({ method: 'PATCH', path: `/email/senders/${id(o)}/nickname`, body: await body(o) }))),
  command('email-sender-limit', 'Update automatic daily limit (0 disables automatic sending)', [idOption, ...bodyOptions], async (o) => emit(await apiRequest({ method: 'PATCH', path: `/email/senders/${id(o)}/auto-email-limit`, body: await body(o) }))),
  command('email-record', 'Read an accessible email sending result', [idOption], async (o) => emit(await apiRequest({ path: `/email/records/${id(o)}` }))),
  command('email-records', 'List web-scope sent records and own follow-ups', [
    { flags: '--page <n>', description: 'Page number (default 1)' },
    { flags: '--page-size <n>', description: 'Page size (1-100)' },
    { flags: '--to <email>', description: 'Exact recipient filter' },
    { flags: '--template-id <id>', description: 'Exact template filter' },
  ], async (o) => emit(await apiRequest({ path: '/email/records', query: { page:o.page, pageSize:o.pageSize, to:o.to, templateId:o.templateId } }))),
  command('email-send', 'Send one reviewed email; never retry uncertain delivery automatically', [...bodyOptions, { flags: '--confirm-send', description: 'Confirm actual delivery after reviewing recipient, content and follow-ups' }], async (o) => {
    if (!o.confirmSend) fail(EXIT.PARAMS, 'Review sender, recipient, content and follow-ups, then use --confirm-send')
    let result
    try {
      result = await apiCall({ method: 'POST', path: '/email/send', body: { ...await body(o), confirmSend: true }, timeoutMs: 120_000 })
    } catch {
      fail(EXIT.NETWORK, 'Email submission result is uncertain; do not resend automatically. Check email records first.', { hint:'Check email-record or email-records before considering another send.' })
    }
    if (!result.ok && (result.networkError || result.status >= 500)) {
      fail(EXIT.NETWORK, 'Email submission result is uncertain; do not resend automatically. Check email records first.', { hint:'Check email-record or email-records before considering another send.' })
    }
    if (!result.ok) failHttp(loadConfig().apiBase || DEFAULT_API_BASE, result)
    emit(result.json?.data ?? result.json)
  }),
]
