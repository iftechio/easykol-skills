import { Command } from 'commander'
import { API_COMMANDS, describe } from './commands'
import { emit, EXIT, fail } from './core'

const program = new Command()
program
  .name('easykol')
  .description('EasyKOL CLI — KOL discovery over the EasyKOL API (used by the easykol agent skill)')
  .version('0.1.0')

// API commands (single source of truth in commands.ts)
for (const cmd of API_COMMANDS) {
  const c = program.command(cmd.name).description(`${cmd.summary} [${cmd.billing}]`)
  for (const o of cmd.options) c.option(o.flags, o.description)
  c.action((opts) =>
    cmd.run(opts).catch((e: any) => fail(EXIT.GENERIC, e?.message || String(e))),
  )
}

// schema — self-description so the agent never has to memorize parameters
program
  .command('schema [command]')
  .description('Print the full command tree, or one command schema [free]')
  .option('--all', 'print the full command tree')
  .action((command: string | undefined) => {
    const all = API_COMMANDS.map(describe)
    if (command) {
      const found = all.find((d) => d.name === command)
      if (!found) fail(EXIT.PARAMS, `Unknown command: ${command}`)
      emit(found)
    } else {
      emit({ commands: all })
    }
  })

// exit-codes — agents drive error handling off these
program
  .command('exit-codes')
  .description('List CLI exit codes and their meaning [free]')
  .action(() => {
    emit({
      0: 'success',
      1: 'generic error',
      2: 'unauthenticated — run easykol auth',
      3: 'quota insufficient — top up',
      4: 'forbidden — feature not in plan',
      5: 'network error',
      6: 'bad parameters',
      7: 'rate limited',
    })
  })

program.parseAsync(process.argv).catch((e: any) => fail(EXIT.GENERIC, e?.message || String(e)))
