import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  TAVERN_MENU_ITEMS,
  clampLauncherAnchor,
  launcherPlacement,
  surfaceTitle,
} from '../packages/client/src/state.js'

test('one Tavern launcher exposes stable resource surfaces', () => {
  assert.deepEqual(TAVERN_MENU_ITEMS.map(item => item.id), [
    'preset',
    'world-info',
    'character',
    'user',
  ])
  assert.equal(surfaceTitle('world-info'), '世界信息')
  assert.equal(TAVERN_MENU_ITEMS.find(item => item.id === 'user').available, false)
})

test('floating launcher clamps its drag anchor and expands toward available space', () => {
  assert.deepEqual(clampLauncherAnchor({ x: -20, y: 900 }, { width: 800, height: 600 }), { x: 8, y: 548 })
  assert.deepEqual(launcherPlacement({ x: 748, y: 548 }, { width: 800, height: 600 }, true), {
    side: 'left',
    vertical: 'up',
    left: 572,
    top: 348,
    anchor: { x: 748, y: 548 },
  })
})

test('only the client composition root owns the Tavern shell overlay', () => {
  const root = readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8')
  const preset = readFileSync(new URL('../packages/preset/src/client.js', import.meta.url), 'utf8')
  const character = readFileSync(new URL('../packages/character/src/client.js', import.meta.url), 'utf8')
  assert.equal(root.match(/slots\.inject\('shell\.overlay'/g)?.length, 1)
  assert.match(root, /id: 'dsh-tavern-launcher'/)
  assert.doesNotMatch(preset, /slots\.inject|dsh-tavern-preset-launcher/)
  assert.doesNotMatch(character, /slots\.inject|dsh-tavern-character-overlay/)
})
