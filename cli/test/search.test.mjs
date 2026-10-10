import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

async function harness(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'easykol-v2-'))
  const requests = [],
    tasks = new Map(),
    byKey = new Map()
  let charges = 0,
    uncertain = options.uncertain,
    partial = options.partial
  const server = createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = raw ? JSON.parse(raw) : undefined
    const url = new URL(req.url, 'http://localhost')
    requests.push({ method: req.method, path: url.pathname, body })
    res.setHeader('content-type', 'application/json')
    const send = (data) =>
      res.end(
        JSON.stringify({
          statusCode: 200,
          error: null,
          message: 'Success',
          data,
        }),
      )
    if (options.unavailable) {
      res.statusCode = 404
      return res.end('{"message":"Not found"}')
    }
    if (url.pathname === '/external/v1/intelligent-search/parse')
      return send({
        canonicalTags: [{ name: 'Gaming' }],
        keywords: [],
        estimatedTotal: 123,
      })
    if (url.pathname === '/external/v1/intelligent-search') {
      charges++
      return send({
        total: 2,
        data: [{ nickname: 'Legacy one' }, { nickname: 'Legacy two' }],
      })
    }
    if (url.pathname.endsWith('/parse'))
      return send({
        parameters: {
          ...body,
          canonicalTags: [],
          keywords: [],
          expandedQuery: body.sentence,
        },
        quote: {
          unit: 'taskPoints',
          reserved: options.quote ?? body.batchCount ?? 1,
        },
      })
    if (req.method === 'POST') {
      let task = byKey.get(body.idempotencyKey)
      if (!task) {
        charges++
        const parent = url.pathname.endsWith('/next')
          ? tasks.get(url.pathname.split('/').at(-2))
          : null
        task = {
          taskId: `task-${charges}`,
          searchMode: parent?.searchMode ?? body.searchMode,
          effectiveParameters: parent?.effectiveParameters ?? body,
          status: options.processing ? 'PROCESSING' : 'COMPLETED',
          resultsReady: !options.processing,
          data: [],
          nextOffset: null,
          quote: { unit: 'taskPoints', reserved: options.quote ?? 1 },
          settlement: { pending: false, net: options.net ?? 1 },
        }
        tasks.set(task.taskId, task)
        byKey.set(body.idempotencyKey, task)
      }
      if (uncertain) {
        uncertain = false
        res.statusCode = 500
        return res.end('{"message":"lost response"}')
      }
      if (partial) {
        partial = false
        res.writeHead(200)
        res.write('{"data":')
        setTimeout(() => res.destroy(), 10)
        return
      }
      return send(task)
    }
    return send(tasks.get(url.pathname.split('/').at(-1)))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  writeFileSync(
    join(dir, 'config.json'),
    JSON.stringify({
      apiKey: 'test-key-only',
      email: 'test@example.com',
      apiBase: base,
    }),
  )
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  })
  const run = (args, entryArgs = ['dist/index.js']) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [...entryArgs, ...args], {
        env: {
          ...process.env,
          EASYKOL_CONFIG_DIR: dir,
          EASYKOL_API_BASE: base,
          EASYKOL_SEARCH_SESSION_BUDGET: '50',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let out = '',
        err = ''
      child.stdout.on('data', (c) => (out += c))
      child.stderr.on('data', (c) => (err += c))
      child.on('close', (code) => resolve({ code, json: out.trim() ? JSON.parse(out) : null, err }))
    })
  return {
    run,
    requests,
    tasks,
    charges: () => charges,
    spent: () => JSON.parse(readFileSync(join(dir, 'search-session.json'))).spent,
  }
}
const search = [
  'search-v2',
  '--platform',
  'TIKTOK',
  '--sentence',
  'US gaming creators',
  '--regions',
  'US',
  '--idempotency-key',
  'request-001',
  '--no-wait',
]

test('default fast prepares v2, quotes one batch, and recovers a completed task for free', async (t) => {
  const h = await harness(t)
  const first = await h.run(search)
  assert.equal(first.code, 0)
  assert.equal(first.json.data.searchMode, 'fast')
  assert.equal(h.requests[0].path, '/external/v2/intelligent-search/parse')
  assert.equal(h.requests[1].body.idempotencyKey, 'request-001')
  assert.equal(h.spent(), 10)
  const retry = await h.run(['search-v2', '--idempotency-key', 'request-001', '--no-wait'])
  assert.equal(retry.json.data.taskId, first.json.data.taskId)
  assert.equal(h.charges(), 1)
  assert.equal(h.requests.filter((r) => r.method === 'POST').length, 2)
  assert.equal(h.spent(), 10)
})
test('standard and beta preserve explicit modes and product requirements', async (t) => {
  const h = await harness(t)
  for (const mode of ['standard', 'beta']) {
    const args = [...search, '--mode', mode]
    args[args.indexOf('request-001')] = `request-${mode}`
    if (mode === 'beta')
      args.push('--product', 'Running headphones', '--audience', 'Runners', '--visual')
    const response = await h.run(args)
    assert.equal(response.code, 0)
    assert.equal(response.json.data.searchMode, mode)
  }
  assert.equal(h.requests.at(-1).body.productRequirements.targetAudience, 'Runners')
  assert.equal(h.requests.at(-1).body.useVisualScreening, true)
})
test('uncertain paid submission recovers with the persisted original key/body and one reservation', async (t) => {
  const h = await harness(t, { uncertain: true })
  const first = await h.run(search)
  assert.equal(first.code, 5)
  assert.match(first.json.error.message, /request-001/)
  const recovered = await h.run(['search-v2', '--idempotency-key', 'request-001', '--no-wait'])
  assert.equal(recovered.code, 0)
  assert.equal(h.charges(), 1)
  assert.equal(h.spent(), 10)
  assert.deepEqual(h.requests[1].body, h.requests[2].body)
})
test('a paid response interrupted after headers retains the recovery key and reservation', async (t) => {
  const h = await harness(t, { partial: true })
  const first = await h.run(search)
  assert.equal(first.code, 5)
  assert.match(first.json.error.message, /uncertain.*request-001/)
  const recovered = await h.run(['search-v2', '--idempotency-key', 'request-001', '--no-wait'])
  assert.equal(recovered.code, 0)
  assert.equal(h.charges(), 1)
  assert.equal(h.spent(), 10)
})

