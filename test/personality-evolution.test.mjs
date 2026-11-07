import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { PersonalityStore } from '../packages/personality/src/store.js'
import { PersonalityEvolution } from '../packages/personality/src/evolution.js'
import { readRevisionEvidence } from '../packages/personality/src/evidence.js'
import { installEvolutionHost } from '../packages/personality/src/evolution-host.js'
import { installIndependentAssembler } from './helpers/assembler-host.mjs'

const change = { before: 'I thought a clever critique was sufficient.', after: 'I owe the author a testable alternative.',
  behavior: 'When pointing out a gap, offer a test.', boundary: 'When the user wants a review.', reason: 'My last review gave no way forward.' }
function temporary(t) {
  const path = mkdtempSync(join(tmpdir(), 'personality-evolution-'))
  t.after(() => rmSync(path,{force:true,recursive:true}))
  return path
}

test('external evidence can lose its read lease; a late assessor cannot overwrite a rollback or a reselected personality', { timeout: 10000 }, async t => {
  const directory = temporary(t), cards = new PersonalityStore(directory), card = cards.create()
  const store = new PersonalityEvolution(cards.storageDir, cards), id = card.id
  const events = [], session = { id: 'test', header: { id: 'test', createdAt: 5 }, snapshotEvents: () => events }
  const callbacks = new Map(), errors = [], disposers = []
  let allow = true, release, started
  const gate = () => new Promise(r => { started = r })
  const llm = { async *stream(options) {
    assert.equal(options.purpose,'tavern-personality-evolution')
    const prompt = JSON.parse(options.messages[0].content[0].text)
    assert.equal(prompt.evidence,'Bound external excerpt')
    if (started) await new Promise(resolve => { release = resolve; started(); started = null })
    yield { type: 'block-end', block: { type: 'text', text: JSON.stringify({change}) } }; yield {type:'finish',reason:{kind:'stop'}}
  } }
  const host = installEvolutionHost({effect: f => disposers.push(f()),provide() {},get: () => llm,on: (e, f) => callbacks.set(e,f)}, {
    cards,evolution:store,nativeLease:()=>()=>true,notify(){},report:e=>errors.push(e) })
  t.after(() => disposers.forEach(f=>f()))
  let externalText='Bound external excerpt'
  const external=async () => ({id:'external-item',version:'12',text:externalText,checkCurrent:()=>allow})
  store.sources.register({id:'test-source', resolve:external, read:external })
  store.mutate(id,'config',{expectedRevision:0, operationId:'configure', enabled:true,referenceSource:'test-source'})
  cards.select(session.id,{characterCardId:id})
  let n = 0
  function emit(type,data) { const e={type,data,seq:events.length};events.push(e);callbacks.get('session/event')(session,e) }
  function turn() {
    n++
    emit('turn/start',{turn:n});emit('user/message',{message:{source:{kind:'user'},content:[{type:'text',text:'human correction'}]}})
    emit('request/header',{header:{config:{provider:'offline',model:'test'}}})
    emit('assistant/message',{turn:n,message:{content:[{type:'text',text:'final response'}]}})
    emit('turn/end',{turn:n,reason:{kind:'completed'}})
  }
  async function run(interfere) { const ready=gate();turn();await ready;interfere?.();release();await host.idle() }
  await run(()=>{ allow=false })
  assert.equal(store.view(id).history.length,0)
  allow=true
  await run()
  const saved=store.current(id)
  assert.equal(saved.evidence.version,'12')
  assert.equal(saved.revision,2)
  assert.equal((await readRevisionEvidence(store,id,2)).text,externalText)
  externalText='Changed source body'
  assert.equal((await readRevisionEvidence(store,id,2)).available,false)
  externalText='Bound external excerpt'
  const rollback = { operationId:'rollback',expectedRevision:2,targetRevision:0 }
  await run(()=>store.mutate(id,'rollback',rollback))
  assert.equal(store.current(id),null)
  assert.equal(store.mutate(id,'rollback',rollback).revision,3)
  assert.throws(()=>store.mutate(id,'rollback',{...rollback,targetRevision:2}),{code:'EVOLUTION_CONFLICT'})
  await run(()=>{cards.select(session.id,null);cards.select(session.id,{characterCardId:id})})
  const replay = new PersonalityEvolution(cards.storageDir,cards)
  assert.equal(replay.current(id),null)
  assert.equal(replay.notice(id).kind,'rollback')
  assert.equal(replay.view(id).history.length,2)
  assert.deepEqual(errors,[])
})

