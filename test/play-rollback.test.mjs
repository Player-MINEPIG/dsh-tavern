import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { PlayWorkspaceStore } from '../packages/play/src/workspace.js'
import { createRollbackService, readRollback } from '../packages/play/src/rollback.js'
import { timelineWithHead, timelineHeadForVariant } from '../packages/play/src/timeline-tree.js'
import { createContractOperation } from '../packages/play/src/operation-contract.js'

const deferred = () => Promise.withResolvers()
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rollback-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const root = join(dir, 'rp'); mkdirSync(root)
  const storage = join(dir, 'storage')
  const store = new PlayWorkspaceStore(storage)
  await store.bindRoot(root)
  const path = 'run/timeline.json'
  const fresh = { expectedRevision: null, expectedRevisionPresent: true }
  const catalog = { playthroughs: [{ id: 'run', path }] }
  store.writeFile('catalog.json', JSON.stringify(catalog), fresh)
  const variant = (id, sessionId, start, end) => ({ id, sessionId, startEventId: start, endEventId: end, ext: { pmpDshTavern: { sessionFormatVersion: 4 } } })
  const timeline = { nodes: [
    { id: 'q', kind: 'qa', parentVariantId: null, adoptedVariantId: 'v', variants: [variant('v','parent',0,1),variant('alt','other',0,1)] },
    { id: 'old', kind: 'qa', parentVariantId: 'v', adoptedVariantId: 'w', variants: [variant('w','parent',5,6)] },
  ], head: { sessionId: 'parent', nodeId: 'old', variantId: 'w' } }
  const initial = store.writeFile(path, JSON.stringify(timeline), fresh)
  const req = { nodeId: 'q', expectedRevision: initial.revision, expectedWorkspaceScope: JSON.stringify([store.get().workspaceId,root]) }
  const events = [
    {seq:0,type:'user/message',data:{role:'user',id:'user'}},
    {seq:1,type:'assistant/message',data:{message:{role:'assistant',id:'reply'}}},
  ]
  let forks = 0
  const host = {
    coordinates: async () => ({sessionFormatVersion:4}),
    async forkSession(_args,{operation}) {
      forks++
      operation.checkpoint('session.created',{sessionId:'child'})
      return {sessionId:'child'}
    },
    inspectSession: async () => ({ meta:{ id:'child', version:4 }, inheritedEventCount:2, events }),
  }
  const operation = () => createContractOperation({ operation:'playthrough.rollback', meta:{playthroughId:'run'} })
  const service = createRollbackService(store,host)
  return {dir,storage,store,host,service,path,initial,req,timeline,operation,forks:()=>forks,run:()=>service.run('run',req,operation())}
}

test('Host reserves the timeline across the fork and remembers a rollback child before its first QA', async t => {
  const f = await fixture(t), paused = deferred(), release = deferred()
  f.host.copySelection = async () => { paused.resolve(); await release.promise }
  const task = f.run(); await paused.promise
  assert.equal(readRollback(f.store,'run').child,'child')
  const write = {expectedRevision:f.initial.revision,expectedRevisionPresent:true}
  assert.throws(()=>f.store.writeFile(f.path,JSON.stringify(f.timeline),write),{code:'PLAY_ROLLBACK_BUSY'})
  await assert.rejects(f.run(),{code:'PLAY_ROLLBACK_BUSY'})
  release.resolve()
  const result = await task
  assert.equal(readRollback(f.store,'run').stage,'done')
  const switched = timelineWithHead(result.timeline,{nodeId:'q',variantId:'alt',sessionId:'other'})
  assert.deepEqual(timelineHeadForVariant(switched,'v'),{nodeId:'q',variantId:'v',sessionId:'child'})
  assert.equal((await f.run()).sessionId,'child') // Lost response, same revision.
  assert.equal(f.forks(),1)
})

