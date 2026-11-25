import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

test('creator workflows preserve explicit mutations, free task reads and bounded lookups', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'easykol-workflows-'))
  const requests = []
  const server = createServer(async (req, res) => {
    let data = ''
    for await (const chunk of req) data += chunk
    requests.push([req.method, req.url, data ? JSON.parse(data) : null])
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ data: { taskId: 'task-1', status: 'PROCESSING' } }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(folder, { recursive: true, force: true })
  })
  writeFileSync(join(folder, 'config.json'), JSON.stringify({ apiKey: 'fixture', email: 'fixture@example.com' }))
  const entry = process.env.EASYKOL_TEST_ENTRY || fileURLToPath(new URL('../dist/index.js', import.meta.url))
  const execute = promisify(execFile)
  const run = (...args) => execute(process.execPath, [entry, ...args], { env: {
    ...process.env, EASYKOL_CONFIG_DIR: folder, EASYKOL_API_BASE: `http://127.0.0.1:${server.address().port}`,
  } })
  const url = 'https://www.tiktok.com/@fixture'
  await assert.rejects(run('favorites-delete', '--project-id', 'project-1'), { code: 6 })
  await assert.rejects(run('search-v2', '--platform', 'INSTAGRAM', '--sentence', 'fixture', '--has-video-cart'), { code: 6 })
  await assert.rejects(run('creators-by-email', '--email', 'fixture@example.com', '--limit', '61'), { code: 6 })
  await run('favorites-add', '--project-id', 'project-1', '--kol-ids', 'c1,c1,c2')
  await run('favorites-share', '--project-id', 'project-1', '--scope', 'workspace')
  await run('favorites-export', '--project-id', 'project-1', '--days', '7', '--lang', 'zh')
  await run('favorites-export-result', '--project-id', 'project-1', '--task-id', 'task-1')
  await run('fake-followers', '--url', url)
  await run('fake-followers-result', '--task-id', 'task-1')
  await run('tiktok-cart', '--url', url, '--limit', '20')
  assert.deepEqual(requests, [
    ['POST', '/external/v1/favorites/project-1/creators', { action: 'add', kolIds: ['c1', 'c2'] }],
    ['PUT', '/external/v1/favorites/project-1/share', { scope: 'workspace' }],
    ['POST', '/external/v1/favorites/project-1/exports', { recentDays: 7, lang: 'zh' }],
    ['GET', '/external/v1/favorites/project-1/exports/task-1', null],
    ['POST', '/external/v1/fake-followers', { url }],
    ['GET', '/external/v1/fake-followers/task-1', null],
    ['POST', '/external/v1/creators/recent-posts', { url, limit: 20, cartOnly: true }],
  ])
})
