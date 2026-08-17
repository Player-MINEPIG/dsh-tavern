import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../packages/tavern-loader/src/index.js'

test('selected preset enters system prompt and model call config seams', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-host-'))
  const sections = []
  const listeners = new Map()
  const emitted = []
  const ctx = {
    systemPrompt: { section: (section) => sections.push(section) },
    on: (name, listener) => listeners.set(name, listener),
    emit: (name) => emitted.push(name),
    get: () => undefined,
    effect: () => {},
    logger: { info: () => {} },
  }

  try {
    const store = apply(ctx, { storageDir: directory })
    const preset = store.create({ id: 'active', name: 'Active preset' })
    store.update(preset.id, {
      sampling: { temperature: 0.25, maxTokens: 1024, reasoningEffort: 'low' },
      prompts: [{ ...preset.prompts[0], content: 'Contract marker' }],
    })
    store.select(preset.id)

    assert.match(sections[0].text({}), /Contract marker/)
    assert.equal(sections[1].name, 'rp:policy')
    assert.equal(sections[1].text({}), '')
    const callConfig = await listeners.get('agent/request')({}, async () => ({ provider: 'test', model: 'model' }))
    assert.deepEqual(callConfig, {
      provider: 'test',
      model: 'model',
      temperature: 0.25,
      maxTokens: 1024,
      reasoningEffort: 'low',
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('replace mode removes other system sections but preserves request capabilities', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-host-replace-'))
  const listeners = new Map()
  const ctx = {
    systemPrompt: { section: () => {} },
    on: (name, listener) => listeners.set(name, listener),
    emit: () => {},
    get: () => undefined,
    effect: () => {},
    logger: { info: () => {} },
  }

  try {
    const store = apply(ctx, { storageDir: directory })
    const preset = store.create({ id: 'replace', name: 'Replacement preset' })
    store.update(preset.id, {
      systemPromptMode: 'replace',
      prompts: [{ ...preset.prompts[0], content: 'Only this system text' }],
    })
    store.select(preset.id)

    const tools = [{ name: 'tool-a' }]
    const contexts = [{ name: 'runtime-context' }]
    const result = await listeners.get('system-prompt/assemble')({}, {}, async () => ({
      sections: [{ name: 'harness', text: 'host text' }],
      tools,
      contexts,
      variables: { session: 'kept' },
    }))

    assert.equal(result.sections.length, 1)
    assert.equal(result.sections[0].name, 'dsh-tavern:profile')
    assert.match(result.sections[0].text, /Only this system text/)
    assert.equal(result.tools, tools)
    assert.equal(result.contexts, contexts)
    assert.deepEqual(result.variables, { session: 'kept' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Host resolves profile and call config from the requesting agent session', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-host-sessions-'))
  const sections = []
  const listeners = new Map()
  const ctx = {
    systemPrompt: { section: (section) => sections.push(section) },
    on: (name, listener) => listeners.set(name, listener),
    emit: () => {},
    get: () => undefined,
    effect: () => {},
    logger: { info: () => {} },
  }
  const agent = (id) => ({ id, session: { header: {}, deriveMessages: () => [] } })

  try {
    const store = apply(ctx, { storageDir: directory })
    const first = store.create({ id: 'first', name: 'First' })
    const second = store.create({ id: 'second', name: 'Second' })
    store.update(first.id, {
      sampling: { temperature: 0.1 },
      prompts: [{ ...first.prompts[0], content: 'First session prompt' }],
    })
    store.update(second.id, {
      sampling: { temperature: 0.9 },
      prompts: [{ ...second.prompts[0], content: 'Second session prompt' }],
    })
    store.sessionSelections.set('session-a', { presetId: first.id })
    store.sessionSelections.set('session-b', { presetId: second.id })

    assert.match(sections[0].text({ agent: agent('session-a') }), /First session prompt/)
    assert.match(sections[0].text({ agent: agent('session-b') }), /Second session prompt/)
    const firstConfig = await listeners.get('agent/request')({ agent: agent('session-a') }, async () => ({ provider: 'test', model: 'model' }))
    const secondConfig = await listeners.get('agent/request')({ agent: agent('session-b') }, async () => ({ provider: 'test', model: 'model' }))
    assert.equal(firstConfig.temperature, 0.1)
    assert.equal(secondConfig.temperature, 0.9)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('selected user keeps DSH agent identity and contributes one Tavern profile section', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-host-user-'))
  const sections = []
  const listeners = new Map()
  const ctx = {
    systemPrompt: { section: section => sections.push(section) },
    on: (name, listener) => listeners.set(name, listener),
    emit: () => {},
    get: () => undefined,
    effect: () => {},
    logger: { info: () => {} },
  }
  const selectedAgent = { id: 'user-session', session: { header: {}, deriveMessages: () => [] } }
  try {
    const store = apply(ctx, { storageDir: directory })
    store.userStore.create({ id: 'host-user', name: 'Host Reader', description: 'Host user description.' })
    store.sessionSelections.set('user-session', { userId: 'host-user' })
    const profileText = sections[0].text({ agent: selectedAgent })
    const harness = { name: 'harness', text: 'DSH agent identity remains authoritative.' }
    const tavern = { name: sections[0].name, text: profileText }
    const assembly = await listeners.get('system-prompt/assemble')({}, { agent: selectedAgent }, async () => ({
      sections: [harness, tavern], tools: [], contexts: [], variables: {},
    }))
    assert.equal(assembly.sections.filter(section => section.name === 'harness').length, 1)
    assert.equal(assembly.sections.filter(section => section.name === 'dsh-tavern:profile').length, 1)
    assert.equal(profileText.match(/Host user description\./g)?.length, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Host traces the exact assembled snapshot even if selection changes before agent/request', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-host-trace-snapshot-'))
  const sections = []
  const listeners = new Map()
  const ctx = {
    systemPrompt: { section: section => sections.push(section) },
    on: (name, listener) => listeners.set(name, listener),
    emit: () => {},
    get: () => undefined,
    effect: () => {},
    logger: { info: () => {} },
  }
  const session = {
    id: 'session-traced',
    header: {},
    events: [],
    deriveMessages: () => [],
    requestHeader: () => undefined,
  }
  const agent = { id: 'session-traced', session }

  try {
    const store = apply(ctx, { storageDir: directory })
    const assembled = store.create({ id: 'assembled', name: 'Assembled preset' })
    const later = store.create({ id: 'later', name: 'Later preset' })
    store.update(assembled.id, {
      sampling: { temperature: 0.2 },
      prompts: [{ ...assembled.prompts[0], content: 'ASSEMBLED_MARKER' }],
    })
    store.update(later.id, {
      sampling: { temperature: 0.8 },
      prompts: [{ ...later.prompts[0], content: 'LATER_MARKER' }],
    })
    store.sessionSelections.set(agent.id, { presetId: assembled.id })

    assert.match(sections[0].text({ agent }), /ASSEMBLED_MARKER/)
    store.sessionSelections.set(agent.id, { presetId: later.id })
    const config = await listeners.get('agent/request')(
      { agent, turn: 3, step: 1 },
      async () => ({ provider: 'test', model: 'model' }),
    )

    assert.equal(config.temperature, 0.2)
    const trace = store.traceStore.list(agent.id)[0]
    assert.equal(trace.turn, 3)
    assert.equal(trace.step, 1)
    assert.equal(trace.resources.preset.id, assembled.id)
    assert.equal(trace.assembly.callConfig.temperature, 0.2)
    assert.equal(session.events.length, 0)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
