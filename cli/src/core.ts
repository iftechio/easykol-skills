import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Exit codes — agents key error handling off these (see `easykol exit-codes`). */
export const EXIT = {
  OK: 0,
  GENERIC: 1,
  UNAUTH: 2,
  QUOTA: 3,
  FORBIDDEN: 4,
  NETWORK: 5,
  PARAMS: 6,
  RATELIMIT: 7,
  /** Local search session budget exceeded — ask the user before continuing. */
  BUDGET: 8,
} as const

export const DEFAULT_API_BASE = 'https://app.easykol.com'

/** Keep in sync with package.json version. */
export const CLI_VERSION = '0.1.1'

/** Default max search quota spendable in one rolling CLI session without --confirm-spend. */
export const DEFAULT_SEARCH_SESSION_BUDGET = 50

const CONFIG_DIR = join(homedir(), '.easykol')
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json')
const SEARCH_SESSION_PATH = join(CONFIG_DIR, 'search-session.json')
const SEARCH_SESSION_TTL_MS = 2 * 60 * 60 * 1000

interface SearchSessionState {
  startedAt: number
  spent: number
  keyHint?: string
}

export interface EasykolConfig {
  apiKey?: string
  email?: string
  apiBase?: string
}

export function loadConfig(): EasykolConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {}
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as EasykolConfig
  } catch {
    return {}
  }
}

export function saveConfig(cfg: EasykolConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 })
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

interface Action {
  url?: string
  hint: string
}

/** Standard success output: { status, data, quota?, action? }. */
export function emit(data: unknown, extra?: { quota?: unknown; action?: Action }): void {
  const out: Record<string, unknown> = { status: 'ok', data }
  if (extra?.quota !== undefined) out.quota = extra.quota
  if (extra?.action) out.action = extra.action
  process.stdout.write(JSON.stringify(out, null, 2) + '\n')
}

/** Standard error output + exit. */
export function fail(code: number, message: string, action?: Action): never {
  const out: Record<string, unknown> = { status: 'error', error: { code, message } }
  if (action) out.action = action
  process.stdout.write(JSON.stringify(out, null, 2) + '\n')
  process.exit(code)
}

export function required<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null || value === '') {
    fail(EXIT.PARAMS, `Missing required option ${name}`)
  }
  return value as T
}

export interface RawResult {
  ok: boolean
  status: number
  json: any
  networkError?: string
}

interface CallOptions {
  method?: string
  path: string // relative to /external/v1
  body?: unknown
  query?: Record<string, string | undefined>
}

/** Low-level call — never throws, never exits on HTTP error (returns the result). */
export async function apiCall(opts: CallOptions): Promise<RawResult> {
  const cfg = loadConfig()
  if (!cfg.apiKey || !cfg.email) {
    fail(EXIT.UNAUTH, 'Not authenticated. Run: easykol auth --key-stdin --email <email>', {
      hint: 'Configure your API key and email first',
    })
  }
  const base = process.env.EASYKOL_API_BASE || cfg.apiBase || DEFAULT_API_BASE
  const qs = opts.query
    ? '?' +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''
  const url = `${base}/external/v1${opts.path}${qs}`

  let res: Response
  try {
    res = await fetch(url, {
      method: opts.method || 'GET',
      headers: {
        'ek-api-key': cfg.apiKey,
        'ek-api-email': cfg.email,
        'content-type': 'application/json',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch (e: any) {
    return { ok: false, status: 0, json: null, networkError: e?.message || String(e) }
  }

  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { message: text }
  }
  return { ok: res.ok, status: res.status, json }
}

/** Map an HTTP failure to the right exit code + message, then exit. */
export function failHttp(base: string, r: RawResult): never {
  if (r.networkError) fail(EXIT.NETWORK, `Network error: ${r.networkError}`)
  const msg = r.json?.message || r.json?.error || `Request failed (HTTP ${r.status})`
  const lower = String(msg).toLowerCase()
  if (r.status === 401) fail(EXIT.UNAUTH, msg)
  if (r.status === 429) fail(EXIT.RATELIMIT, msg)
  if (r.status === 400) fail(EXIT.PARAMS, msg)
  if (
    r.status === 402 ||
    lower.includes('quota') ||
    lower.includes('配额') ||
    lower.includes('insufficient')
  ) {
    fail(EXIT.QUOTA, msg, {
      url: `${base}/skills/dashboard#quota`,
      hint: 'Insufficient quota — top up',
    })
  }
  if (r.status === 403) fail(EXIT.FORBIDDEN, msg)
  if (r.status >= 500 || r.status === 0) fail(EXIT.NETWORK, msg)
  fail(EXIT.GENERIC, msg)
}

/** High-level request — returns response `data`, or exits with the mapped code. */
export async function apiRequest<T = unknown>(opts: CallOptions): Promise<T> {
  const base = loadConfig().apiBase || DEFAULT_API_BASE
  const r = await apiCall(opts)
  if (r.ok) return (r.json?.data ?? r.json) as T
  failHttp(base, r)
}

export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (buf += c))
    process.stdin.on('end', () => resolve(buf))
  })
}

