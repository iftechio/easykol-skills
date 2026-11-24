import assert from 'node:assert/strict'
import { execFile, spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { builtinModules } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

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

test('creator lookup commands use the external inventory routes and preserve the requested limit', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'easykol-creator-lookups-'))
  const requests = []
  let disconnect = false
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ method: req.method, path: req.url, body: body ? JSON.parse(body) : undefined })
    if (disconnect) return req.socket.destroy()
    res.setHeader('content-type', 'application/json')
    const emailLookup = req.url === '/external/v1/creators/by-email'
    const result = emailLookup ? { creators: [] } : { items: [{ id: 'post-1' }] }
    const billing = emailLookup
      ? { unit: 'AI_CREDIT', basis: 'per_creator', ratePoints: 0.1, maxPoints: 0.3, chargedPoints: 0 }
      : { unit: 'AI_CREDIT', basis: 'per_query', ratePoints: 0.1, maxPoints: 0.1, chargedPoints: 0.1 }
    res.end(JSON.stringify({ data: { ...result, truncated: false, billing } }))
  })
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ apiKey: 'fixture', email: 'caller@example.com' }))
  const entry = process.env.EASYKOL_TEST_ENTRY
    || fileURLToPath(new URL('../../skills/easykol/scripts/api.cjs', import.meta.url))
  const execute = promisify(execFile)
  const run = (args) => execute(process.execPath, [entry, ...args], {
    env: { ...process.env, EASYKOL_CONFIG_DIR: dir, EASYKOL_API_BASE: base },
  })
  const url = 'https://www.youtube.com/@example'
  const recent = ['creator-recent-posts', '--url', url, '--limit']
  const lookup = ['creators-by-email', '--email', ' Creator@Example.com ', '--limit', '3']
  const recentResult = JSON.parse((await run([...recent, '2'])).stdout).data
  assert.deepEqual(recentResult.items, [{ id: 'post-1' }])
  assert.deepEqual(recentResult.billing, { unit: 'AI_CREDIT', basis: 'per_query', ratePoints: 0.1, maxPoints: 0.1, chargedPoints: 0.1 })
  const lookupResult = JSON.parse((await run(lookup)).stdout).data
  assert.deepEqual(lookupResult.creators, [])
  assert.deepEqual(lookupResult.billing, { unit: 'AI_CREDIT', basis: 'per_creator', ratePoints: 0.1, maxPoints: 0.3, chargedPoints: 0 })
  await assert.rejects(run([...recent, '61']), { code: 6 })
  await assert.rejects(run(['creators-by-email', '--email', 'a@example.com,b@example.com']), { code: 6 })
  assert.deepEqual(requests, [
    { method: 'POST', path: '/external/v1/creators/recent-posts', body: { url, limit: 2 } },
    { method: 'POST', path: '/external/v1/creators/by-email', body: { email: 'creator@example.com', limit: 3 } },
  ])
  disconnect = true
  await assert.rejects(run([...recent, '2']), { code: 5 })
  assert.equal(requests.length, 3)
  await assert.rejects(run(lookup), { code: 5 })
  assert.equal(requests.length, 4)
})

test('audience reports resume by ID without submitting another analysis', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'easykol-audience-'))
  const requests = []
  const status = { taskId: 'audience-1', status: 'PROCESSING' }
  const report = { taskId: 'audience-1', status: 'COMPLETED', result: { fakeFollowers: null } }
  let lookup = status
  const server = createServer((req, res) => {
    requests.push([req.method, req.url])
    req.resume()
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ data: req.method === 'POST' ? status : lookup }))
  })
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ apiKey: 'test-only', email: 'test@example.com' }))
  const entry = fileURLToPath(new URL('../../skills/easykol/scripts/api.cjs', import.meta.url))
  const execute = promisify(execFile)
  const run = (args) => execute(process.execPath, [entry, ...args], {
    env: { ...process.env, EASYKOL_CONFIG_DIR: dir, EASYKOL_API_BASE: base },
  })
  const submit = ['audience', '--url', 'https://www.youtube.com/@example']
  const query = ['audience-result', '--task-id', status.taskId]
  const data = (result) => JSON.parse(result.stdout).data

  assert.deepEqual(data(await run([...submit, '--submit-only'])), status)
  assert.deepEqual(data(await run(query)), status)
  lookup = report
  assert.deepEqual(data(await run(query)), report)
  assert.deepEqual(requests, [
    ['POST', '/external/v1/audience'],
    ['GET', '/external/v1/audience/audience-1'],
    ['GET', '/external/v1/audience/audience-1'],
  ])

  requests.length = 0
  await assert.rejects(run([...submit, '--timeout', '0']), (error) => {
    assert.match(error.stderr, /audience-result --task-id audience-1/)
    assert.match(JSON.parse(error.stdout).error.message, /timed out/)
    return true
  })
  assert.deepEqual(data(await run(query)), report)
  assert.deepEqual(requests, [
    ['POST', '/external/v1/audience'],
    ['GET', '/external/v1/audience/audience-1'],
  ])

  requests.length = 0
  assert.deepEqual(data(await run(submit)), report.result)
  assert.deepEqual(requests, [
    ['POST', '/external/v1/audience'],
    ['GET', '/external/v1/audience/audience-1'],
  ])
})
