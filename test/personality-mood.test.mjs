import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PersonalityMood } from '../packages/personality/src/mood.js'
import { classifyMoodTurn } from '../packages/personality/src/mood-host.js'

test('card-wide manual mood survives restart and fades on read without changing its revision', t => {
  const dir = mkdtempSync(join(tmpdir(), 'personality-mood-')); t.after(() => rmSync(dir, {recursive:true, force:true}))
  let now = 0
  const create = () => new PersonalityMood(dir,{ now:() => now, contextFor:id => id.split('-')[0] })
  const store = create()
  const mood = { feeling:'relieved', reason:'The change is verified', intensity:4 }
  store.change('card','first-1',{mood,expectedRevision:0})
  const file = readFileSync(store.file('card'),'utf8')
  now += 14400000
  assert.equal(create().read('card','another-2').mood.intensity,2)
  assert.equal(readFileSync(store.file('card'),'utf8'),file)
  assert.throws(()=>store.change('card','first-1',{mood:null,expectedRevision:0}),{code:'MOOD_REVISION_CONFLICT'})
  assert.deepEqual(store.read('other','first-1').mood,null)
  store.change('card','first-1',{mood,expectedRevision:1},'event')
  assert.equal(store.read('card','first-2').mood.source,'event')
  assert.equal(store.read('card','another-2').mood.source,'manual')
  store.change('card','first-1',{expectedRevision:2,mood:null})
  assert.equal(store.read('card','first-2').mood,null)
})

test('budget and event identity survive restarts; a repeated mention does not buy another call',t=>{
  const dir=mkdtempSync(join(tmpdir(),'personality-judgments-'));t.after(()=>rmSync(dir,{recursive:true,force:true}))
  let now=0;const create=()=>new PersonalityMood(dir,{now:()=>now})
  const store=create();store.change('p','s',{automatic:true,expectedRevision:0})
  assert.ok(store.reserve('p','s',2,3,1,'topic','assess'))
  assert.equal(create().reserve('p','s',2,3,1,'different','assess'),false)
  assert.equal(create().reserve('p','s',2,5,1,'topic','assess'),false)
  for (const seq of [6,7,8]) assert.ok(store.reserve('p','s',2,seq,1,'topic'+seq,'assess'))
  assert.equal(store.reserve('p','s',2,9,1,'topic9','assess'),false)
  now += 3600001;assert.ok(store.reserve('p','s',2,10,1,'topic','assess'))
})

test('resolved incidents require an explicit non-hypothetical user event',()=>{
  const current={source:'event'}
  assert.equal(classifyMoodTurn({users:['问题解决了。']},current),'resolve')
  assert.notEqual(classifyMoodTurn({users:['你以为问题解决了吗？']},current),'resolve')
  assert.equal(classifyMoodTurn({users:['把这行翻译成英文。']},current),'skip')
  assert.equal(classifyMoodTurn({users:['这份承诺恐怕要推迟。']},null),'assess')
})
