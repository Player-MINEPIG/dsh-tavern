import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CharacterStore } from '../packages/character/src/index.js'
import { apply } from '../packages/tavern-loader/src/index.js'

function syntheticCard() {
  return JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'Synthetic Keeper',
      description: 'Keeps the integration boundary.',
      personality: 'Precise',
      scenario: 'A self-authored test.',
      first_mes: 'Hello from the fixture.',
      mes_example: '',
      creator_notes: 'Must not enter the runtime prompt.',
      system_prompt: 'Act as Synthetic Keeper.',
      post_history_instructions: '',
      alternate_greetings: [],
      tags: [],
      creator: 'dsh-tavern tests',
      character_version: '1',
      character_book: {
        name: 'Synthetic embedded lore',
        scan_depth: 4,
        token_budget: 256,
        recursive_scanning: false,
        extensions: {},
        entries: [{
          id: 1,
          keys: ['clocktower'],
          secondary_keys: [],
          comment: 'Integration entry',
          content: 'The synthetic clocktower rings at dawn.',
          enabled: true,
          insertion_order: 80,
          constant: false,
          selective: false,
          position: 'after_char',
          case_sensitive: false,
          extensions: { position: 1, depth: 4, role: 0, probability: 100 },
        }],
      },
      extensions: {},
    },
  })
}

function host() {
  const sections = []
  const listeners = new Map()
  return {
    sections,
    listeners,
    ctx: {
      systemPrompt: { section: section => sections.push(section) },
      on: (name, listener) => listeners.set(name, listener),
      emit: () => {},
      get: () => undefined,
      effect: () => {},
      logger: { info: () => {} },
    },
  }
}

function agent(id, text = '') {
  return {
    id,
    session: {
      header: {},
      deriveMessages: () => text === '' ? [] : [{ role: 'user', content: [{ type: 'text', text }] }],
    },
  }
}

