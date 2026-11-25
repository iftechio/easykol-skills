import { randomUUID } from 'node:crypto'
import { SEARCH_COMMANDS } from './search'
import { EMAIL_COMMANDS } from './email'
import { CREATOR_WORKFLOW_COMMANDS } from './creator-workflows'
import {
  apiCall,
  apiRequest,
  assertSearchSessionBudget,
  CONFIG_PATH,
  countSearchResults,
  DEFAULT_API_BASE,
  emit,
  EXIT,
  fail,
  failHttp,
  loadConfig,
  maskKey,
  readStdin,
  recordSearchSessionSpend,
  required,
  saveConfig,
} from './core'

export interface OptionDef {
  flags: string
  description: string
}

export interface CommandDef {
  name: string
  summary: string
  billing: string
  options: OptionDef[]
  run: (opts: Record<string, any>) => Promise<void>
}

// ---------- shared parsing helpers ----------

function parseList(v?: string): string[] | undefined {
  if (!v) return undefined
  const arr = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return arr.length ? arr : undefined
}

function num(v?: string): number | undefined {
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function creatorLookupLimit(value?: string): number | undefined {
  if (value === undefined) return undefined
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > 60) {
    fail(EXIT.PARAMS, '--limit must be an integer between 1 and 60')
  }
  return limit
}

type Platform = 'TIKTOK' | 'YOUTUBE' | 'INSTAGRAM'

function normPlatform(p?: string): Platform {
  const up = String(p ?? '').toUpperCase()
  if (up === 'TIKTOK' || up === 'YOUTUBE' || up === 'INSTAGRAM') return up
  fail(EXIT.PARAMS, `--platform must be one of TIKTOK|YOUTUBE|INSTAGRAM (got ${p ?? 'none'})`)
}

/** filter fields shared by parse / more-words / search */
function baseFilters(opts: Record<string, any>) {
  return {
    regions: parseList(opts.regions),
    languages: parseList(opts.languages),
    minSubscribers: num(opts.minSubscribers),
    maxSubscribers: num(opts.maxSubscribers),
    avgMin: num(opts.avgMin),
    avgMax: num(opts.avgMax),
  }
}

const FILTER_OPTIONS: OptionDef[] = [
  { flags: '--regions <list>', description: 'comma-separated ISO Alpha-2 country codes, e.g. US,GB' },
  { flags: '--languages <list>', description: 'comma-separated BCP-47 language codes, e.g. en,zh' },
  { flags: '--min-subscribers <n>', description: 'minimum follower / subscriber count' },
  { flags: '--max-subscribers <n>', description: 'maximum follower / subscriber count' },
  { flags: '--avg-min <n>', description: 'min avg views (TT/YT) or avg likes (IG)' },
  { flags: '--avg-max <n>', description: 'max avg views (TT/YT) or avg likes (IG)' },
]

// ---------- async task poller ----------

async function pollTask(
  path: string, // e.g. '/similar/task123'
  intervalMs = 3000,
  timeoutMs = 120_000,
  requestTimeoutMs?: number,
): Promise<any> {
  const cfg = loadConfig()
  const base = process.env.EASYKOL_API_BASE || cfg.apiBase || DEFAULT_API_BASE
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const r = await apiCall({
      path,
      timeoutMs: requestTimeoutMs === undefined
        ? undefined
        : Math.max(1, Math.min(requestTimeoutMs, deadline - Date.now())),
    })
    if (r.networkError) fail(EXIT.NETWORK, `Network error: ${r.networkError}`)
    if (!r.ok) failHttp(base, r)
    const task = r.json?.data ?? r.json
    const status: string = task?.status ?? ''
    if (status === 'COMPLETED') return task
    if (status === 'FAILED' || status === 'CANCELLED') {
      fail(EXIT.GENERIC, `Task ${status.toLowerCase()}: ${task?.error ?? 'unknown error'}`)
    }
    await new Promise((res) => setTimeout(res, intervalMs))
  }
  fail(EXIT.GENERIC, `Task timed out after ${timeoutMs / 1000}s`)
}

// ---------- commands ----------

