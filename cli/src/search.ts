import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandDef, OptionDef } from './commands'
import {
  apiCall,
  apiRequest,
  CONFIG_DIR,
  DEFAULT_API_BASE,
  emit,
  EXIT,
  fail,
  failHttp,
  loadConfig,
  reconcileSearchTaskBudget,
  required,
  reserveSearchTaskBudget,
} from './core'

const path = '/intelligent-search'
const journalDir = join(CONFIG_DIR, 'search-tasks')
interface Journal {
  identity: string
  key: string
  path: string
  input?: any
  body: any
  quotedQuota: number
  taskId?: string
}
function scope() {
  const cfg = loadConfig()
  return createHash('sha256')
    .update(
      JSON.stringify([
        cfg.apiKey,
        cfg.email,
        process.env.EASYKOL_API_BASE || cfg.apiBase || DEFAULT_API_BASE,
      ]),
    )
    .digest('hex')
}
const identity = (key: string) => createHash('sha256').update(`${scope()}:${key}`).digest('hex')
const file = (id: string) => join(journalDir, `${id}.json`)
function save(entry: Journal) {
  mkdirSync(journalDir, { recursive: true, mode: 0o700 })
  writeFileSync(file(entry.identity), JSON.stringify(entry), { mode: 0o600 })
}
function load(key: string): Journal | undefined {
  const target = file(identity(key))
  return existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : undefined
}
function key(opts: any) {
  const value = opts.idempotencyKey ?? randomUUID()
  if (value.length < 8 || value.length > 128)
    fail(EXIT.PARAMS, '--idempotency-key must contain 8–128 characters')
  return value
}
function number(value: any, name: string, fallback?: number) {
  if (value === undefined) return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) fail(EXIT.PARAMS, `${name} must be a nonnegative number`)
  return n
}
const list = (value?: string) =>
  value === undefined
    ? undefined
    : value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
