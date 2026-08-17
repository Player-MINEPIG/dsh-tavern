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
    'session-template',
    'settings',
  ])
  assert.equal(surfaceTitle('world-info'), 'nav.worldBook')
  assert.equal(TAVERN_MENU_ITEMS.find(item => item.id === 'user').available, true)
  assert.equal(TAVERN_MENU_ITEMS.find(item => item.id === 'settings').showBinding, false)
})

test('floating launcher clamps its drag anchor and expands toward available space', () => {
  assert.deepEqual(clampLauncherAnchor({ x: -20, y: 900 }, { width: 800, height: 600 }), { x: 8, y: 548 })
  assert.deepEqual(launcherPlacement({ x: 748, y: 548 }, { width: 800, height: 600 }, true), {
    side: 'left',
    vertical: 'up',
    left: 492,
    top: 216,
    anchor: { x: 748, y: 548 },
  })
  assert.deepEqual(clampLauncherAnchor({ x: 748, y: 548 }, { width: 800, height: 600 }, 1.5), { x: 726, y: 526 })
  assert.deepEqual(launcherPlacement({ x: 748, y: 548 }, { width: 800, height: 600 }, true, 1.5), {
    side: 'left',
    vertical: 'up',
    left: 342,
    top: 28,
    anchor: { x: 726, y: 526 },
  })
})

test('launcher status follows each session selection and resolves future catalogs', () => {
  const sessionA = launcherResourceStatuses({
    selection: {
      presetId: 'preset-a',
      characterCardId: 'character-a',
      worldBookIds: ['world-a', 'world-b'],
      userId: 'user-a',
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

  assert.deepEqual(sessionA.preset, { bound: true, title: 'Balanced Red', titleKey: null, count: 1 })
  assert.deepEqual(sessionA.character, { bound: true, title: 'Synthetic Guide', titleKey: null, count: 1 })
  assert.deepEqual(sessionA['world-info'], {
    bound: true,
    count: 2,
    title: 'Harbour Notes · Mountain Notes',
    titleKey: null,
  })
  assert.deepEqual(sessionA.user, { bound: true, title: 'Local Tester', titleKey: null, count: 1 })
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
    titleKey: null,
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
  assert.match(root, /}, 'DT'\)\)/)
  assert.doesNotMatch(root, /}, 'ST'\)\)/)
  assert.match(root, /'data-active': surface === item\.id/)
  assert.match(root, /'data-bound': item\.binding === false \? undefined : status\.bound/)
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
  assert.match(root, /SessionTemplatePanel/)
  assert.match(root, /ctx\.workspaces\.connectWorkspace/)
  assert.match(root, /ctx\.sessions\.open/)
  assert.match(root, /session-configurations\/preview/)
  assert.match(root, /session-configurations\/apply/)
  assert.match(root, /surface === 'settings'/)
  assert.match(root, /uiSettingsRequest\('PUT'/)
  assert.match(root, /--dtv-ui-scale/)
})

test('standalone world-book panel exposes CRUD, multi-binding and all required entry controls', () => {
  const source = readFileSync(new URL('../packages/world-book-library/src/client.js', import.meta.url), 'utf8')
  for (const route of ['world-books/import', 'world-book-selection', 'world-books/']) assert.match(source, new RegExp(route))
  for (const label of ['world.entry.title', 'world.entry.primaryKeys', 'world.entry.secondaryKeys', 'world.entry.secondaryLogicShort', 'common.enable', 'world.entry.constant', 'world.entry.caseSensitive', 'world.entry.wholeWord', 'world.entry.position', 'world.entry.order', 'world.entry.probability', 'world.entry.body']) {
    assert.match(source, new RegExp(label.replaceAll('.', '\\.')))
  }
  assert.match(source, /saveEmbedded/)
  assert.match(source, /world\.addEmbeddedEntry/)
})

test('resource mutations announce one shared refresh event consumed by the shell and panels', () => {
  const root = readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8')
  const preset = readFileSync(new URL('../packages/preset/src/client.js', import.meta.url), 'utf8')
  const character = readFileSync(new URL('../packages/character/src/client.js', import.meta.url), 'utf8')
  const worldBook = readFileSync(new URL('../packages/world-book-library/src/client.js', import.meta.url), 'utf8')
  const user = readFileSync(new URL('../packages/user/src/client.js', import.meta.url), 'utf8')

  assert.match(root, /addEventListener\('dsh-tavern:refresh', onRefresh\)/)
  assert.ok((preset.match(/announceTavernRefresh\(\)/g)?.length ?? 0) >= 6)
  assert.equal(character.match(/announceTavernRefresh\(\)/g)?.length, 7)
  assert.match(character, /addEventListener\('dsh-tavern:refresh', onRefresh\)/)
  assert.match(character, /rawText\(item\.name\)/)
  assert.doesNotMatch(character, /item\.sourceFormat/)
  assert.match(character, /character\.bindingUnsaved/)
  assert.match(character, /character\.bindingApplied/)
  assert.match(character, /characterBindingDirty\(selection, binding\)/)
  assert.match(worldBook, /dispatchEvent\(new Event\('dsh-tavern:refresh'\)\)/)
  assert.match(user, /notifyRefresh\(\)/)
  assert.match(worldBook, /addEventListener\('dsh-tavern:refresh', onRefresh\)/)
  assert.match(user, /addEventListener\('dsh-tavern:refresh', onRefresh\)/)
})

