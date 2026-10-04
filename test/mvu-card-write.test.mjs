import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MvuService } from '../packages/mvu-adapter/src/index.js'

async function fixture(t) {
  const storageDir = mkdtempSync(join(tmpdir(), 'mvu-card-')); t.after(() => rmSync(storageDir, { recursive: true, force: true }))
  const scope = { playthroughId: 'p', sessionId: 's', nodeId: 'n', variantId: 'v', endEventId: 1, sessionFormatVersion: 4 }
  const text = "_.add('hp',-1);", fingerprint = createHash('sha256').update(JSON.stringify(text)).digest('hex')
  let granted = false, active = true
  const sourceIdentity = { version: 1, sha256: 'a'.repeat(64), scope }
  const service = new MvuService({ storageDir, resources: [{ sharing: 'shared', id: 'mvu:card', sessionIds: ['s'], initial: { stat_data: { hp: 10 } }, schemaSource: 'const Schema=z.object({hp:z.number().min(0)});' }],
    resolveScope: async input => { assert.deepEqual(input, scope); return { writableHead: active, messageId: 'reply', fingerprint } },
    authorizeCardWrite: async ({ grantId, sourceIdentity: identity }) => granted && grantId === 'grant' && JSON.stringify(identity) === JSON.stringify(sourceIdentity) ? { valid: true, write: true, scope, checkCurrent: () => granted } : null })
  const events = [{ seq: 0, type: 'turn/start', data: { turn: 1 } }, { seq: 1, type: 'assistant/message', data: { turn: 1, message: { id: 'reply', content: [{ type: 'text', text }] } } }, { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }]
  await service.ingest({ id: 's', header: { id: 's', version: 4 }, inheritedEventCount: 0, snapshotEvents: () => events })
  const facts = []; service.observe(f => facts.push(f))
  service.inspect = async () => ({ header: { id: 's', version: 4 }, events })
  return { service, scope, sourceIdentity, facts, grant: () => { granted = true }, revoke: () => { granted = false }, leave: () => { active = false }, bind: () => service.createCardBinding({ scope, grantId: 'grant', sourceIdentity }) }
}
test('downloaded enabled card writes retain binding/CAS/idempotency without a manager permission gate', async t => {
  const f = await fixture(t), { service, scope } = f
  await assert.rejects(f.bind(), { code: 'MVU_WRITE_DENIED' })
  f.grant(); const { capability } = await f.bind()
  await service.setManagementMode({ id: 'mvu:card', mode: 'managed', scope: { sessionId: 's' }, expectedRevision: 1, operationId: 'manage' })
  const request = { capability, operation: 'patch', value: [{ op: 'delta', path: '/hp', value: -2 }], expectedRevision: 2, operationId: 'click', cause: 'user-interaction' }
  let policyCalls=0
  const stop=service.registerUsage(()=>{policyCalls++;return {enabled:false,reason:'config-unavailable'}})
  const result = await service.cardWrite(request)
  assert.equal(result.variables.stat_data.hp, 7); assert.equal(result.revision, 3)
  assert.deepEqual(await service.cardWrite(request), result)
  assert.equal(f.facts.filter(e => e.phase === 'applied').length, 1)
  assert.equal((await service.snapshot(scope)).variables.stat_data.hp, 7)
  await assert.rejects(service.cardWrite({ ...request, operationId: 'stale' }), { code: 'REVISION_CONFLICT' })
  await assert.rejects(service.cardWrite({ ...request, value: [], expectedRevision: 3 }), { code: 'MVU_IDEMPOTENCY_CONFLICT' })
  assert.equal(policyCalls,0);stop()
  const continued=await service.cardWrite({ ...request,operationId:'removed',expectedRevision:3 });assert.equal(continued.variables.stat_data.hp,5)
  assert.ok(f.facts.filter(e=>e.phase==='applied').every(e=>e.configRevision===null))
  f.revoke(); await assert.rejects(service.cardWrite(request), { code: 'MVU_WRITE_DENIED' })
})
test('replace preserves source schema and historical or revoked bindings cannot write', async t => {
  const f = await fixture(t); f.grant(); f.service.registerUsage(() => ({ enabled: true, checkCurrent: () => true })); const { capability } = await f.bind()
  const request = { capability, operation: 'replace', value: { stat_data: { hp: -1 } }, expectedRevision: 1, operationId: 'replace', cause: 'script' }
  await assert.rejects(f.service.cardWrite(request), { code: 'MVU_SCHEMA' })
  const result = await f.service.cardWrite({ ...request, value: { stat_data: { hp: 4 } } })
  assert.equal(result.variables.stat_data.hp, 4); assert.ok(result.variables.mvu_schema)
  f.leave(); await assert.rejects(f.service.cardWrite({ ...request, operationId: 'old', expectedRevision: 2 }), { code: 'MVU_READ_ONLY' })
  f.service.revokeCardBinding(capability)
  await assert.rejects(f.service.cardWrite(request), { code: 'MVU_WRITE_DENIED' })
})
test('card cancellation and disabling while scope resolution awaits leave no candidate commit', async t => {
  for (const revoke of [false, true]) {
    const f = await fixture(t); f.grant(); f.service.registerUsage(() => ({ enabled: true, checkCurrent: () => true })); const { capability } = await f.bind()
    let release, entered
    const ready = new Promise(resolve => { entered = resolve })
    const resolve=f.service.resolveScope
    f.service.resolveScope=async scope=>{const evidence=await resolve(scope);entered();await new Promise(done=>{release=done});return evidence}
    const controller = new AbortController()
    const writing = f.service.cardWrite({ capability, operation: 'patch', value: [{ op: 'delta', path: '/hp', value: -3 }], expectedRevision: 1, operationId: 'pending', cause: 'interval', signal: controller.signal })
    await ready; if (revoke) f.revoke(); else controller.abort(); release()
    await assert.rejects(writing)
    assert.equal((await f.service.read({ id: 'mvu:card', scope: { sessionId: 's' } })).content.stat_data.hp, 9)
    assert.ok(!f.facts.some(e => e.phase === 'applied'))
  }
})

