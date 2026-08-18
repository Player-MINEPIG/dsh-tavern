import test from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { API_V2 } from '../packages/identity.js'
import {
  ChromeStore,
  PlayWorkspaceStore,
  createPlayApiHandler,
} from '../packages/tavern-loader/src/index.js'

function invoke(handler, { method = 'GET', url, body } = {}) {
  return new Promise((resolve, reject) => {
    const content = body === undefined ? undefined : JSON.stringify(body)
    const req = Readable.from(content === undefined ? [] : [Buffer.from(content)])
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

function hostWithDirs() {
  return {
    async createDirectory({ path, name }) {
      mkdirSync(join(path, name))
    },
  }
}

function setup({ host = hostWithDirs() } = {}) {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-root-'))
  const outside = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-outside-'))
  const handler = createPlayApiHandler({
    chromeStore: new ChromeStore(pluginDir),
    workspaceStore: new PlayWorkspaceStore(pluginDir, { host }),
  })
  return { pluginDir, playRoot, outside, handler }
}

function cleanup(fixture) {
  rmSync(fixture.pluginDir, { recursive: true, force: true })
  rmSync(fixture.playRoot, { recursive: true, force: true })
  rmSync(fixture.outside, { recursive: true, force: true })
}

test('files and dirs require a bound play workspace root', async () => {
  const fixture = setup()
  try {
    const unbound = await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=a.txt`,
      body: { content: 'no' },
    })
    assert.equal(unbound.status, 409)
    assert.equal(unbound.body.code, 'PLAY_WORKSPACE_UNBOUND')
    assert.equal(existsSync(join(fixture.playRoot, 'a.txt')), false)

    const dirs = await invoke(fixture.handler, {
      method: 'POST',
      url: `${API_V2}/workspace/dirs`,
      body: { path: 'card/pt' },
    })
    assert.equal(dirs.status, 409)
  } finally {
    cleanup(fixture)
  }
})

test('POST /workspace/dirs uses Host createDirectory and does not mkdir locally', async () => {
  const fixture = setup({ host: {} })
  try {
    await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace`,
      body: { path: fixture.playRoot },
    })
    const dirs = await invoke(fixture.handler, {
      method: 'POST',
      url: `${API_V2}/workspace/dirs`,
      body: { path: 'card/pt' },
    })
    assert.equal(dirs.status, 501)
    assert.equal(dirs.body.code, 'PLAY_HOST_UNAVAILABLE')
    assert.equal(existsSync(join(fixture.playRoot, 'card')), false)
  } finally {
    cleanup(fixture)
  }
})

test('PUT /workspace binds an existing directory and returns first-selection warnings', async () => {
  const fixture = setup()
  try {
    const missing = await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace`,
      body: { path: join(fixture.outside, 'missing') },
    })
    assert.equal(missing.status, 400)

    const bound = await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace`,
      body: { path: fixture.playRoot },
    })
    assert.equal(bound.status, 200)
    assert.equal(bound.body.selected, true)
    assert.equal(bound.body.firstSelection, true)
    assert.equal(bound.body.contractVersion, 1)
    assert.ok(bound.body.warnings.some(item => item.code === 'SWIPE_DISK'))

    const again = await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace`,
      body: { path: fixture.playRoot },
    })
    assert.equal(again.body.firstSelection, false)
    assert.equal(new PlayWorkspaceStore(fixture.pluginDir).get().rootPath, bound.body.rootPath)
  } finally {
    cleanup(fixture)
  }
})

test('workspace dirs and files round-trip; path jail refuses escape', async () => {
  const fixture = setup()
  try {
    await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace`,
      body: { path: fixture.playRoot },
    })

    const made = await invoke(fixture.handler, {
      method: 'POST',
      url: `${API_V2}/workspace/dirs`,
      body: { path: 'card-a/run-1' },
    })
    assert.equal(made.status, 200)
    const listed = await invoke(fixture.handler, { url: `${API_V2}/workspace/files?list=` })
    assert.equal(listed.status, 200)
    assert.ok(listed.body.list.some(item => item.path === 'card-a' && item.type === 'dir'))

    const nested = await invoke(fixture.handler, { url: `${API_V2}/workspace/files?list=card-a` })
    assert.ok(nested.body.list.some(item => item.path === 'card-a/run-1'))

    const written = await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=card-a/run-1/notes.txt`,
      body: { content: 'hello play' },
    })
    assert.equal(written.status, 200)
    const read = await invoke(fixture.handler, {
      url: `${API_V2}/workspace/files?path=card-a/run-1/notes.txt`,
    })
    assert.equal(read.body.content, 'hello play')

    const parentEscape = await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=../secret.txt`,
      body: { content: 'nope' },
    })
    assert.equal(parentEscape.status, 400)
    assert.equal(parentEscape.body.code, 'PLAY_PATH_ESCAPE')
    assert.equal(existsSync(join(fixture.playRoot, 'secret.txt')), false)
    assert.equal(existsSync(join(fixture.outside, 'secret.txt')), false)

    const absolute = await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=${encodeURIComponent(join(fixture.outside, 'abs.txt'))}`,
      body: { content: 'nope' },
    })
    assert.equal(absolute.status, 400)
    assert.equal(existsSync(join(fixture.outside, 'abs.txt')), false)
  } finally {
    cleanup(fixture)
  }
})

test('symlink that leaves the play root is refused and does not write outside', async () => {
  const fixture = setup()
  try {
    await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace`,
      body: { path: fixture.playRoot },
    })
    writeFileSync(join(fixture.outside, 'secret.txt'), 'outside')
    const link = join(fixture.playRoot, 'escape')
    try {
      symlinkSync(fixture.outside, link, 'dir')
    } catch {
      return
    }
    const leaked = await invoke(fixture.handler, {
      url: `${API_V2}/workspace/files?path=escape/secret.txt`,
    })
    assert.equal(leaked.status, 403)
    assert.equal(leaked.body.code, 'PLAY_PATH_ESCAPE')

    const write = await invoke(fixture.handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=escape/planted.txt`,
      body: { content: 'planted' },
    })
    assert.equal(write.status, 403)
    assert.equal(existsSync(join(fixture.outside, 'planted.txt')), false)
  } finally {
    cleanup(fixture)
  }
})

test('play workspace module never calls archiveSession', () => {
  const source = [
    readFileSync(new URL('../packages/play/src/workspace.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../packages/play/src/paths.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../packages/play/src/server.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../packages/tavern-loader/src/index.js', import.meta.url), 'utf8'),
  ].join('\n')
  assert.doesNotMatch(source, /archiveSession/)
})
