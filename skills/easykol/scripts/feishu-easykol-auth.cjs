const { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } = require('node:fs')
const { homedir } = require('node:os')
const { join } = require('node:path')

const website = 'https://app.easykol.com'
const authEndpoint = website + '/api/device-auth'
const webCredentialEndpoint = website + '/api/enterprise-api-key/feishu-credentials'
const externalCredentialEndpoint = 'https://talent-marketing-api.aiwaifu.top/external/v1/feishu/credentials'
const purpose = 'feishu_credentials'
const directory = process.env.EASYKOL_CONFIG_DIR || join(homedir(), '.easykol')
const statePath = join(directory, 'feishu-auth.json')

function readConfig(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null
    throw new Error('Unable to read local EasyKOL authorization.')
  }
}

function saveState(state) {
  let temporary
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    temporary = mkdtempSync(join(directory, '.feishu-auth-'))
    const staged = join(temporary, 'state.json')
    writeFileSync(staged, JSON.stringify(state), { mode: 0o600 })
    renameSync(staged, statePath)
  } catch {
    throw new Error('Unable to save local EasyKOL authorization. Check the configuration directory permissions.')
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true })
  }
}

function clearState() {
  rmSync(statePath, { force: true })
}

function currentDeviceState() {
  const state = readConfig(statePath)
  if (!state || state.status === 'authorization_required' || state.expiresAt > Date.now()) {
    return state
  }
  return requireDeviceAuthorization()
}

function requireDeviceAuthorization() {
  const state = { status: 'authorization_required' }
  saveState(state)
  return state
}

function existingApiKey() {
  const config = readConfig(join(directory, 'config.json'))
  if (typeof config?.apiKey !== 'string' || typeof config?.email !== 'string') return null
  const apiKey = config.apiKey.trim()
  const email = config.email.trim()
  return apiKey && email ? { apiKey, email } : null
}

function verificationUrl(value, userCode) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('EasyKOL returned an invalid authorization link.')
  }
  if (!['https://easykol.com', website].includes(url.origin) ||
    url.username || url.password || url.hash || url.pathname !== '/device-bind' ||
    !/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(userCode) ||
    [...url.searchParams].length !== 1 || url.searchParams.get('user_code') !== userCode) {
    throw new Error('EasyKOL returned an invalid authorization link.')
  }
  return url.href
}

function describeState(state) {
  if (state?.status === 'approved' && isScopedToken(state.token)) {
    return { status: 'ready', authorization: 'device' }
  }
  if (state?.status === 'authorization_pending') {
    return {
      status: state.status,
      verificationUrl: verificationUrl(state.verificationUrl, state.userCode),
      userCode: state.userCode,
      expiresAt: new Date(state.expiresAt).toISOString(),
      retryAfterSeconds: Math.max(0, Math.ceil((state.nextPollAt - Date.now()) / 1000)),
    }
  }
  if (state) return { status: 'authorization_required' }
  return null
}

function isScopedToken(token) {
  return typeof token === 'string' && /^ekdf_[\w-]{43}$/.test(token)
}

function authorizationStatus() {
  const device = describeState(currentDeviceState())
  if (device) return device
  return existingApiKey()
    ? { status: 'ready', authorization: 'skill_key' }
    : { status: 'authorization_required' }
}

