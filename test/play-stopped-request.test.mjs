import test from 'node:test'
import assert from 'node:assert/strict'
import {stoppedRequestFromEvents} from '../packages/play/src/stopped-request.js'
import {createPlayNodeController} from '../packages/client/src/play/nodes.js'
import {appendCompletedTurns} from '../packages/client/src/play/turns.js'
import {loadChatState} from '../packages/client/src/play/chat.js'
import {normalizeSessionMessages} from '../packages/client/src/play/schema.js'

const events=()=>[
 {seq:0,type:'turn/start',data:{turn:1}},
 {seq:1,type:'user/message',data:{id:'u',role:'user',source:{kind:'user'},content:[{type:'text',text:'Neutral question'}]}},
 {seq:2,type:'assistant/message',data:{turn:1,interrupted:true,message:{id:'a',content:[{type:'reasoning',text:'Analysis only'}]}}},
 {seq:3,type:'turn/end',data:{turn:1,reason:{kind:'aborted'}}},
]
test('only a durable cancelled human request without assistant text offers a retry',()=>{
 const source=events(),expected={userEventId:1,turnStartEventId:0,turnEndEventId:3}
 assert.deepEqual(stoppedRequestFromEvents(source),expected)
 assert.equal(stoppedRequestFromEvents(source.slice(0,-1)),null)
 for(const change of [items=>items[3].data.reason.kind='completed',items=>items[2].data.message.content.push({type:'text',text:'Saved body'}),items=>items[1].data.source.kind='subagent-report',items=>items.push({seq:4,type:'turn/start',data:{turn:2}})]){
  const items=events();change(items);assert.equal(stoppedRequestFromEvents(items),null)
 }
 const value=normalizeSessionMessages({incompleteTurn:false,stoppedRequest:expected,messages:source.slice(1,3).map(event=>({id:(event.data.message??event.data).id,seq:event.seq,role:event.type==='user/message'?'user':'assistant',content:(event.data.message??event.data).content}))})
 assert.deepEqual(value.stoppedRequest,expected)
 assert.equal(appendCompletedTurns({nodes:[]},value,'old').added.length,0)
 assert.throws(()=>normalizeSessionMessages({...value,incompleteTurn:true}),/invalid stopped/)
})

function fixture(later=false,stoppedAgain=false){
 const playthrough={id:'p',path:'p/timeline.json',ext:{pmpDshTavern:{rootSessionId:'old'}}}
 const parent={id:'parent',kind:'qa',parentVariantId:null,adoptedVariantId:'parent-v',variants:[{id:'parent-v',sessionId:'old',startEventId:1,endEventId:3}]}
 let timeline={nodes:later?[parent]:[],head:later?{sessionId:'old',nodeId:'parent',variantId:'parent-v'}:null},writes=0,id=0
 const userSeq=later?5:1,stoppedRequest={userEventId:userSeq,turnStartEventId:userSeq-1,turnEndEventId:userSeq+2},calls=[]
 const prefix=later?[{role:'user',seq:1,text:'Previous question'},{role:'assistant',seq:3,text:'Previous reply'}]:[]
 const user={role:'user',seq:userSeq,text:'Neutral stopped question'}
 const client={getTimeline:async()=>structuredClone(timeline),putTimeline:async(_p,next)=>{writes++;timeline=next},getFocus:async()=>timeline.head,
  getMessages:async sessionId=>({incompleteTurn:false,sessionFormatVersion:4,stoppedRequest:sessionId==='old'||stoppedAgain?stoppedRequest:null,messages:[...prefix,user,...(sessionId==='old'||stoppedAgain?[{role:'assistant',seq:userSeq+1,text:'',content:[{type:'reasoning',text:'Analysis only'}]}]:[{role:'assistant',seq:userSeq+1,text:'Neutral saved answer'}])]}),
  getCharacterSelection:async()=>({selection:null}),postSession:async(...args)=>{calls.push(['create',...args]);return {sessionId:'new'}},postBranch:async(...args)=>{calls.push(['branch',...args]);return {sessionId:'new'}},postUserMessage:async(...args)=>{calls.push(['send',...args]);return {accepted:true}}}
 const controller=createPlayNodeController(client,{idFactory:()=>`v-${++id}`,delay:()=>{throw Error('A stopped request must not wait for polling')}})
 return {playthrough,client,controller,stoppedRequest,calls,get timeline(){return timeline},get writes(){return writes}}
}

for(const later of [false,true])test(`${later?'later':'first'} cancelled ordinary request retries into a real reply and can then swipe`,async()=>{
 const f=fixture(later),before=structuredClone(f.timeline),opened=[]
 const state=await loadChatState(f.client,'old',f.playthrough)
 assert.deepEqual(state.stoppedRequest,f.stoppedRequest)
 assert.deepEqual(f.timeline,before);assert.equal(f.writes,0)
 const result=await f.controller.retryStoppedRequest(f.playthrough,{sessionId:'old',userEventId:f.stoppedRequest.userEventId},{onStarted:value=>opened.push(value.sessionId)})
 assert.deepEqual(opened,['new']);assert.equal(f.timeline.nodes.length,later?2:1)
 const creation=f.calls[0],coordinate={sessionId:'old',beforeUserEventId:f.stoppedRequest.userEventId}
 assert.deepEqual(creation.at(-1),coordinate)
 assert.equal(creation[0],later?'branch':'create')
 if(later)assert.equal(creation[2],3)
 assert.deepEqual(f.calls[1],['send','new','Neutral stopped question'])
 await f.controller.createReplySwipe(f.playthrough,result.nodeId)
 assert.equal(f.timeline.nodes.at(-1).variants.length,2)
})

test('cancelling the ordinary request retry again never records a fabricated reply',async()=>{
 const f=fixture(false,true),before=structuredClone(f.timeline)
 await assert.rejects(f.controller.retryStoppedRequest(f.playthrough,{sessionId:'old',userEventId:1}),/stopped without a saved/)
 assert.equal(f.writes,0);assert.deepEqual(f.timeline,before)
})
