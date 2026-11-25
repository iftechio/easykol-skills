import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { CommandDef, OptionDef } from './commands'
import {
  apiCall,
  apiRequest,
  apiXlsx,
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
  projectId?: string
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
  if (!['fast', 'standard', 'beta', 'tag', 'keyword'].includes(searchMode))
    fail(EXIT.PARAMS, '--mode must be fast|standard|beta|tag|keyword')
  const direct = searchMode === 'tag' || searchMode === 'keyword'
  const canonicalTags = list(opts.tags)
  const keywords = list(opts.keywords)
  if (searchMode === 'tag' && !canonicalTags?.length)
    fail(EXIT.PARAMS, '--mode tag requires at least one --tags value')
  if (searchMode === 'keyword' && !keywords?.length)
    fail(EXIT.PARAMS, '--mode keyword requires at least one --keywords value')
  if (
    opts.searchDataMode !== undefined &&
    (!direct || !['historical', 'realtime'].includes(opts.searchDataMode))
  )
    fail(EXIT.PARAMS, '--search-data-mode historical|realtime is available for tag and keyword')
  const platform = String(required(opts.platform, '--platform')).toUpperCase()
  if (!['TIKTOK', 'YOUTUBE', 'INSTAGRAM'].includes(platform))
    fail(EXIT.PARAMS, '--platform must be TIKTOK|YOUTUBE|INSTAGRAM')
  if (opts.hasVideoCart && platform !== 'TIKTOK')
    fail(EXIT.PARAMS, '--has-video-cart requires --platform TIKTOK')
  if (opts.hasTkShop && platform !== 'TIKTOK')
    fail(EXIT.PARAMS, '--has-tk-shop requires --platform TIKTOK')
  if (opts.gender && !['male', 'female'].includes(opts.gender))
    fail(EXIT.PARAMS, '--gender must be male|female')
  const instagramViewRange = opts.viewMin !== undefined || opts.viewMax !== undefined
  const avgRange = opts.avgMin !== undefined || opts.avgMax !== undefined
  if (platform !== 'INSTAGRAM' && (instagramViewRange || opts.onlyVideoCreators || opts.isAmzPartner))
    fail(
      EXIT.PARAMS,
      'Playback range, video creators and Amazon affiliates require --platform INSTAGRAM',
    )
  if (platform === 'INSTAGRAM' && avgRange && (instagramViewRange || opts.useMedianPlayCount))
    fail(EXIT.PARAMS, 'Choose Instagram video views or average likes for the range')
  if (opts.matchPrecisionMode && !['strict', 'balanced', 'fuzzy'].includes(opts.matchPrecisionMode))
    fail(EXIT.PARAMS, '--match-precision-mode must be strict|balanced|fuzzy')
  if (opts.locale && !['zh', 'en'].includes(opts.locale))
    fail(EXIT.PARAMS, '--locale must be zh|en')
  if (opts.tone !== undefined && opts.tones !== undefined)
    fail(EXIT.PARAMS, 'Use --tone or --tones')
  const batchCount = number(opts.batches, '--batches', 1)!
  const maxBatches = searchMode === 'beta' ? 20 : 10
  if (!Number.isInteger(batchCount) || batchCount < 1 || batchCount > maxBatches)
    fail(EXIT.PARAMS, `--batches must be an integer from 1 to ${maxBatches} for ${searchMode}`)
  const lastPublishedDays = number(opts.lastPublishedDays, '--last-published-days')
  if (
    lastPublishedDays !== undefined &&
    (!Number.isInteger(lastPublishedDays) || lastPublishedDays < 1 || lastPublishedDays > 3650)
  )
    fail(EXIT.PARAMS, '--last-published-days must be an integer from 1 to 3650')
  return JSON.parse(
    JSON.stringify({
      searchMode,
      searchDataMode: opts.searchDataMode,
      platform,
      sentence: direct ? opts.sentence : required(opts.sentence, '--sentence'),
      locale: opts.locale,
      batchCount,
      regions: list(opts.regions),
      languages: list(opts.languages),
      minSubscribers: number(opts.minSubscribers, '--min-subscribers'),
      maxSubscribers: number(opts.maxSubscribers, '--max-subscribers'),
      avgMin: number(opts.avgMin, '--avg-min'),
      avgMax: number(opts.avgMax, '--avg-max'),
      viewMin: number(opts.viewMin, '--view-min'),
      viewMax: number(opts.viewMax, '--view-max'),
      useMedianPlayCount: opts.useMedianPlayCount,
      onlyVideoCreators: opts.onlyVideoCreators,
      canonicalTags,
      keywords,
      mustExclude: list(opts.exclude),
      expandedQuery: opts.expandedQuery,
      focusKeyword: opts.focusKeyword,
      matchPrecisionMode: opts.matchPrecisionMode,
      bioOnly: opts.bioOnly,
      hasContactInfo: opts.hasContact ? true : undefined,
      hasDirectContact: opts.hasDirectContact,
      hasTkShop: opts.hasTkShop ? true : undefined,
      hasVideoCart: opts.hasVideoCart ? true : undefined,
      isAmzPartner: opts.isAmzPartner,
      gender: opts.gender,
      skinColor: list(opts.skinColors),
      ageRange: opts.ageRange,
      mainCategory: opts.mainCategory,
      subCategory: opts.subCategory,
      tone: list(opts.tones) ?? opts.tone,
      toneExclude: list(opts.toneExclude),
      faceOnCamera: opts.faceOnCamera ? true : undefined,
      formatTags: list(opts.formatTags),
      sceneTags: list(opts.sceneTags),
      lastPublishedDays,
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
    description: 'fast (default) | standard | beta | tag | keyword',
  },
  {
    flags: '--search-data-mode <mode>',
    description: 'historical (default) | realtime for tag and keyword searches',
  },
  {
    flags: '--platform <p>',
    description: 'TIKTOK | YOUTUBE | INSTAGRAM (required)',
  },
  {
    flags: '--sentence <text>',
    description: 'creator search requirement (required for fast, standard and beta)',
  },
  { flags: '--locale <locale>', description: 'search explanation language: zh | en' },
  {
    flags: '--batches <n>',
    description: '1–10, or 1–20 for beta (default 1)',
  },
  {
    flags: '--regions <list>',
    description: 'creator country codes, comma separated',
  },
  {
    flags: '--languages <list>',
    description: 'creator language codes, comma separated',
  },
  { flags: '--min-subscribers <n>', description: 'minimum followers' },
  { flags: '--max-subscribers <n>', description: 'maximum followers' },
  {
    flags: '--avg-min <n>',
    description: 'minimum average views (TT/YT) or likes (IG)',
  },
  {
    flags: '--avg-max <n>',
    description: 'maximum average views (TT/YT) or likes (IG)',
  },
  { flags: '--view-min <n>', description: 'minimum video views (Instagram only)' },
  { flags: '--view-max <n>', description: 'maximum video views (Instagram only)' },
  { flags: '--use-median-play-count', description: 'use median views for the view range' },
  { flags: '--only-video-creators', description: 'require Instagram video creators' },
  { flags: '--tags <list>', description: 'explicit canonical tags' },
  { flags: '--keywords <list>', description: 'explicit keywords' },
  { flags: '--exclude <list>', description: 'excluded topics' },
  { flags: '--expanded-query <text>', description: 'edited search phrasing or selected product directions' },
  { flags: '--focus-keyword <text>', description: 'focus keyword' },
  { flags: '--match-precision-mode <mode>', description: 'strict | balanced | fuzzy matching' },
  { flags: '--bio-only', description: 'match keywords in the creator bio only' },
  { flags: '--has-contact', description: 'require a contact record' },
  { flags: '--has-direct-contact', description: 'require a direct contact, such as email or phone' },
  {
    flags: '--has-tk-shop',
    description: 'require stored TikTok Shop presence (TIKTOK only)',
  },
  { flags: '--has-video-cart', description: 'require stored TikTok post-level product anchor evidence' },
  { flags: '--is-amz-partner', description: 'require Amazon affiliate evidence (Instagram only)' },
  { flags: '--gender <g>', description: 'creator gender male | female' },
  {
    flags: '--skin-colors <list>',
    description: 'creator skin-color code keys, comma separated',
  },
  { flags: '--age-range <range>', description: 'creator age code key or numeric range' },
  { flags: '--main-category <key>', description: 'content main-category code key' },
  { flags: '--sub-category <key>', description: 'content sub-category code key' },
  { flags: '--tone <key>', description: 'content-tone code key' },
  { flags: '--tones <list>', description: 'include any of these content-tone code keys' },
  { flags: '--tone-exclude <list>', description: 'exclude these content-tone code keys' },
  { flags: '--face-on-camera', description: 'require a creator who appears on camera' },
  { flags: '--format-tags <list>', description: 'video-format code keys, comma separated' },
  { flags: '--scene-tags <list>', description: 'scene code keys, comma separated' },
  {
    flags: '--last-published-days <n>',
    description: 'require a post in the last 1–3650 days',
  },
  { flags: '--visual', description: 'enable visual screening (beta only)' },
  { flags: '--product <text>', description: 'product description (beta only)' },
  {
    flags: '--audience <text>',
    description: 'product target audience; requires --product',
  },
  {
    flags: '--ideal-influencer <text>',
    description: 'creator requirements; requires --product',
  },
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
const projectOption = {
  flags: '--project-id <id>',
  description: 'own project ID required for tasks created in the web app',
}
const resultOptions: OptionDef[] = [
  projectOption,
  { flags: '--attitude <value>', description: 'LIKE | SUPERLIKE | DISLIKE | NORATE' },
  { flags: '--include-similar-favorites', description: 'include favorite creators from similar searches' },
  { flags: '--has-email', description: 'apply the website contact availability filter' },
  { flags: '--updated-within-60-days', description: 'only creators who posted in the last 60 days' },
  { flags: '--has-tk-shop', description: 'only creators with TikTok Shop' },
  { flags: '--is-amz-partner', description: 'only Amazon affiliates' },
]

function resultFilters(opts: Record<string, any>) {
  if (opts.attitude && !['LIKE', 'SUPERLIKE', 'DISLIKE', 'NORATE'].includes(opts.attitude))
    fail(EXIT.PARAMS, '--attitude must be LIKE|SUPERLIKE|DISLIKE|NORATE')
  return {
    projectId: opts.projectId,
    attitude: opts.attitude,
    includeSimilarFavorites: opts.includeSimilarFavorites,
    hasEmail: opts.hasEmail,
    updatedWithin60Days: opts.updatedWithin60Days,
    hasTkShop: opts.hasTkShop,
    isAmzPartner: opts.isAmzPartner,
  }
}
function reconcile(entry: Journal, task: any) {
  if (task.settlement && !task.settlement.pending)
    reconcileSearchTaskBudget(entry.identity, task.settlement.net * 10)
}
export async function readSearchTask(taskId: string, opts: any = {}) {
  const { projectId, ...filters } = resultFilters(opts)
  const task = await apiRequest<any>({
    version: 2,
    path: `${path}/${encodeURIComponent(taskId)}`,
    query: { projectId, offset: opts.offset, limit: opts.limit, ...filters },
  })
  if (projectId !== undefined && task?.effectiveParameters?.projectId !== projectId)
    fail(EXIT.PARAMS, 'The search API did not confirm the requested project scope.')
  const missingFilter = Object.entries(filters).some(
    ([field, value]) => value !== undefined && task?.resultFilters?.[field] !== value,
  )
  if (missingFilter)
    fail(EXIT.PARAMS, 'The search API did not confirm the requested result filters.')
  return task
}
async function prepareSearch(input: Record<string, unknown>) {
  const parsed = await apiRequest<{ parameters: Record<string, unknown>; quote: unknown }>({
    version: 2,
    method: 'POST',
    path: `${path}/parse`,
    timeoutMs: 210_000,
    body: input,
  })
  const changed = Object.entries(input)
    .filter(([field, value]) => !isDeepStrictEqual(parsed?.parameters?.[field], value))
    .map(([field]) => field)
  if (changed.length)
    fail(EXIT.PARAMS, `The search API did not preserve these inputs: ${changed.join(', ')}. No paid search was submitted.`)
  return parsed
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
    const r = await apiCall({
      version: 2,
      path: `${path}/${encodeURIComponent(task.taskId)}`,
      query: { projectId: entry.projectId },
    })
    if (!r.ok)
      fail(
        EXIT.NETWORK,
        `Polling interrupted; taskId=${task.taskId}, idempotencyKey=${entry.key}${entry.projectId ? `, projectId=${entry.projectId}` : ''}. Read the existing task to resume.`,
      )
    task = r.json?.data ?? r.json
  }
  reconcile(entry, task)
  emit({
    ...task,
    idempotencyKey: entry.key,
    ...(opts.wait !== false && !task.resultsReady && !['COMPLETED', 'FAILED'].includes(task.status)
      ? {
          pollingTimedOut: true,
          resume: `task --task-id ${task.taskId}${entry.projectId ? ` --project-id ${entry.projectId}` : ''}`,
        }
      : {}),
  })
}
async function submit(entry: Journal, opts: any) {
  number(opts.timeout, '--timeout', 120)
  reserveSearchTaskBudget(entry.identity, entry.quotedQuota, Boolean(opts.confirmSpend))
  save(entry) // Persist the exact body BEFORE the paid request, including an uncertain response.
  const r = await apiCall({
    version: 2,
    method: 'POST',
    path: entry.path,
    body: entry.body,
  })
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
        'External search v2 is unavailable. Deploy the v2 backend first; no automatic V1 fallback.',
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
    name: 'parse-v2',
    summary: 'Prepare a mode-specific search and obtain a task-point quote',
    billing: 'free',
    options: inputOptions,
    async run(opts) {
      emit(await prepareSearch(searchInput(opts)))
    },
  },
  {
    name: 'search-v2',
    summary: 'Create a fast, standard, beta, tag or keyword task (default fast)',
    billing: 'server quote per batch; zero delivered results refunded after settlement',
    options: [...inputOptions, ...paidOptions],
    async run(opts) {
      const idempotencyKey = key(opts)
      let entry = load(idempotencyKey)
      const suppliedSearchInput = Object.keys(opts).some(
        (option) => !['idempotencyKey', 'confirmSpend', 'wait', 'timeout'].includes(option),
      )
      if (
        entry &&
        suppliedSearchInput &&
        !isDeepStrictEqual(searchInput(opts), entry.input)
      )
        fail(EXIT.PARAMS, 'This idempotency key belongs to different search parameters')
      if (!entry) {
        const input = searchInput(opts)
        const parsed = await prepareSearch(input)
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
    summary: 'Read an existing search task and filter its stored results',
    billing: 'free',
    options: [
      { flags: '--task-id <id>', description: 'task ID (required)' },
      { flags: '--offset <n>', description: 'stored page offset (default 0)' },
      {
        flags: '--limit <n>',
        description: 'stored page size 1–100 (default 50); does not create a new batch',
      },
      ...resultOptions,
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
    name: 'search-export',
    summary: 'Download a completed search task as filtered Excel',
    billing: 'free',
    options: [
      { flags: '--task-id <id>', description: 'search task ID (required)' },
      { flags: '--output <path>', description: 'new local .xlsx file (required)' },
      { flags: '--include-emails', description: 'include creator email in the workbook (default off)' },
      ...resultOptions,
    ],
    async run(opts) {
      const taskId = required<string>(opts.taskId, '--task-id')
      const output = resolve(required<string>(opts.output, '--output'))
      if (!output.toLowerCase().endsWith('.xlsx'))
        fail(EXIT.PARAMS, '--output must be an .xlsx file')
      if (existsSync(output)) fail(EXIT.PARAMS, 'The output file already exists')
      const bytes = await apiXlsx({
        version: 2,
        path: `${path}/${encodeURIComponent(taskId)}/export`,
        query: { ...resultFilters(opts), includeEmails: opts.includeEmails },
      })
      const tempDir = mkdtempSync(join(dirname(output), '.easykol-export-'))
      try {
        const temp = join(tempDir, 'export.xlsx')
        writeFileSync(temp, bytes, { mode: 0o600 })
        linkSync(temp, output)
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
      emit({ taskId, output, bytes: bytes.length })
    },
  },
  {
    name: 'search-next',
    summary: 'Continue the exact completed source task, serially',
    billing: 'source per-batch rate; one continuation per source',
    options: [
      {
        flags: '--task-id <id>',
        description: 'completed source task (required; mode/filters are inherited)',
      },
      projectOption,
      { flags: '--batches <n>', description: 'optional batch count; defaults to the source task count' },
      ...paidOptions,
    ],
    async run(opts) {
      const taskId = required<string>(opts.taskId, '--task-id')
      const idempotencyKey = key(opts)
      const target = `${path}/${encodeURIComponent(taskId)}/next`
      let entry = load(idempotencyKey)
      const batchCount = number(opts.batches, '--batches')
      if (
        batchCount !== undefined &&
        (!Number.isInteger(batchCount) || batchCount < 1 || batchCount > 20)
      )
        fail(EXIT.PARAMS, '--batches must be an integer from 1 to 20')
      if (
        entry &&
        (entry.path !== target ||
          (opts.projectId !== undefined && opts.projectId !== entry.projectId) ||
          (batchCount !== undefined && batchCount !== entry.body.batchCount))
      )
        fail(EXIT.PARAMS, 'This idempotency key belongs to a different continuation')
      if (!entry) {
        const source = await readSearchTask(taskId, { projectId: opts.projectId })
        if (source.status !== 'COMPLETED')
          fail(EXIT.PARAMS, `Source is ${source.status}; wait for COMPLETED before continuing`)
        if (batchCount !== undefined && batchCount > (source.searchMode === 'beta' ? 20 : 10))
          fail(EXIT.PARAMS, '--batches above 10 requires a beta source')
        const sourceQuota = quotedQuota(source.quote)
        const nextQuota = batchCount === undefined
          ? sourceQuota
          : (sourceQuota / Number(source.quote.batchCount)) * batchCount
        if (!Number.isSafeInteger(nextQuota) || nextQuota <= 0)
          fail(EXIT.NETWORK, 'The source task did not return a valid per-batch quote')
        entry = {
          identity: identity(idempotencyKey),
          key: idempotencyKey,
          path: target,
          projectId: opts.projectId,
          body: { idempotencyKey, projectId: opts.projectId, batchCount },
          quotedQuota: nextQuota,
        }
      }
      if (entry.taskId) {
        const existing = await readSearchTask(entry.taskId, { projectId: entry.projectId })
        return deliver(entry, existing, opts)
      }
      await submit(entry, opts)
    },
  },
]
