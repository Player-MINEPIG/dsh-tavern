import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadPlaythroughExport,
  playthroughExportDocument,
} from '../packages/client/src/play/export.js'

test('three exports honor display state without changing raw ST or bundle data', async () => {
  const playthrough = {
    id: 'pt-a',
    title: '<Alice run>',
    path: 'a/pt-a/timeline.json',
    ext: { pmpDshTavern: { rootSessionId: 'session-a' } },
  }
  const timeline = { nodes: [
    {
      id: 'qa-1', kind: 'qa', hidden: false, displayOverride: 'Displayed <reply>', adoptedVariantId: 'v-1',
      variants: [{ id: 'v-1', sessionId: 'session-a', startEventId: 1, endEventId: 2 }],
    },
    {
      id: 'qa-2', kind: 'qa', hidden: true, displayOverride: null, adoptedVariantId: 'v-2',
      variants: [{ id: 'v-2', sessionId: 'session-a', startEventId: 3, endEventId: 4 }],
    },
  ] }
  const messages = { incompleteTurn: false, messages: [
    { id: 'u1', role: 'user', seq: 1, content: [], text: 'Hello' },
    { id: 'a1', role: 'assistant', seq: 2, content: [], text: 'Original reply' },
    { id: 'u2', role: 'user', seq: 3, content: [], text: 'Hidden user' },
    { id: 'a2', role: 'assistant', seq: 4, content: [], text: 'Hidden reply' },
  ] }
  const client = {
    async getTimeline() { return timeline },
    async getMessages() { return messages },
    async getCharacterSelection() {
      return { selection: { characterCardId: 'character-a', character: { greetingIndex: 1 } } }
    },
    async getCharacter() {
      return { character: { id: 'character-a', name: 'Alice card', data: { name: 'Alice', nickname: 'Ally', firstMessage: 'Hi', alternateGreetings: ['Alt {{user}} from {{char}}'] } } }
    },
    async getActive() { return { selection: {}, resources: { user: { name: 'Reader' } } } },
    async getFile() { return { content: JSON.stringify({ schemaVersion: 1, rules: [{
      id: 'erase-greeting', name: 'Output protocol', enabled: true, find: '/^Alt.*$/s', replace: '',
      target: 'assistant', scope: { kind: 'global', resourceId: null },
    }] }) } },
  }
  const snapshot = await loadPlaythroughExport(client, playthrough)
  const html = playthroughExportDocument(snapshot, 'html').content
  assert.match(html, /Alt Reader from Ally/)
  assert.match(html, /Displayed &lt;reply&gt;/)
  assert.doesNotMatch(html, /Original reply|Hidden reply|<script/i)

  const st = playthroughExportDocument(snapshot, 'st').content
  assert.ok(st.includes('Alt {{user}} from {{char}}'))
  assert.match(st, /Original reply/)
  assert.doesNotMatch(st, /Displayed|Hidden reply/)

  const bundle = JSON.parse(playthroughExportDocument(snapshot, 'bundle').content)
  assert.equal(bundle.kind, 'pmp-dsh-tavern-playthrough')
  assert.equal(bundle.timeline.nodes[1].hidden, true)
  assert.equal(bundle.messagesBySession['session-a'].messages[3].text, 'Hidden reply')
})

test('exports retain imported read-only history before later DSH timeline turns', async () => {
  const playthrough = {
    id: 'pt-imported', title: '2周目', path: 'a/pt/timeline.json',
    ext: { pmpDshTavern: { rootSessionId: 'session-a', importContextPath: 'a/pt/import-context.json' } },
  }
  const timeline = { nodes: [{
    id: 'qa-live', kind: 'qa', hidden: false, displayOverride: null, adoptedVariantId: 'v-live',
    variants: [{ id: 'v-live', sessionId: 'session-a', startEventId: 1, endEventId: 2 }],
  }] }
  const client = {
    async getTimeline() { return timeline },
    async getFile(path) {
      if (path === 'a/pt/import-context.json') {
        return { content: JSON.stringify({ schemaVersion: 1, greeting: 'Imported hello', qa: [{ user: 'Old Q', assistant: 'Old A' }] }) }
      }
      const error = new Error('missing')
      error.code = 'PLAY_FILE_NOT_FOUND'
      throw error
    },
    async getMessages() { return { incompleteTurn: false, messages: [
      { role: 'user', seq: 1, text: 'New Q' },
      { role: 'assistant', seq: 2, text: 'New A' },
    ] } },
    async getCharacterSelection() { return { selection: null } },
  }
  const snapshot = await loadPlaythroughExport(client, playthrough)
  assert.equal(snapshot.greeting, 'Imported hello')
  assert.deepEqual(snapshot.turns.map(turn => [turn.userText, turn.originalAssistantText]), [
    ['Old Q', 'Old A'],
    ['New Q', 'New A'],
  ])
  const st = playthroughExportDocument(snapshot, 'st').content
  assert.match(st, /Imported hello/)
  assert.match(st, /Old Q/)
  assert.match(st, /New A/)
  const bundle = JSON.parse(playthroughExportDocument(snapshot, 'bundle').content)
  assert.equal(bundle.resources.importContext.qa[0].assistant, 'Old A')
})
