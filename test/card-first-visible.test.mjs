import test from 'node:test'
import assert from 'node:assert/strict'
import {firstCardVisibility} from '../packages/client/src/play/card-first-visible.js'

function fixture() {
  let callback, disconnected=0
  class IntersectionObserver {
    constructor(fn) { callback=fn }
    observe(target) { assert.equal(target,frame) }
    disconnect() { disconnected++ }
  }
  const frame={isConnected:true,ownerDocument:{defaultView:{IntersectionObserver}}}
  const controller=new AbortController()
  return {frame,controller,visible:rect=>callback([{target:frame,isIntersecting:true,intersectionRect:rect}]),disconnected:()=>disconnected}
}

test('first admission waits for a nonempty intersection and disconnects permanently after activation',async()=>{
  const f=fixture();let started=false
  const ready=firstCardVisibility(f.frame,f.controller.signal).then(value=>{started=value;return value})
  f.visible({width:0,height:30});await Promise.resolve();assert.equal(started,false)
  f.visible({width:100,height:30});assert.equal(await ready,true);assert.equal(f.disconnected(),1)
  f.visible({width:100,height:30});f.controller.abort();assert.equal(f.disconnected(),1)
})

test('unmount or scope cancellation releases initial observation and cannot start from a stale callback',async()=>{
  const f=fixture(),ready=firstCardVisibility(f.frame,f.controller.signal)
  f.controller.abort();assert.equal(await ready,false);assert.equal(f.disconnected(),1)
  f.visible({width:100,height:30});assert.equal(f.disconnected(),1)
  assert.equal(await firstCardVisibility(f.frame,f.controller.signal),false)
})

test('an engine without IntersectionObserver starts normally rather than waiting indefinitely',async()=>{
  const controller=new AbortController(),frame={ownerDocument:{defaultView:{}}}
  assert.equal(await firstCardVisibility(frame,controller.signal),true)
  controller.abort();assert.equal(await firstCardVisibility(frame,controller.signal),false)
})