const compat = process.env.DSH_TAVERN_PROMPT_COMPAT_ROOT
test('official Host evaluates a durable human reply out of band and carries the revision to a new session', { skip:!compat,timeout:30000 }, async t=>{
  const directory=temporary(t), require=createRequire(join(resolve(compat),'package.json'))
  const load=name=>import(pathToFileURL(require.resolve('@deepseek-ai/'+name)))
  const {Context}=await load('cordis'), {SystemPrompt}=await load('dsh-system-prompt'), llm=await load('dsh-llm')
  const tavern = await import('../packages/tavern-loader/src/index.js')
  const root = new Context(), foreground=[], auxiliary=[]
  try {
    for (const id of ['sessionController','workspaceController','directoryPickerController']) root.provide(id,{})
    await root.plugin(SystemPrompt,{ personaPrefix:'HOST BASE' })
    for (const suffix of ['session','agent','session-projection','llm','tools','tool-executor-native','agent-loop']) {
      const mod = await load('dsh-'+suffix)
      await root.plugin(mod.default ?? mod,suffix==='agent-loop'?{agents:[]}: {})
    }
    class Adapter extends llm.LlmAdapter {
      async *stream(request) {
        const aux=request.purpose==='tavern-personality-evolution'
        ;(aux?auxiliary:foreground).push(request)
        const text=aux?JSON.stringify({change:auxiliary.length===1?change:null}):'WORK COMPLETE'
        yield {type:'block-start',index:0,blockType:'text'}
        yield {type:'block-end',index:0,block:{type:'text',text}}
        yield {type:'finish',reason:{kind:'stop'}}
      }
    }
    root.llm.registerAdapter(['offline'],new Adapter());await installIndependentAssembler(root,directory)
    let store
    await root.plugin({name:tavern.name,inject:tavern.inject,apply(ctx){store=tavern.apply(ctx,{storageDir:directory})}})
    const card=store.personalityStore.create({name:'Test'})
    async function turn(id) {
      const {agent}=await root.agents.create({sessionId:id,agentOptions:{provider:'offline',model:'test'}})
      store.personalityStore.select(id,{characterCardId:card.id})
      agent.followup(llm.createUserMessage({content:[{type:'text',text:'Tell me what to check next.'}],source:{kind:'user'}}))
      await agent.whenIdle()
      await store.personalityEvolutionHost.idle()
      return agent.session.snapshotEvents()
    }
    const events=await turn('review-a')
    const row=store.personalityEvolution.current(card.id)
    assert.ok(row,JSON.stringify(events.map(e=>[e.type,e.data?.turn,e.data?.reason?.kind])))
    const meta=root.sessions.get('review-a').header
    assert.match((await readRevisionEvidence(store.personalityEvolution,card.id,row.revision,async()=>({meta,events}))).text,/Tell me what to check next/)
    const altered=structuredClone(events)
    altered[row.evidence.assistantSeq].data.message.content=[{type:'text',text:'altered'}]
    assert.equal((await readRevisionEvidence(store.personalityEvolution,card.id,row.revision,async()=>({meta,events:altered}))).available,false)
    assert.equal(events[row.evidence.assistantSeq].type,'assistant/message')
    assert.equal(events[row.evidence.userSeqs[0]].type,'user/message')
    assert.equal(events.filter(e=>e.type==='assistant/message').length,1)
    await turn('review-b')
    assert.equal(auxiliary.length,2);assert.equal(store.personalityEvolution.view(card.id).history.length,1)
    assert.ok(JSON.stringify(foreground.at(-1).messages).includes(change.after))
    assert.equal(store.assemblyStore.list('review-a').length,1)
  } finally {await root.fiber.dispose()}
})