export const API_COMMANDS: CommandDef[] = [
  {
    name: 'auth',
    summary: 'Save your API key + email (key never passed as a logged argument)',
    billing: 'free',
    options: [
      { flags: '--key <key>', description: 'API key (prefer --key-stdin to keep it out of shell history)' },
      { flags: '--key-stdin', description: 'read the API key from stdin' },
      { flags: '--email <email>', description: 'email bound to the API key' },
      { flags: '--api-base <url>', description: `override API base (default ${DEFAULT_API_BASE})` },
    ],
    async run(opts) {
      let apiKey: string | undefined = opts.key
      if (opts.keyStdin) apiKey = (await readStdin()).trim()
      apiKey = required(apiKey, '--key / --key-stdin')
      const email = required<string>(opts.email, '--email')
      const cfg = loadConfig()
      cfg.apiKey = apiKey
      cfg.email = email
      if (opts.apiBase) cfg.apiBase = opts.apiBase
      saveConfig(cfg)
      emit({
        saved: true,
        email,
        apiKey: maskKey(apiKey),
        apiBase: cfg.apiBase || DEFAULT_API_BASE,
        configPath: CONFIG_PATH,
      })
    },
  },
  {
    name: 'quota',
    summary: 'Show remaining credits / plan',
    billing: 'free',
    options: [],
    async run() {
      const base = loadConfig().apiBase || DEFAULT_API_BASE
      const r = await apiCall({ path: '/quota' })
      if (r.networkError) fail(EXIT.NETWORK, `Network error: ${r.networkError}`)
      if (!r.ok) failHttp(base, r)
      emit(r.json?.data ?? r.json)
    },
  },
  {
    name: 'similar',
    summary: 'Find creators similar to a seed profile URL (async, ~30s)',
    billing: '10 quota per call',
    options: [
      { flags: '--url <url>', description: 'seed creator profile URL (required)' },
      { flags: '--regions <list>', description: 'comma-separated ISO Alpha-2 country codes, e.g. US,GB' },
      { flags: '--languages <list>', description: 'comma-separated BCP-47 language codes, e.g. en,zh' },
      { flags: '--min-subscribers <n>', description: 'minimum follower / subscriber count' },
      { flags: '--max-subscribers <n>', description: 'maximum follower / subscriber count' },
      { flags: '--min-avg-views <n>', description: 'min avg views (TT/YT)' },
      { flags: '--max-avg-views <n>', description: 'max avg views (TT/YT)' },
      { flags: '--min-avg-likes <n>', description: 'min avg likes (IG only)' },
      { flags: '--max-avg-likes <n>', description: 'max avg likes (IG only)' },
      { flags: '--has-video-cart', description: 'requires a TikTok seed and stored post-level product anchor evidence' },
      { flags: '--dedup-days <n>', description: 'skip creators seen in past N days (default 3, 0 = off)' },
      { flags: '--timeout <s>', description: 'poll timeout in seconds (default 120)' },
    ],
    async run(opts) {
      const seedProfileUrl = required<string>(opts.url, '--url')
      const body: Record<string, unknown> = {
        seedProfileUrl,
        hasVideoCart: opts.hasVideoCart ? true : undefined,
        dedupDays: num(opts.dedupDays) ?? 3,
        regions: parseList(opts.regions),
        languages: parseList(opts.languages),
        minSubscribers: num(opts.minSubscribers),
        maxSubscribers: num(opts.maxSubscribers),
        minVideosAverageViews: num(opts.minAvgViews),
        maxVideosAverageViews: num(opts.maxAvgViews),
        minAverageLikeCount: num(opts.minAvgLikes),
        maxAverageLikeCount: num(opts.maxAvgLikes),
      }
      const task = await apiRequest<{ taskId: string }>({ method: 'POST', path: '/similar', body })
      const timeoutMs = (num(opts.timeout) ?? 120) * 1000
      const done = await pollTask(`/similar/${task.taskId}`, 3000, timeoutMs)
      emit(done.result ?? done)
    },
  },
  {
    name: 'kol',
    summary: 'Fetch a creator profile by social-media URL',
    billing: 'every 5 calls = 1 quota',
    options: [
      { flags: '--url <url>', description: 'social media profile URL (required)' },
    ],
    async run(opts) {
      const url = required<string>(opts.url, '--url')
      const data = await apiRequest({ path: '/kol', query: { url } })
      emit(data)
    },
  },
  {
    name: 'creator-recent-posts',
    summary: 'List recent posts stored for one YouTube, TikTok or Instagram creator profile',
    billing: '0.1 AI credits per successful query; failed queries do not charge',
    options: [
      { flags: '--url <url>', description: 'creator profile URL (required)' },
      { flags: '--limit <n>', description: 'maximum results, 1–60 (default 20)' },
    ],
    async run(opts) {
      const url = required<string>(opts.url, '--url')
      const limit = creatorLookupLimit(opts.limit)
      emit(await apiRequest({
        method: 'POST',
        path: '/creators/recent-posts',
        body: { url, limit },
        timeoutMs: 45_000,
      }))
    },
  },
  {
    name: 'tiktok-cart',
    summary: 'Check recent stored TikTok posts for product anchors',
    billing: '0.1 AI credits per successful query; failed queries do not charge',
    options: [
      { flags: '--url <url>', description: 'direct TikTok profile URL (required)' },
      { flags: '--limit <n>', description: 'number of stored posts to examine, 1–60 (default 20)' },
    ],
    async run(opts) {
      emit(await apiRequest({
        method: 'POST',
        path: '/creators/recent-posts',
        body: { url: required(opts.url, '--url'), limit: creatorLookupLimit(opts.limit), cartOnly: true },
        timeoutMs: 45_000,
      }))
    },
  },
  {
    name: 'creators-by-email',
    summary: 'Find stored YouTube, TikTok and Instagram creators matching one complete contact email',
    billing: '0.1 AI credits per returned creator; no match is free; default cap 2 points',
    options: [
      { flags: '--email <email>', description: 'exact contact email to match' },
      { flags: '--email-stdin', description: 'read the email to match from stdin' },
      { flags: '--limit <n>', description: 'maximum results and charge cap, 1–60 (default 20)' },
    ],
    async run(opts) {
      const limit = creatorLookupLimit(opts.limit)
      if (opts.email !== undefined && opts.emailStdin) {
        fail(EXIT.PARAMS, 'Use --email or --email-stdin')
      }
      const input = opts.emailStdin ? await readStdin() : opts.email
      const email = required<string>(input?.trim().toLowerCase(), '--email or --email-stdin')
      if (email.length > 254 || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) {
        fail(EXIT.PARAMS, 'Enter one complete email address')
      }
      emit(await apiRequest({
        method: 'POST',
        path: '/creators/by-email',
        body: { email, limit },
        timeoutMs: 45_000,
      }))
    },
  },
  {
    name: 'emails',
    summary: 'Bulk-extract emails for a list of creator profile URLs (async, ~60s)',
    billing: '1 quota per 5 URLs (rounded up)',
    options: [
      { flags: '--tt-urls <list>', description: 'comma-separated TikTok profile URLs' },
      { flags: '--yt-urls <list>', description: 'comma-separated YouTube profile URLs' },
      { flags: '--ins-urls <list>', description: 'comma-separated Instagram profile URLs' },
      { flags: '--timeout <s>', description: 'poll timeout in seconds (default 180)' },
    ],
    async run(opts) {
      const ttUrls = parseList(opts.ttUrls) ?? []
      const ytbUrls = parseList(opts.ytUrls) ?? []
      const insUrls = parseList(opts.insUrls) ?? []
      if (!ttUrls.length && !ytbUrls.length && !insUrls.length) {
        fail(EXIT.PARAMS, 'At least one of --tt-urls / --yt-urls / --ins-urls is required')
      }
      const task = await apiRequest<{ id: string; taskId?: string }>({
        method: 'POST',
        path: '/kol-emails',
        body: { ttUrls, ytbUrls, insUrls },
      })
      const taskId = task.taskId ?? task.id
      required(taskId, 'taskId from response')
      const timeoutMs = (num(opts.timeout) ?? 180) * 1000
      const done = await pollTask(`/kol-emails/${taskId}`, 4000, timeoutMs)
      emit(done)
    },
  },
  {
    name: 'tracked-videos',
    summary: 'Read saved metrics for existing EasyKOL tracked videos and posts',
    billing: 'free (0 AI credits)',
    options: [
      { flags: '--page <number>', description: 'page number (default 1)' },
      { flags: '--page-size <number>', description: 'records per page, 1–100 (default 20)' },
      { flags: '--platform <name>', description: 'platform code, such as TIKTOK, YOUTUBE or INSTAGRAM' },
      { flags: '--blogger-name <text>', description: 'creator name or account keyword' },
      { flags: '--tag-name <text>', description: 'exact EasyKOL placement tag name' },
      { flags: '--start-date <date>', description: 'published on or after YYYY-MM-DD in UTC' },
      { flags: '--end-date <date>', description: 'published on or before YYYY-MM-DD in UTC' },
    ],
    async run(opts) {
      if (opts.tagName !== undefined && !opts.tagName.trim()) {
        fail(EXIT.PARAMS, '--tag-name must contain a nonempty tag name')
      }
      emit(await apiRequest({
        path: '/tracking/videos',
        query: {
          page: opts.page,
          pageSize: opts.pageSize,
          platform: opts.platform?.toUpperCase(),
          bloggerName: opts.bloggerName,
          tagName: opts.tagName,
          startDate: opts.startDate,
          endDate: opts.endDate,
        },
        timeoutMs: 30_000,
      }))
    },
  },
  {
    name: 'tracked-video-trends',
    summary: 'Read saved historical metrics for up to 20 EasyKOL tracked placements',
    billing: 'free (0 AI credits)',
    options: [
      { flags: '--publication-ids <list>', description: 'comma-separated tracking record IDs (required)' },
    ],
    async run(opts) {
      const ids = required<string>(opts.publicationIds, '--publication-ids').split(',').map((id) => id.trim())
      if (ids.some((id) => !id) || ids.length > 20) {
        fail(EXIT.PARAMS, '--publication-ids must contain 1–20 nonempty tracking record IDs')
      }
      emit(await apiRequest({
        path: '/tracking/video-trends',
        query: { publicationIds: ids.join(',') },
        timeoutMs: 30_000,
      }))
    },
  },
  {
    name: 'video',
    summary: 'Fetch video / post data by URL (YouTube, TikTok, Instagram, Facebook, Threads)',
    billing: 'every 5 calls = 1 quota',
    options: [
      { flags: '--url <url>', description: 'video or post URL (required)' },
    ],
    async run(opts) {
      const url = required<string>(opts.url, '--url')
      const data = await apiRequest({ path: '/video', query: { url } })
      emit(data)
    },
  },
  {
    name: 'video-analysis',
    summary: 'Analyze the picture and audio of a TikTok or Instagram video',
    billing: '0.5 AI credits per new task, same as the browser extension',
    options: [
      { flags: '--url <url>', description: 'TikTok or Instagram video URL (required)' },
      { flags: '--prompt <text>', description: 'analysis instructions, 1–2000 characters (required)' },
      { flags: '--language <tag>', description: 'output language, e.g. zh-CN (default en)' },
      { flags: '--task-id <uuid>', description: 'reuse the original ID and inputs to recover a submission' },
      { flags: '--submit-only', description: 'return the task ID and status without polling' },
      { flags: '--timeout <s>', description: 'poll timeout in seconds (default 600)' },
    ],
    async run(opts) {
      const url = required<string>(opts.url, '--url').trim()
      const prompt = required<string>(opts.prompt, '--prompt').trim()
      const language = opts.language ?? 'en'
      const taskId = (opts.taskId ?? randomUUID()).toLowerCase()
      const timeout = opts.timeout === undefined ? 600 : Number(opts.timeout)
      if (!url || url.length > 2048) fail(EXIT.PARAMS, 'Enter one valid video URL')
      if (!prompt || [...prompt].length > 2000) fail(EXIT.PARAMS, 'The prompt must be 1–2000 characters')
      if (language.length > 35 || !/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(language)) {
        fail(EXIT.PARAMS, 'Use a valid --language tag such as zh-CN')
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(taskId)) {
        fail(EXIT.PARAMS, 'Use the task UUID printed by the original submission')
      }
      if (!Number.isInteger(timeout) || timeout < 0 || timeout > 600) {
        fail(EXIT.PARAMS, '--timeout must be an integer between 0 and 600 seconds')
      }
      process.stderr.write(`Video analysis task ${taskId}. Read with video-analysis-result --task-id ${taskId}\n`)
      const task = await apiRequest<{ taskId: string; status: string; pricePoints: number }>({
        method: 'POST',
        path: '/ai-video-analysis',
        body: { taskId, url, prompt, language },
        timeoutMs: 45_000,
      })
      if (task.taskId !== taskId) fail(EXIT.GENERIC, 'Unexpected video analysis task ID')
      if (opts.submitOnly || task.status === 'COMPLETED' || task.status === 'FAILED') {
        emit(task)
        return
      }
      const result = await pollTask(`/ai-video-analysis/${taskId}`, 5000, timeout * 1000, 15_000)
      emit({ ...result, pricePoints: task.pricePoints })
    },
  },
  {
    name: 'video-analysis-result',
    summary: 'Read the status or report of an existing video analysis task',
    billing: 'free',
    options: [
      { flags: '--task-id <id>', description: 'ID of the existing video analysis task (required)' },
    ],
    async run(opts) {
      const taskId = required<string>(opts.taskId, '--task-id')
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(taskId)) fail(EXIT.PARAMS, 'Invalid --task-id')
      emit(await apiRequest({ path: `/ai-video-analysis/${taskId}`, timeoutMs: 15_000 }))
    },
  },
  {
    name: 'audience',
    summary: 'Fetch audience analysis for a creator: age/gender/region/fake-follower rate (async if not cached)',
    billing: '1× / 2× / 6× use 1 / 2 / 6 AI credits per new analysis; eligible cached reports are free',
    options: [
      { flags: '--url <url>', description: 'creator profile URL (required)' },
      { flags: '--data-multiplier <1|2|6>', description: 'sample tier (default 2); 1× to try, 2× for routine analysis, 6× for deeper evaluation' },
      { flags: '--submit-only', description: 'return the task ID and current status without polling' },
      { flags: '--timeout <s>', description: 'poll timeout in seconds (default 120)' },
    ],
    async run(opts) {
      const url = required<string>(opts.url, '--url')
      const tier = opts.dataMultiplier ?? '2'
      if (tier !== '1' && tier !== '2' && tier !== '6') {
        fail(EXIT.PARAMS, '--data-multiplier must be 1, 2, or 6')
      }
      const task = await apiRequest<{ taskId: string; status: string; result?: unknown }>({
        method: 'POST',
        path: '/audience',
        body: { url, dataMultiplier: Number(tier) },
      })
      if (opts.submitOnly) {
        emit(task)
        return
      }
      if (task.status === 'COMPLETED') {
        emit(task.result ?? task)
        return
      }
      process.stderr.write(`Audience task ${task.taskId}; resume with audience-result --task-id ${task.taskId}\n`)
      const timeoutMs = (num(opts.timeout) ?? 120) * 1000
      const done = await pollTask(`/audience/${task.taskId}`, 5000, timeoutMs)
      emit(done.result ?? done)
    },
  },
  {
    name: 'audience-result',
    summary: 'Read the status and result of an existing audience analysis task',
    billing: 'free',
    options: [
      { flags: '--task-id <id>', description: 'task ID returned by audience (required)' },
    ],
    async run(opts) {
      const taskId = required<string>(opts.taskId, '--task-id')
      if (!/^[a-zA-Z0-9_-]+$/.test(taskId)) fail(EXIT.PARAMS, 'Invalid --task-id')
      emit(await apiRequest({ path: `/audience/${taskId}`, timeoutMs: 15_000 }))
    },
  },
  {
    name: 'parse',
    summary: 'Preview a search: canonical tags + keywords + estimated total (no charge)',
    billing: 'free',
    options: [
      { flags: '--sentence <text>', description: 'natural-language search description (required)' },
      { flags: '--platform <p>', description: 'TIKTOK | YOUTUBE | INSTAGRAM (required)' },
      ...FILTER_OPTIONS,
    ],
    async run(opts) {
      const body = {
        sentence: required<string>(opts.sentence, '--sentence'),
        platform: normPlatform(opts.platform),
        ...baseFilters(opts),
      }
      const data = await apiRequest({ method: 'POST', path: '/intelligent-search/parse', body })
      emit(data)
    },
  },
  {
    name: 'more-words',
    summary: 'Suggest more keywords, excluding ones already shown (no charge)',
    billing: 'free',
    options: [
      { flags: '--sentence <text>', description: 'original search description (required)' },
      { flags: '--platform <p>', description: 'TIKTOK | YOUTUBE | INSTAGRAM (required)' },
      { flags: '--exclude <list>', description: 'comma-separated keywords already shown' },
      ...FILTER_OPTIONS,
    ],
    async run(opts) {
      const body = {
        sentence: required<string>(opts.sentence, '--sentence'),
        platform: normPlatform(opts.platform),
        exclude: parseList(opts.exclude) ?? [],
        ...baseFilters(opts),
      }
      const data = await apiRequest({ method: 'POST', path: '/intelligent-search/more-words', body })
      emit(data)
    },
  },
  {
    name: 'search',
    summary: 'Run the KOL search and return matching creators (consumes quota)',
    billing: 'N quota (N = results returned; 0 = free); session budget 50 unless --confirm-spend',
    options: [
      { flags: '--sentence <text>', description: 'natural-language search description (required)' },
      { flags: '--platform <p>', description: 'TIKTOK | YOUTUBE | INSTAGRAM (required)' },
      { flags: '--limit <n>', description: 'number of results, 1-50 (default 20)' },
      { flags: '--tags <list>', description: 'confirmed canonical tags from parse (comma-separated)' },
      { flags: '--keywords <list>', description: 'confirmed keywords from parse/more-words (comma-separated)' },
      { flags: '--has-contact', description: 'only return creators with contact info' },
      { flags: '--gender <g>', description: 'male | female' },
      {
        flags: '--confirm-spend',
        description:
          'user-approved override when this call would exceed the rolling search session budget (default 50)',
      },
      ...FILTER_OPTIONS,
    ],
    async run(opts) {
      const regions = parseList(opts.regions)
      required(regions, '--regions')
      const minSubscribers = num(opts.minSubscribers)
      if (minSubscribers === undefined) fail(EXIT.PARAMS, 'Missing required option --min-subscribers')
      const avgMin = num(opts.avgMin)
      if (avgMin === undefined) fail(EXIT.PARAMS, 'Missing required option --avg-min')
      const limit = num(opts.limit) ?? 20
      if (!Number.isInteger(limit) || limit < 1 || limit > 50)
        fail(EXIT.PARAMS, '--limit must be an integer from 1 to 50')
      // Single-call soft cap: >30 needs explicit user-approved spend confirmation.
      if (limit > 30 && !opts.confirmSpend) {
        fail(
          EXIT.BUDGET,
          `--limit ${limit} exceeds 30. Ask the user to approve, then re-run with --confirm-spend.`,
          { hint: 'Confirm with the user before large single searches' },
        )
      }
      assertSearchSessionBudget(limit, Boolean(opts.confirmSpend))
      const body: Record<string, unknown> = {
        sentence: required<string>(opts.sentence, '--sentence'),
        platform: normPlatform(opts.platform),
        limit,
        canonicalTags: parseList(opts.tags),
        keywords: parseList(opts.keywords),
        hasContactInfo: opts.hasContact ? true : undefined,
        gender: opts.gender,
        regions,
        minSubscribers,
        avgMin,
        languages: parseList(opts.languages),
        maxSubscribers: num(opts.maxSubscribers),
        avgMax: num(opts.avgMax),
      }
      const data = await apiRequest({ method: 'POST', path: '/intelligent-search', body })
      recordSearchSessionSpend(countSearchResults(data))
      emit(data)
    },
  },
  ...SEARCH_COMMANDS,
  ...EMAIL_COMMANDS,
  ...CREATOR_WORKFLOW_COMMANDS,
]

/** schema-friendly view of a command (no handler). */
export function describe(cmd: CommandDef) {
  return {
    name: cmd.name,
    summary: cmd.summary,
    billing: cmd.billing,
    options: cmd.options.map((o) => ({ flags: o.flags, description: o.description })),
  }
}