async function requestJson(url, method, { body, headers = {} } = {}) {
  let response
  try {
    response = await fetch(url, {
      method,
      headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new Error('Unable to reach the EasyKOL authorization service.')
  }
  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('EasyKOL returned an unexpected authorization response (HTTP ' + response.status + ').')
  }
  if (!response.ok || result?.statusCode !== 1000) {
    const error = new Error('EasyKOL authorization request failed (HTTP ' + response.status + ').')
    error.httpStatus = response.status
    throw error
  }
  return result.data
}

async function startAuthorization() {
  const previous = describeState(currentDeviceState())
  if (previous && previous.status !== 'authorization_required') return previous
  const data = await requestJson(authEndpoint + '/code', 'POST', {
    body: { deviceName: 'Codex 飞书表格助手', platform: 'Codex', purpose },
  })
  if (data?.purpose !== purpose) {
    throw new Error('This EasyKOL server does not support scoped Feishu authorization.')
  }
  const url = verificationUrl(data.verificationUriComplete, data.userCode)
  if (!/^[0-9a-f]{64}$/.test(data.deviceCode) ||
    !Number.isInteger(data.expiresIn) || data.expiresIn < 1 || data.expiresIn > 1800 ||
    !Number.isInteger(data.interval) || data.interval < 1 || data.interval > 60) {
    throw new Error('EasyKOL returned invalid authorization details.')
  }
  const state = {
    status: 'authorization_pending',
    deviceCode: data.deviceCode,
    userCode: data.userCode,
    verificationUrl: url,
    expiresAt: Date.now() + data.expiresIn * 1000,
    interval: data.interval,
    nextPollAt: Date.now(),
  }
  saveState(state)
  return describeState(state)
}

async function pollAuthorization() {
  const pending = currentDeviceState()
  if (!pending || pending.status === 'authorization_required') {
    return { status: 'authorization_required' }
  }
  if (pending.status === 'approved') return describeState(pending)
  if (pending.status !== 'authorization_pending' || !/^[0-9a-f]{64}$/.test(pending.deviceCode)) {
    return requireDeviceAuthorization()
  }
  if (pending.nextPollAt > Date.now()) return describeState(pending)
  pending.nextPollAt = Date.now() + pending.interval * 1000
  saveState(pending)
  const data = await requestJson(authEndpoint + '/token', 'POST', {
    body: { deviceCode: pending.deviceCode },
  })
  if (data?.status === 'authorization_pending') return describeState(pending)
  if (data?.status === 'slow_down') {
    pending.interval = Math.min(pending.interval + 5, 60)
    pending.nextPollAt = Date.now() + pending.interval * 1000
    saveState(pending)
    return describeState(pending)
  }
  if (data?.status === 'expired' || data?.status === 'denied') {
    requireDeviceAuthorization()
    return { status: data.status }
  }
  const expiresAt = Date.parse(data?.expiresAt)
  if (data?.status !== 'approved' || !isScopedToken(data.token) ||
    !Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt - Date.now() > 20 * 60 * 1000) {
    requireDeviceAuthorization()
    throw new Error('EasyKOL did not return a scoped Feishu authorization.')
  }
  const approved = { status: 'approved', token: data.token, expiresAt }
  saveState(approved)
  return describeState(approved)
}

async function manageCredential(method, id) {
  const device = currentDeviceState()
  const authorization = describeState(device)
  let endpoint
  let headers
  if (authorization?.authorization === 'device') {
    endpoint = webCredentialEndpoint
    headers = { Authorization: 'Bearer ' + device.token }
  } else {
    const legacy = existingApiKey()
    if (authorization || !legacy) {
      throw new Error('EasyKOL authorization is required. Run authorize, then authorize-poll after approval.')
    }
    endpoint = externalCredentialEndpoint
    headers = { 'ek-api-key': legacy.apiKey, 'ek-api-email': legacy.email }
  }
  try {
    return await requestJson(id ? endpoint + '/' + encodeURIComponent(id) : endpoint, method, { headers })
  } catch (error) {
    if (error.httpStatus === 401) {
      if (authorization?.authorization === 'device') requireDeviceAuthorization()
      throw new Error('EasyKOL authorization expired or was rejected. Run authorize to continue.')
    }
    throw error
  }
}

function finishWorkflowAuthorization() {
  if (describeState(currentDeviceState())?.authorization === 'device') clearState()
}

module.exports = {
  authorizationStatus,
  startAuthorization,
  pollAuthorization,
  manageCredential,
  finishWorkflowAuthorization,
}
