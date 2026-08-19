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
      return { character: { id: 'character-a', name: 'Alice card', data: { name: 'Alice', firstMessage: 'Hi', alternateGreetings: ['Alt hello'] } } }
    },
  }
  const snapshot = await loadPlaythroughExport(client, playthrough)
  const html = playthroughExportDocument(snapshot, 'html').content
  assert.match(html, /Displayed &lt;reply&gt;/)
  assert.doesNotMatch(html, /Original reply|Hidden reply|<script/i)

  const st = playthroughExportDocument(snapshot, 'st').content
  assert.match(st, /Alt hello/)
  assert.match(st, /Original reply/)
  assert.doesNotMatch(st, /Displayed|Hidden reply/)

  const bundle = JSON.parse(playthroughExportDocument(snapshot, 'bundle').content)
  assert.equal(bundle.kind, 'pmp-dsh-tavern-playthrough')
  assert.equal(bundle.timeline.nodes[1].hidden, true)
  assert.equal(bundle.messagesBySession['session-a'].messages[3].text, 'Hidden reply')
})
