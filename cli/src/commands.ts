import {
  apiCall,
  apiRequest,
  CONFIG_PATH,
  DEFAULT_API_BASE,
  emit,
  EXIT,
  fail,
  failHttp,
  loadConfig,
  maskKey,
  readStdin,
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
): Promise<any> {
  const base = loadConfig().apiBase || DEFAULT_API_BASE
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const r = await apiCall({ path })
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
    name: 'doctor',
    summary: 'Check CLI version, config, and API connectivity',
    billing: 'free',
    options: [],
    async run() {
      const cfg = loadConfig()
      const base = cfg.apiBase || DEFAULT_API_BASE
      const majorNode = Number(process.versions.node.split('.')[0])
      let reachable = false
      try {
        const res = await fetch(base, { method: 'HEAD' })
        reachable = res.status < 500
      } catch {
        reachable = false
      }
      emit({
        cliVersion: '0.1.0',
        node: process.version,
        nodeOk: majorNode >= 18,
        configPath: CONFIG_PATH,
        hasApiKey: Boolean(cfg.apiKey),
        hasEmail: Boolean(cfg.email),
        apiBase: base,
        reachable,
      })
    },
  },
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
      { flags: '--dedup-days <n>', description: 'skip creators seen in past N days (default 3, 0 = off)' },
      { flags: '--timeout <s>', description: 'poll timeout in seconds (default 120)' },
    ],
    async run(opts) {
      const seedProfileUrl = required<string>(opts.url, '--url')
      const body: Record<string, unknown> = {
        seedProfileUrl,
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
    billing: 'N quota (N = results returned; 0 = free)',
    options: [
      { flags: '--sentence <text>', description: 'natural-language search description (required)' },
      { flags: '--platform <p>', description: 'TIKTOK | YOUTUBE | INSTAGRAM (required)' },
      { flags: '--limit <n>', description: 'number of results, 1-50 (default 20)' },
      { flags: '--tags <list>', description: 'confirmed canonical tags from parse (comma-separated)' },
      { flags: '--keywords <list>', description: 'confirmed keywords from parse/more-words (comma-separated)' },
      { flags: '--has-contact', description: 'only return creators with contact info' },
      { flags: '--gender <g>', description: 'male | female' },
      ...FILTER_OPTIONS,
    ],
    async run(opts) {
      const regions = parseList(opts.regions)
      required(regions, '--regions')
      const minSubscribers = num(opts.minSubscribers)
      if (minSubscribers === undefined) fail(EXIT.PARAMS, 'Missing required option --min-subscribers')
      const avgMin = num(opts.avgMin)
      if (avgMin === undefined) fail(EXIT.PARAMS, 'Missing required option --avg-min')
      const body: Record<string, unknown> = {
        sentence: required<string>(opts.sentence, '--sentence'),
        platform: normPlatform(opts.platform),
        limit: num(opts.limit),
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
      emit(data)
    },
  },
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
