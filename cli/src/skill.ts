// Skill-local API transport. Built into one file with only Node built-in imports.
import { parseArgs, type ParseArgsConfig } from 'node:util'
import { API_COMMANDS, describe, type CommandDef } from './commands'
import { CLI_VERSION, CONFIG_PATH, DEFAULT_API_BASE, emit, EXIT, fail, loadConfig } from './core'

const commands: CommandDef[] = API_COMMANDS.map((command) => command.name === 'auth'
  ? { ...command, options: command.options.filter((o) => !o.flags.startsWith('--key ')) }
  : command)

async function main() {
  const [name, ...args] = process.argv.slice(2)
  if (name === '--version') return void process.stdout.write(`${CLI_VERSION}\n`)
  if (!name || name === '--help' || name === 'schema') {
    const found = args[0] && args[0] !== '--all' ? commands.find((c) => c.name === args[0]) : undefined
    if (args[0] && args[0] !== '--all' && !found) fail(EXIT.PARAMS, `Unknown operation: ${args[0]}`)
    return emit(found ? describe(found) : { commands: commands.map(describe) })
  }
  if (name === 'exit-codes') return emit(EXIT)
  if (name === 'doctor') {
    const cfg = loadConfig()
    const apiBase = process.env.EASYKOL_API_BASE || cfg.apiBase || DEFAULT_API_BASE
    let reachable = false
    try {
      reachable = (await fetch(apiBase, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })).status < 500
    } catch { /* Report connectivity without invoking installers or registries. */ }
    return emit({ runtime: 'skill', node: process.version, nodeOk: Number(process.versions.node.split('.')[0]) > 18 || (Number(process.versions.node.split('.')[0]) === 18 && Number(process.versions.node.split('.')[1]) >= 3),
      configPath: CONFIG_PATH, hasApiKey: Boolean(cfg.apiKey), hasEmail: Boolean(cfg.email), apiBase, reachable })
  }
  const command = commands.find((c) => c.name === name)
  if (!command) fail(EXIT.PARAMS, `Unknown operation: ${name}; use schema --all`)
  if (args.includes('--help')) return emit(describe(command))
  const options: NonNullable<ParseArgsConfig['options']> = {}
  for (const option of command.options) {
    const match = /^--([a-z0-9-]+)(?:\s+([<[]))?/.exec(option.flags)
    if (!match) throw new Error(`Unsupported option definition: ${option.flags}`)
    options[match[1]] = { type: match[2] ? 'string' : 'boolean' }
  }
  let values
  try { values = parseArgs({ args, options, strict: true, allowPositionals: false }).values }
  catch (error: any) { fail(EXIT.PARAMS, error.message) }
  const opts: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    const positive = key.startsWith('no-') ? key.slice(3) : key
    opts[positive.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = key.startsWith('no-') ? !value : value
  }
  await command.run(opts)
}

main().catch((error: any) => fail(EXIT.GENERIC, error?.message || String(error)))
