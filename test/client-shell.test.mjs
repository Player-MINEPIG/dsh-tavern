import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  TAVERN_MENU_ITEMS,
  clampLauncherAnchor,
  launcherPlacement,
  launcherResourceStatuses,
  surfaceTitle,
} from '../packages/client/src/state.js'

test('one Tavern launcher exposes stable resource surfaces', () => {
  assert.deepEqual(TAVERN_MENU_ITEMS.map(item => item.id), [
    'preset',
    'character',
    'world-info',
    'user',
  ])
  assert.equal(surfaceTitle('world-info'), '世界书')
  assert.equal(TAVERN_MENU_ITEMS.find(item => item.id === 'user').available, true)
})

test('floating launcher clamps its drag anchor and expands toward available space', () => {
  assert.deepEqual(clampLauncherAnchor({ x: -20, y: 900 }, { width: 800, height: 600 }), { x: 8, y: 548 })
  assert.deepEqual(launcherPlacement({ x: 748, y: 548 }, { width: 800, height: 600 }, true), {
    side: 'left',
    vertical: 'up',
    left: 492,
    top: 316,
    anchor: { x: 748, y: 548 },
  })
})

test('launcher status follows each session selection and resolves future catalogs', () => {
  const sessionA = launcherResourceStatuses({
    selection: {
      presetId: 'preset-a',
      characterCardId: 'character-a',
      worldBookIds: ['world-a', 'world-b'],
      userProfileId: 'user-a',
    },
    resources: {
      preset: { id: 'preset-a', name: 'Balanced Red' },
      characterCard: { id: 'character-a', name: 'Synthetic Guide' },
      worldBooks: [{ id: 'world-a', name: 'Harbour Notes', matchedEntryCount: 0 }],
    },
    catalogs: {
      worldBooks: [{ id: 'world-b', title: 'Mountain Notes' }],
      userProfiles: [{ id: 'user-a', displayName: 'Local Tester' }],
    },
  })
  const sessionB = launcherResourceStatuses({
    selection: { presetId: null, characterCardId: null, worldBookIds: [] },
    resources: { preset: null, characterCard: null, worldBooks: [] },
  })

  assert.deepEqual(sessionA.preset, { bound: true, title: 'Balanced Red', count: 1 })
  assert.deepEqual(sessionA.character, { bound: true, title: 'Synthetic Guide', count: 1 })
  assert.deepEqual(sessionA['world-info'], {
    bound: true,
    count: 2,
    title: 'Harbour Notes、Mountain Notes · 2 本',
  })
  assert.deepEqual(sessionA.user, { bound: true, title: 'Local Tester', count: 1 })
  assert.equal(sessionB.preset.bound, false)
  assert.equal(sessionB.character.bound, false)
  assert.equal(sessionB['world-info'].bound, false)
  assert.equal(sessionB.user.bound, false)
})

test('world-book dot reflects selection, not whether an entry matched this turn', () => {
  const selectedWithoutHit = launcherResourceStatuses({
    selection: { worldBookIds: ['quiet-book'] },
    resources: { worldBooks: [{ id: 'quiet-book', name: 'Quiet Book', matchedEntryCount: 0, activeEntryIds: [] }] },
  })
  const catalogHitWithoutSelection = launcherResourceStatuses({
    selection: { worldBookIds: [] },
    catalog: { worldBooks: [{ id: 'catalog-only', name: 'Catalog Only', matchedEntryCount: 3 }] },
  })
  const embeddedSelectionWithoutHit = launcherResourceStatuses({
    selection: { characterCardId: 'character-a', worldBookIds: [] },
    resources: {
      worldBooks: [{
        id: 'character:character-a:embedded-world-book',
        name: 'Embedded Notes',
        kind: 'embedded-character-book',
        matchedEntryCount: 0,
      }],
    },
  })

  assert.equal(selectedWithoutHit['world-info'].bound, true)
  assert.equal(catalogHitWithoutSelection['world-info'].bound, false)
  assert.equal(embeddedSelectionWithoutHit['world-info'].bound, true)
})

test('legacy active responses and missing optional fields remain safe', () => {
  assert.deepEqual(launcherResourceStatuses({ selected: { id: 'legacy', name: 'Legacy Preset' } }).preset, {
    bound: true,
    title: 'Legacy Preset',
    count: 1,
  })
  assert.doesNotThrow(() => launcherResourceStatuses(null))
})

test('only the client composition root owns the Tavern shell overlay', () => {
  const root = readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8')
  const preset = readFileSync(new URL('../packages/preset/src/client.js', import.meta.url), 'utf8')
  const character = readFileSync(new URL('../packages/character/src/client.js', import.meta.url), 'utf8')
  const user = readFileSync(new URL('../packages/user/src/client.js', import.meta.url), 'utf8')
  assert.equal(root.match(/slots\.inject\('shell\.overlay'/g)?.length, 1)
  assert.match(root, /id: 'dsh-tavern-launcher'/)
  assert.match(root, /'data-active': surface === item\.id/)
  assert.match(root, /'data-bound': status\.bound/)
  assert.match(root, /setActiveSnapshot\(null\)[\s\S]*refreshStatus\(\)/)
  assert.match(root, /event\.key !== 'Escape'/)
  assert.match(root, /'data-surface-open': surface !== null/)
  assert.match(root, /setSurface\(id\)[\s\S]*dsh-tavern:refresh/)
  assert.doesNotMatch(root, /surface === null \? h\('div', \{\s*className: 'dtv-launcher'/)
  assert.doesNotMatch(preset, /slots\.inject|dsh-tavern-preset-launcher/)
  assert.doesNotMatch(character, /slots\.inject|dsh-tavern-character-overlay/)
  assert.doesNotMatch(user, /slots\.inject|avatar|image\/|<img/)
  assert.match(root, /WorldBookPanel/)
  assert.match(root, /UserPanel/)
})

test('standalone world-book panel exposes CRUD, multi-binding and all required entry controls', () => {
  const source = readFileSync(new URL('../packages/world-book-library/src/client.js', import.meta.url), 'utf8')
  for (const route of ['world-books/import', 'world-book-selection', 'world-books/']) assert.match(source, new RegExp(route))
  for (const label of ['条目标题', '主关键词', '附加关键词', 'Secondary logic', '启用', '常驻', '区分大小写', '全词匹配', '位置', '顺序', '概率', '正文']) {
    assert.match(source, new RegExp(label))
  }
  assert.match(source, /saveEmbedded/)
  assert.match(source, /新增内嵌条目/)
})

test('resource mutations announce one shared refresh event consumed by the shell and panels', () => {
  const root = readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8')
  const preset = readFileSync(new URL('../packages/preset/src/client.js', import.meta.url), 'utf8')
  const character = readFileSync(new URL('../packages/character/src/client.js', import.meta.url), 'utf8')

  assert.match(root, /addEventListener\('dsh-tavern:refresh', onRefresh\)/)
  assert.equal(preset.match(/announceTavernRefresh\(\)/g)?.length, 6)
  assert.equal(character.match(/announceTavernRefresh\(\)/g)?.length, 5)
  assert.match(character, /addEventListener\('dsh-tavern:refresh', onRefresh\)/)
})
