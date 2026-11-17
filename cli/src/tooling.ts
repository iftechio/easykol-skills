import { execFileSync } from 'node:child_process'
import type { CommandDef } from './commands'
import { CLI_VERSION, CONFIG_PATH, DEFAULT_API_BASE, emit, EXIT, loadConfig } from './core'

export const TOOL_COMMANDS: CommandDef[] = [
  {
    name: 'doctor',
    summary: 'Check CLI version, config, and API connectivity',
    billing: 'free',
    options: [],
    async run() {
      const cfg = loadConfig()
      const base = process.env.EASYKOL_API_BASE || cfg.apiBase || DEFAULT_API_BASE
      const majorNode = Number(process.versions.node.split('.')[0])
      let reachable = false
      try {
        const res = await fetch(base, { method: 'HEAD' })
        reachable = res.status < 500
      } catch {
        reachable = false
      }
      let latestCliVersion: string | null = null
      let updateAvailable = false
      try {
        latestCliVersion = execFileSync('npm', ['view', '@easykol/cli', 'version'], {
          encoding: 'utf8',
          timeout: 15_000,
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim()
        updateAvailable = Boolean(latestCliVersion && latestCliVersion !== CLI_VERSION)
      } catch {
        latestCliVersion = null
      }
      emit({
        cliVersion: CLI_VERSION,
        latestCliVersion,
        updateAvailable,
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
    name: 'upgrade',
    summary: 'Update @easykol/cli and refresh the easykol skill from GitHub (free)',
    billing: 'free',
    options: [
      {
        flags: '--skip-skill',
        description: 'only update the CLI package, do not run skills update',
      },
    ],
    async run(opts) {
      const steps: Array<{ step: string; ok: boolean; detail?: string }> = []

      try {
        const out = execFileSync('npm', ['install', '-g', '@easykol/cli@latest'], {
          encoding: 'utf8',
          timeout: 120_000,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        steps.push({ step: 'cli', ok: true, detail: out.trim().split('\n').slice(-3).join(' | ') })
      } catch (e: any) {
        steps.push({
          step: 'cli',
          ok: false,
          detail: e?.stderr?.toString?.() || e?.message || String(e),
        })
      }

      if (!opts.skipSkill) {
        try {
          const out = execFileSync(
            'npx',
            ['--yes', 'skills', 'update', 'easykol', '-y'],
            {
              encoding: 'utf8',
              timeout: 120_000,
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          )
          steps.push({ step: 'skill', ok: true, detail: out.trim().split('\n').slice(-5).join(' | ') })
        } catch (e: any) {
          steps.push({
            step: 'skill',
            ok: false,
            detail: e?.stderr?.toString?.() || e?.message || String(e),
          })
        }
      }

      const ok = steps.every((s) => s.ok)
      emit({
        upgraded: ok,
        cliVersionBefore: CLI_VERSION,
        steps,
        hint: ok
          ? 'CLI/skill refresh attempted. Re-read the easykol skill if this session started on an older copy.'
          : 'Partial failure — retry or ask the user to run: npm i -g @easykol/cli@latest && npx skills update easykol -y',
      })
      if (!ok) process.exitCode = EXIT.GENERIC
    },
  },
]
