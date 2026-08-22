import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import {
  DEFAULT_RP_SECTION,
  RpModeController,
  RpPolicyStore,
  SessionSelectionStore,
  createRpPolicyApiHandler,
  normalizeRpPolicySection,
  rpPolicyStoreConstants,
} from '../packages/tavern-loader/src/index.js'

function invoke(handler, { method = 'GET', body, rawBody } = {}) {
  return new Promise((resolve, reject) => {
    const content = rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
    const req = Readable.from(content === undefined ? [] : [Buffer.from(content)])
    req.method = method
    req.url = '/pmp-dsh-tavern/api/v1/rp-policy'
    const res = {
      statusCode: 200,
      setHeader() {},
      end: (payload = '') => resolve({
        status: res.statusCode,
        body: payload === '' ? null : JSON.parse(String(payload)),
      }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('RP policy stays at the built-in default until saved, then survives store recreation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-rp-policy-'))
  try {
    const store = new RpPolicyStore(directory)
    assert.equal(store.get(), DEFAULT_RP_SECTION)
    assert.equal(store.view().custom, false)
    assert.equal(store.set('Stay in character.\nDo not write files.'), 'Stay in character.\nDo not write files.')
    assert.equal(new RpPolicyStore(directory).get(), 'Stay in character.\nDo not write files.')
    assert.equal(new RpPolicyStore(directory).view().custom, true)
    assert.match(readFileSync(join(directory, 'rp-policy.json'), 'utf8'), /Stay in character/)
    assert.equal(store.reset(), DEFAULT_RP_SECTION)
    assert.equal(new RpPolicyStore(directory).view().custom, false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('RP policy rejects non-string and oversized text, and allows an empty overlay', () => {
  assert.equal(normalizeRpPolicySection(''), '')
  assert.equal(normalizeRpPolicySection('   \n'), '')
  assert.throws(() => normalizeRpPolicySection(12), /string/)
  assert.throws(() => normalizeRpPolicySection('x'.repeat(rpPolicyStoreConstants.maxPolicyBytes + 1)), /limit/)
})

test('RP policy API supports read, replace, reset, and bounded failures', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-rp-policy-api-'))
  try {
    const changes = []
    const handler = createRpPolicyApiHandler(new RpPolicyStore(directory), { onChange: () => changes.push(1) })
    const initial = await invoke(handler)
    assert.equal(initial.body.section, DEFAULT_RP_SECTION)
    assert.equal(initial.body.custom, false)
    const saved = await invoke(handler, { method: 'PUT', body: { section: 'Custom RP policy' } })
    assert.equal(saved.status, 200)
    assert.equal(saved.body.section, 'Custom RP policy')
    assert.equal(saved.body.custom, true)
    assert.equal(changes.length, 1)
    assert.equal((await invoke(handler, { method: 'PUT', body: { section: '   ' } })).status, 200)
    assert.equal((await invoke(handler)).body.section, '')
    assert.equal((await invoke(handler, { method: 'PUT', body: {} })).status, 400)
    assert.equal((await invoke(handler, { method: 'PUT', rawBody: '{bad' })).status, 400)
    assert.equal((await invoke(handler, { method: 'PUT', rawBody: 'x'.repeat(rpPolicyStoreConstants.maxPolicyBytes + 1) })).status, 413)
    const reset = await invoke(handler, { method: 'DELETE' })
    assert.equal(reset.body.section, DEFAULT_RP_SECTION)
    assert.equal(reset.body.custom, false)
    assert.equal(changes.length, 3)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('RP controller reads live policy store text without replacing the default fallback', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-rp-policy-controller-'))
  try {
    const store = new RpPolicyStore(directory)
    const controller = new RpModeController({
      selections: new SessionSelectionStore(directory),
      policyStore: store,
    })
    assert.equal(controller.section, DEFAULT_RP_SECTION)
    store.set('Stay in the scene.')
    assert.equal(controller.section, 'Stay in the scene.')
    store.reset()
    assert.equal(controller.section, DEFAULT_RP_SECTION)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
