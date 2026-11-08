import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { parseHTML } from 'linkedom'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { PersonalityEvolution } from '../packages/personality/src/evolution.js'
import { PersonalityMood } from '../packages/personality/src/mood.js'
import { PersonalityMoodReply } from '../packages/personality/src/mood-reply.js'
import { moodApi, isMoodApiPath } from '../packages/personality/src/mood-http.js'
import { PersonalityPanel, usePersonalitySelection } from '../packages/client/src/personality-panel.js'
import { PersonalityStore } from '../packages/personality/src/store.js'
import { createPersonalityApiHandler } from '../packages/personality/src/server.js'
import { getClientUiSettings, setClientUiSettings } from '../packages/client/src/i18n.js'
import { DEFAULT_EVOLUTION_INSTRUCTIONS } from '../packages/personality/src/evolution-prompt.js'

test('native panel imports, explicitly applies and edits a card without affecting other sessions', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'personality-panel-'))
  const store = new PersonalityStore(directory)
  const evolution = new PersonalityEvolution(directory, store)
  const moods = new PersonalityMood(directory)
  const replies = new PersonalityMoodReply(directory)
  const sessions = new Map(['A', 'B'].map(id => [id, { id, header: { id, createdAt: 1 }, snapshotEvents: () => [] }]))
  const mood = moodApi(store, moods, () => {}, { replies, sessionFor: id => sessions.get(id) })
  const api = createPersonalityApiHandler(store, { evolution })
  const original = { spec: 'chara_card_v2', spec_version: '2.0', data: {
    name: 'Glass', personality: 'Direct', extensions: { imported: true },
  } }
  const previous = Object.fromEntries(['window','document','Event','fetch','getComputedStyle','IS_REACT_ACT_ENVIRONMENT'].map(key => [key, globalThis[key]]))
  const settings = getClientUiSettings()
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>')
  Object.assign(globalThis, { window, document, Event: window.Event, getComputedStyle: () => ({ display: 'block' }), IS_REACT_ACT_ENVIRONMENT: true })
  globalThis.fetch = async (url, options = {}) => {
    assert.ok(!url.includes('/character-selection'))
    const bytes = options.body instanceof Blob ? Buffer.from(await options.body.arrayBuffer()) : options.body ? Buffer.from(options.body) : null
    const req = Readable.from(bytes ? [bytes] : [])
    Object.assign(req, { method: options.method ?? 'GET', url })
    let result
    await (isMoodApiPath(url) ? mood : api)(req, { setHeader() {}, end(data) { result = new Response(data, { status: this.statusCode }) } })
    return result
  }
  setClientUiSettings({ locale: 'en' }, { announce: false })
  const loadModels = async () => ({ ok: true, value: { groups: [{ id: 'offline-judge', name: 'Offline judge', models: [{ id: 'review', name: 'Review' }] }], failures: [] } })
  function View({ sessionId }) {
    const selection = usePersonalitySelection(sessionId, true)
    return h(PersonalityPanel, { key: sessionId, sessionId, selection, loadModels, close() {} })
  }
  const root = createRoot(document.getElementById('root'))
  t.after(async () => {
    await act(() => root.unmount())
    setClientUiSettings(settings, { announce: false })
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value
    }
    rmSync(directory, { recursive: true, force: true })
  })
  const button = label => [...document.querySelectorAll('button')].find(item => item.textContent === label)
  const perform = async fn => act(async () => { fn(); await new Promise(resolve => setImmediate(resolve)) })
  const render = id => perform(() => root.render(h(View, { sessionId: id })))
  await render('A')
  const file = new File([JSON.stringify(original)], 'glass.json', {type: 'application/json'})
  await perform(() => Simulate.change(document.querySelector('input[type=file]'), { target: { files: [file], value: '' } }))
  const card = store.list()[0]
  assert.equal(card.name, 'Glass')
  assert.equal(store.selectedCharacter('A'), null)
  await perform(() => Simulate.click(button('Use in this session')))
  assert.equal(store.selectedCharacter('A').character.id, card.id)
  const personalityField = [...document.querySelectorAll('label')].find(label => label.querySelector('span')?.textContent === 'Personality').querySelector('textarea')
  await perform(() => Simulate.change(personalityField, { target: { value: 'Measured' } }))
  assert.equal(button('Save changes').disabled, false)
  await perform(() => Simulate.click(button('Save changes')))
  const exported = JSON.parse(store.json(card.id).text)
  assert.equal(exported.data.personality, 'Measured')
  assert.deepEqual(exported.data.extensions, original.data.extensions)
  await perform(() => Simulate.click(button('Mood')))
  const moodInput = document.querySelector('input.dcc-input')
  const reasonInput = document.querySelector('textarea.dcc-textarea')
  await perform(() => Simulate.change(moodInput, { target: { value: 'wary' } }))
  await perform(() => Simulate.change(reasonInput, { target: { value: 'A concrete concern' } }))
  await perform(() => Simulate.click(button('Save mood')))
  assert.equal(moods.read(card.id, 'A').mood.feeling, 'wary')
  assert.equal(moods.read(card.id, 'A').automatic, false)
  await perform(() => Simulate.click(button('Skip mood for the next reply')))
  assert.equal(replies.view(sessions.get('A'), card.id).status, 'pending')
  assert.ok(document.body.textContent.includes('You can cancel before it starts'))
  assert.equal(moods.read(card.id, 'A').mood.feeling, 'wary')
  assert.equal(moods.read(card.id, 'A').automatic, false)
  await perform(() => Simulate.click(button('Cancel skipping mood')))
  assert.equal(replies.view(sessions.get('A'), card.id).status, 'idle')
  const origin = { kind: 'original', sessionId: 'A', sessionCreatedAt: 1, startSeq: 3, endSeq: 8 }
  evolution.enqueue(card.id, origin)
  evolution.finish(card.id, 0, evolution.batch(card.id, origin, { urgent: true }), origin, { before: 'Explain everything', after: 'Prioritize evidence', behavior: 'Name uncertainty', boundary: 'In reviews', reason: 'Unverified conclusion' }, { partial: true })
  await perform(() => Simulate.click(button('Growth')))
  assert.ok(document.body.textContent.includes('Prioritize evidence'))
  assert.ok(document.body.textContent.includes('events 3–8'))
  await perform(() => Simulate.click(button('View evidence')))
  assert.ok(document.body.textContent.includes('The original session is unavailable'))
  await perform(() => Simulate.click(button('Restore original personality')))
  assert.equal(evolution.current(card.id), null)
  const interval = [...document.querySelectorAll('label')].find(label => label.textContent.includes('Completed turns per assessment')).querySelector('select')
  await perform(() => Simulate.change(interval, { target: { value: '4' } }))
  assert.equal(evolution.view(card.id).config.assessmentInterval, 4)
  const judge = [...document.querySelectorAll('label')].find(label => label.textContent.includes('Growth judging model')).querySelector('select')
  assert.ok(judge.textContent.includes('Offline judge · Review'))
  await perform(() => Simulate.change(judge, { target: { value: JSON.stringify({ provider: 'offline-judge', model: 'review' }) } }))
  assert.deepEqual(evolution.view(card.id).config.assessmentModel, { provider: 'offline-judge', model: 'review' })
  const criteria = [...document.querySelectorAll('label')].find(label => label.textContent.includes('Growth judging criteria')).querySelector('textarea')
  assert.equal(criteria.value, DEFAULT_EVOLUTION_INSTRUCTIONS)
  await perform(() => Simulate.change(criteria, { target: { value: 'Consider only testable changes.' } }))
  await perform(() => Simulate.click(button('Save judging criteria')))
  assert.equal(evolution.view(card.id).config.assessmentInstructions, 'Consider only testable changes.')
  assert.ok(document.querySelector('details pre').textContent.startsWith('Consider only testable changes.'))
  await perform(() => Simulate.click(button('Restore default criteria')))
  assert.equal(evolution.view(card.id).config.assessmentInstructions, '')
  assert.equal(criteria.value, DEFAULT_EVOLUTION_INSTRUCTIONS)
  await perform(() => Simulate.change(judge, { target: { value: '' } }))
  assert.equal(evolution.view(card.id).config.assessmentModel, null)
  const refresh = [...document.querySelectorAll('label')].find(label => label.textContent.includes('Apply accepted revisions')).querySelector('select')
  await perform(() => Simulate.change(refresh, { target: { value: 'session-compaction' } }))
  assert.equal(evolution.view(card.id).config.refreshMode, 'session-compaction')
  assert.equal(evolution.view(card.id).config.assessmentInterval, 4)
  await render('B')
  assert.equal(button('Turn off for this session').disabled, true)
  assert.equal(store.selectedCharacter('A').character.id, card.id)
  await render('A')
  await perform(() => Simulate.click(button('Turn off for this session')))
  assert.equal(store.selectedCharacter('A'), null)
})
