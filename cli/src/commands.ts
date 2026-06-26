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