test('a failed head write resumes after Host restart without a second fork', async t => {
  const f=await fixture(t)
  f.store.beforeRename=()=>{throw new Error('simulated disk failure')}
  await assert.rejects(f.run(),/disk failure/)
  assert.equal(readRollback(f.store,'run').stage,'ready')
  assert.deepEqual(JSON.parse(f.store.readFile(f.path).content),f.timeline)
  const reopened=new PlayWorkspaceStore(f.storage)
  const next=await createRollbackService(reopened,f.host).run('run',f.req,f.operation())
  assert.equal(next.timeline.head.sessionId,'child')
  assert.equal(f.forks(),1)
})

test('uncertain native fork is reported and cannot be repeated or dismissed using a different operation ID', async t=>{
  const f=await fixture(t)
  f.host.forkSession=async()=>{throw new Error('transport lost')}
  await assert.rejects(f.run(),/transport lost/)
  const pending=readRollback(f.store,'run')
  assert.equal(pending.stage,'starting')
  await assert.rejects(f.run(),{code:'PLAY_ROLLBACK_PENDING'})
  assert.throws(()=>f.service.dismiss('run','wrong-id'),{code:'PLAY_ROLLBACK_PENDING'})
  f.service.dismiss('run',pending.operationId)
  assert.equal(readRollback(f.store,'run').stage,'dismissed')
})

test('a stalled fork returns a pending result and a late child cannot overwrite a newer timeline', async t=>{
  const f=await fixture(t), started=deferred(), release=deferred()
  f.host.forkSession=async()=>{started.resolve();return release.promise}
  const service=createRollbackService(f.store,f.host,{waitMs:25})
  const task=service.run('run',f.req,f.operation())
  await started.promise
  const keepAlive=setInterval(()=>{},100)
  try { await assert.rejects(task,{code:'PLAY_ROLLBACK_PENDING'}) } finally { clearInterval(keepAlive) }
  f.store.writeFile(f.path,JSON.stringify({...f.timeline,ext:{note:'newer'}}),{expectedRevision:f.initial.revision,expectedRevisionPresent:true})
  release.resolve({sessionId:'late'})
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(readRollback(f.store,'run').child,'late')
  assert.equal(JSON.parse(f.store.readFile(f.path).content).head.sessionId,'parent')
  await assert.rejects(service.run('run',f.req,f.operation()),{code:'PLAY_FILE_REVISION_CONFLICT'})
})

test('concurrent catalog changes are scoped and a stale visible reply cannot create a child', async t=>{
  const f=await fixture(t)
  await assert.rejects(f.service.run('run',{...f.req,variantId:'alt'},f.operation()),{code:'PLAY_FILE_REVISION_CONFLICT'})
  assert.equal(f.forks(),0)
  const entered=deferred(), release=deferred()
  f.host.copySelection=async()=>{entered.resolve(); await release.promise}
  const running=f.run(); await entered.promise
  const cat=f.store.readFile('catalog.json')
  const write={expectedRevision:cat.revision,expectedRevisionPresent:true}
  assert.throws(()=>f.store.writeFile('catalog.json','{"playthroughs":[]}',write),{code:'PLAY_ROLLBACK_BUSY'})
  const catalog=JSON.parse(cat.content)
  catalog.playthroughs.push({id:'other',path:'other/timeline.json'})
  f.store.writeFile('catalog.json',JSON.stringify(catalog),write)
  release.resolve()
  assert.equal((await running).timeline.head.sessionId,'child')
})

test('recovery retries the failed lineage copy without repeating selection or creating another child', async t => {
  const { host, store, run, forks } = await fixture(t)
  const calls = []
  host.copySelection = async () => { calls.push('selection') }
  host.copyImportContextLineage = async () => {
    calls.push('lineage')
    throw new Error('interrupted lineage copy')
  }
  await assert.rejects(run(), { code: 'PLAY_BRANCH_COPY_FAILED' })
  assert.equal(readRollback(store, 'run').stage, 'selection-copied')
  host.copyImportContextLineage = async () => { calls.push('lineage') }
  assert.equal((await run()).timeline.head.sessionId, 'child')
  assert.deepEqual(calls, ['selection', 'lineage', 'lineage'])
  assert.equal(forks(), 1)
})
