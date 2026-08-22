import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import {
  TavernTraceRecorder,
  TavernTraceStore,
  createTavernTraceApiHandler,
  tavernTraceStoreConstants,
} from '../packages/tavern-trace/src/index.js'

function snapshot(marker = 'SYNTHETIC_PROFILE_MARKER') {
  return {
    systemText: `[dsh-tavern profile]\n${marker}\nSECRET_PROFILE_BODY`,
    systemPromptMode: 'append',
    callConfig: { temperature: 0.4, maxTokens: 700 },
    resources: {
      preset: { id: 'preset-a', name: 'Synthetic preset' },
      characterCard: { id: 'character-a', name: 'Synthetic character' },
      user: { id: 'user-a', name: 'Synthetic user', description: 'SECRET_USER_DESCRIPTION' },
      worldBooks: [{ id: 'book-a', name: 'Synthetic lore', kind: 'standalone-world-book' }],
    },
    diagnostics: [{ code: 'SYNTHETIC_INFO', severity: 'info', message: 'Test-owned diagnostic' }],
    audit: {
      fingerprint: 'a'.repeat(64),
      selection: {
        presetId: 'preset-a',
        characterCardId: 'character-a',
        userProfileId: 'user-a',
        worldBookIds: ['book-a'],
      },
      worldBookSelection: {
        explicitIds: ['book-a'],
        userBoundIds: ['book-a', 'book-b'],
        effectiveIds: ['book-a', 'book-b'],
        duplicateIds: ['book-a'],
        order: 'session-explicit-then-user',
      },
      composition: {
        userInjection: {
          selected: true,
          descriptionAvailable: true,
          descriptionCharacters: 23,
          descriptionInsertions: 1,
          descriptionPlacement: 'preset-marker:personaDescription',
        },
      },
      worldBooks: {
        resources: [{
          resource: { id: 'book-a', name: 'Synthetic lore', entryCount: 2, matchedEntryCount: 1 },
          budget: { limit: 20, used: 8, remaining: 12 },
          decisions: [{
            resourceId: 'book-a',
            entryId: 1,
            entryName: 'Synthetic entry',
            decision: 'included',
            reason: 'secondary-and_any-match',
            primaryKeys: ['harbor', 'quay'],
            secondaryKeys: ['lantern'],
            primaryMatches: ['harbor'],
            secondaryMatches: ['lantern'],
            secondaryLogic: 'and_any',
            probability: 50,
            probabilityRoll: 0.2,
            tokenCost: 8,
            requestedPosition: 'at_depth',
            appliedPosition: 'after',
            approximatePosition: true,
            content: 'SECRET_WORLD_BOOK_BODY',
          }, {
            resourceId: 'book-a',
            entryId: 2,
            entryName: 'Rejected synthetic entry',
            decision: 'rejected',
            reason: 'budget-exceeded',
            primaryKeys: ['harbor'],
            secondaryKeys: [],
            primaryMatches: ['harbor'],
            secondaryMatches: [],
            tokenCost: 30,
            requestedPosition: 'after_character_definition',
            content: 'SECOND_SECRET_WORLD_BOOK_BODY',
          }],
        }],
      },
    },
  }
}

function session(id, headerEvent) {
  const events = headerEvent === undefined ? [] : [headerEvent]
  return {
    id,
    events,
    requestHeader: () => events.findLast(event => event.type === 'request/header')?.data.header,
    append: () => { throw new Error('Tavern Trace must never append a Session event') },
  }
}

