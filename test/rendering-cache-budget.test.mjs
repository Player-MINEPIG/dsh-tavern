import test from 'node:test'
import assert from 'node:assert/strict'
import {createRenderingCacheBudget} from '../packages/client/src/play/rendering-cache-budget.js'
test('code, inactive archives and inert data share an atomic replaceable byte budget',()=>{
 const budget=createRenderingCacheBudget(100)
 assert.equal(budget.reserve('executable',60),60)
 assert.equal(budget.reserve('executable-inactive',15),75)
 assert.equal(budget.reserve('opening-inert',25),100)
 assert.throws(()=>budget.reserve('opening-inert',26),/shared byte budget/)
 assert.equal(budget.snapshot().total,100)
 assert.deepEqual(budget.snapshot().entries,[['executable',60],['executable-inactive',15],['opening-inert',25]])
 assert.equal(budget.reserve('executable',30),70)
 assert.equal(budget.reserve('opening-inert',0),45)
 assert.throws(()=>budget.snapshot().entries[0][1]=1,TypeError)
 assert.equal(createRenderingCacheBudget(100).snapshot().total,0)
 for(const value of [-1,1.5,Infinity,NaN])assert.throws(()=>budget.reserve('code',value),/Invalid/)
})
test('cold-cache accounting waits for registered initialization without retaining empty reservations',async()=>{
 const budget=createRenderingCacheBudget(100);let finish,settled=false
 budget.reserve('opening-inert',20)
 budget.trackInitialization('existing-opening-inert',new Promise(resolve=>{finish=()=>{budget.reserve('opening-inert',0);resolve()}}))
 const ready=budget.ready().then(()=>{settled=true;budget.reserve('executable',95)})
 await Promise.resolve();assert.equal(settled,false)
 finish();await ready;assert.equal(budget.snapshot().total,95)
 budget.trackInitialization('failed-cold-read',Promise.reject(Error('fixture unavailable')))
 await budget.ready();assert.equal(budget.snapshot().total,95)
})
