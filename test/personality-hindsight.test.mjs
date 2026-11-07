import test from 'node:test'
import assert from 'node:assert/strict'
import { createHindsightEvidence, installHindsightEvidence } from '../packages/personality/src/hindsight.js'
import { PersonalityEvidenceSources } from '../packages/personality/src/evolution.js'
import { evidenceHash } from '../packages/personality/src/turn-assessment.js'

const setup = { baseUrl: 'https://hindsight.example.test', bankId: 'project::example',
  bindings: [{ personalityId: 'glass', sessionIds: ['chat'] }] }
const id = '930f7556-5b72-454f-af56-753c6c30be66'
const user = 'Help me pressure-test the assumption', assistant = 'I will verify the premise first.'
const origin = { kind: 'original', sessionId: 'chat', sessionCreatedAt: 1, startSeq: 12, endSeq: 15,
  userSeqs: [13], assistantSeq: 14, textHash: evidenceHash([[user], assistant]) }
const request = { personalityId: 'glass', origin, signal: new AbortController().signal }
function fixture() {
  const calls = []
  const unit = { id, text: 'The assistant commits to checking the premise before offering advice.',
    type: 'experience', state: 'valid', document_id: 'conversation:chat', chunk_id: 'example_chunk_1',
    tags: ['source:chat', 'harness:dsh'], edited_at: null }
  const rows = [{ role: 'system', content: 'REF-ID: conversation:chat' }, {role:'user',content:user}, {role:'assistant',content:assistant}]
  const state = { unit, rows, chunkBank: setup.bankId, listDoc: unit.document_id, deleted:false }
  async function fetcher(rawUrl, options) {
    assert.ok(options.signal instanceof AbortSignal)
    assert.equal(options.redirect, 'error')
    assert.equal(options.method, undefined, 'only GET is allowed')
    assert.equal(options.body, undefined, 'the user exchange is never uploaded')
    const url = new URL(rawUrl)
    calls.push(url)
    if (url.pathname.endsWith('/memories/list')) {
      assert.deepEqual(Object.fromEntries(url.searchParams), {document_id:'conversation:chat',state:'valid',limit:'16'})
      return Response.json({items:[{id,document_id:state.listDoc,fact_type:unit.type}]})
    }
    if (url.pathname.endsWith('/memories/' + id)) return state.deleted ? new Response(null,{status:404}) : Response.json(unit)
    if (url.pathname.endsWith('/chunks/' + unit.chunk_id)) return Response.json({chunk_id:unit.chunk_id,
      bank_id:state.chunkBank,document_id:unit.document_id,chunk_text:state.rows.map(row=>JSON.stringify(row)).join('\n')})
    throw new Error('Unexpected Hindsight route ' + url.pathname)
  }
  return { calls, state, source: createHindsightEvidence(setup, { fetcher }) }
}

test('configured Hindsight uses a verified scoped memory unit and resolves only its original content version', async () => {
  const { source, calls, state } = fixture()
  assert.equal(source.supports(request.personalityId), true)
  assert.equal(source.supports('someone-else'), false)
  assert.equal(await source.resolve({...request,personalityId:'someone-else'}), null)
  assert.equal(await source.resolve({...request,origin:{...origin,sessionId:'other'}}), null)
  assert.equal(calls.length, 0)
  const value = await source.resolve(request)
  assert.equal(value.id,id)
  assert.match(value.text,/^\[Hindsight experience memory\]/)
  assert.match(value.version,/^[a-f0-9]{64}$/)
  assert.equal(await value.revalidate(),true)
  assert.equal((await source.read({...request,id,version:value.version})).text,value.text)
  state.unit.text = 'A later correction'
  assert.equal(await value.revalidate(),false)
  assert.equal(await source.read({...request,id,version:value.version}),null)
})

test('unrelated, ambiguous, invalidated or deleted units cannot become personality evidence', async () => {
  for (const change of [
    s=>{s.listDoc='conversation:other'},s=>{s.chunkBank='other'},
    s=>{s.rows[1]={role:'user',content:'A different request'}},
    s=>{s.rows.unshift({role:'user',content:'Another turn in this chunk'})},
    s=>{s.unit.tags=['source:chat','harness:claude']},s=>{s.unit.state='invalidated'},s=>{s.deleted=true},
  ]) {
    const { source,state }=fixture()
    change(state)
    assert.equal(await source.resolve(request),null)
  }
})

test('registering an explicit Hindsight endpoint makes no network calls, and disposal cancels or prevents new reads', async () => {
  const sources=new PersonalityEvidenceSources()
  let dispose
  const ctx={effect(f){dispose=f()}}
  installHindsightEvidence(ctx,sources,undefined)
  assert.deepEqual(sources.list(),['original'])
  installHindsightEvidence(ctx,sources,setup)
  const active=sources.get('hindsight')
  assert.deepEqual(sources.list(),['original','hindsight'])
  dispose()
  assert.deepEqual(sources.list(),['original'])
  assert.equal(await active.resolve(request),null)
  assert.throws(()=>createHindsightEvidence({...setup,bindings:[{personalityId:'glass',sessionIds:['*']}]}),/binding/)
})
