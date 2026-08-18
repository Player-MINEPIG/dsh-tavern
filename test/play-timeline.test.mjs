import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { API_V2 } from '../packages/identity.js'
import {
  ChromeStore,
  PlayWorkspaceStore,
  createPlayApiHandler,
  deriveFocus,
  normalizeTimeline,
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

const greetingOnly = {
  nodes: [
    {
      id: 'g1',
      kind: 'greeting',
      hidden: false,
      displayOverride: null,
      adoptedVariantId: 'gv',
      variants: [{ id: 'gv', sessionId: 'session-greet', startEventId: 0, endEventId: 0 }],
    },
  ],
}

const multiQaUnusedVariant = {
  nodes: [
    {
      id: 'g1',
      kind: 'greeting',
      hidden: false,
      adoptedVariantId: 'gv',
      variants: [{ id: 'gv', sessionId: 'session-root', startEventId: 0, endEventId: 0 }],
    },
    {
      id: 'q1',
      kind: 'qa',
      hidden: false,
      adoptedVariantId: 'v-old',
      variants: [
        { id: 'v-old', sessionId: 'session-root', startEventId: 1, endEventId: 4 },
        { id: 'v-unused', sessionId: 'session-swipe-old', startEventId: 1, endEventId: 4 },
      ],
    },
    {
      id: 'q2',
      kind: 'qa',
      hidden: false,
      adoptedVariantId: 'v-new',
      variants: [
        { id: 'v-old', sessionId: 'session-root', startEventId: 5, endEventId: 8 },
        { id: 'v-new', sessionId: 'session-focus', startEventId: 5, endEventId: 8 },
      ],
    },
  ],
}

test('normalizeTimeline accepts legal documents and rejects bad kind, missing event ids, and focusSessionId', () => {
  assert.equal(normalizeTimeline(greetingOnly).nodes[0].kind, 'greeting')
  assert.throws(() => normalizeTimeline({ nodes: [{ ...greetingOnly.nodes[0], kind: 'swipe' }] }), /kind/)
  assert.throws(() => normalizeTimeline({
    nodes: [{
      ...greetingOnly.nodes[0],
      variants: [{ id: 'gv', sessionId: 's', startEventId: 0 }],
    }],
  }), /endEventId/)
  assert.throws(() => normalizeTimeline({ focusSessionId: 'nope', nodes: [] }), /focusSessionId/)
  assert.throws(() => normalizeTimeline({
    nodes: [{ ...greetingOnly.nodes[0], focusSessionId: 'nope' }],
  }), /focusSessionId/)
})

test('deriveFocus uses the last rendered QA adopted variant and ignores unused older swipes', () => {
  assert.deepEqual(deriveFocus(greetingOnly), { sessionId: null, nodeId: null, variantId: null })
  assert.deepEqual(deriveFocus(multiQaUnusedVariant), {
    sessionId: 'session-focus',
    nodeId: 'q2',
    variantId: 'v-new',
  })
  const hiddenTail = structuredClone(multiQaUnusedVariant)
  hiddenTail.nodes[2].hidden = true
  assert.equal(deriveFocus(hiddenTail).sessionId, 'session-root')
})

test('PUT timeline.json validates before writing; catalog.json likewise', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-timeline-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-play-timeline-root-'))
  try {
    const handler = createPlayApiHandler({
      chromeStore: new ChromeStore(pluginDir),
      workspaceStore: new PlayWorkspaceStore(pluginDir),
    })
    await invoke(handler, { method: 'PUT', url: `${API_V2}/workspace`, body: { path: playRoot } })

    const bad = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: JSON.stringify({ focusSessionId: 'session-x', nodes: [] }) },
    })
    assert.equal(bad.status, 400)
    assert.equal(existsSync(join(playRoot, 'run', 'timeline.json')), false)

    const ok = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=run/timeline.json`,
      body: { content: JSON.stringify(multiQaUnusedVariant) },
    })
    assert.equal(ok.status, 200)
    const saved = JSON.parse(readFileSync(join(playRoot, 'run', 'timeline.json'), 'utf8'))
    assert.equal(Object.hasOwn(saved, 'focusSessionId'), false)
    assert.equal(deriveFocus(saved).sessionId, 'session-focus')

    const badCatalog = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=catalog.json`,
      body: { content: JSON.stringify({ focusSessionId: 'x', playthroughs: [] }) },
    })
    assert.equal(badCatalog.status, 400)
    assert.equal(existsSync(join(playRoot, 'catalog.json')), false)

    const catalog = await invoke(handler, {
      method: 'PUT',
      url: `${API_V2}/workspace/files?path=catalog.json`,
      body: { content: JSON.stringify({ playthroughs: [{ id: 'pt1', path: 'run/timeline.json' }] }) },
    })
    assert.equal(catalog.status, 200)
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
})

test('timeline validation does not read DSH events', () => {
  const source = readFileSync(new URL('../packages/play/src/timeline.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /ctx\.sessions|session\.history|deriveMessages|@deepseek-ai/)
})
