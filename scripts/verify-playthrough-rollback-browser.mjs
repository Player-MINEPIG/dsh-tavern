import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { build } from 'esbuild'
import { ChromeStore, PlayWorkspaceStore, createPlayApiHandler } from '../packages/play/src/index.js'

const chrome = process.env.CHROME_PATH ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync)
assert.ok(chrome, 'Set CHROME_PATH to Chrome or Chromium')
const directory = mkdtempSync(join(tmpdir(), 'tavern-rollback-browser-'))
const root = join(directory, 'rp')
const storage = join(directory, 'tavern')
const childId = 'browser-child'
const row = { id: 'run', path: 'run/timeline.json' }
const variant = { id: 'reply', sessionId: 'parent', startEventId: 0, endEventId: 1, ext: { pmpDshTavern: { sessionFormatVersion: 4 } } }
let forks = 0
const host = {
  createWorkspace: async () => ({ workspaceId: 'browser' }),
  coordinates: async () => ({ sessionFormatVersion: 4 }),
  forkSession: async () => { forks++; return { sessionId: childId } },
  inspectSession: async () => ({
    meta: { id: childId, version: 4 }, inheritedEventCount: 2,
    events: [
      { seq: 0, type: 'user/message', data: { id: 'question', role: 'user' } },
      { seq: 1, type: 'assistant/message', data: { message: { id: 'answer', role: 'assistant' } } },
    ],
  }),
}
let server
try {
  mkdirSync(root)
  const store = new PlayWorkspaceStore(storage, { host })
  await store.bindRoot(root)
  const api = createPlayApiHandler({ workspaceStore: store, chromeStore: new ChromeStore(storage), host })
  const fresh = { expectedRevision: null, expectedRevisionPresent: true }
  store.writeFile('catalog.json', JSON.stringify({ playthroughs: [row] }), fresh)
  const head = { sessionId: 'parent', nodeId: 'opening', variantId: variant.id }
  store.writeFile(row.path, JSON.stringify({
    nodes: [{ id: head.nodeId, kind: 'qa', variants: [variant], adoptedVariantId: variant.id, parentVariantId: null }], head,
  }), fresh)
  const app = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import { createElement } from 'react'
    import { createRoot } from 'react-dom/client'
    import { flushSync } from 'react-dom'
    import { PlayTurnActions } from './packages/client/src/play/turn-actions.js'
    import { createLivePlayClient } from './packages/client/src/play/live.js'
    import { translate } from './packages/client/src/i18n.js'
    const variant = ${JSON.stringify(variant)}
    const result = document.querySelector('output')
    flushSync(() => createRoot(document.querySelector('main')).render(createElement(PlayTurnActions, {
      turn: { id: 'opening', variant, variants: [variant] }, playthrough: ${JSON.stringify(row)},
      playClient: createLivePlayClient({ fetchImpl: fetch.bind(window) }), onChanged() {},
      onError: error => { if (error) result.textContent = error }, openSession: id => { result.textContent = id }
    })))
    document.querySelector('button[aria-label="' + translate('play.chat.rollbackPlaythrough') + '"]').click()
  ` }, bundle: true, format: 'iife', write: false, define: { 'process.env.NODE_ENV': '"production"' } })
  server = createServer((req, res) => {
    if (req.url === '/') return res.end('<!doctype html><meta charset="utf-8"><main></main><output>pending</output><script src="/app.js"></script>')
    if (req.url === '/app.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(app.outputFiles[0].contents)
    }
    return api(req, res)
  })
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const { stdout } = await promisify(execFile)(chrome, [
    '--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run',
    '--no-default-browser-check', '--user-data-dir=' + join(directory, 'browser'), '--virtual-time-budget=5000',
    '--dump-dom', 'http://127.0.0.1:' + server.address().port,
  ], { timeout: 30_000 })
  assert.equal(stdout.match(/<output>(.*?)<\/output>/s)?.[1], childId)
  assert.equal(JSON.parse(store.readFile(row.path).content).head.sessionId, childId)
  assert.equal(forks, 1)
  console.log('Rollback button opened the child saved in the timeline.')
} finally {
  if (server?.listening) await new Promise(resolve => server.close(resolve))
  rmSync(directory, { recursive: true, force: true })
}
