import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const cliEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url))

test('reported CLI version matches package metadata', () => {
  const result = spawnSync(process.execPath, [cliEntry, '--version'], {
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), packageJson.version)
})
