import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SessionConfigurationError,
  SessionConfigurationService,
  SessionTemplateLimitError,
  SessionTemplateStore,
  normalizeTemplateSelection,
} from '../packages/session-template/src/index.js'
import { SessionSelectionStore, normalizeSelection } from '../packages/tavern-loader/src/session-policy.js'

function resources(values = []) {
  const items = new Set(values)
  return {
    get(id) {
      if (!items.has(id)) {
        const error = new Error(`missing: ${id}`)
        error.code = 'NOT_FOUND'
        throw error
      }
      return { id }
    },
    delete: id => items.delete(id),
  }
}

function fixture(directory, options = {}) {
  const templates = new SessionTemplateStore(directory, options.templates)
  const selections = new SessionSelectionStore(directory, options.selections)
  const presets = resources(['preset-a'])
  const characters = resources(['character-a'])
  characters.normalizeSelection = (id, selection) => {
    characters.get(id)
    if (selection.character.greetingIndex === 99) throw new TypeError('greetingIndex out of range')
    return selection
  }
  const users = resources(['user-a'])
  const worldBooks = resources(['book-a', 'book-b'])
  const service = new SessionConfigurationService({ templates, selections, presets, characters, users, worldBooks })
  return { templates, selections, presets, characters, users, worldBooks, service }
}

const selection = {
  presetId: 'preset-a',
  characterCardId: 'character-a',
  userId: 'user-a',
  worldBookIds: ['book-a', 'book-b'],
  character: {
    greetingIndex: 2,
    preferCharacterSystemPrompt: false,
    preferCharacterPostHistory: true,
  },
}

test('template projection stays identical to the loader selection schema', () => {
  const input = {
    ...selection,
    worldBookIds: ['book-a', 'book-a', '', 12],
    character: { ...selection.character, injected: 'discarded' },
    runtime: { turn: 9 },
  }
  assert.deepEqual(normalizeTemplateSelection(input), normalizeSelection(input))
})

test('session templates persist only the bounded Tavern selection projection', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-template-store-'))
  try {
    const first = new SessionTemplateStore(directory, {
      id: () => 'template-a',
      now: () => '2026-08-15T01:00:00.000Z',
    })
    const created = first.create({ name: '  Tavern setup  ', selection: { ...selection, injected: 'discarded' } })
    assert.equal(created.name, 'Tavern setup')
    assert.deepEqual(created.selection, selection)
    assert.equal(first.state.selectedId, 'template-a')

    const renamed = first.update(created.id, { name: 'Renamed setup', now: '2026-08-15T02:00:00.000Z' })
    assert.equal(renamed.name, 'Renamed setup')
    assert.equal(renamed.updatedAt, '2026-08-15T02:00:00.000Z')

    const reloaded = new SessionTemplateStore(directory)
    assert.deepEqual(reloaded.get(created.id).selection, selection)
    assert.equal(reloaded.state.selectedId, created.id)
    const stored = JSON.parse(readFileSync(join(directory, 'session-templates.json'), 'utf8'))
    assert.deepEqual(Object.keys(stored.templates[0].selection).toSorted(), [
      'character', 'characterCardId', 'presetId', 'userId', 'worldBookIds',
    ])

    reloaded.delete(created.id)
    assert.equal(reloaded.state.selectedId, null)
    assert.deepEqual(reloaded.list(), [])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('template count and byte limits fail transactionally', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-template-limits-'))
  try {
    let nextId = 0
    const countLimited = new SessionTemplateStore(directory, {
      maxTemplates: 1,
      id: () => `template-${++nextId}`,
    })
    countLimited.create({ name: 'First', selection: {} })
    assert.throws(
      () => countLimited.create({ name: 'Second', selection: {} }),
      error => error instanceof SessionTemplateLimitError && error.code === 'SESSION_TEMPLATE_LIMIT_REACHED',
    )
    assert.equal(countLimited.list().length, 1)

    const bytesDirectory = mkdtempSync(join(tmpdir(), 'dsh-tavern-template-bytes-'))
    try {
      const byteLimited = new SessionTemplateStore(bytesDirectory, {
        maxStateBytes: 360,
        id: () => 'template-bytes',
      })
      assert.throws(
        () => byteLimited.create({ name: 'x'.repeat(100), selection }),
        error => error.code === 'SESSION_TEMPLATE_STORAGE_LIMIT_REACHED',
      )
      assert.deepEqual(byteLimited.list(), [])
    } finally {
      rmSync(bytesDirectory, { recursive: true, force: true })
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('current settings and templates apply as one clean target selection', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-template-service-'))
  try {
    const { templates, selections, service } = fixture(directory, {
      templates: { id: () => 'template-a' },
    })
    selections.set('source-session', selection)
    const created = service.createTemplate('Saved setup', 'source-session')
    assert.equal(created.id, 'template-a')

    selections.set('source-session', { presetId: null, worldBookIds: [] })
    service.apply('target-current', { mode: 'current', sessionId: 'source-session' })
    service.apply('target-template', { mode: 'template', templateId: templates.state.selectedId })

    assert.deepEqual(selections.get('target-current'), {
      presetId: null,
      characterCardId: 'character-a',
      userId: 'user-a',
      worldBookIds: [],
      character: selection.character,
    })
    assert.deepEqual(selections.get('target-template'), selection)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('missing template resources produce diagnostics and never partially replace a target', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-template-missing-'))
  try {
    const { templates, selections, worldBooks, service } = fixture(directory, {
      templates: { id: () => 'template-missing' },
    })
    templates.create({ name: 'Will become stale', selection })
    worldBooks.delete('book-b')
    selections.set('target-session', { presetId: 'preset-a', worldBookIds: ['book-a'] })
    const before = selections.get('target-session')

    const preview = service.preview({ mode: 'template', templateId: 'template-missing' })
    assert.equal(preview.available, false)
    assert.deepEqual(preview.contents, {
      preset: { id: 'preset-a', name: 'preset-a', missing: false },
      characterCard: { id: 'character-a', name: 'character-a', missing: false },
      user: { id: 'user-a', name: 'user-a', missing: false },
      worldBooks: [
        { id: 'book-a', name: 'book-a', missing: false },
        { id: 'book-b', name: 'book-b', missing: true },
      ],
      character: selection.character,
    })
    assert.deepEqual(preview.diagnostics.map(item => item.code), ['SESSION_CONFIGURATION_WORLD_BOOK_MISSING'])
    assert.match(preview.diagnostics[0].message, /book-b/)
    assert.throws(
      () => service.apply('target-session', { mode: 'template', templateId: 'template-missing' }),
      error => error instanceof SessionConfigurationError && error.status === 409,
    )
    assert.deepEqual(selections.get('target-session'), before)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
