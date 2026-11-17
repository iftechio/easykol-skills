import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { builtinModules } from 'node:module'
import { test } from 'node:test'

test('an installed Skill runs by itself without npm, global easykol or node_modules', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'easykol-skill-only-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  cpSync(new URL('../../skills/easykol', import.meta.url), join(dir, 'easykol'), { recursive: true })
  const entry = join(dir, 'easykol/scripts/api.cjs')
  const env = { ...process.env, PATH: '', NODE_PATH: '', EASYKOL_CONFIG_DIR: join(dir, 'config') }
  const run = (args, input) => spawnSync(process.execPath, [entry, ...args], { cwd: dir, env, input, encoding: 'utf8' })
  const schema = run(['schema', 'email-send'])
  assert.equal(schema.status, 0, schema.stderr)
  assert.equal(JSON.parse(schema.stdout).data.name, 'email-send')
  const auth = run(['auth', '--key-stdin', '--email', 'test@example.com', '--api-base', 'http://127.0.0.1:1'], 'test-only-secret')
  assert.equal(auth.status, 0, auth.stderr)
  assert.equal(auth.stdout.includes('test-only-secret'), false)
  const doctor = run(['doctor'])
  assert.equal(doctor.status, 0, doctor.stderr)
  assert.equal(JSON.parse(doctor.stdout).data.runtime, 'skill')
  assert.equal(JSON.parse(doctor.stdout).data.hasApiKey, true)
  const operations = JSON.parse(run(['schema', '--all']).stdout).data.commands
  assert.equal(operations.some((c) => c.name === 'upgrade'), false)
  assert.equal(operations.find((c) => c.name === 'auth').options.some((o) => o.flags.startsWith('--key ')), false)
  const bad = run(['email-send', '--not-a-real-option'])
  assert.equal(bad.status, 6)
  const source = readFileSync(entry, 'utf8')
  for (const [, dependency] of source.matchAll(/require\("([^"]+)"\)/g)) {
    assert.ok(dependency.startsWith('node:') || builtinModules.includes(dependency), dependency)
  }
})
