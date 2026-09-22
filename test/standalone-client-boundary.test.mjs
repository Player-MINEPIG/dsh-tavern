import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const resourceSources = [
  'packages/preset/src/client.js',
  'packages/character/src/client.js',
  'packages/user/src/client.js',
  'packages/world-book-library/src/client.js',
  'packages/session-template/src/client.js',
]

// A source reuse boundary, not an independent frontend implementation. Bundle
// React itself so this check cannot accidentally borrow DSH's module loader.
test('resource clients and HTTP workflows bundle and initialize without the DSH client runtime', async () => {
  const result = await build({
    absWorkingDir: projectRoot,
    stdin: {
      sourcefile: 'standalone-client-boundary-entry.js',
      resolveDir: projectRoot,
      contents: `
        export { PresetSidebar } from './packages/preset/src/client.js'
        export { CharacterPanel } from './packages/character/src/client.js'
        export { UserPanel } from './packages/user/src/client.js'
        export { WorldBookPanel } from './packages/world-book-library/src/client.js'
        export { SessionTemplatePanel } from './packages/session-template/src/client.js'
        export { createLivePlayClient } from './packages/client/src/play/live.js'
        export { createCleanSessionWorkflow, createConfiguredPlaythroughWorkflow }
          from './packages/session-template/src/client-state.js'
      `,
    },
    bundle: true,
    write: false,
    metafile: true,
    platform: 'browser',
    target: 'es2022',
    format: 'iife',
    globalName: 'standaloneClientBoundary',
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const inputs = Object.keys(result.metafile.inputs).map(path => path.replaceAll('\\', '/'))
  for (const source of resourceSources) assert.ok(inputs.some(path => path.endsWith(source)), source)
  assert.ok(inputs.some(path => /node_modules\/react\//.test(path)), 'React must be bundled')
  for (const path of inputs) {
    assert.doesNotMatch(path, /@deepseek-ai|packages\/client\/src\/(?:entry|index)\.js|dist\/client\.js/)
  }
  const imports = Object.values(result.metafile.inputs).flatMap(input => input.imports)
    .concat(Object.values(result.metafile.outputs).flatMap(output => output.imports))
  for (const entry of imports) {
    assert.doesNotMatch(entry.path, /@deepseek-ai|__ModuleLoader__/)
    assert.notEqual(entry.external, true, `Unresolved external import: ${entry.path}`)
  }
  const bundle = result.outputFiles[0].text
  assert.doesNotMatch(bundle, /@deepseek-ai|__ModuleLoader__/)

  // No window, document, Cordis context, fetch, or DSH loader is supplied.
  // Initialization and injected HTTP calls must not need any of those globals.
  const sandbox = {}
  runInNewContext(bundle, sandbox, { timeout: 5000 })
  const exported = sandbox.standaloneClientBoundary
  for (const name of ['PresetSidebar', 'CharacterPanel', 'UserPanel', 'WorldBookPanel', 'SessionTemplatePanel', 'createCleanSessionWorkflow', 'createConfiguredPlaythroughWorkflow']) {
    assert.equal(typeof exported[name], 'function', name)
  }
  const calls = []
  const client = exported.createLivePlayClient({
    apiRoot: '/test/v2',
    v1Root: '/test/v1',
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options.method, body: options.body })
      return { ok: true, status: 200, json: async () => ({ ok: true, mode: 'native', revision: null }) }
    },
  })
  assert.equal((await client.getChrome()).mode, 'native')
  await client.postUserMessage('session/one', 'original user text')
  assert.deepEqual(calls, [
    { url: '/test/v2/chrome', method: 'GET', body: undefined },
    { url: '/test/v2/sessions/session%2Fone/user-message', method: 'POST', body: '{"text":"original user text"}' },
  ])
})
