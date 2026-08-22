import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  API_ROOT,
  API_V1,
  API_V2,
  LEGACY_API_ROOT,
  PLUGIN_ID,
  PROFILE_SECTION,
  CLIENT_REFRESH_EVENT,
  CLIENT_UI_SETTINGS_EVENT,
} from '../packages/identity.js'
import { apply, createApiHandler } from '../packages/tavern-loader/src/index.js'
import { PresetStore } from '../packages/preset/src/index.js'

function invoke(handler, { method = 'GET', url } = {}) {
  return new Promise((resolve, reject) => {
    const req = Readable.from([])
    req.method = method
    req.url = url
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

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dev-plans' || entry.name === 'assets') continue
      walk(full, files)
    } else if (['.js', '.mjs'].includes(extname(entry.name))) {
      files.push(full)
    }
  }
  return files
}

test('plugin identity uses pmp-dsh-tavern with versioned API roots', () => {
  assert.equal(PLUGIN_ID, 'pmp-dsh-tavern')
  assert.equal(API_ROOT, '/pmp-dsh-tavern/api')
  assert.equal(API_V1, '/pmp-dsh-tavern/api/v1')
  assert.equal(API_V2, '/pmp-dsh-tavern/api/v2')
  assert.equal(LEGACY_API_ROOT, '/dsh-tavern/api')
  assert.equal(PROFILE_SECTION, 'pmp-dsh-tavern:profile')
  assert.equal(CLIENT_REFRESH_EVENT, 'pmp-dsh-tavern:refresh')
  assert.equal(CLIENT_UI_SETTINGS_EVENT, 'pmp-dsh-tavern:ui-settings')
})

test('legacy /dsh-tavern/api resource paths are not served', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-legacy-api-'))
  const store = new PresetStore(directory)
  const handler = createApiHandler(store)
  try {
    const response = await invoke(handler, { url: `${LEGACY_API_ROOT}/presets` })
    assert.equal(response.status, 404)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Host registers the unversioned API root so v1 and v2 share one prefix', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-identity-prefix-'))
  const routes = []
  const ctx = {
    systemPrompt: { section: () => {} },
    on: () => {},
    emit: () => {},
    get: name => name === 'webServer' ? { register: route => { routes.push(route); return () => {} } } : undefined,
    effect: install => install(),
    logger: { info: () => {} },
  }
  try {
    apply(ctx, { storageDir: directory })
    assert.deepEqual(routes.map(route => route.path), [API_ROOT])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('runtime sources do not keep a callable /dsh-tavern/api root', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const files = [
    ...walk(join(root, 'packages')),
    ...walk(join(root, 'scripts')),
  ]
  const leftover = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!text.includes('/dsh-tavern/api')) continue
    const remaining = text
      .split(/\r?\n/)
      .filter(line => line.includes('/dsh-tavern/api') && !line.includes('LEGACY_API_ROOT'))
    if (remaining.length > 0) leftover.push(`${file.replace(root, '')}: ${remaining[0].trim()}`)
  }
  assert.deepEqual(leftover, [])
})
