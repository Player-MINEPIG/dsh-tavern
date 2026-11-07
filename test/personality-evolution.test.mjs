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
import { installEvolutionHost, urgentSelfCorrection, validateEvolutionAssessment } from '../packages/personality/src/evolution-host.js'
import { installIndependentAssembler } from './helpers/assembler-host.mjs'

const change = { before: 'I thought a clever critique was sufficient.', after: 'I owe the author a testable alternative.',
  behavior: 'When pointing out a gap, offer a test.', boundary: 'When the user wants a review.', reason: 'My last review gave no way forward.' }
const assessment = (change, input) => {
  const entries = Array.isArray(input.evidence) ? input.evidence : [input.evidence]
  return { change, basis: { kind: 'self-understanding', supports: entries.map((item,index) => ({ index:index+1, quote: (typeof item === 'string' ? item : item.users[0]).slice(0, 80) })), counterevidence: 'No contrary evidence was supplied.' } }
}
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
    assert.equal(prompt.evidence,externalText)
    if (started) await new Promise(resolve => { release = resolve; started(); started = null })
    yield { type: 'block-end', block: { type: 'text', text: JSON.stringify(assessment(change, prompt)) } }; yield {type:'finish',reason:{kind:'stop'}}
  } }
  const host = installEvolutionHost({effect: f => disposers.push(f()),provide() {},get: () => llm,on: (e, f) => callbacks.set(e,f)}, {
    cards,evolution:store,nativeLease:()=>()=>true,notify(){},report:e=>errors.push(e) })
  t.after(() => disposers.forEach(f=>f()))
  let externalText='Bound external excerpt', externalVersion='12'
  const external=async () => ({id:'external-item',version:externalVersion,text:externalText,checkCurrent:()=>allow})
  store.sources.register({id:'test-source', resolve:external, read:external })
  store.mutate(id,'config',{expectedRevision:0, operationId:'configure', enabled:true,referenceSource:'test-source',assessmentInterval:1})
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
  externalVersion='13'; externalText='A new independent external excerpt'
  const rollback = { operationId:'rollback',expectedRevision:2,targetRevision:0 }
  await run(()=>store.mutate(id,'rollback',rollback))
  assert.equal(store.current(id),null)
  assert.equal(store.mutate(id,'rollback',rollback).revision,3)
  assert.throws(()=>store.mutate(id,'rollback',{...rollback,targetRevision:2}),{code:'EVOLUTION_CONFLICT'})
  externalVersion='14'; externalText='A third independent external excerpt'
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
  let callTool = true
  try {
    for (const id of ['sessionController','workspaceController','directoryPickerController']) root.provide(id,{})
    await root.plugin(SystemPrompt,{ personaPrefix:'HOST BASE' })
    for (const suffix of ['session','agent','session-projection','llm','tools','tool-executor-native','agent-loop']) {
      const mod = await load('dsh-'+suffix)
      await root.plugin(mod.default ?? mod,suffix==='agent-loop'?{agents:[]}: {})
    }
    root.tools.register({ name:'observe', description:'Return a fixed external observation', parameters:{type:'object',properties:{}},
      output:{schema:{type:'string'},render:(_,text)=>[{type:'text',text}]},execute:async()=> 'MEASURED: expected 42, observed 7; the prior conclusion is disproven.' })
    class Adapter extends llm.LlmAdapter {
      async *stream(request) {
        const aux=request.purpose==='tavern-personality-evolution'
        ;(aux?auxiliary:foreground).push(request)
        if (!aux && callTool) {
          callTool=false
          yield {type:'block-start',index:0,blockType:'tool-call'}
          yield {type:'block-end',index:0,block:{type:'tool-call',id:'observation-call',name:'observe',arguments:'{}'}}
          yield {type:'finish',reason:{kind:'tool-calls'}}
          return
        }
        const input=aux?JSON.parse(request.messages[0].content[0].text):null
        const answer=aux?assessment(auxiliary.length===1?change:null,input):null
        if (answer?.change && input.evidence.tools?.length) answer.basis.supports=[{index:1,toolSeq:input.evidence.tools[0].seq,quote:input.evidence.tools[0].text}]
        const text=aux?JSON.stringify(answer):'WORK COMPLETE'
        yield {type:'block-start',index:0,blockType:'text'}
        yield {type:'block-end',index:0,block:{type:'text',text}}
        yield {type:'finish',reason:{kind:'stop'}}
      }
    }
    root.llm.registerAdapter(['offline'],new Adapter());await installIndependentAssembler(root,directory)
    let store
    await root.plugin({name:tavern.name,inject:tavern.inject,apply(ctx){store=tavern.apply(ctx,{storageDir:directory})}})
    const card=store.personalityStore.create({name:'Test'})
    store.personalityEvolution.mutate(card.id,'config',{operationId:'immediate-test',expectedRevision:0,enabled:true,assessmentInterval:1})
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
    const evidence=await readRevisionEvidence(store.personalityEvolution,card.id,row.revision,async()=>({meta,events}))
    assert.match(evidence.text,/Tell me what to check next/)
    assert.match(evidence.text,/tool observe \(event \d+\): MEASURED/)
    assert.equal(row.evidence.toolEvidence.length,1)
    const alteredTool=structuredClone(events)
    alteredTool[row.evidence.toolEvidence[0].seq].data.message.content=[{type:'text',text:'A fabricated observation'}]
    assert.equal((await readRevisionEvidence(store.personalityEvolution,card.id,row.revision,async()=>({meta,events:alteredTool}))).available,false)
    const altered=structuredClone(events)
    altered[row.evidence.assistantSeq].data.message.content=[{type:'text',text:'altered'}]
    assert.equal((await readRevisionEvidence(store.personalityEvolution,card.id,row.revision,async()=>({meta,events:altered}))).available,false)
    assert.equal(events[row.evidence.assistantSeq].type,'assistant/message')
    assert.equal(events[row.evidence.userSeqs[0]].type,'user/message')
    assert.equal(events.filter(e=>e.type==='assistant/message').length,2)
    await turn('review-b')
    assert.equal(auxiliary.length,2);assert.equal(store.personalityEvolution.view(card.id).history.length,1)
    assert.ok(JSON.stringify(foreground.at(-1).messages).includes(change.after))
    assert.equal(store.assemblyStore.list('review-a').length,2)
  } finally {await root.fiber.dispose()}
})

