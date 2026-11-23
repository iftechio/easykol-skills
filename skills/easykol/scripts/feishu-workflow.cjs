const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { homedir, tmpdir } = require('node:os')
const { join } = require('node:path')

const endpoint = 'https://talent-marketing-api.aiwaifu.top/external/v1/kol'
const metrics = ['followerCount', 'medianPlayCount']
const value = (value_type, value) => ({ value_type, value })
const ref = (path) => value('ref', path)
const text = (content) => value('text', content)
const metricPath = (name) => '$.lookup.body.data.' + name

function readSetup(path) {
  const setup = JSON.parse(readFileSync(path, 'utf8'))
  const names = [
    'baseToken', 'tableId', 'tableName', 'urlFieldName', 'urlFieldId',
    'followerFieldName', 'medianViewsFieldName',
  ]
  if (!setup || names.some((name) =>
    typeof setup[name] !== 'string' || !setup[name].trim()
  )) {
    throw new Error('Setup must include the verified Base, table and field coordinates.')
  }
  if (!/^tbl[\w]+$/.test(setup.tableId) || !/^fld[\w]+$/.test(setup.urlFieldId)
    || !/^[\w]+$/.test(setup.baseToken)
    || typeof setup.urlFieldIsHyperlink !== 'boolean'
    || new Set([setup.urlFieldName, setup.followerFieldName, setup.medianViewsFieldName]).size !== 3) {
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

function buildWorkflow(setup, credentials) {
  const urlRef = '$.trigger.' + setup.urlFieldId + (setup.urlFieldIsHyperlink ? '.link' : '')
  const fields = {
    followerCount: setup.followerFieldName,
    medianPlayCount: setup.medianViewsFieldName,
  }
  const cases = [
    { id: 'both', title: '写入粉丝数和播放量中位数', names: metrics },
    { id: 'followers', title: '写入粉丝数', names: ['followerCount'] },
    { id: 'median', title: '写入播放量中位数', names: ['medianPlayCount'] },
  ]
  const token = createHash('sha256').update(JSON.stringify(setup)).digest('hex').slice(0, 32)
  return {
    client_token: token,
    title: 'EasyKOL 达人数据自动回填 · ' + setup.tableName,
    steps: [
      {
        id: 'trigger',
        type: 'SetRecordTrigger',
        title: '达人主页链接修改时',
        next: 'lookup',
        data: {
          table_name: setup.tableName,
          field_watch_info: [{ field_name: setup.urlFieldName, operator: 'isNotEmpty', value: [] }],
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
          headers: [
            { key: 'ek-api-key', value: [text(credentials.apiKey)] },
            { key: 'ek-api-email', value: [text(credentials.email)] },
          ],
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
      ...cases.map(({ id, title, names }) => ({
        id,
        type: 'SetRecordAction',
        title,
        next: null,
        data: {
          table_name: setup.tableName,
          max_set_record_num: 1,
          ref_info: { step_id: 'trigger' },
          field_values: names.map((name) => ({
            field_name: fields[name], value: [ref(metricPath(name))],
          })),
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

function run() {
  const [mode, setupPath, profile, ...extraArgs] = process.argv.slice(2)
  if (!['preview', 'create'].includes(mode) || !setupPath || extraArgs.length) {
    throw new Error('Usage: node feishu-workflow.cjs <preview|create> <setup.json> [profile]')
  }
  let setup
  try {
    setup = readSetup(setupPath)
  } catch {
    throw new Error('Check setup.json for the Base and field coordinates listed in the skill.')
  }
  const preview = mode === 'preview'
  const credentials = preview ? { apiKey: 'ek_preview_only', email: 'preview@example.com' } : loadCredentials()
  const workflow = buildWorkflow(setup, credentials)
  const directory = mkdtempSync(join(tmpdir(), 'easykol-feishu-workflow-'))
  try {
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
    process.stdout.write(JSON.stringify({ workflowId, enabled: false }) + '\n')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

try {
  run()
} catch (error) {
  process.stderr.write(error.message + '\n')
  process.exitCode = 1
}
