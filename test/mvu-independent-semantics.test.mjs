// Review-only synthetic regression fixture. No real profile, provider or UI.
// Run: node --test test/mvu-independent-semantics.test.mjs

import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const modulePath = join(root, 'packages/mvu-adapter/src/index.js')
const { MvuService } = await import(pathToFileURL(modulePath).href)
const sourcePath = join(root, 'packages/mvu-adapter/src/service.js')
const sourceHash = createHash('sha256').update(readFileSync(sourcePath)).digest('hex')
const state = hp => ({ stat_data: { hp }, schema: { type: 'object', extensible: false, properties: { hp: { type: 'number', required: true } } } })
const scopeA = { sessionId: 'A', authority: 'local' }, scopeB = { sessionId: 'B', authority: 'local' }
const results = []
async function check(name, run) {
  await test(name, run)
}
async function fixture(run, sessionIds = ['A', 'B']) {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-review-regression-'))
  const service = new MvuService({ storageDir, resources: [{ id: 'mvu:shared', sessionIds, initial: state(100) }] })
  try { await run(service) } finally { service.dispose(); rmSync(storageDir, { recursive: true, force: true }) }
}
const read = (service, scope) => service.read({ id: 'mvu:shared', scope })
const update = (service, scope, hp, expectedRevision, operationId) => service.update({ id: 'mvu:shared', scope, content: state(hp), expectedRevision, operationId })

await fixture(async service => {
  await update(service, scopeA, 80, 0, 'A-first')
  await check('same ID current content is shared across sessions', async () => assert.equal((await read(service, scopeB)).content.stat_data.hp, 80))
  await check('CAS uses the shared entity revision', async () => assert.rejects(update(service, scopeB, 60, 0, 'stale-edit'), { code: 'REVISION_CONFLICT' }))
  await update(service, scopeB, 60, 1, 'B-middle')
  await update(service, scopeA, 40, 2, 'A-latest')
  await check('latest B read sees A latest update', async () => assert.equal((await read(service, scopeB)).content.stat_data.hp, 40))
  await check('global Settings listing includes configured resource', async () => assert.equal((await service.list({ scope: {} })).length, 1))
  await check('unauthorized session cannot read a historical end', async () => assert.rejects(read(service, { sessionId: 'forbidden', endEventId: 999 }), { code: 'SCOPE_MISMATCH' }))
  await check('unauthorized session cannot read a historical message', async () => assert.rejects(read(service, { sessionId: 'forbidden', messageId: 'manual:A-first' }), { code: 'SCOPE_MISMATCH' }))
  await check('A historical scope must reject a B message coordinate', async () => assert.rejects(read(service, { ...scopeA, endEventId: 0, messageId: 'manual:B-middle' })))
  await check('historical content carries its own revision', async () => {
    const old = await read(service, { ...scopeA, messageId: 'manual:A-first' })
    assert.equal(old.content.stat_data.hp, 80)
    assert.equal(old.revision, 1)
  })
})

const event = (seq, type, data) => ({ seq, type, data })
const reply = (seq, turn, id, amount) => event(seq, 'assistant/message', { turn, step: turn, message: { id, role: 'assistant', content: [{ type: 'text', text: `_.add('hp', ${amount});` }] } })
const session = (id, events, inheritedEventCount, parentSession) => ({
  id, header: { id, version: 4, createdAt: 1000, isSeeded: Boolean(parentSession), ...(parentSession ? { parentSession } : {}) },
  inheritedEventCount, snapshotEvents: () => events,
})
await fixture(async service => {
  const rootEvents = [event(0, 'turn/start', { turn: 1 }), reply(1, 1, 'root-message', -1), event(2, 'turn/end', { turn: 1, reason: { kind: 'completed' } })]
  const childEvents = [...rootEvents, event(3, 'session/end-seed', { inherited: true }), event(4, 'turn/start', { turn: 2 }), reply(5, 2, 'child-message', -2), event(6, 'turn/end', { turn: 2, reason: { kind: 'completed' } })]
  const grandchildEvents = [...childEvents, event(7, 'session/end-seed', { inherited: true })]
  await service.ingest(session('root', rootEvents, 0))
  await service.ingest(session('child', childEvents, 3, 'root'))
  await check('first fork applies only its own reply', async () => assert.equal((await read(service, { sessionId: 'root' })).content.stat_data.hp, 97))
  await service.ingest(session('grandchild', grandchildEvents, 7, 'child'))
  await check('second fork does not reapply inherited parent update', async () => assert.equal((await read(service, { sessionId: 'root' })).content.stat_data.hp, 97))
}, ['*'])