function quotedQuota(quote: any): number {
  const quota = Number(quote?.reserved) * 10
  if (quote?.unit !== 'taskPoints' || !Number.isSafeInteger(quota) || quota <= 0)
    fail(EXIT.NETWORK, 'Invalid V2 quote; no paid search was submitted')
  return quota
}
export function searchInput(opts: any) {
  if ((opts.audience || opts.idealInfluencer) && !opts.product)
    fail(EXIT.PARAMS, '--audience and --ideal-influencer require --product')
  const searchMode = opts.mode ?? 'fast'
  if (!['fast', 'standard', 'beta'].includes(searchMode))
    fail(EXIT.PARAMS, '--mode must be fast|standard|beta')
  const platform = String(required(opts.platform, '--platform')).toUpperCase()
  if (!['TIKTOK', 'YOUTUBE', 'INSTAGRAM'].includes(platform))
    fail(EXIT.PARAMS, '--platform must be TIKTOK|YOUTUBE|INSTAGRAM')
  const batchCount = number(opts.batches, '--batches', 1)!
  if (
    !Number.isInteger(batchCount) ||
    batchCount < 1 ||
    batchCount > (searchMode === 'beta' ? 1 : 10)
  )
    fail(EXIT.PARAMS, 'Use 1–10 batches; beta requires one batch and serial search-next')
  return JSON.parse(
    JSON.stringify({
      searchMode,
      platform,
      sentence: required(opts.sentence, '--sentence'),
      batchCount,
      regions: list(opts.regions),
      languages: list(opts.languages),
      minSubscribers: number(opts.minSubscribers, '--min-subscribers'),
      maxSubscribers: number(opts.maxSubscribers, '--max-subscribers'),
      avgMin: number(opts.avgMin, '--avg-min'),
      avgMax: number(opts.avgMax, '--avg-max'),
      canonicalTags: list(opts.tags),
      keywords: list(opts.keywords),
      mustExclude: list(opts.exclude),
      hasContactInfo: opts.hasContact ? true : undefined,
      gender: opts.gender,
      useVisualScreening: opts.visual ? true : undefined,
      productRequirements: opts.product
        ? {
            productDescription: opts.product,
            targetAudience: opts.audience,
            idealInfluencer: opts.idealInfluencer,
          }
        : undefined,
    }),
  )
}
const inputOptions: OptionDef[] = [
  {
    flags: '--mode <mode>',
    description: 'fast (default) | standard | beta; never silently substituted',
  },
  { flags: '--platform <p>', description: 'TIKTOK | YOUTUBE | INSTAGRAM (required)' },
  {
    flags: '--sentence <text>',
    description: 'creator search requirement (required for a new search)',
  },
  {
    flags: '--batches <n>',
    description: '1–10 (default 1); beta permits one batch per serial request',
  },
  { flags: '--regions <list>', description: 'creator country codes, comma separated' },
  { flags: '--languages <list>', description: 'creator language codes, comma separated' },
  { flags: '--min-subscribers <n>', description: 'minimum followers' },
  { flags: '--max-subscribers <n>', description: 'maximum followers' },
  { flags: '--avg-min <n>', description: 'minimum average views (TT/YT) or likes (IG)' },
  { flags: '--avg-max <n>', description: 'maximum average views (TT/YT) or likes (IG)' },
  { flags: '--tags <list>', description: 'explicit canonical tags' },
  { flags: '--keywords <list>', description: 'explicit keywords' },
  { flags: '--exclude <list>', description: 'excluded topics' },
  { flags: '--has-contact', description: 'require a contact record' },
  { flags: '--gender <g>', description: 'creator gender male | female' },
  { flags: '--visual', description: 'enable visual screening (beta only)' },
  { flags: '--product <text>', description: 'product description (beta only)' },
  { flags: '--audience <text>', description: 'product target audience; requires --product' },
  { flags: '--ideal-influencer <text>', description: 'creator requirements; requires --product' },
]
const waitOptions: OptionDef[] = [
  { flags: '--no-wait', description: 'return the task immediately' },
  {
    flags: '--timeout <seconds>',
    description: 'polling deadline (default 120); never re-submits on timeout',
  },
]
const paidOptions: OptionDef[] = [
  {
    flags: '--idempotency-key <key>',
    description: 'stable key for submission/recovery (auto-generated and persisted if omitted)',
  },
  {
    flags: '--confirm-spend',
    description:
      'use previously granted user approval to exceed session budget (50 raw quota = 5 task points)',
  },
  ...waitOptions,
]
function reconcile(entry: Journal, task: any) {
  if (task.settlement && !task.settlement.pending)
    reconcileSearchTaskBudget(entry.identity, task.settlement.net * 10)
}
export async function readSearchTask(taskId: string, opts: any = {}) {
  return apiRequest<any>({
    version: 2,
    path: `${path}/${encodeURIComponent(taskId)}`,
    query: { offset: opts.offset, limit: opts.limit },
  })
}
async function deliver(entry: Journal, initial: any, opts: any) {
  let task = initial
  const timeout = number(opts.timeout, '--timeout', 120)!
  const deadline = Date.now() + timeout * 1000
  while (
    opts.wait !== false &&
    !task.resultsReady &&
    !['COMPLETED', 'FAILED'].includes(task.status) &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(3000, Math.max(0, deadline - Date.now()))),
    )
    const r = await apiCall({ version: 2, path: `${path}/${encodeURIComponent(task.taskId)}` })
    if (!r.ok)
      fail(
        EXIT.NETWORK,
        `Polling interrupted; taskId=${task.taskId}, idempotencyKey=${entry.key}. Resume with easykol task --task-id ${task.taskId}`,
      )
    task = r.json?.data ?? r.json
  }
  reconcile(entry, task)
  emit({
    ...task,
    idempotencyKey: entry.key,
    ...(opts.wait !== false && !task.resultsReady && !['COMPLETED', 'FAILED'].includes(task.status)
      ? { pollingTimedOut: true, resume: `easykol task --task-id ${task.taskId}` }
      : {}),
  })
}
async function submit(entry: Journal, opts: any) {
  number(opts.timeout, '--timeout', 120)
  reserveSearchTaskBudget(entry.identity, entry.quotedQuota, Boolean(opts.confirmSpend))
  save(entry) // Persist the exact body BEFORE the paid request, including an uncertain response.
  const r = await apiCall({ version: 2, method: 'POST', path: entry.path, body: entry.body })
  if (!r.ok) {
    if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429)
      reconcileSearchTaskBudget(entry.identity, 0)
    if (r.networkError || r.status >= 500 || r.status === 408 || r.status === 429)
      fail(
        EXIT.NETWORK,
        `Submission outcome uncertain; idempotencyKey=${entry.key}. Recover with the same command and --idempotency-key ${entry.key}; never start a replacement search.`,
      )
    if (r.status === 404)
      fail(
        EXIT.PARAMS,
        'External search v2 is unavailable. Deploy the v2 backend first; legacy commands are explicit opt-ins.',
      )
    failHttp(loadConfig().apiBase || DEFAULT_API_BASE, r)
  }
  const task = r.json?.data ?? r.json
  if (!task?.taskId || typeof task.status !== 'string')
    fail(
      EXIT.NETWORK,
      `Invalid submission response; outcome uncertain. Recover with --idempotency-key ${entry.key}; never create a replacement search.`,
    )
  entry.taskId = task.taskId
  save(entry)
  await deliver(entry, task, opts)
}

