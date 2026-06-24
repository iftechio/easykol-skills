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
} as const

export const DEFAULT_API_BASE = 'https://easykol.com'

const CONFIG_DIR = join(homedir(), '.easykol')
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

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
  const base = cfg.apiBase || DEFAULT_API_BASE
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
