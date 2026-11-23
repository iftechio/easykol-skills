import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const workflow = fileURLToPath(new URL('../../skills/easykol/scripts/feishu-workflow.cjs', import.meta.url))
const deviceCode = 'a'.repeat(64)
const deviceToken = 'ekdf_' + 'b'.repeat(43)
const workflowToken = 'ekf_' + 'c'.repeat(43)
const verificationUrl = 'https://easykol.com/device-bind?user_code=ABCD-EFGH'

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'easykol-feishu-onboarding-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const preload = join(directory, 'mock-fetch.cjs')
  const statePath = join(directory, 'feishu-auth.json')
  const setupPath = join(directory, 'setup.json')
  const mockCli = join(directory, 'lark-cli')
  writeFileSync(setupPath, JSON.stringify({
    baseToken: 'bascnExample', tableId: 'tblExample', tableName: 'Example', urlFieldName: 'URL',
    urlFieldId: 'fldProfile', urlFieldIsHyperlink: false, followerFieldName: 'Followers',
    medianViewsFieldName: 'Median views', recordIdFieldName: 'Row ID', statusFieldName: 'Status',
  }))
  writeFileSync(preload, `
    const assert = require('node:assert/strict')
    const reply = (data) => new Response(JSON.stringify({ statusCode: 1000, data }))
    global.fetch = async (url, options) => {
      const mode = process.env.FEISHU_HTTP_FIXTURE
      assert.notEqual(mode, 'none')
      if (url === 'https://app.easykol.com/api/device-auth/code') {
        assert.equal(options.method, 'POST')
        assert.equal(JSON.parse(options.body).purpose, 'feishu_credentials')
        return reply({
          purpose: mode === 'legacy' ? undefined : 'feishu_credentials',
          userCode: 'ABCD-EFGH', deviceCode: ${JSON.stringify(deviceCode)}, interval: 10, expiresIn: 600,
          verificationUriComplete: mode === 'foreign' ? 'https://example.com/device-bind?user_code=ABCD-EFGH' : ${JSON.stringify(verificationUrl)},
        })
      }
      if (url === 'https://app.easykol.com/api/device-auth/token') {
        assert.equal(options.method, 'POST')
        assert.equal(JSON.parse(options.body).deviceCode, ${JSON.stringify(deviceCode)})
        if (mode === 'pending') return reply({ status: 'authorization_pending' })
        return reply({
          status: 'approved', token: mode === 'broad' ? 'ekd_' + 'b'.repeat(43) : ${JSON.stringify(deviceToken)},
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        })
      }
      const path = '/api/enterprise-api-key/feishu-credentials'
      if (url === 'https://app.easykol.com' + path ||
          url === 'https://app.easykol.com' + path + '/credExample') {
        assert.deepEqual(options.headers, { Authorization: 'Bearer ' + ${JSON.stringify(deviceToken)} })
        if (options.method === 'DELETE') return reply({ revoked: true })
        assert.equal(options.method, 'POST')
        return reply({ id: 'credExample', token: ${JSON.stringify(workflowToken)} })
      }
      if (url === 'https://talent-marketing-api.aiwaifu.top/external/v1/feishu/credentials/credExample') {
        assert.equal(options.method, 'DELETE')
        assert.deepEqual(options.headers, { 'ek-api-key': 'test-existing-key', 'ek-api-email': 'test@example.com' })
        return reply({ revoked: true })
      }
      assert.fail('Unexpected endpoint')
    }
  `)
  writeFileSync(mockCli, `#!${process.execPath}
    const assert = require('node:assert/strict')
    const { createHash } = require('node:crypto')
    const { readFileSync, statSync } = require('node:fs')
    assert.ok(process.argv.includes('+workflow-create'))
    assert.ok(process.argv.includes('@workflow.json'))
    const definition = JSON.parse(readFileSync('workflow.json', 'utf8'))
    const { urlFieldIsHyperlink, ...setup } = JSON.parse(readFileSync(${JSON.stringify(setupPath)}, 'utf8'))
    const expectedCreateToken = createHash('sha256')
      .update(JSON.stringify([{ ...setup, urlFieldIsHyperlink }, 'credExample']))
      .digest('hex').slice(0, 32)
    assert.equal(definition.client_token, expectedCreateToken)
    assert.equal(statSync('workflow.json').mode & 0o777, 0o600)
    assert.deepEqual(definition.steps.find((step) => step.id === 'lookup').data.headers, [
      { key: 'ek-api-key', value: [{ value_type: 'text', value: ${JSON.stringify(workflowToken)} }] },
    ])
    process.stdout.write(JSON.stringify({ data: { workflow_id: 'wkfExample' } }))
  `, { mode: 0o700 })
  const run = (args, mode = 'none', expectedStatus = 0) => {
    const result = spawnSync(process.execPath, ['--require', preload, workflow, ...args], {
      cwd: directory, encoding: 'utf8',
      env: {
        ...process.env, EASYKOL_CONFIG_DIR: directory, FEISHU_HTTP_FIXTURE: mode,
        PATH: directory + delimiter + (process.env.PATH || ''),
      },
    })
    assert.equal(result.status, expectedStatus, result.stderr)
    for (const secret of [deviceCode, deviceToken, workflowToken, 'test-existing-key']) {
      assert.equal((result.stdout + result.stderr).includes(secret), false)
    }
    return expectedStatus === 0 ? JSON.parse(result.stdout) : result.stderr
  }
  return { directory, statePath, setupPath, run }
}

