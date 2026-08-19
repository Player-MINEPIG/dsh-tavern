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
  const client = {
    async createDirs(path) { calls.push(['dirs', path]) },
    async putFile(path, content) { calls.push(['context', path, JSON.parse(content)]) },
    async postSession(source, ref) { calls.push(['session', source, ref]); return { sessionId: 'session-new' } },
    async getCatalog() { return { playthroughs: [] } },
    async putTimeline(playthrough, timeline) { calls.push(['timeline', playthrough.path, timeline]) },
    async putCatalog(catalog) { calls.push(['catalog', catalog]) },
  }
  const file = { name: 'old.jsonl', async text() {
    return [JSON.stringify({}), JSON.stringify({ is_user: true, mes: 'Q' }), JSON.stringify({ is_user: false, mes: 'A' })].join('\n')
  } }
  const result = await importPlaythrough(client, {
    id: 'old', title: 'Alice run', path: 'alice/old/timeline.json',
    ext: { pmpDshTavern: { characterId: 'alice', rootSessionId: 'session-old' } },
  }, file, { now: () => new Date('2026-08-20T00:00:00Z'), randomUUID: () => 'fixed' })
  assert.equal(result.sessionId, 'session-new')
  assert.deepEqual(calls.map(call => call[0]), ['dirs', 'context', 'session', 'timeline', 'catalog'])
  assert.deepEqual(calls[2], ['session', 'session-old', { path: 'alice/playthrough-fixed/import-context.json' }])
  assert.deepEqual(calls[3][2].nodes, [])
})
