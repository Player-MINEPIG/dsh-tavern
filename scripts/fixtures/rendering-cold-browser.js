// Authored HTML/Helper fixtures only. Run through verify-card-worker-browser
// with TAVERN_WORKER_FIXTURE=scripts/fixtures/rendering-cold-browser.js.
import React from 'react'
import {createRoot} from 'react-dom/client'
import {PlaySessionDock} from '../../packages/client/src/play/notice.js'
import {MowanChatView} from '../../packages/client/src/play/chat.js'
import {createRenderingDependencies,dependencyStore,renderingDependencies} from '../../packages/client/src/play/rendering-dependencies.js'
import {createRenderingTrust,renderingTrust} from '../../packages/client/src/play/rendering-trust.js'
import {renderingInventory,identifyRenderingSources} from '../../packages/client/src/play/rendering-sources.js'
import {setClientConversationSettings} from '../../packages/client/src/conversation-settings.js'

;(async()=>{
const results=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const check=(name,pass,detail)=>results.push({name,pass:!!pass,...(detail?{detail}:{})})
const until=async predicate=>{for(let i=0;i<200;i++){if(predicate())return true;await pause(25)}return false}
let root,network=0
globalThis.fetch=async source=>{
 if(String(source).startsWith('https://fixture.example/'))network++
 // Optional binding reads have no Host in this standalone fixture either.
 throw Error('Standalone cold fixture has no network')
}
try{
 for(const surface of ['chat','dock'])for(const mode of ['late-enablement','late-adapter','early-settings']){
  setClientConversationSettings({})
  const id='cold-'+surface+'-'+mode,owner='character:'+id,url='https://fixture.example/'+id+'.html'
  const greeting=`<body><script>$('body').load('${url}');</script></body>`
  const helpers=mode==='late-adapter'?[]:[{id:'off',name:'Disabled fixture',enabled:true,content:"import 'https://fixture.example/off.js';throw Error('Disabled helper executed')"}]
  const character={id,name:id,data:{name:id,firstMessage:greeting},source:{raw:{data:{name:id,first_mes:greeting,extensions:{tavern_helper:{scripts:helpers}}}}}}
  const settings={interactiveCards:true,...(mode==='late-adapter'?{renderingAdapters:{schemaVersion:1,entries:[{owner,source:url,mode:'original'}]}}:{scriptEnablement:{schemaVersion:1,entries:[{owner,key:'helper:id:off',enabled:false}]}})}
  const seedTrust=createRenderingTrust(),store=dependencyStore()
  seedTrust.setEnablement(settings.scriptEnablement);seedTrust.setAdapterIntents(settings.renderingAdapters)
  const seed=createRenderingDependencies({trust:seedTrust,store,channelFactory:()=>null,download:async source=>{
   if(source!==url)throw Error('Unexpected fixture source')
   return '<body><output id="cold">static</output><script>document.getElementById("cold").textContent="restored";</script></body>'
  }})
  await seed.sync(await identifyRenderingSources(renderingInventory(character,{kind:'character',resourceId:id})));await seed.acquire(owner)
  if(seed.inspect(owner).status!=='ready')throw Error('Fixture seed failed')
  seed.dispose()
  const sessionId='session-'+id,playthrough={id,path:'timeline.json',ext:{pmpDshTavern:{characterId:id,rootSessionId:sessionId}}}
  let historyReads=0,writes=0
  const client={
   async getWorkspace(){return {selected:true,rootPath:'/fixture/cold'}},
   async getCatalog(){return {playthroughs:[playthrough]}},
   async getMessages(){historyReads++;return {incompleteTurn:false,messages:[]}},
   async getTimeline(){return {nodes:[]}},
   async getCharacterSelection(){return {selection:{characterCardId:id,character:{greetingIndex:0}}}},
   async getCharacter(){return {character}},
   async putTimeline(){writes++;throw Error('No history writes expected')},
  }
  const session={id:sessionId,sessionId,cwd:'/fixture/cold',running:false,blank:surface==='dock'},chat={legacy:{nodes:[],partial:null},timeline:{turnOrder:[],turns:new Map()}}
  const host=document.createElement('div');document.body.append(host);root=createRoot(host)
  if(mode==='early-settings')setClientConversationSettings(settings)
  root.render(surface==='chat'?React.createElement(MowanChatView,{sessionId,useSession:selector=>selector(session),useChat:selector=>selector(chat),playClient:client,playthrough,openSession:()=>{}}):React.createElement(PlaySessionDock,{session,useSessions:selector=>selector({byId:{[sessionId]:session}}),useConversation:selector=>selector({}),conversationPhase:()=> 'blank',playClient:client}))
  if(mode!=='early-settings'){
   if(!await until(()=>renderingDependencies.inspect(owner)?.status==='changed'))throw Error('Initial default fingerprint was not observed: '+host.textContent+' '+JSON.stringify(renderingDependencies.inspect(owner)))
   const reads=historyReads
   setClientConversationSettings(settings)
   const restored=await until(()=>host.querySelector('iframe')?.contentDocument?.getElementById('cold')?.textContent==='restored')
   check(surface+' '+mode+' restores cached HTML after preferences arrive without Settings or history reload',restored&&historyReads===reads,{status:renderingDependencies.inspect(owner)?.status,historyReads,reads})
  }else check(surface+' '+mode+' restores the same cached HTML on first mount',await until(()=>host.querySelector('iframe')?.contentDocument?.getElementById('cold')?.textContent==='restored'))
  check(surface+' '+mode+' has no source fetch, settings prerequisite, history write or disabled helper approval',network===0&&writes===0&&!host.querySelector('.dtv-conversation-settings')&&renderingTrust.inspect(owner,'https://fixture.example/off.js')===null)
  root.unmount();root=null;host.remove()
 }
}catch(error){check('Unexpected cold fixture error',false,error.stack)}
finally{root?.unmount();renderingDependencies.dispose();setClientConversationSettings({},{announce:false})}
const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
