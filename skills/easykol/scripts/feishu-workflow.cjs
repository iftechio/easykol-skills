const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { homedir, tmpdir } = require('node:os')
const { join } = require('node:path')

const apiOrigin = 'https://talent-marketing-api.aiwaifu.top'
const endpoint = apiOrigin + '/external/v1/feishu/creator-metrics'
const credentialEndpoint = apiOrigin + '/external/v1/feishu/credentials'
const metrics = ['followerCount', 'medianPlayCount']
const value = (value_type, value) => ({ value_type, value })
const ref = (path) => value('ref', path)
const text = (content) => value('text', content)
const metricPath = (name) => '$.lookup.body.data.' + name

function readSetup(path) {
  const setup = JSON.parse(readFileSync(path, 'utf8'))
  const names = [
    'baseToken', 'tableId', 'tableName', 'urlFieldName', 'urlFieldId',
    'followerFieldName', 'medianViewsFieldName', 'recordIdFieldName', 'statusFieldName',
  ]
  if (!setup || names.some((name) =>
    typeof setup[name] !== 'string' || !setup[name].trim()
  )) {
    throw new Error('Setup must include the verified Base, table and field coordinates.')
  }
  if (!/^tbl[\w]+$/.test(setup.tableId) || !/^fld[\w]+$/.test(setup.urlFieldId)
    || !/^[\w]+$/.test(setup.baseToken)
    || typeof setup.urlFieldIsHyperlink !== 'boolean'
    || new Set([
      setup.urlFieldName, setup.followerFieldName, setup.medianViewsFieldName,
      setup.recordIdFieldName, setup.statusFieldName,
    ]).size !== 5) {
    throw new Error('Setup has an invalid ID, URL field type or duplicate field name.')
  }
  return Object.fromEntries([...names, 'urlFieldIsHyperlink'].map((name) => [name, setup[name]]))
}

function filter(path, operator, right_value = []) {
  return { left_value: ref(path), operator, right_value }
}

function branchCondition(names) {
  return {
    conjunction: 'or',
    conditions: [{
      conjunction: 'and',
      conditions: [
        filter('$.lookup.body.statusCode', 'is', [value('number', 1000)]),
        ...metrics.map((name) =>
          filter(metricPath(name), names.includes(name) ? 'isNotEmpty' : 'isEmpty')
        ),
      ],
    }],
  }
}

function buildWorkflow(setup, token) {
  const sourceField = '$.trigger.' + setup.urlFieldId
  const urlRef = sourceField + (setup.urlFieldIsHyperlink ? '.link' : '')
  const target = {
    table_name: setup.tableName,
    max_set_record_num: 1,
    filter_info: {
      conjunction: 'and',
      conditions: [
        { field_name: setup.recordIdFieldName, operator: 'is', value: [ref('$.trigger.recordId')] },
        { field_name: setup.urlFieldName, operator: 'is', value: [ref(sourceField)] },
      ],
    },
  }
  const status = (message) => ({ field_name: setup.statusFieldName, value: [text(message)] })
  const fields = {
    followerCount: setup.followerFieldName,
    medianPlayCount: setup.medianViewsFieldName,
  }
  const cases = [
    { id: 'both', title: '写入粉丝数和播放量中位数', names: metrics, status: '已更新' },
    {
      id: 'followers', title: '写入粉丝数', names: ['followerCount'],
      status: '已更新粉丝数。当前达人缺少播放量中位数，该列原值仅为历史记录。',
    },
    {
      id: 'median', title: '写入播放量中位数', names: ['medianPlayCount'],
      status: '已更新播放量中位数。当前达人缺少粉丝数，该列原值仅为历史记录。',
    },
  ]
  const clientToken = createHash('sha256').update(JSON.stringify(setup)).digest('hex').slice(0, 32)
  return {
    client_token: clientToken,
    title: 'EasyKOL 达人数据自动回填 · ' + setup.tableName,
    steps: [
      {
        id: 'trigger',
        type: 'SetRecordTrigger',
        title: '达人主页链接修改时',
        next: 'pending',
        data: {
          table_name: setup.tableName,
          field_watch_info: [{ field_name: setup.urlFieldName, operator: 'isNotEmpty', value: [] }],
        },
      },
      {
        id: 'pending',
        type: 'SetRecordAction',
        title: '标记指标待更新',
        next: 'lookup',
        data: {
          ...target,
          field_values: [status('待更新。已有指标为历史记录，请以本次回填为准。')],
        },
      },
      {
        id: 'lookup',
        type: 'HTTPClientAction',
        title: '查询 EasyKOL 达人数据',
        next: 'available',
        data: {
          method: 'GET',
          url: [text(endpoint)],
          queries: [{ key: 'url', value: [ref(urlRef)] }],
          headers: [{ key: 'ek-api-key', value: [text(token)] }],
          body_type: 'none',
          response_type: 'json',
          response_value: JSON.stringify({
            statusCode: 1000,
            data: { followerCount: 12345, medianPlayCount: 6789 },
          }),
        },
      },
      {
        id: 'available',
        type: 'SwitchBranch',
        title: '按返回的指标更新',
        next: null,
        children: { links: cases.map(({ id, title }) => ({
          kind: 'case', label: id, desc: title, to: id,
        })) },
        data: {
          mode: 'exclusive',
          no_match_action: 'fail',
          child_branch_list: cases.map(({ title, names }) => ({
            name: title, condition: branchCondition(names),
          })),
        },
      },
      ...cases.map(({ id, title, names, status: message }) => ({
        id,
        type: 'SetRecordAction',
        title,
        next: null,
        data: {
          ...target,
          field_values: [
            ...names.map((name) => ({ field_name: fields[name], value: [ref(metricPath(name))] })),
            status(message),
          ],
        },
      })),
    ],
  }
}