test('original parse and search keep their V1 endpoint, options, result shape and per-result budget', async (t) => {
  const h = await harness(t)
  const parsed = await h.run([
    'parse',
    '--platform',
    'TIKTOK',
    '--sentence',
    'Gaming',
    '--regions',
    'US',
  ])
  assert.equal(parsed.code, 0)
  assert.deepEqual(parsed.json.data, {
    canonicalTags: [{ name: 'Gaming' }],
    keywords: [],
    estimatedTotal: 123,
  })
  const found = await h.run([
    'search',
    '--platform',
    'TIKTOK',
    '--sentence',
    'Gaming',
    '--regions',
    'US',
    '--min-subscribers',
    '1000',
    '--avg-min',
    '500',
    '--limit',
    '2',
    '--tags',
    'Gaming',
  ])
  assert.equal(found.code, 0)
  assert.deepEqual(found.json.data, {
    total: 2,
    data: [{ nickname: 'Legacy one' }, { nickname: 'Legacy two' }],
  })
  assert.deepEqual(h.requests, [
    {
      method: 'POST',
      path: '/external/v1/intelligent-search/parse',
      body: { sentence: 'Gaming', platform: 'TIKTOK', regions: ['US'] },
    },
    {
      method: 'POST',
      path: '/external/v1/intelligent-search',
      body: {
        sentence: 'Gaming',
        platform: 'TIKTOK',
        limit: 2,
        canonicalTags: ['Gaming'],
        regions: ['US'],
        minSubscribers: 1000,
        avgMin: 500,
      },
    },
  ])
  assert.equal(h.spent(), 2)
})

test('shared HTTP defaults leave V1 without a new deadline and apply deadlines only to V2', async (t) => {
  const h = await harness(t)
  const result = await h.run(
    [],
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `
    import core from './src/core.ts';
    const { apiCall } = core;
    const signals = [];
    globalThis.fetch = async (_url, opts) => {
      signals.push(Boolean(opts.signal));
      return new Response('{}');
    };
    await apiCall({ path: '/video' });
    await apiCall({ version: 2, path: '/intelligent-search/task' });
    process.stdout.write(JSON.stringify(signals));
  `,
    ],
  )
  assert.equal(result.code, 0, result.err)
  assert.deepEqual(result.json, [false, true])
})
test('poll timeout retains task identity; task queries never create paid work', async (t) => {
  const h = await harness(t, { processing: true })
  const args = search.filter((a) => a !== '--no-wait').concat(['--timeout', '0'])
  const first = await h.run(args)
  assert.equal(first.json.data.pollingTimedOut, true)
  assert.equal(first.json.data.taskId, 'task-1')
  const queried = await h.run(['task', '--task-id', 'task-1', '--offset', '0', '--limit', '100'])
  assert.equal(queried.code, 0)
  assert.equal(h.charges(), 1)
})
test('continuation submits only a new key to the exact completed source', async (t) => {
  const h = await harness(t)
  await h.run(search)
  const next = await h.run([
    'search-next',
    '--task-id',
    'task-1',
    '--idempotency-key',
    'request-next',
    '--no-wait',
  ])
  assert.equal(next.code, 0)
  assert.equal(h.requests.at(-1).path, '/external/v2/intelligent-search/task-1/next')
  assert.deepEqual(h.requests.at(-1).body, { idempotencyKey: 'request-next' })
  assert.equal(next.json.data.searchMode, 'fast')
  assert.equal(h.charges(), 2)
})
test('a missing v2 deployment never falls back to v1', async (t) => {
  const h = await harness(t, { unavailable: true })
  const response = await h.run(search)
  assert.equal(response.code, 6)
  assert.match(response.json.error.message, /V1 fallback/)
  assert.equal(h.requests.length, 1)
  assert.ok(h.requests.every((r) => r.path.startsWith('/external/v2/')))
  assert.equal(h.charges(), 0)
})
test('beta multi-batch is rejected locally before any remote request', async (t) => {
  const h = await harness(t)
  const response = await h.run([...search, '--mode', 'beta', '--batches', '3'])
  assert.equal(response.code, 6)
  assert.equal(h.requests.length, 0)
})
test('server quote above the session budget blocks before paid submission', async (t) => {
  const h = await harness(t, { quote: 6 })
  const response = await h.run(search)
  assert.equal(response.code, 8)
  assert.equal(h.charges(), 0)
  assert.deepEqual(
    h.requests.map((r) => r.path),
    ['/external/v2/intelligent-search/parse'],
  )
})
test('finalized refund reconciles the reservation and a changed request cannot reuse the key', async (t) => {
  const h = await harness(t, { net: 0 })
  await h.run(search)
  assert.equal(h.spent(), 0)
  const response = await h.run([...search, '--mode', 'standard'])
  assert.equal(response.code, 6)
  assert.equal(h.charges(), 1)
})