test('a fresh user can authorize, pause, resume and create without a general API key', {
  skip: process.platform === 'win32' && 'fixture uses a POSIX executable for lark-cli',
}, (t) => {
  const { statePath, setupPath, run } = fixture(t)
  assert.deepEqual(run(['status']), { status: 'authorization_required' })
  assert.match(run(['create', setupPath], 'none', 1), /Run authorize/)
  const pending = run(['authorize'], 'issue')
  assert.equal(pending.status, 'authorization_pending')
  assert.equal(pending.verificationUrl, verificationUrl)
  assert.equal(statSync(statePath).mode & 0o777, 0o600)
  assert.deepEqual(run(['authorize']), pending)
  assert.equal(run(['authorize-poll'], 'pending').status, 'authorization_pending')
  assert.equal(run(['authorize-poll']).status, 'authorization_pending')
  const savedState = JSON.parse(readFileSync(statePath, 'utf8'))
  writeFileSync(statePath, JSON.stringify({ ...savedState, nextPollAt: 0 }))
  assert.deepEqual(run(['authorize-poll'], 'approved'), { status: 'ready', authorization: 'device' })
  assert.deepEqual(run(['create', setupPath], 'approved'), {
    workflowId: 'wkfExample', credentialId: 'credExample', enabled: false,
  })
  assert.equal(existsSync(statePath), false)
})

test('the helper rejects old, foreign and broader device authorization before use', (t) => {
  const { statePath, run } = fixture(t)
  assert.match(run(['authorize'], 'legacy', 1), /does not support scoped/)
  assert.match(run(['authorize'], 'foreign', 1), /invalid authorization link/)
  assert.equal(existsSync(statePath), false)
  assert.equal(run(['authorize'], 'issue').status, 'authorization_pending')
  assert.match(run(['authorize-poll'], 'broad', 1), /did not return a scoped/)
  assert.deepEqual(JSON.parse(readFileSync(statePath, 'utf8')), { status: 'authorization_required' })
})

test('an existing Skill API configuration is preserved and can still revoke', (t) => {
  const { directory, statePath, run } = fixture(t)
  const path = join(directory, 'config.json')
  const initial = JSON.stringify({ apiKey: 'test-existing-key', email: 'test@example.com' })
  writeFileSync(path, initial, { mode: 0o600 })
  assert.deepEqual(run(['status']), { status: 'ready', authorization: 'skill_key' })
  assert.deepEqual(run(['revoke', 'credExample'], 'legacy-key'), { revoked: true })
  assert.equal(existsSync(statePath), false)
  assert.equal(readFileSync(path, 'utf8'), initial)
})

test('an expired explicit EasyKOL authorization does not fall back to another configured key', (t) => {
  const { directory, statePath, setupPath, run } = fixture(t)
  writeFileSync(join(directory, 'config.json'), JSON.stringify({
    apiKey: 'test-existing-key', email: 'test@example.com',
  }), { mode: 0o600 })
  writeFileSync(statePath, JSON.stringify({
    status: 'approved', token: deviceToken, expiresAt: Date.now() - 1,
  }), { mode: 0o600 })
  assert.deepEqual(run(['status']), { status: 'authorization_required' })
  assert.match(run(['create', setupPath], 'none', 1), /Run authorize/)
  assert.deepEqual(JSON.parse(readFileSync(statePath, 'utf8')), { status: 'authorization_required' })
})