function searchSessionBudget(): number {
  const raw = process.env.EASYKOL_SEARCH_SESSION_BUDGET
  if (raw === undefined || raw === '') return DEFAULT_SEARCH_SESSION_BUDGET
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_SEARCH_SESSION_BUDGET
}

function loadSearchSession(): SearchSessionState {
  try {
    if (!existsSync(SEARCH_SESSION_PATH)) return { startedAt: Date.now(), spent: 0 }
    const state = JSON.parse(readFileSync(SEARCH_SESSION_PATH, 'utf8')) as SearchSessionState
    if (!state?.startedAt || Date.now() - state.startedAt > SEARCH_SESSION_TTL_MS)
      return { startedAt: Date.now(), spent: 0 }
    return { startedAt: state.startedAt, spent: Math.max(0, Number(state.spent) || 0), keyHint: state.keyHint }
  } catch {
    return { startedAt: Date.now(), spent: 0 }
  }
}

function saveSearchSession(state: SearchSessionState): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(SEARCH_SESSION_PATH, JSON.stringify(state, null, 2), { mode: 0o600 })
}

/**
 * Block a search when this call's planned cost would push the rolling session
 * spend over the budget, unless the caller passed confirmSpend.
 * Planned cost uses --limit (worst-case bill for a full result page).
 */
export function assertSearchSessionBudget(plannedCost: number, confirmSpend: boolean): void {
  const budget = searchSessionBudget()
  const planned = Math.max(0, Math.floor(plannedCost))
  const session = loadSearchSession()
  const projected = session.spent + planned
  if (projected <= budget || confirmSpend) return

  fail(
    EXIT.BUDGET,
    `Search session budget exceeded: spent ${session.spent}, this call plans up to ${planned}, budget ${budget}. ` +
      `Ask the user to approve more spend, then re-run with --confirm-spend. ` +
      `Override budget via EASYKOL_SEARCH_SESSION_BUDGET.`,
    {
      hint: 'Confirm with the user before continuing paid searches',
    },
  )
}

/** Record actual billed search cost after a successful call (N = results returned). */
export function recordSearchSessionSpend(actualCost: number): void {
  const cost = Math.max(0, Math.floor(actualCost))
  if (cost <= 0) return
  const cfg = loadConfig()
  const session = loadSearchSession()
  session.spent += cost
  session.keyHint = cfg.apiKey ? maskKey(cfg.apiKey) : session.keyHint
  saveSearchSession(session)
}

export function countSearchResults(data: unknown): number {
  if (!data || typeof data !== 'object') return 0
  const obj = data as { total?: unknown; data?: unknown }
  if (typeof obj.total === 'number' && Number.isFinite(obj.total)) return Math.max(0, Math.floor(obj.total))
  if (Array.isArray(obj.data)) return obj.data.length
  if (Array.isArray(data)) return data.length
  return 0
}