function invoke(handler, url) {
  return new Promise((resolve, reject) => {
    const req = Readable.from([])
    req.method = 'GET'
    req.url = url
    const res = {
      statusCode: 200,
      setHeader: () => {},
      end: payload => resolve({
        status: res.statusCode,
        body: JSON.parse(payload),
        bytes: Buffer.byteLength(payload),
      }),
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

test('Trace correlates turn/step to request/header while persisting only minimized metadata', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-trace-'))
  let time = 1000
  try {
    const store = new TavernTraceStore(directory)
    const recorder = new TavernTraceRecorder(store, { now: () => ++time })
    const model = snapshot()
    const agent = { id: 'session-trace', session: null }
    const pending = recorder.begin({ agent, turn: 4, step: 2, snapshot: model })

    assert.equal(pending.turn, 4)
    assert.equal(pending.step, 2)
    assert.equal(pending.worldBooks[0].decisions[0].reason, 'secondary-and_any-match')
    assert.equal(pending.worldBooks[0].decisions[1].reason, 'budget-exceeded')
    assert.equal(pending.resources.userProfile.name, 'Synthetic user')
    assert.deepEqual(pending.worldBookSelection, {
      explicitIds: ['book-a'],
      userBoundIds: ['book-a', 'book-b'],
      effectiveIds: ['book-a', 'book-b'],
      duplicateIds: ['book-a'],
      order: 'session-explicit-then-user',
    })
    assert.deepEqual(pending.worldBooks[0].decisions[0].primaryKeys, ['harbor', 'quay'])
    assert.deepEqual(pending.worldBooks[0].decisions[0].secondaryKeys, ['lantern'])
    assert.equal(pending.sensitiveContentStored, false)
    assert.equal(pending.entersModelHistory, false)

    const header = {
      config: { provider: 'test', model: 'synthetic', temperature: 0.4, maxTokens: 700 },
      system: `${model.systemText}\nHOST_SECRET_SYSTEM`,
      tools: [{ name: 'SECRET_TOOL_SCHEMA' }],
    }
    const event = { type: 'request/header', seq: 7, time: 1002, data: { header, reason: 'initial' } }
    const liveSession = session('session-trace', event)
    agent.session = liveSession
    const finalized = recorder.observeSessionEvent(liveSession, event)

    assert.equal(finalized.status, 'header-observed')
    assert.equal(finalized.authority.headerEventSeq, 7)
    assert.equal(finalized.authority.headerReason, 'initial')
    assert.equal(finalized.authority.headerReused, false)
    assert.equal(finalized.authority.tavernProfilePresent, true)
    assert.equal(finalized.authority.tavernCallConfigApplied, true)

    const disk = readFileSync(join(directory, 'tavern-traces.json'), 'utf8')
    for (const secret of [
      'SECRET_PROFILE_BODY',
      'SECRET_WORLD_BOOK_BODY',
      'SECOND_SECRET_WORLD_BOOK_BODY',
      'SECRET_USER_DESCRIPTION',
      'HOST_SECRET_SYSTEM',
      'SECRET_TOOL_SCHEMA',
    ]) assert.doesNotMatch(disk, new RegExp(secret))

    const reloaded = new TavernTraceStore(directory)
    assert.equal(reloaded.list('session-trace')[0].authority.headerEventSeq, 7)
    assert.equal(reloaded.list('session-trace')[0].worldBooks[0].decisions[0].primaryMatches[0], 'harbor')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Trace bounds records and sessions and the GET API restores the persisted slice', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-trace-bounds-'))
  try {
    const store = new TavernTraceStore(directory, { maxSessions: 2, maxRecordsPerSession: 2 })
    const recorder = new TavernTraceRecorder(store, { now: (() => { let value = 0; return () => ++value })() })
    for (const id of ['session-a', 'session-b', 'session-c']) {
      for (let turn = 1; turn <= 3; turn += 1) recorder.begin({ agent: { id }, turn, step: 1, snapshot: snapshot(`MARKER_${id}_${turn}`) })
    }

    assert.deepEqual(store.list('session-a'), [])
    assert.deepEqual(Object.keys(store.state.sessions).toSorted(), ['session-b', 'session-c'])
    assert.deepEqual(store.list('session-c').map(record => record.turn), [2, 3])

    const response = await invoke(createTavernTraceApiHandler(new TavernTraceStore(directory, {
      maxSessions: 2,
      maxRecordsPerSession: 2,
    })), '/pmp-dsh-tavern/api/v1/traces?sessionId=session-c')
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.records.map(record => record.turn), [2, 3])
    assert.deepEqual(response.body.storage, {
      kind: 'plugin-bounded-json',
      maxSessions: 2,
      maxRecordsPerSession: 2,
      maxRecordBytes: 64 * 1024,
      maxTotalBytes: 8 * 1024 * 1024,
      persistedBytes: response.body.storage.persistedBytes,
    })
    assert.ok(response.body.storage.persistedBytes > 0)

    const tiny = new TavernTraceStore(join(directory, 'tiny'), { maxRecordBytes: 512 })
    assert.throws(() => tiny.upsert('session-tiny', {
      id: '1:1:1', turn: 1, step: 1, attempt: 1, recordedAt: 1, oversized: 'x'.repeat(1024),
    }), /oversized/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Trace enforces one global byte budget across sessions, reload and GET responses', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-trace-total-budget-'))
  const maxTotalBytes = 5 * 1024
  const options = {
    maxSessions: 12,
    maxRecordsPerSession: 12,
    maxRecordBytes: 2 * 1024,
    maxTotalBytes,
  }
  try {
    const store = new TavernTraceStore(directory, options)
    for (let index = 1; index <= 18; index += 1) {
      store.upsert(`session-${index % 3}`, {
        id: `${index}:1:1`,
        turn: index,
        step: 1,
        attempt: 1,
        recordedAt: index,
        updatedAt: index,
        marker: `fixture-${index}`,
        padding: `${'界'.repeat(120)}-${'x'.repeat(420)}`,
      })
    }

    const stateText = `${JSON.stringify(store.state, null, 2)}\n`
    const stateBytes = Buffer.byteLength(stateText)
    const statePath = join(directory, 'tavern-traces.json')
    const persistedText = readFileSync(statePath, 'utf8')
    const retained = Object.values(store.state.sessions).flatMap(bucket => bucket.records)
    assert.ok(retained.length < 18)
    assert.ok(stateBytes <= maxTotalBytes)
    assert.equal(store.serializedBytes, stateBytes)
    assert.equal(store.persistedBytes, stateBytes)
    assert.equal(statSync(statePath).size, stateBytes)
    assert.equal(Buffer.byteLength(persistedText), stateBytes)
    assert.equal(persistedText, stateText)
    assert.ok(retained.some(record => record.id === '18:1:1'))
    assert.ok(retained.every(record => record.id !== '1:1:1'))
    const retainedTurns = retained.map(record => record.turn).toSorted((left, right) => left - right)
    assert.deepEqual(
      retainedTurns,
      Array.from({ length: 19 - retainedTurns[0] }, (_value, offset) => retainedTurns[0] + offset),
    )

    const reloaded = new TavernTraceStore(directory, options)
    assert.deepEqual(reloaded.state, store.state)
    assert.equal(reloaded.serializedBytes, stateBytes)
    assert.equal(reloaded.persistedBytes, stateBytes)
    assert.ok(statSync(statePath).size <= maxTotalBytes)

    const tightened = new TavernTraceStore(directory, { ...options, maxTotalBytes: 3 * 1024 })
    assert.ok(tightened.serializedBytes <= 3 * 1024)
    assert.equal(statSync(statePath).size, tightened.persistedBytes)
    assert.ok(tightened.list('session-0').some(record => record.id === '18:1:1'))

    const response = await invoke(
      createTavernTraceApiHandler(tightened),
      '/pmp-dsh-tavern/api/v1/traces?sessionId=session-0',
    )
    assert.equal(response.status, 200)
    assert.ok(response.bytes <= 3 * 1024)
    assert.equal(response.body.storage.maxTotalBytes, 3 * 1024)
    assert.equal(response.body.storage.persistedBytes, tightened.persistedBytes)
    assert.ok(response.body.records.some(record => record.id === '18:1:1'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Trace GET compacts response metadata before dropping the only latest record', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-trace-response-envelope-'))
  try {
    const store = new TavernTraceStore(directory, { maxTotalBytes: 1024, maxRecordBytes: 1024 })
    store.upsert('session-latest', {
      id: '9:1:1', turn: 9, step: 1, attempt: 1, recordedAt: 9, updatedAt: 9, padding: 'x'.repeat(670),
    })
    const response = await invoke(
      createTavernTraceApiHandler(store),
      '/pmp-dsh-tavern/api/v1/traces?sessionId=session-latest',
    )
    assert.equal(response.status, 200)
    assert.ok(response.bytes <= store.maxTotalBytes)
    assert.equal(response.body.responseMetadataTrimmed, true)
    assert.equal(response.body.records.length, 1)
    assert.equal(response.body.records[0].id, '9:1:1')
    assert.equal(response.body.storage.maxTotalBytes, 1024)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Trace rejects a record that cannot fit the total budget and clamps every configurable cap', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-trace-hard-caps-'))
  try {
    const store = new TavernTraceStore(directory, {
      maxSessions: Number.MAX_SAFE_INTEGER,
      maxRecordsPerSession: Number.MAX_SAFE_INTEGER,
      maxRecordBytes: Number.MAX_SAFE_INTEGER,
      maxTotalBytes: Number.MAX_SAFE_INTEGER,
    })
    assert.equal(store.maxSessions, tavernTraceStoreConstants.hardMaxSessions)
    assert.equal(store.maxRecordsPerSession, tavernTraceStoreConstants.hardMaxRecordsPerSession)
    assert.equal(store.maxRecordBytes, tavernTraceStoreConstants.hardMaxRecordBytes)
    assert.equal(store.maxTotalBytes, tavernTraceStoreConstants.hardMaxTotalBytes)

    const tiny = new TavernTraceStore(join(directory, 'tiny-total'), {
      maxRecordBytes: 2 * 1024,
      maxTotalBytes: 1024,
    })
    tiny.upsert('session-tiny', {
      id: '1:1:1', turn: 1, step: 1, attempt: 1, recordedAt: 1, updatedAt: 1, padding: 'safe',
    })
    const beforeState = structuredClone(tiny.state)
    const beforeDisk = readFileSync(tiny.statePath, 'utf8')
    const recordThatCannotFit = {
      id: '2:1:1', turn: 2, step: 1, attempt: 1, recordedAt: 2, updatedAt: 2, padding: '界'.repeat(260),
    }
    assert.ok(Buffer.byteLength(JSON.stringify(recordThatCannotFit)) < tiny.maxRecordBytes)
    assert.throws(() => tiny.upsert('session-tiny', recordThatCannotFit), /total limit/)
    assert.deepEqual(tiny.state, beforeState)
    assert.equal(readFileSync(tiny.statePath, 'utf8'), beforeDisk)

    const blockedTarget = join(directory, 'rename-blocked-by-directory')
    mkdirSync(blockedTarget)
    tiny.statePath = blockedTarget
    assert.throws(() => tiny.upsert('session-tiny', {
      id: '3:1:1', turn: 3, step: 1, attempt: 1, recordedAt: 3, updatedAt: 3,
    }))
    assert.deepEqual(tiny.state, beforeState)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Trace reuses the latest authoritative header without creating model history or tool events', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-trace-reuse-'))
  try {
    const store = new TavernTraceStore(directory)
    const recorder = new TavernTraceRecorder(store)
    const model = snapshot('REUSED_PROFILE')
    const headerEvent = {
      type: 'request/header',
      seq: 2,
      time: 1,
      data: {
        reason: 'initial',
        header: { config: { temperature: 0.4, maxTokens: 700 }, system: model.systemText },
      },
    }
    const liveSession = session('session-reused', headerEvent)
    const before = structuredClone(liveSession.events)
    const agent = { id: 'session-reused', session: liveSession }
    recorder.begin({ agent, turn: 2, step: 1, snapshot: model })
    recorder.observeSessionEvent(liveSession, {
      type: 'assistant/message',
      seq: 5,
      time: 2,
      data: { turn: 2, step: 1, message: { content: [] } },
    })

    const record = store.list('session-reused')[0]
    assert.equal(record.authority.headerEventSeq, 2)
    assert.equal(record.authority.headerReused, true)
    assert.deepEqual(liveSession.events, before)
    assert.equal(record.entersModelHistory, false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('client registers Tavern Trace as an additive official conversation view', () => {
  const source = readFileSync(new URL('../packages/tavern-trace/src/client.js', import.meta.url), 'utf8')
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(source, /slots\.inject\('conversation\.view'/)
  assert.match(source, /id: 'tavern-trace'/)
  assert.match(source, /label: translate\('trace.title'\)/)
  assert.match(source, /\.dttrace-body\{[^}]*flex:1[^}]*overflow:auto/)
  assert.match(source, /\.dttrace-record\{[^}]*overflow:visible/)
  assert.match(source, /className: 'dttrace-scale'/)
  assert.doesNotMatch(source, /height: `\$\{100 \/ uiSettings\.scale\}%`/)
  assert.doesNotMatch(source, /querySelector\([^)]*(trajectory|conversation)/i)
  assert.doesNotMatch(source, /MutationObserver|monkey|tool\/call|user\/message|assistant\/message/)
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-conversation'))
})
