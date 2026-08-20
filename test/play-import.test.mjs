import test from 'node:test'
import assert from 'node:assert/strict'
import { importPlaythrough, parsePlaythroughImport } from '../packages/client/src/play/import.js'

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

test('import writes immutable context before creating a new empty session and timeline', async () => {
  const calls = []
  let context = null
  let timeline = null
  let catalog = { playthroughs: [] }
  const client = {
    async createDirs(path) { calls.push(['dirs', path]) },
    async putFile(path, content) { context = { path, content }; calls.push(['context', path, JSON.parse(content)]) },
    async postSession(source, ref) { calls.push(['session', source, ref]); return { sessionId: 'session-new' } },
    async getCatalog() { return structuredClone(catalog) },
    async putTimeline(playthrough, value) { timeline = structuredClone(value); calls.push(['timeline', playthrough.path, value]) },
    async getTimeline() { return structuredClone(timeline) },
    async putCatalog(value) { catalog = structuredClone(value); calls.push(['catalog', value]) },
    async getFile() { return structuredClone(context) },
    async getCharacterSelection() { return { selection: { characterCardId: 'alice' } } },
  }
  const file = { name: 'old.jsonl', async text() {
    return [JSON.stringify({}), JSON.stringify({ is_user: true, mes: 'Q' }), JSON.stringify({ is_user: false, mes: 'A' })].join('\n')
  } }
  const result = await importPlaythrough(client, {
    id: 'old', title: 'Alice run', path: 'alice/old/timeline.json',
    ext: { pmpDshTavern: { characterId: 'alice', rootSessionId: 'session-old' } },
  }, file, { now: () => new Date('2026-08-20T00:00:00Z'), randomUUID: () => 'fixed' })
  assert.equal(result.sessionId, 'session-new')
  assert.equal(result.playthrough.title, '1周目')
  assert.equal(result.playthrough.ext.pmpDshTavern.playthroughNumber, 1)
  assert.deepEqual(calls.map(call => call[0]), ['dirs', 'context', 'session', 'timeline', 'catalog'])
  assert.deepEqual(calls[2], ['session', 'session-old', { path: 'alice/playthrough-fixed/import-context.json' }])
  assert.deepEqual(calls[3][2].nodes, [])
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