export const SEARCH_COMMANDS: CommandDef[] = [
  {
    name: 'parse',
    summary: 'Prepare a mode-specific search and obtain a task-point quote',
    billing: 'free',
    options: inputOptions,
    async run(opts) {
      emit(
        await apiRequest({
          version: 2,
          method: 'POST',
          path: `${path}/parse`,
          timeoutMs: 210_000,
          body: searchInput(opts),
        }),
      )
    },
  },
  {
    name: 'search',
    summary: 'Create a fast/standard/beta search task (default fast)',
    billing: 'server quote per batch; zero delivered results refunded after settlement',
    options: [...inputOptions, ...paidOptions],
    async run(opts) {
      const idempotencyKey = key(opts)
      let entry = load(idempotencyKey)
      if (
        entry &&
        opts.sentence &&
        JSON.stringify(searchInput(opts)) !== JSON.stringify(entry.input)
      )
        fail(EXIT.PARAMS, 'This idempotency key belongs to different search parameters')
      if (!entry) {
        const input = searchInput(opts)
        const parsed = await apiRequest<any>({
          version: 2,
          method: 'POST',
          path: `${path}/parse`,
          timeoutMs: 210_000,
          body: input,
        })
        entry = {
          identity: identity(idempotencyKey),
          key: idempotencyKey,
          path,
          input,
          body: { ...parsed.parameters, idempotencyKey },
          quotedQuota: quotedQuota(parsed.quote),
        }
      }
      if (entry.path !== path) fail(EXIT.PARAMS, 'This idempotency key belongs to a continuation')
      if (entry.taskId) return deliver(entry, await readSearchTask(entry.taskId), opts)
      await submit(entry, opts)
    },
  },
  {
    name: 'task',
    summary: 'Read an existing v2 search task and stored result page',
    billing: 'free',
    options: [
      { flags: '--task-id <id>', description: 'task ID (required)' },
      { flags: '--offset <n>', description: 'stored page offset (default 0)' },
      {
        flags: '--limit <n>',
        description: 'stored page size 1–100 (default 50); does not create a new batch',
      },
    ],
    async run(opts) {
      const taskId = required<string>(opts.taskId, '--task-id')
      const task = await readSearchTask(taskId, opts)
      if (existsSync(journalDir))
        for (const name of readdirSync(journalDir)) {
          if (!name.endsWith('.json')) continue
          const entry: Journal = JSON.parse(readFileSync(join(journalDir, name), 'utf8'))
          if (entry.taskId === taskId && entry.identity === identity(entry.key))
            reconcile(entry, task)
        }
      emit(task)
    },
  },
  {
    name: 'search-next',
    summary: 'Continue the exact completed source task, serially',
    billing: 'inherits the source task quote; one continuation per source',
    options: [
      {
        flags: '--task-id <id>',
        description: 'completed source task (required; mode/filters are inherited)',
      },
      ...paidOptions,
    ],
    async run(opts) {
      const taskId = required<string>(opts.taskId, '--task-id')
      const idempotencyKey = key(opts)
      const target = `${path}/${encodeURIComponent(taskId)}/next`
      let entry = load(idempotencyKey)
      if (entry && entry.path !== target)
        fail(EXIT.PARAMS, 'This idempotency key belongs to a different task')
      if (!entry) {
        const source = await readSearchTask(taskId)
        if (source.status !== 'COMPLETED')
          fail(EXIT.PARAMS, `Source is ${source.status}; wait for COMPLETED before continuing`)
        entry = {
          identity: identity(idempotencyKey),
          key: idempotencyKey,
          path: target,
          body: { idempotencyKey },
          quotedQuota: quotedQuota(source.quote),
        }
      }
      if (entry.taskId) return deliver(entry, await readSearchTask(entry.taskId), opts)
      await submit(entry, opts)
    },
  },
]