test('unified loader injects a selected character and its triggered embedded world book', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-integration-'))
  const { ctx, sections } = host()
  try {
    const store = apply(ctx, { storageDir: directory })
    const character = store.characterStore.import(syntheticCard(), { id: 'synthetic-keeper' })
    store.sessionSelections.set('session-a', {
      characterCardId: character.id,
      character: { greetingIndex: 0 },
    })

    const prompt = sections[0].text({ agent: agent('session-a', 'Tell me about the clocktower.') })
    assert.match(prompt, /character-id: synthetic-keeper/)
    assert.match(prompt, /Keeps the integration boundary\./)
    assert.match(prompt, /The synthetic clocktower rings at dawn\./)
    assert.doesNotMatch(prompt, /Must not enter the runtime prompt/)

    const active = store.profileLoader.compile({ agent: agent('session-a', 'clocktower') })
    assert.equal(active.resources.characterCard.id, 'synthetic-keeper')
    assert.equal(active.resources.worldBooks[0].kind, 'embedded-character-book')
    assert.deepEqual(active.activeLoreEntries, ['character:synthetic-keeper:embedded-world-book:1'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('legacy character selections migrate once into the loader session policy', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-migration-'))
  try {
    const legacy = new CharacterStore(directory)
    legacy.import(syntheticCard(), { id: 'legacy-card' })
    legacy.select('legacy-session', {
      characterCardId: 'legacy-card',
      character: { greetingIndex: 0, preferCharacterSystemPrompt: false },
    })

    const { ctx } = host()
    const store = apply(ctx, { storageDir: directory })
    assert.equal(store.sessionSelections.get('legacy-session').characterCardId, 'legacy-card')
    assert.equal(store.sessionSelections.get('legacy-session').character.preferCharacterSystemPrompt, false)
    assert.equal(store.characterStore.selection('legacy-session'), null)

    store.sessionSelections.set('legacy-session', { characterCardId: null, character: {} })
    const restarted = apply(host().ctx, { storageDir: directory })
    assert.equal(restarted.sessionSelections.get('legacy-session').characterCardId, null)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Host registers one broad API prefix so character and preset routes cannot shadow each other', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-routes-'))
  const routes = []
  const webServer = { register: route => { routes.push(route); return () => {} } }
  const { ctx } = host()
  ctx.get = name => name === 'webServer' ? webServer : undefined
  ctx.effect = install => install()
  try {
    apply(ctx, { storageDir: directory })
    assert.deepEqual(routes.map(route => route.path), ['/pmp-dsh-tavern/api'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('embedded world-book scanning bounds the durable-history input', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-scan-limit-'))
  const { ctx } = host()
  try {
    const store = apply(ctx, { storageDir: directory, worldBook: { maxScanCharacters: 32 } })
    const character = store.characterStore.import(syntheticCard(), { id: 'bounded-card' })
    store.sessionSelections.set('bounded-session', { characterCardId: character.id })
    const active = store.profileLoader.compile({ agent: agent('bounded-session', `${'x'.repeat(64)}clocktower`) })
    assert.deepEqual(active.activeLoreEntries, ['character:bounded-card:embedded-world-book:1'])
    assert.equal(active.diagnostics.find(item => item.code === 'WORLD_BOOK_SCAN_TEXT_TRUNCATED')?.scannedCharacters, 32)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('standalone world books are isolated per session and merge with embedded books through one adapter', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-standalone-books-'))
  const { ctx } = host()
  try {
    const store = apply(ctx, { storageDir: directory })
    const character = store.characterStore.import(syntheticCard(), { id: 'library-character' })
    store.worldBookStore.import(JSON.stringify({
      name: 'Alpha Book',
      token_budget: 100,
      entries: {
        high: { uid: 1, key: ['alpha'], content: 'High-order alpha lore.', order: 200, position: 0 },
        low: { uid: 2, key: ['alpha'], content: 'Low-order alpha lore.', order: 100, position: 0 },
      },
    }), { id: 'alpha-book' })
    store.worldBookStore.import(JSON.stringify({
      name: 'Beta Book',
      entries: { beta: { uid: 3, key: ['beta'], content: 'Beta lore.', order: 50, position: 1 } },
    }), { id: 'beta-book' })

    store.sessionSelections.set('session-a', {
      characterCardId: character.id,
      worldBookIds: ['alpha-book', 'beta-book'],
    })
    store.sessionSelections.set('session-b', { worldBookIds: ['beta-book'] })

    const first = store.profileLoader.compile({ agent: agent('session-a', 'alpha beta clocktower') })
    assert.deepEqual(first.resources.worldBooks.map(item => item.id), [
      'alpha-book',
      'beta-book',
      'character:library-character:embedded-world-book',
    ])
    assert.ok(first.systemText.indexOf('High-order alpha lore.') < first.systemText.indexOf('Low-order alpha lore.'))
    assert.match(first.systemText, /Beta lore\./)
    assert.match(first.systemText, /synthetic clocktower rings at dawn/)

    store.worldBookStore.delete('alpha-book')
    store.sessionSelections.clearResource('world-book', 'alpha-book')
    const afterDelete = store.profileLoader.compile({ agent: agent('session-a', 'alpha beta clocktower') })
    assert.deepEqual(afterDelete.audit.selection.worldBookIds, ['beta-book'])
    assert.doesNotMatch(afterDelete.systemText, /alpha lore/)
    assert.match(afterDelete.systemText, /Beta lore\./)
    assert.match(afterDelete.systemText, /synthetic clocktower rings at dawn/)

    const isolated = store.profileLoader.compile({ agent: agent('session-b', 'alpha beta') })
    assert.doesNotMatch(isolated.systemText, /alpha lore/)
    assert.match(isolated.systemText, /Beta lore\./)

    store.sessionSelections.set('session-a', { worldBookIds: [] })
    const unbound = store.profileLoader.compile({ agent: agent('session-a', 'alpha beta clocktower') })
    assert.doesNotMatch(unbound.systemText, /alpha lore|Beta lore/)
    assert.match(unbound.systemText, /synthetic clocktower rings at dawn/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('selected users add their books through loader policy, deduplicate explicit books, and preserve session isolation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-book-integration-'))
  const { ctx } = host()
  try {
    const store = apply(ctx, { storageDir: directory })
    store.userStore.create({ id: 'reader-a', name: 'Reader A', description: '' })
    store.userStore.create({ id: 'reader-b', name: 'Reader B', description: '' })
    for (const [id, name, content] of [
      ['explicit-book', 'Explicit Book', 'Explicit lore.'],
      ['shared-book', 'Shared Book', 'Shared lore.'],
      ['user-a-book', 'User A Book', 'User A lore.'],
      ['user-b-book', 'User B Book', 'User B lore.'],
    ]) {
      store.worldBookStore.import(JSON.stringify({
        name,
        entries: { one: { uid: 1, key: [], constant: true, content, position: 1 } },
      }), { id })
    }
    store.userWorldBooks.set('reader-a', ['shared-book', 'user-a-book'])
    store.userWorldBooks.set('reader-b', ['user-b-book'])
    store.sessionSelections.set('session-a', {
      userId: 'reader-a',
      worldBookIds: ['explicit-book', 'shared-book'],
    })
    store.sessionSelections.set('session-b', { userId: 'reader-b' })

    const first = store.profileLoader.compile({ agent: agent('session-a') })
    const activeView = store.profileLoader.activeView('session-a')
    assert.deepEqual(activeView.selection.worldBookIds, ['explicit-book', 'shared-book', 'user-a-book'])
    assert.deepEqual(activeView.sessionSelection.worldBookIds, ['explicit-book', 'shared-book'])
    assert.deepEqual(first.audit.sessionSelection.worldBookIds, ['explicit-book', 'shared-book'])
    assert.deepEqual(first.audit.worldBookSelection, {
      explicitIds: ['explicit-book', 'shared-book'],
      userBoundIds: ['shared-book', 'user-a-book'],
      effectiveIds: ['explicit-book', 'shared-book', 'user-a-book'],
      duplicateIds: ['shared-book'],
      order: 'session-explicit-then-user',
    })
    assert.deepEqual(first.resources.worldBooks.map(item => [item.id, item.bindingSources]), [
      ['explicit-book', ['session']],
      ['shared-book', ['session', 'user']],
      ['user-a-book', ['user']],
    ])
    assert.equal(first.systemText.match(/Shared lore\./g)?.length, 1)

    const isolated = store.profileLoader.compile({ agent: agent('session-b') })
    assert.match(isolated.systemText, /User B lore\./)
    assert.doesNotMatch(isolated.systemText, /User A lore|Shared lore|Explicit lore/)

    store.sessionSelections.set('session-a', { userId: null })
    const unbound = store.profileLoader.compile({ agent: agent('session-a') })
    assert.deepEqual(unbound.audit.worldBookSelection.effectiveIds, ['explicit-book', 'shared-book'])
    assert.match(unbound.systemText, /Explicit lore|Shared lore/)
    assert.doesNotMatch(unbound.systemText, /User A lore/)

    store.userStore.delete('reader-a')
    store.sessionSelections.clearResource('user', 'reader-a')
    store.userWorldBooks.clearUser('reader-a')
    assert.deepEqual(store.sessionSelections.get('session-a').worldBookIds, ['explicit-book', 'shared-book'])
    assert.deepEqual(store.userWorldBooks.get('reader-a'), [])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('real loader isolates users by session, refreshes switches immediately, restores, unbinds, and cleans deletion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-integration-'))
  const firstHost = host()
  try {
    const store = apply(firstHost.ctx, { storageDir: directory })
    store.userStore.create({ id: 'reader-one', name: 'Reader One', description: 'One description.' })
    store.userStore.create({ id: 'reader-two', name: 'Reader Two', description: 'Two description.' })
    store.sessionSelections.set('session-one', { userId: 'reader-one' })
    store.sessionSelections.set('session-two', { userId: 'reader-two' })

    assert.match(firstHost.sections[0].text({ agent: agent('session-one') }), /user-name: Reader One[\s\S]*One description\./)
    assert.doesNotMatch(firstHost.sections[0].text({ agent: agent('session-one') }), /Two description\./)
    assert.match(firstHost.sections[0].text({ agent: agent('session-two') }), /user-name: Reader Two[\s\S]*Two description\./)

    store.sessionSelections.set('session-one', { userId: 'reader-two' })
    const switched = firstHost.sections[0].text({ agent: agent('session-one') })
    assert.match(switched, /user-name: Reader Two/)
    assert.doesNotMatch(switched, /One description\./)

    const restartedHost = host()
    const restarted = apply(restartedHost.ctx, { storageDir: directory })
    assert.equal(restarted.sessionSelections.get('session-one').userId, 'reader-two')
    assert.match(restartedHost.sections[0].text({ agent: agent('session-one') }), /Two description\./)

    restarted.sessionSelections.set('session-one', { userId: null })
    assert.doesNotMatch(restartedHost.sections[0].text({ agent: agent('session-one') }), /user-name:|Two description\./)
    assert.match(restartedHost.sections[0].text({ agent: agent('session-two') }), /Two description\./)

    restarted.userStore.delete('reader-two')
    restarted.sessionSelections.clearResource('user', 'reader-two')
    assert.equal(restarted.sessionSelections.get('session-two').userId, null)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('real loader user snapshot stays stable and contains one authoritative Tavern profile contribution', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-user-snapshot-'))
  const { ctx, sections } = host()
  try {
    const store = apply(ctx, { storageDir: directory })
    store.userStore.create({ id: 'snapshot-user', name: 'Snapshot Reader', description: 'Synthetic snapshot description for {{user}}.' })
    store.sessionSelections.set('snapshot-session', { userId: 'snapshot-user' })
    const snapshot = store.profileLoader.compile({ agent: agent('snapshot-session') })
    const actual = {
      sectionNames: sections.map(section => section.name),
      selection: snapshot.audit.selection,
      resources: snapshot.resources,
      systemText: snapshot.systemText,
      diagnosticCodes: snapshot.diagnostics.map(item => item.code),
    }
    const expected = JSON.parse(readFileSync(new URL('./snapshots/user-profile-loader.json', import.meta.url), 'utf8'))
    assert.deepEqual(actual, expected)
    assert.equal(snapshot.systemText.match(/Synthetic snapshot description for Snapshot Reader\./g)?.length, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