test('write authority revocation during the final scope await is checked synchronously before persistence', async t => {
  const f = await fixture(t); f.grant(); f.service.registerUsage(() => ({ enabled: true, checkCurrent: () => true })); const { capability } = await f.bind()
  const resolve = f.service.resolveScope; let calls = 0
  f.service.resolveScope = async scope => { const evidence = await resolve(scope); if (++calls === 2) f.revoke(); return evidence }
  await assert.rejects(f.service.cardWrite({ capability, operation: 'patch', value: [{ op: 'delta', path: '/hp', value: -2 }], expectedRevision: 1, operationId: 'revoked-final', cause: 'interval' }), { code: 'MVU_WRITE_DENIED' })
  assert.equal((await f.service.read({ id: 'mvu:card', scope: { sessionId: 's' } })).content.stat_data.hp, 9)
  assert.ok(!f.facts.some(e => e.phase === 'applied'))
})
test('failed final binding reads do not allocate unreachable capabilities', async t => {
  const f = await fixture(t); f.grant(); const resolve = f.service.resolveScope; let calls = 0
  f.service.resolveScope = async scope => { if (++calls % 2 === 0) throw new Error('transient'); return resolve(scope) }
  for (let i = 0; i < 513; i++) await assert.rejects(f.bind(), /transient/)
  f.service.resolveScope = resolve
  assert.ok((await f.bind()).capability)
})

test('current enabled card execution does not expire after thirty minutes',async t=>{
 const f=await fixture(t);f.grant();const {capability}=await f.bind(),now=Date.now()
 t.mock.method(Date,'now',()=>now+2*60*60*1000)
 const result=await f.service.cardWrite({capability,operation:'patch',value:[{op:'delta',path:'/hp',value:1}],expectedRevision:1,operationId:'after-two-hours',cause:'interval'})
 assert.equal(result.variables.stat_data.hp,10);assert.equal(result.revision,2)
})

test('same native binding identity replays concurrently without consuming capability slots',async t=>{
 const f=await fixture(t);f.grant();const bindingId=crypto.randomUUID(),request={scope:f.scope,grantId:'grant',sourceIdentity:f.sourceIdentity,bindingId}
 const results=await Promise.all(Array.from({length:20},()=>f.service.createCardBinding(request)))
 assert.ok(results.every(result=>result.capability===bindingId))
 for(let i=0;i<513;i++)assert.equal((await f.service.createCardBinding(request)).capability,bindingId)
 const changed={...request,sourceIdentity:{...request.sourceIdentity,sha256:'b'.repeat(64)}}
 await assert.rejects(f.service.createCardBinding(changed),{code:'MVU_IDEMPOTENCY_CONFLICT'})
 const written=await f.service.cardWrite({capability:bindingId,operation:'patch',value:[{op:'delta',path:'/hp',value:1}],expectedRevision:1,operationId:'unchanged-transaction',cause:'script'})
 assert.equal(written.revision,2)
})
test('revoking known creation identity during final await cannot resurrect a binding',async t=>{
 const f=await fixture(t);f.grant();const bindingId=crypto.randomUUID(),snapshot=f.service.snapshot.bind(f.service)
 let enter,release;const ready=new Promise(resolve=>{enter=resolve})
 f.service.snapshot=async scope=>{const result=await snapshot(scope);enter();await new Promise(resolve=>{release=resolve});return result}
 const binding=f.service.createCardBinding({scope:f.scope,grantId:'grant',sourceIdentity:f.sourceIdentity,bindingId})
 await ready;f.service.revokeCardBinding(bindingId);release();await assert.rejects(binding,{code:'MVU_WRITE_DENIED'})
 await assert.rejects(f.service.cardWrite({capability:bindingId,operation:'patch',value:[],expectedRevision:1,operationId:'revoked',cause:'script'}),{code:'MVU_WRITE_DENIED'})
 f.service.snapshot=snapshot;assert.ok((await f.bind()).capability)
})