function batchFixture(t, source) {
  const directory = temporary(t)
  const cards = new PersonalityStore(directory)
  const id = cards.create().id
  const events = []
  const session = { id: 'batch', header: { id: 'batch', createdAt: 15 }, snapshotEvents: () => events }
  cards.select(session.id, { characterCardId: id })
  const requests = []
  const llm = { async *stream(req) {
    requests.push(JSON.parse(req.messages[0].content[0].text))
    yield { type: 'block-end', block: { type: 'text', text: JSON.stringify({ change }) } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } }
  const boot = () => {
    const evolution = new PersonalityEvolution(cards.storageDir, cards)
    if (source) evolution.sources.register(source)
    let listener, dispose
    const host = installEvolutionHost({ effect: f => { dispose = f() }, provide() {}, get: () => llm, on: (_,f) => { listener = f } },
      { cards, evolution, nativeLease: () => () => true, notify() {}, report(error) { throw error } })
    return { evolution, host, emit(type,data) { const e = { type, data, seq: events.length }; events.push(e); listener(session,e); return e }, replay: e => listener(session,e), dispose }
  }
  const turn = async (worker,n) => {
    const start = worker.emit('turn/start',{ turn:n })
    worker.emit('request/header',{ header:{ config:{ provider:'offline', model:'test' } } })
    worker.emit('user/message',{ source:{ kind:'user' }, content:[{ type:'text', text:'Original text '+n }] })
    worker.emit('assistant/message',{ turn:n, message:{ content:[{ type:'text',text:'Reply '+n }] } })
    const end = worker.emit('turn/end',{ turn:n, reason:{ kind:'completed' } })
    await worker.host.idle()
    return { start, end }
  }
  return {id, cards, session, events, requests, boot, turn}
}

test('batched assessment survives restart with only original coordinates, audits all included turns and skips duplicate delivery', { timeout: 10000 }, async t => {
  const {id, cards, session, events, requests, boot, turn} = batchFixture(t)
  let worker=boot()
  worker.evolution.mutate(id,'config',{operationId:'interval',expectedRevision:0,enabled:true,assessmentInterval:2})
  await turn(worker,1)
  assert.equal(worker.evolution.view(id).pendingCount,1)
  assert.equal(requests.length,0)
  assert.ok(!JSON.stringify(worker.evolution.record(id)).includes('Original text'))
  worker.dispose()
  worker=boot();t.after(worker.dispose)
  const {start,end}=await turn(worker,2)
  assert.equal(worker.evolution.view(id).pendingCount,0)
  assert.deepEqual(requests[0].evidence.map(item => item.users[0]),['Original text 1','Original text 2'])
  assert.equal(worker.evolution.current(id).evidence.items.length,2)
  const inspect=async()=>({meta:session.header,events})
  assert.equal((await readRevisionEvidence(worker.evolution,id,2,inspect)).text,'user: Original text 1\n\nassistant: Reply 1\n\nuser: Original text 2\n\nassistant: Reply 2')
  worker.replay(start);worker.replay(end);await worker.host.idle()
  assert.equal(requests.length,1)
  worker.evolution.remove(id)
  assert.equal(new PersonalityEvolution(cards.storageDir,cards).current(id),null)
})

test('an unverified first external origin stays deferred while later verified origins form a batch; delayed evidence can resume after restart', { timeout: 10000 }, async t => {
  const missingSeq = 4
  let recovered = false
  const reads = []
  const provider = { id: 'external-test', resolve({ origin }) {
    reads.push(origin.endSeq)
    if (origin.endSeq === missingSeq && !recovered) return null
    return { id: String(origin.endSeq), version: 1, text: 'verified-' + origin.endSeq, checkCurrent: () => true }
  } }
  const { id, requests, boot, turn } = batchFixture(t, provider)
  let worker = boot()
  worker.evolution.mutate(id, 'config', { operationId:'external-batch', expectedRevision:0, enabled:true, referenceSource:provider.id, assessmentInterval:2 })
  const first = await turn(worker, 1), second = await turn(worker, 2)
  assert.equal(first.end.seq,missingSeq)
  assert.equal(requests.length,0)
  assert.deepEqual(worker.evolution.view(id).deferredReasons, { 'reference-unavailable': 1 })
  worker.dispose()
  worker = boot(); t.after(worker.dispose)
  const third = await turn(worker,3)
  assert.deepEqual(requests.map(r => r.evidence), [[`verified-${second.end.seq}`, `verified-${third.end.seq}`]])
  const view = worker.evolution.view(id)
  assert.equal(view.pendingCount,1); assert.equal(view.deferredCount,1)
  assert.equal(view.history.length,1)
  assert.deepEqual(view.history[0].evidence.items.map(item => item.origin.endSeq),[second.end.seq,third.end.seq])
  assert.ok(!JSON.stringify(worker.evolution.record(id)).includes('Original text'))
  const tries = reads.filter(seq => seq === missingSeq).length
  recovered = true
  const fourth = await turn(worker,4)
  // Backoff after the second miss prevents immediate repeated source reads.
  assert.equal(reads.filter(seq => seq === missingSeq).length,tries)
  assert.equal(requests.length,1)
  await turn(worker,5)
  assert.deepEqual(requests[1].evidence,[`verified-${missingSeq}`,`verified-${fourth.end.seq}`])
  assert.equal(worker.evolution.view(id).deferredCount,0)
  assert.equal(worker.evolution.view(id).pendingCount,1)
})