test('world-book panel separates session, user and character sources while exposing unapplied binding state', () => {
  const source = readFileSync(new URL('../packages/world-book-library/src/client.js', import.meta.url), 'utf8')
  assert.match(source, /world\.standalone/)
  assert.match(source, /world\.characterBound/)
  assert.match(source, /data-source': 'standalone'/)
  assert.match(source, /data-source': 'user'/)
  assert.match(source, /data-source': 'character'/)
  assert.match(source, /deriveUserWorldBookSource/)
  assert.match(source, /world\.user\.current/)
  assert.match(source, /world\.user\.order/)
  assert.match(source, /world\.user\.editHint/)
  assert.match(source, /users\/\$\{encodeURIComponent\(userId\)\}\/world-books/)
  assert.match(source, /saveUserSelection/)
  assert.match(source, /method: 'PUT'/)
  assert.match(source, /world\.user\.unsaved/)
  assert.match(source, /editUserBook/)
  assert.match(source, /world\.user\.editContent/)
  assert.match(source, /scrollIntoView/)
  assert.match(source, /world\.embeddedEmpty/)
  assert.match(source, /world\.bindingUnsaved/)
  assert.match(source, /world\.bindingAppliedButton/)
  assert.doesNotMatch(source, /`\$\{item\.name\} · \$\{item\.sourceFormat\}`/)
})

test('preset browsing is separate from explicit per-session binding', () => {
  const source = readFileSync(new URL('../packages/preset/src/client.js', import.meta.url), 'utf8')
  const root = readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8')
  const server = readFileSync(new URL('../packages/preset/src/server.js', import.meta.url), 'utf8')
  assert.match(source, /label: uiMessage\('preset.browse'\)/)
  assert.match(source, /value: draft\?\.id \?\? ''/)
  assert.match(source, /onChange: \(event\) => browse\(event\.target\.value\)/)
  assert.match(source, /body\(\{ id: draft\.id, sessionId \}\)/)
  assert.match(source, /body\(\{ id: null, sessionId \}\)/)
  assert.match(source, /className: 'dtt-button dtt-button-primary'[^\n]+onClick: bind/)
  assert.match(source, /preset\.status\.created/)
  assert.match(source, /preset\.status\.imported/)
  assert.equal(source.match(/api\('\/select'/g)?.length, 2)
  assert.match(root, /PresetSidebar,[\s\S]*sessionId,[\s\S]*sessionBlank/)
  assert.match(server, /beforeSelectionChange\?\.\(\{ sessionId: targetSessionId, presetId: selectedId \}\)/)
})

test('session-template panel renders resolved configuration contents and current-settings guidance', () => {
  const source = readFileSync(new URL('../packages/session-template/src/client.js', import.meta.url), 'utf8')
  assert.match(source, /function TemplatePreview/)
  assert.match(source, /contents\.preset/)
  assert.match(source, /contents\.characterCard/)
  assert.match(source, /contents\.user/)
  assert.match(source, /contents\.worldBooks/)
  assert.match(source, /template\.currentSettingsReminder/)
})

test('session-template primary actions use the shared blue business token', () => {
  const root = readFileSync(new URL('../packages/client/src/index.js', import.meta.url), 'utf8')
  const source = readFileSync(new URL('../packages/session-template/src/client.js', import.meta.url), 'utf8')
  assert.match(root, /\.dtv-primary\{background:var\(--dsw-alias-state-business-primary,#2677d9\)/)
  assert.doesNotMatch(root, /\.dtv-primary\{background:var\(--dsw-alias-button-primary-fill/)
  assert.equal(source.match(/className: 'dtv-button dtv-primary'/g)?.length, 2)
})

test('user session binding uses the same primary action styling as other binding panels', () => {
  const source = readFileSync(new URL('../packages/user/src/client.js', import.meta.url), 'utf8')
  assert.match(source, /className: 'dtu-button dtu-primary'[^\n]+onClick: bind/)
})

test('user panel edits independent world-book relationships and exposes unsaved-state safeguards', () => {
  const source = readFileSync(new URL('../packages/user/src/client.js', import.meta.url), 'utf8')
  assert.match(source, /users\/\$\{encodeURIComponent\(draft\.id\)\}\/world-books/)
  assert.match(source, /method: 'PUT'/)
  assert.match(source, /user\.worldBooksTitle/)
  assert.match(source, /user\.worldBooksHint/)
  assert.match(source, /user\.dirty/)
  assert.match(source, /beforeunload/)
  assert.match(source, /uiMessage\('user\.confirmCloseDirty'\)/)
  assert.doesNotMatch(source, /description:\s*worldBookIds|worldBookIds:\s*draft\.description/)
})
