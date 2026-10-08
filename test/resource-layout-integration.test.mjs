import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleRequest, createDefaultRegistry, normalizePreset, withBlockMove, positionRows, configurePosition } from '../packages/request-assembler/index.js'
test('Tavern resource adapter delegates current grouping and stable overrides to assembler', () => {
  const preset = normalizePreset({ format: 'dsh-tavern-request-assembly', version: 1, name: 'Resources', backend: 'core', rules: [{ id: 'worldbook', kind: 'worldbook' }, { id: 'character', kind: 'character' }], layout: { version: 1, source: 'manual', identity: 'preserve', fallback: 'source-order', overrides: [] } })
  const assets = { loreEntries: [{ id: 'a', content: 'A', position: 'before' }, { id: 'b', content: 'B', position: 'before' }], character: { id: 'c', data: { description: 'Character' } } }
  const run = p => assembleRequest({ registry: createDefaultRegistry(), preset: p, assets })
  const first = run(preset), [lore, character] = first.resourceLayout.blocks
  assert.deepEqual(lore.entries.map(e => e.text), ['A', 'B'])
  const next = run(withBlockMove(preset, first.resourceLayout, lore.id, character.id, 'after'))
  assert.deepEqual(next.nodes.map(n => n.text), ['Character', 'A', 'B'])
})

test('Tavern resource positions remain configurable before loading and survive resource replacement', () => {
  const registry = createDefaultRegistry()
  const preset = normalizePreset({ format: 'dsh-tavern-request-assembly', version: 1, name: 'Positions', backend: 'core', rules: [{ id: 'worldbook', kind: 'worldbook', enabled: true }] })
  const rows = positionRows(preset, registry.list())
  assert.ok(rows.some(r => r.positionId === 'after_example_messages'))
  const configured = configurePosition(preset, registry.list(), 'worldbook#after', { enabled: false })
  for (const resourceId of ['book-a', 'book-b']) {
    const result = assembleRequest({ registry, preset: configured, assets: { loreEntries: [{ id: resourceId, resourceId, position: 'after', content: 'OFF' }, { id: 'before', resourceId, position: 'before', content: 'ON' }] } })
    assert.deepEqual(result.nodes.map(n => n.text), ['ON'])
  }
})
