import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PlayMembershipService } from '../packages/play/src/membership.js'
import { PlayWorkspaceStore } from '../packages/play/src/workspace.js'

const path = 'card/p/timeline.json'
const root = 'root-session'
const known = 'pmpDshTavern'

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'play-detach-recovery-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const storage = join(directory, 'host'), workspace = join(directory, 'rp')
  mkdirSync(workspace)
  const store = new PlayWorkspaceStore(storage)
  await store.bindRoot(workspace)
  const service = new PlayMembershipService(store)
  const put = (path, document, revision = null) => store.writeFile(path, JSON.stringify(document), {
    expectedRevision: revision, expectedRevisionPresent: true,
  })
  const row = { id: 'p', path, title: 'PRIVATE-TITLE', ext: { [known]: { rootSessionId: root } } }
  put('catalog.json', { playthroughs: [row, { id: 'q', path: 'card/q/timeline.json' }] })
  put(path, { nodes: [
    { id: 'a', kind: 'qa', adoptedVariantId: 'x', variants: [{ id: 'x', sessionId: root, startEventId: 1, endEventId: 2 }] },
    { id: 'b', kind: 'qa', adoptedVariantId: 'y', variants: [{ id: 'y', sessionId: 'child', startEventId: 3, endEventId: 4 }] },
  ], ext: { opaque: 'PRIVATE-STORY' } })
  function interrupt(target, afterWrite = false) {
    const write = store.writeFile.bind(store)
    store.writeFile = (documentPath, ...args) => {
      if (documentPath !== target) return write(documentPath, ...args)
      store.writeFile = write
      if (afterWrite) write(documentPath, ...args)
      throw Object.assign(new Error('Host interrupted'), { code: 'TEST_CRASH' })
    }
    assert.throws(() => service.detach('p', root), { code: 'TEST_CRASH' })
  }
  function edit(path, update) {
    const file = store.readFile(path)
    put(path, update(JSON.parse(file.content)), file.revision)
  }
  const restart = () => new PlayMembershipService(new PlayWorkspaceStore(storage))
  return { store, row, storage, interrupt, edit, restart, service }
}

for (const [target, afterWrite, expectedWrites, stage] of [
  [path, false, [path, 'catalog.json'], 'prepared'],
  [path, true, ['catalog.json'], 'prepared'],
  ['catalog.json', false, ['catalog.json'], 'timeline-verified'],
  ['catalog.json', true, [], 'timeline-verified'],
]) {
  test(`repair after interruption ${afterWrite ? 'after' : 'before'} ${target} writes only missing changes`, async t => {
    const f = await fixture(t)
    f.interrupt(target, afterWrite)
    const pendingDir = join(f.storage, 'playthrough-detaches')
    const [filename] = readdirSync(pendingDir)
    assert.doesNotMatch(readFileSync(join(pendingDir, filename), 'utf8'), /PRIVATE-/)
    const service = f.restart()
    const writes = []
    const beforeWrite = (file, path) => {
      assert.equal(file.path, path)
      assert.equal(service.workspaceStore.readFile(path).revision, file.revision)
      writes.push(path)
    }
    const preview = service.repairDetach(f.row, { apply: false, beforeWrite })
    assert.equal(preview.remaining[0].reason, 'detach-pending')
    assert.equal(preview.remaining[0].stage, stage)
    assert.equal(preview.remaining[0].sessionId, root)
    assert.deepEqual(writes, [])
    const recovered = service.repairDetach(f.row, { apply: true, beforeWrite })
    assert.deepEqual(recovered.remaining, [])
    assert.equal(recovered.changes[0].kind, 'detach-recovered')
    assert.equal(recovered.changes[0].operationId, preview.remaining[0].operationId)
    assert.deepEqual(writes, expectedWrites)
    assert.deepEqual(service.readTimeline(f.row).timeline, { nodes: [], ext: { opaque: 'PRIVATE-STORY' } })
    assert.equal(service.readCatalog().catalog.playthroughs[0].ext, undefined)
    assert.equal(service.repairDetach(f.row, { apply: true }), null)
  })
}

test('retry after Host restart preserves descendant IDs and concurrent edits to other catalog rows', async t => {
  const f = await fixture(t)
  f.interrupt('catalog.json')
  f.edit('catalog.json', catalog => { catalog.playthroughs[1].title = 'other edit'; return catalog })
  const service = f.restart()
  assert.deepEqual(service.detach('p', root), {
    ok: true, detached: true, playthroughId: 'p', sessionId: root, detachedSessionIds: [root, 'child'], empty: true,
  })
  assert.equal(service.readCatalog().catalog.playthroughs[1].title, 'other edit')
  assert.equal(service.detach('p', root).detached, false)
})

for (const target of [path, 'catalog.json']) {
  test(`new edits to ${target} survive repair and retry after the timeline write`, async t => {
    const f = await fixture(t)
    f.interrupt('catalog.json')
    f.edit(target, value => {
      if (target === path) value.ext = { story: 'new timeline' }
      else value.playthroughs[0].ext[known].rootSessionId = 'new-root'
      return value
    })
    const service = f.restart()
    const before = [path, 'catalog.json'].map(p => f.store.readFile(p).revision)
    const report = service.repairDetach(f.row, { apply: true })
    assert.equal(report.remaining[0].code, 'PLAY_FILE_REVISION_CONFLICT')
    assert.throws(() => service.detach('p', root), { code: 'PLAY_FILE_REVISION_CONFLICT' })
    assert.deepEqual([path, 'catalog.json'].map(p => f.store.readFile(p).revision), before)
  })
}

test('repair checks the paired file again after backing up the catalog', async t => {
  const f = await fixture(t)
  f.interrupt('catalog.json')
  const rev = f.store.readFile('catalog.json').revision
  const repair = f.restart().repairDetach(f.row, { apply: true, beforeWrite() {
    f.edit(path, value => ({ ...value, ext: { story: 'concurrent edit' } }))
  } })
  assert.equal(repair.remaining[0].code, 'PLAY_FILE_REVISION_CONFLICT')
  assert.equal(f.store.readFile('catalog.json').revision, rev)
})

test('cancellation during repair backup prevents the following write', async t => {
  const f = await fixture(t)
  f.interrupt(path)
  const controller = new AbortController()
  const before = [path, 'catalog.json'].map(p => f.store.readFile(p).revision)
  assert.throws(() => f.restart().repairDetach(f.row, {
    apply: true, signal: controller.signal, beforeWrite() { controller.abort() },
  }), { name: 'AbortError' })
  assert.deepEqual([path, 'catalog.json'].map(p => f.store.readFile(p).revision), before)
})

for (const target of [path, 'catalog.json']) {
  test(`detach verifies the stored bytes when a write to ${target} reports success`, async t => {
    const f = await fixture(t)
    const write = f.store.writeFile.bind(f.store)
    f.store.writeFile = (documentPath, content, options) => {
      if (documentPath === target) return { ok: true, path: target }
      return write(documentPath, content, options)
    }
    assert.throws(() => f.service.detach('p', root), { code: 'PLAY_FILE_REVISION_CONFLICT' })
    assert.equal(f.service.readCatalog().catalog.playthroughs[0].ext[known].rootSessionId, root)
    const service = f.restart()
    assert.deepEqual(service.repairDetach(f.row, { apply: true }).remaining, [])
    assert.equal(service.readCatalog().catalog.playthroughs[0].ext, undefined)
  })
}
