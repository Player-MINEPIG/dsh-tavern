import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import {
  SessionConfigurationService,
  SessionTemplateStore,
  createSessionTemplateApiHandler,
  sessionTemplateApiConstants,
} from '../packages/session-template/src/index.js'
import { SessionSelectionStore } from '../packages/tavern-loader/src/session-policy.js'

function invoke(handler, { method = 'GET', url = '/dsh-tavern/api/session-templates', body } = {}) {
  return new Promise((resolve, reject) => {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
    request.method = method
    request.url = url
    const response = {
      statusCode: 200,
      setHeader: () => {},
      end: data => resolve({
        status: response.statusCode,
        body: data === undefined || data === '' ? null : JSON.parse(String(data)),
      }),
    }
    Promise.resolve(handler(request, response)).catch(reject)
  })
}

function present() {
  return { get: id => ({ id }) }
}

test('session-template API covers create, select, rename, update, preview, apply and delete', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-template-api-'))
  try {
    const templates = new SessionTemplateStore(directory, { id: () => 'template-api' })
    const selections = new SessionSelectionStore(directory)
    selections.set('source', { presetId: 'preset-a', worldBookIds: ['book-a'] })
    const characters = present()
    characters.normalizeSelection = id => characters.get(id)
    const configurations = new SessionConfigurationService({
      templates,
      selections,
      presets: present(),
      characters,
      users: present(),
      worldBooks: present(),
    })
    const changes = []
    const handler = createSessionTemplateApiHandler(templates, configurations, { onChange: change => changes.push(change) })

    const created = await invoke(handler, {
      method: 'POST',
      body: { name: 'API setup', sourceSessionId: 'source' },
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.template.id, 'template-api')

    const clearedSelection = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/session-templates/select',
      body: { id: null },
    })
    assert.equal(clearedSelection.body.selectedId, null)
    const restoredSelection = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/session-templates/select',
      body: { id: 'template-api' },
    })
    assert.equal(restoredSelection.body.selectedId, 'template-api')

    const renamed = await invoke(handler, {
      method: 'PATCH',
      url: '/dsh-tavern/api/session-templates/template-api',
      body: { name: 'Renamed API setup' },
    })
    assert.equal(renamed.body.template.name, 'Renamed API setup')

    selections.set('source', { presetId: null, worldBookIds: [] })
    const updated = await invoke(handler, {
      method: 'PATCH',
      url: '/dsh-tavern/api/session-templates/template-api',
      body: { sourceSessionId: 'source' },
    })
    assert.equal(updated.body.template.selection.presetId, null)

    const preview = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/session-configurations/preview',
      body: { source: { mode: 'template', templateId: 'template-api' } },
    })
    assert.equal(preview.body.available, true)

    const applied = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/session-configurations/apply',
      body: { targetSessionId: 'target', source: { mode: 'template', templateId: 'template-api' } },
    })
    assert.equal(applied.status, 200)
    assert.equal(selections.get('target').presetId, null)

    const listed = await invoke(handler)
    assert.equal(listed.body.selectedId, 'template-api')
    assert.equal(listed.body.templates[0].diagnostics.length, 0)

    const deleted = await invoke(handler, {
      method: 'DELETE',
      url: '/dsh-tavern/api/session-templates/template-api',
      body: {},
    })
    assert.equal(deleted.status, 200)
    assert.equal(templates.state.selectedId, null)
    assert.deepEqual(changes.map(item => item.kind), [
      'session-template-created',
      'session-template-selected',
      'session-template-selected',
      'session-template-updated',
      'session-template-updated',
      'session-configuration-applied',
      'session-template-deleted',
    ])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('session-template API rejects invalid source and publishes its request bound', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-template-api-invalid-'))
  try {
    const templates = new SessionTemplateStore(directory)
    const selections = new SessionSelectionStore(directory)
    const characters = present()
    characters.normalizeSelection = id => characters.get(id)
    const handler = createSessionTemplateApiHandler(templates, new SessionConfigurationService({
      templates,
      selections,
      presets: present(),
      characters,
      users: present(),
      worldBooks: present(),
    }))
    const response = await invoke(handler, {
      method: 'POST',
      url: '/dsh-tavern/api/session-configurations/preview',
      body: { source: { mode: 'private-session-copy' } },
    })
    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'INVALID_SESSION_TEMPLATE_REQUEST')
    assert.equal(sessionTemplateApiConstants.maxBodyBytes, 64 * 1024)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
