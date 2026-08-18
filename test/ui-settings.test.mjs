import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import {
  UiSettingsStore,
  createUiSettingsApiHandler,
  normalizeUiSettings,
  uiSettingsConstants,
} from '../packages/tavern-loader/src/index.js'

function invoke(handler, { method = 'GET', body, rawBody } = {}) {
  return new Promise((resolve, reject) => {
    const content = rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
    const req = Readable.from(content === undefined ? [] : [Buffer.from(content)])
    req.method = method
    req.url = '/pmp-dsh-tavern/api/v1/ui-settings'
    const headers = {}
    const res = {
      statusCode: 200,
      setHeader: (name, value) => { headers[name.toLowerCase()] = value },
      end: (payload = '') => resolve({
        status: res.statusCode,
        headers,
        body: payload === '' ? null : JSON.parse(String(payload)),
      }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('UI settings are global, bounded, atomic, and survive store recreation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-ui-settings-'))
  try {
    const store = new UiSettingsStore(directory)
    assert.deepEqual(store.get(), uiSettingsConstants.defaults)
    assert.deepEqual(store.set({ locale: 'en', scale: 1.25 }), {
      schemaVersion: 1,
      locale: 'en',
      scale: 1.25,
      rpFollowCharacter: true,
    })
    assert.deepEqual(new UiSettingsStore(directory).get(), store.get())
    assert.equal(readFileSync(join(directory, 'ui-settings.json'), 'utf8').includes('session'), false)
    assert.equal(store.reset().locale, 'zh-CN')
    assert.equal(store.get().scale, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('UI settings whitelist locale, scale, increments, and fields', () => {
  assert.throws(() => normalizeUiSettings({ locale: 'fr', scale: 1 }), /locale/)
  assert.throws(() => normalizeUiSettings({ locale: 'en', scale: 2 }), /scale/)
  assert.throws(() => normalizeUiSettings({ locale: 'en', scale: 1.03 }), /increments/)
  assert.throws(() => normalizeUiSettings({ locale: 'en', scale: 1, sessionId: 'forbidden' }), /Unsupported/)
  assert.throws(() => normalizeUiSettings({ locale: 'en', scale: 1, rpFollowCharacter: 'yes' }), /rpFollowCharacter/)
})

test('oversized or malformed persisted UI settings fall back without reading resource data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-ui-settings-invalid-'))
  try {
    writeFileSync(join(directory, 'ui-settings.json'), 'x'.repeat(uiSettingsConstants.maxSettingsBytes + 1))
    assert.deepEqual(new UiSettingsStore(directory).get(), uiSettingsConstants.defaults)
    writeFileSync(join(directory, 'ui-settings.json'), '{invalid')
    assert.deepEqual(new UiSettingsStore(directory).get(), uiSettingsConstants.defaults)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('UI settings API supports read, replace, reset, and bounded failures', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-ui-settings-api-'))
  try {
    const handler = createUiSettingsApiHandler(new UiSettingsStore(directory))
    assert.equal((await invoke(handler)).body.settings.locale, 'zh-CN')
    const saved = await invoke(handler, { method: 'PUT', body: { locale: 'en', scale: 0.85 } })
    assert.equal(saved.status, 200)
    assert.deepEqual(saved.body.settings, { schemaVersion: 1, locale: 'en', scale: 0.85, rpFollowCharacter: true })
    assert.equal((await invoke(handler, { method: 'PUT', body: { locale: 'en', scale: 1, extra: true } })).status, 400)
    assert.equal((await invoke(handler, { method: 'PUT', rawBody: '{bad' })).status, 400)
    assert.equal((await invoke(handler, { method: 'PUT', rawBody: 'x'.repeat(uiSettingsConstants.maxSettingsBytes + 1) })).status, 413)
    const reset = await invoke(handler, { method: 'DELETE' })
    assert.deepEqual(reset.body.settings, uiSettingsConstants.defaults)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('root loader routes UI settings through the existing single secured API prefix', () => {
  const source = readFileSync(new URL('../packages/tavern-loader/src/index.js', import.meta.url), 'utf8')
  assert.match(source, /isUiSettingsApiPath\(req\.url\)[\s\S]*uiSettingsApi\(req, res\)/)
  assert.match(source, /isRpPolicyApiPath\(req\.url\)[\s\S]*rpPolicyApi\(req, res\)/)
  assert.match(source, /isRpModeApiPath\(req\.url\)[\s\S]*rpModeApi\(req, res\)/)
  assert.equal(source.match(/path: API_ROOT/g)?.length, 1)
  assert.equal(source.match(/secureTavernApi\(/g)?.length, 1)
  const client = readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8')
  assert.match(client, /\/rp-alert/)
  assert.match(client, /RpHighRiskDialog/)
  assert.match(client, /async function rpAlertRequest[\s\S]*Content-Type': 'application\/json'/)
  assert.match(client, /dismissedRpAlerts/)
})