function loadCredentials() {
  const directory = process.env.EASYKOL_CONFIG_DIR || join(homedir(), '.easykol')
  try {
    const config = JSON.parse(readFileSync(join(directory, 'config.json'), 'utf8'))
    if (typeof config.apiKey === 'string' && config.apiKey.trim()
      && typeof config.email === 'string' && config.email.trim()) {
      return { apiKey: config.apiKey.trim(), email: config.email.trim() }
    }
  } catch {
    // Report a fixed message so an invalid credential file is never echoed.
  }
  throw new Error('Configure the intended EasyKOL account before creating the workflow.')
}

async function manageCredential(method, id) {
  const { apiKey, email } = loadCredentials()
  const url = id ? credentialEndpoint + '/' + encodeURIComponent(id) : credentialEndpoint
  let response
  let result
  try {
    response = await fetch(url, {
      method,
      headers: { 'ek-api-key': apiKey, 'ek-api-email': email },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    })
    result = await response.json()
  } catch {
    throw new Error('Unable to reach the EasyKOL Feishu credential service.')
  }
  if (!response.ok || result.statusCode !== 1000) {
    throw new Error('EasyKOL Feishu credential request failed (HTTP ' + response.status + ').')
  }
  return result.data
}

async function run() {
  const [mode, setupPath, profile, ...extraArgs] = process.argv.slice(2)
  if (mode === 'revoke' && /^[\w-]{1,64}$/.test(setupPath || '') && !profile) {
    const data = await manageCredential('DELETE', setupPath)
    if (data?.revoked !== true) throw new Error('EasyKOL did not confirm credential revocation.')
    process.stdout.write(JSON.stringify({ revoked: true }) + '\n')
    return
  }
  if (!['preview', 'create'].includes(mode) || !setupPath || extraArgs.length) {
    throw new Error('Usage: node feishu-workflow.cjs <preview|create> <setup.json> [profile], or revoke <credentialId>')
  }
  let setup
  try {
    setup = readSetup(setupPath)
  } catch {
    throw new Error('Check setup.json for the Base and field coordinates listed in the skill.')
  }
  const preview = mode === 'preview'
  const credential = preview ? { token: 'ekf_preview_only' } : await manageCredential('POST')
  if (typeof credential?.token !== 'string'
    || (!preview && (!/^ekf_[\w-]{43}$/.test(credential.token) || !/^[\w-]{1,64}$/.test(credential.id || '')))) {
    throw new Error('EasyKOL did not return a usable Feishu credential.')
  }
  const workflow = buildWorkflow(setup, credential.token)
  let directory
  try {
    directory = mkdtempSync(join(tmpdir(), 'easykol-feishu-workflow-'))
    const path = join(directory, 'workflow.json')
    writeFileSync(path, JSON.stringify(workflow), { mode: 0o600 })
    const args = ['base', '+workflow-create', '--as', 'user', '--base-token', setup.baseToken, '--json', '@workflow.json']
    if (profile) args.push('--profile', profile)
    if (preview) args.push('--dry-run')
    const result = spawnSync('lark-cli', args, {
      cwd: directory,
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    })
    if (preview) {
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
    }
    if (result.error?.code === 'ENOENT') throw new Error('Install the official Feishu CLI first.')
    if (result.status !== 0) {
      throw new Error(preview
        ? 'Feishu CLI could not preview the workflow.'
        : 'Feishu CLI did not confirm creation. Check workflow-list and user permissions before retrying.')
    }
    if (preview) return
    let workflowId
    try {
      const output = JSON.parse(result.stdout)
      workflowId = output.data?.workflow_id ?? output.data?.workflow?.workflow_id ?? output.workflow_id
    } catch {
      // A request may have succeeded even if the CLI could not return a usable ID.
    }
    if (typeof workflowId !== 'string' || !/^wkf[\w]+$/.test(workflowId)) {
      throw new Error('Creation returned no usable workflow ID. Check workflow-list before retrying.')
    }
    process.stdout.write(JSON.stringify({ workflowId, credentialId: credential.id, enabled: false }) + '\n')
  } catch (error) {
    if (preview) throw error
    throw new Error(error.message + ' Feishu credential ID: ' + credential.id)
  } finally {
    if (directory) rmSync(directory, { recursive: true, force: true })
  }
}

run().catch((error) => {
  process.stderr.write(error.message + '\n')
  process.exitCode = 1
})