function batchFixture(t, source, response = input => assessment(change,input)) {
  const directory = temporary(t)
  const cards = new PersonalityStore(directory)
  const id = cards.create().id
  const events = []
  const session = { id: 'batch', header: { id: 'batch', createdAt: 15 }, snapshotEvents: () => events }
  cards.select(session.id, { characterCardId: id })
  const requests = [], errors = []
  const llm = { async *stream(req) {
    requests.push(JSON.parse(req.messages[0].content[0].text))
    yield { type: 'block-end', block: { type: 'text', text: JSON.stringify(response(requests.at(-1))) } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } }
  const boot = () => {
    const evolution = new PersonalityEvolution(cards.storageDir, cards)
    if (source) evolution.sources.register(source)
    let listener, dispose
    const host = installEvolutionHost({ effect: f => { dispose = f() }, provide() {}, get: () => llm, on: (_,f) => { listener = f } },
      { cards, evolution, nativeLease: () => () => true, notify() {}, report(error) { errors.push(error) } })
    return { evolution, host, emit(type,data) { const e = { type, data, seq: events.length }; events.push(e); listener(session,e); return e }, replay: e => listener(session,e), dispose }
  }
  const turn = async (worker,n,text='Original text '+n) => {
    const start = worker.emit('turn/start',{ turn:n })
    worker.emit('request/header',{ header:{ config:{ provider:'offline', model:'test' } } })
    worker.emit('user/message',{ source:{ kind:'user' }, content:[{ type:'text', text }] })
    worker.emit('assistant/message',{ turn:n, message:{ content:[{ type:'text',text:'Reply '+n }] } })
    const end = worker.emit('turn/end',{ turn:n, reason:{ kind:'completed' } })
    await worker.host.idle()
    return { start, end }
  }
  return {id, cards, session, events, requests, errors, boot, turn}
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

test('new ledgers batch four turns, but an explicit self-correction wakes a short session without bypassing validation', async t => {
  const { id, requests, boot, turn } = batchFixture(t)
  const worker = boot(); t.after(worker.dispose)
  assert.equal(worker.evolution.view(id).config.assessmentInterval,4)
  await turn(worker,1,'The project uses Node.js.')
  await turn(worker,2,'I prefer a concise answer.')
  assert.equal(requests.length,0)
  await turn(worker,3,'记住这个教训：不要把自信等同于可靠，应说明自己能证实到哪一步。')
  assert.equal(requests.length,1)
  assert.equal(worker.evolution.view(id).pendingCount,0)
  assert.equal(worker.evolution.current(id).evidence.items.length,3)
  assert.equal(urgentSelfCorrection({users:['Always format this project as JSON.']}),false)
  assert.equal(urgentSelfCorrection({users:['remember this lesson: your responsibility is to verify the claim']}),true)
})

test('an urgent supported correction is not held behind an unavailable earlier source entry', async t => {
  const source={id:'partial-urgent',resolve({origin}){return origin.startSeq===0?null:{id:String(origin.endSeq),version:1,text:'Verified correction of responsibility and capability limits.',checkCurrent:()=>true}}}
  const {id,requests,boot,turn}=batchFixture(t,source)
  const worker=boot();t.after(worker.dispose)
  worker.evolution.mutate(id,'config',{operationId:'source',expectedRevision:0,enabled:true,referenceSource:source.id})
  await turn(worker,1)
  await turn(worker,2,'remember this lesson: state what you verified before making a claim.')
  assert.equal(requests.length,1)
  assert.equal(worker.evolution.current(id).evidence.origin.startSeq,5)
  assert.equal(worker.evolution.view(id).pendingCount,1)
  assert.equal(worker.evolution.view(id).deferredCount,1)
})

test('Host checks candidate category, human grounding, counterevidence and scope before accepting a revision', () => {
  const evidence = [{ reference: { kind: 'original' }, text: { users: ['The correction establishes a responsibility to verify.'], assistant: 'I have learned to be perfect.' } }]
  const valid = assessment(change,{evidence:evidence[0].text})
  assert.deepEqual(validateEvolutionAssessment(valid,evidence),{...change,evidenceSupports:[{index:1}]})
  for (const kind of ['fact','user-preference','task-rule','mood','model-claim']) {
    assert.equal(validateEvolutionAssessment({...valid,basis:{...valid.basis,kind}},evidence),null)
  }
  for (const basis of [undefined,{...valid.basis,counterevidence:''},{...valid.basis,supports:[{index:1,quote:'I have learned to be perfect.'}]},
    {...valid.basis,supports:[{index:1,quote:'.'}]},
    {...valid.basis,supports:[{index:2,quote:valid.basis.supports[0].quote}]}]) {
    assert.throws(()=>validateEvolutionAssessment({...valid,basis},evidence),{code:'PERSONALITY_ASSESSMENT_SCHEMA'})
  }
  assert.throws(()=>validateEvolutionAssessment({...valid,change:{...change,boundary:''}},evidence),{code:'INVALID_EVOLUTION'})
  const brief=[{reference:{kind:'original'},text:{users:['错了。'],assistant:'我学会了。',tools:[{seq:3,text:'结果不一致。'}]}}]
  assert.equal(validateEvolutionAssessment({...valid,basis:{...valid.basis,supports:[{index:1,quote:'错了'}]}},brief).after,change.after)
  assert.equal(validateEvolutionAssessment({...valid,basis:{...valid.basis,supports:[{index:1,toolSeq:3,quote:'结果不一致'}]}},brief).after,change.after)
  assert.equal(validateEvolutionAssessment({...valid,basis:{...valid.basis,supports:[{index:1,quote:'错了'},{index:1,toolSeq:3,quote:'结果不一致'}]}},brief).evidenceSupports.length,2)
  assert.throws(()=>validateEvolutionAssessment({...valid,basis:{...valid.basis,supports:[{index:1,quote:'我学会了'}]}},brief),{code:'PERSONALITY_ASSESSMENT_SCHEMA'})
})

test('older ledgers retain cadence and external evidence history without changing the authored card', t => {
  const directory=temporary(t),cards=new PersonalityStore(directory),id=cards.create().id
  const original=cards.json(id).text,store=new PersonalityEvolution(cards.storageDir,cards)
  const old=structuredClone(store.record(id))
  delete old.config.assessmentInterval
  delete old.reviewedEvidence
  old.revision=1
  const evidence={kind:'external',source:'old-source',id:'old-entry',version:1,textHash:'old-hash'}
  old.history=[{...change,revision:1,kind:'revision',evidence}]
  store.save(id,old)
  const restored=new PersonalityEvolution(cards.storageDir,cards)
  assert.equal(restored.view(id).config.assessmentInterval,1)
  assert.equal(restored.current(id).after,change.after)
  assert.equal(restored.hasEvidence(id,evidence),true)
  assert.equal(cards.json(id).text,original)
})

test('one external source version cannot buy repeated assessments or become fresh evidence after restart and rollback', async t => {
  let version = 1, text = 'The same independently verified responsibility correction.'
  const source = { id: 'dedupe', resolve: () => ({ id: 'same-observation', version, text, checkCurrent: () => true }) }
  const { id, requests, boot, turn } = batchFixture(t,source)
  let worker = boot()
  worker.evolution.mutate(id,'config',{operationId:'one',expectedRevision:0,enabled:true,referenceSource:source.id,assessmentInterval:1})
  await turn(worker,1)
  assert.equal(requests.length,1)
  worker.dispose(); worker=boot(); t.after(worker.dispose)
  await turn(worker,2)
  assert.equal(requests.length,1)
  worker.evolution.mutate(id,'rollback',{operationId:'undo',expectedRevision:2,targetRevision:0})
  await turn(worker,3)
  assert.equal(requests.length,1)
  assert.equal(worker.evolution.current(id),null)
  version=2
  await turn(worker,4)
  assert.equal(requests.length,1,'renumbering an unchanged source body is not independent evidence')
  text='A changed verified correction with a new evidence version.'
  version=3
  await turn(worker,5)
  assert.equal(requests.length,2)
  assert.equal(worker.evolution.current(id).evidence.version,3)
  assert.equal(worker.evolution.view(id).pendingCount,0)
})

test('invalid assessor output defers its batch with bounded backoff while new evidence continues', async t => {
  const {id,requests,errors,boot,turn}=batchFixture(t,null,()=>({change}))
  const worker=boot();t.after(worker.dispose)
  worker.evolution.mutate(id,'config',{operationId:'invalid-output',expectedRevision:0,enabled:true,assessmentInterval:1})
  for (let n=1;n<=4;n++) await turn(worker,n)
  assert.equal(requests.filter(input=>input.evidence.users[0]==='Original text 1').length,1)
  assert.equal(requests.length,4)
  assert.equal(worker.evolution.current(id),null)
  assert.deepEqual(worker.evolution.view(id).deferredReasons,{'assessment-rejected':4})
  await turn(worker,5)
  assert.equal(requests.filter(input=>input.evidence.users[0]==='Original text 1').length,2)
  assert.ok(requests.some(input=>input.evidence.users[0]==='Original text 5'))
  assert.equal(errors.length,requests.length)
  assert.ok(errors.every(error=>error.code==='PERSONALITY_ASSESSMENT_SCHEMA'))
})
