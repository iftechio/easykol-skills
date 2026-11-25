import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

test('audience submits the selected tier and defaults to 2×', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'easykol-audience-tiers-'))
  const requests = []
  let advertisesTiers = true
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const part of req) body += part
    requests.push({ method: req.method, path: req.url, body: body ? JSON.parse(body) : undefined })
    res.setHeader('content-type', 'application/json')
    if (req.url === '/external/v1/quota') {
      return res.end(JSON.stringify({
        data: advertisesTiers ? { capabilities: { audienceDataMultipliers: [1, 2, 6] } } : {},
      }))
    }
    res.end(JSON.stringify({ data: { taskId: 'report-1', status: 'PROCESSING' } }))
  })
  t.after(() => new Promise((resolve) => server.close(resolve)))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ apiKey: 'test-only', email: 'test@example.com' }))
  const entry = process.env.EASYKOL_TEST_ENTRY
    || fileURLToPath(new URL('../../skills/easykol/scripts/api.cjs', import.meta.url))
  const url = 'https://www.youtube.com/@example'
  const execute = promisify(execFile)
  const run = (...args) => execute(process.execPath, [
    entry, 'audience', '--url', url, '--submit-only', ...args,
  ], {
    env: { ...process.env, EASYKOL_CONFIG_DIR: dir, EASYKOL_API_BASE: `http://127.0.0.1:${server.address().port}` },
  })
  await run()
  for (const tier of ['1', '2', '6']) await run('--data-multiplier', tier)
  await assert.rejects(run('--data-multiplier', '3'), { code: 6 })
  advertisesTiers = false
  await assert.rejects(run('--data-multiplier', '6'), { code: 6 })
  await run()
  assert.deepEqual(requests.map(({ method }) => method), [
    'POST', 'GET', 'POST', 'POST', 'GET', 'POST', 'GET', 'POST',
  ])
  assert.deepEqual(requests.filter(({ method }) => method === 'POST'), [2, 1, 2, 6, 2].map((dataMultiplier) => ({
    method: 'POST', path: '/external/v1/audience', body: { url, dataMultiplier },
  })))
})
