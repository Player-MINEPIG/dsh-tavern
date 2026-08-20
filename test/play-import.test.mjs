import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bindPlaythroughImport,
  parsePlaythroughImport,
  unbindPlaythroughImport,
} from '../packages/client/src/play/import.js'

test('ST JSONL import keeps greeting and complete QA pairs as read-only context', () => {
  const text = [
    JSON.stringify({ character_name: 'Alice' }),
    JSON.stringify({ is_user: false, mes: 'Hello' }),
    JSON.stringify({ is_user: true, mes: 'Question' }),
    JSON.stringify({ is_user: false, mes: 'Answer' }),
  ].join('\n')
  assert.deepEqual(parsePlaythroughImport(text, 'old.jsonl'), {
    schemaVersion: 1,
    greeting: 'Hello',
    qa: [{ user: 'Question', assistant: 'Answer' }],
    source: { format: 'sillytavern-jsonl', fileName: 'old.jsonl' },
  })
})

test('import binds immutable context to the current empty session without creating a replacement session', async () => {
  const calls = []
  let context = null
  let binding = null
  const client = {
    async getTimeline() { return { nodes: [] } },
    async getMessages() { return { incompleteTurn: false, messages: [] } },
    async createDirs(path) { calls.push(['dirs', path]) },
    async putFile(path, content) { context = { path, content }; calls.push(['context', path, JSON.parse(content)]) },
    async putImportContextBinding(sessionId, reference) {
      calls.push(['bind', sessionId, reference])
      binding = { path: reference.path, hash: 'hash', state: 'pending', qaCount: 1 }
      return binding
    },
    async getImportContextBinding() { return binding },
    async deleteImportContextBinding(sessionId) { calls.push(['unbind', sessionId]); binding = null; return null },
    async getFile() { return structuredClone(context) },
  }
  const file = { name: 'old.jsonl', async text() {
    return [JSON.stringify({}), JSON.stringify({ is_user: true, mes: 'Q' }), JSON.stringify({ is_user: false, mes: 'A' })].join('\n')
  } }
  const playthrough = {
    id: 'old', title: 'Alice run', path: 'alice/old/timeline.json',
    ext: { pmpDshTavern: { characterId: 'alice', rootSessionId: 'session-old' } },
  }
  const result = await bindPlaythroughImport(client, playthrough, file, { randomUUID: () => 'fixed' })
  assert.equal(result.sessionId, 'session-old')
  assert.equal(result.binding.path, 'alice/old/import-context-fixed.json')
  assert.deepEqual(calls.map(call => call[0]), ['dirs', 'context', 'bind'])
  assert.equal(calls.some(call => call[0] === 'session'), false)
  await unbindPlaythroughImport(client, playthrough)
  assert.equal(binding, null)
  assert.deepEqual(calls.at(-1), ['unbind', 'session-old'])
})

test('frontend import mutation fails closed after authoritative conversation starts', async () => {
  const client = {
    async getTimeline() { return { nodes: [] } },
    async getMessages() { return { incompleteTurn: false, messages: [{ role: 'user' }] } },
  }
  const playthrough = { path: 'alice/old/timeline.json', ext: { pmpDshTavern: { rootSessionId: 'session-old' } } }
  await assert.rejects(bindPlaythroughImport(client, playthrough, { name: 'old.jsonl', async text() {
    return [JSON.stringify({}), JSON.stringify({ is_user: true, mes: 'Q' }), JSON.stringify({ is_user: false, mes: 'A' })].join('\n')
  } }), error => error.code === 'PLAY_IMPORT_CONTEXT_LOCKED')
})

test('portable bundle reimport keeps earlier imported context before native timeline turns', () => {
  const bundle = JSON.stringify({
    kind: 'pmp-dsh-tavern-playthrough', schemaVersion: 1,
    playthrough: { id: 'pt' },
    timeline: { nodes: [{
      id: 'qa-2', kind: 'qa', adoptedVariantId: 'v',
      variants: [{ id: 'v', sessionId: 's', startEventId: 1, endEventId: 2 }],
    }] },
    messagesBySession: { s: { messages: [
      { role: 'user', seq: 1, text: 'new user' },
      { role: 'assistant', seq: 2, text: 'new assistant' },
    ] } },
    resources: {
      greeting: 'old greeting',
      importContext: { greeting: 'import greeting', qa: [{ user: 'old user', assistant: 'old assistant' }] },
    },
  })
  const parsed = parsePlaythroughImport(bundle, 'bundle.json')
  assert.equal(parsed.greeting, 'import greeting')
  assert.deepEqual(parsed.qa, [
    { user: 'old user', assistant: 'old assistant' },
    { user: 'new user', assistant: 'new assistant' },
  ])
})
