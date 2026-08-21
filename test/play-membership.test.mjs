import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PlayMembershipService,
  PlayWorkspaceStore,
  detachSessionFromTimeline,
  parseCatalogJson,
  parseTimelineJson,
  validatePlayDocument,
} from '../packages/play/src/index.js'

function variant(id, sessionId) {
  return { id, sessionId, startEventId: 1, endEventId: 2 }
}

function sampleTimeline() {
  return {
    nodes: [
      { id: 'n-root', kind: 'qa', hidden: false, displayOverride: null, parentVariantId: null, adoptedVariantId: 'v-root', variants: [variant('v-root', 'root')] },
      { id: 'n-swipe', kind: 'qa', hidden: false, displayOverride: null, parentVariantId: 'v-root', adoptedVariantId: 'v-target', variants: [variant('v-target', 'target'), variant('v-sibling', 'sibling')] },
      { id: 'n-child', kind: 'qa', hidden: false, displayOverride: null, parentVariantId: 'v-target', adoptedVariantId: 'v-child', variants: [variant('v-child', 'child')] },
      { id: 'n-kept', kind: 'qa', hidden: false, displayOverride: null, parentVariantId: 'v-sibling', adoptedVariantId: 'v-kept', variants: [variant('v-kept', 'kept')] },
    ],
    head: { sessionId: 'child', nodeId: 'n-child', variantId: 'v-child' },
    ext: {
      pmpDshTavern: {
        importContextPath: 'card/pt/import-context.json',
        branchHeads: [
          { branchVariantId: 'v-target', sessionId: 'child', nodeId: 'n-child', variantId: 'v-child' },
          { branchVariantId: 'v-sibling', sessionId: 'kept', nodeId: 'n-kept', variantId: 'v-kept' },
        ],
      },
    },
  }
}

test('detachSessionFromTimeline removes the target branch and descendants but preserves siblings', () => {
  const result = detachSessionFromTimeline(sampleTimeline(), 'target')
  assert.equal(result.changed, true)
  assert.deepEqual(new Set(result.detachedSessionIds), new Set(['target', 'child']))
  assert.deepEqual(result.timeline.nodes.map(node => node.id), ['n-root', 'n-swipe', 'n-kept'])
  assert.deepEqual(result.timeline.nodes[1].variants.map(item => item.id), ['v-sibling'])
  assert.equal(result.timeline.nodes[1].adoptedVariantId, 'v-sibling')
  assert.equal(result.timeline.head.variantId, 'v-kept')
  assert.deepEqual(result.timeline.ext.pmpDshTavern.branchHeads, [
    { branchVariantId: 'v-sibling', sessionId: 'kept', nodeId: 'n-kept', variantId: 'v-kept' },
  ])
})

test('detachSessionFromTimeline follows implicit legacy adopted parents', () => {
  const timeline = {
    nodes: [
      { id: 'n1', kind: 'qa', adoptedVariantId: 'v1', variants: [variant('v1', 'target')] },
      { id: 'n2', kind: 'qa', adoptedVariantId: 'v2', variants: [variant('v2', 'child')] },
    ],
  }
  const result = detachSessionFromTimeline(timeline, 'target')
  assert.deepEqual(result.timeline.nodes, [])
  assert.deepEqual(new Set(result.detachedSessionIds), new Set(['target', 'child']))
})

test('PlayMembershipService detects character mismatch and commits root detachment with CAS', async () => {
  const pluginDir = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-plugin-'))
  const playRoot = mkdtempSync(join(tmpdir(), 'dsh-tavern-membership-root-'))
  try {
    const store = new PlayWorkspaceStore(pluginDir)
    await store.bindRoot(playRoot)
    store.createDir('card/pt')
    const timeline = sampleTimeline()
    const catalog = {
      playthroughs: [{
        id: 'pt',
        path: 'card/pt/timeline.json',
        title: '1周目',
        ext: { pmpDshTavern: { characterId: 'card', rootSessionId: 'root', importContextPath: 'card/pt/import-context.json' } },
      }],
    }
    store.writeFile('card/pt/timeline.json', JSON.stringify(timeline), {
      expectedRevision: null,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    store.writeFile('catalog.json', JSON.stringify(catalog), {
      expectedRevision: null,
      expectedRevisionPresent: true,
      validate: validatePlayDocument,
    })
    const service = new PlayMembershipService(store)
    assert.deepEqual(service.conflictsForSelection('root', 'other'), [{
      playthroughId: 'pt',
      playthroughTitle: '1周目',
      sessionId: 'root',
      expectedCharacterId: 'card',
      requestedCharacterId: 'other',
      descendantSessionCount: 4,
    }])
    assert.deepEqual(service.conflictsForSelection('root', 'card'), [])

    const result = service.detach('pt', 'root')
    assert.equal(result.detached, true)
    assert.deepEqual(new Set(result.detachedSessionIds), new Set(['root', 'target', 'sibling', 'child', 'kept']))
    const savedCatalog = parseCatalogJson(store.readFile('catalog.json', { validate: validatePlayDocument }).content)
    assert.equal(savedCatalog.playthroughs.length, 1)
    assert.equal(savedCatalog.playthroughs[0].ext.pmpDshTavern.rootSessionId, undefined)
    assert.equal(savedCatalog.playthroughs[0].ext.pmpDshTavern.importContextPath, undefined)
    const savedTimeline = parseTimelineJson(store.readFile('card/pt/timeline.json', { validate: validatePlayDocument }).content)
    assert.equal(savedTimeline.ext?.pmpDshTavern?.importContextPath, undefined)
  } finally {
    rmSync(pluginDir, { recursive: true, force: true })
    rmSync(playRoot, { recursive: true, force: true })
  }
})
