import test from 'node:test'
import assert from 'node:assert/strict'
import {CLIENT_REFRESH_EVENT} from '../packages/identity.js'
import {installPlaySlotOccupancy} from '../packages/client/src/play/occupancy.js'
import {openingLayoutSession,OPENING_SESSION_SLOT} from '../packages/client/src/play/opening-layout.js'
const settle=()=>new Promise(resolve=>setImmediate(resolve))
const playthrough={id:'p',path:'p/timeline.json',ext:{pmpDshTavern:{rootSessionId:'s',characterId:'c'}}}
function fixture(){
 let snapshot={byId:{s:{id:'s',cwd:'/fixture',blank:true,retainedBy:{mainView:1}},ordinary:{id:'ordinary',cwd:'/fixture',blank:true,retainedBy:{}}}},notify=()=>{},selected='c',failSelection=false
 const registrations=[],cleanups=[]
 const ctx={sessions:{list:{getSnapshot:()=>snapshot,subscribe:fn=>{notify=fn;return()=>{notify=()=>{}}}}},slots:{entries:()=>[{store:{create(){}}}],inject:(_,fn)=>cleanups.push(fn()),register(options,component){const item={options,component,active:true};registrations.push(item);return()=>{item.active=false}}}}
 const client={getWorkspace:async()=>({selected:true,rootPath:'/fixture'}),getCatalog:async()=>({playthroughs:[playthrough]}),getTimeline:async()=>({nodes:[]}),getCharacterSelection:async()=>{if(failSelection)throw Error('Selection read failed');return{selection:{characterCardId:selected},character:selected?{id:selected}:null}}}
 const occupancy=installPlaySlotOccupancy(ctx,client,{conversationPhase:()=> 'blank',switchToNative(){}})
 return {registrations,cleanups,occupancy,update:fn=>{snapshot=fn(snapshot);notify()},role:value=>{selected=value},fail:value=>{failSelection=value}}
}
test('empty opening eligibility uses the actual blank primary root and matching character',()=>{
 const rows={byId:{s:{id:'s',blank:true,retainedBy:{mainView:1}}}},bindings=new Map([['s',{playthrough,characterId:'c'}]])
 assert.equal(openingLayoutSession(rows,bindings),'s')
 for(const characterId of [null,'other'])assert.equal(openingLayoutSession(rows,new Map([['s',{playthrough,characterId}]])),null)
 assert.equal(openingLayoutSession({byId:{s:{id:'s',blank:false,retainedBy:{mainView:1}}}},bindings),null)
 assert.equal(openingLayoutSession({byId:{s:{id:'s',blank:true,retainedBy:{preview:1}}}},bindings),null)
})
test('confirmed blank RP mounts its own child and actual first-turn lifecycle releases the native layout',async()=>{
 const f=fixture();f.occupancy.setMode('play');await settle();await settle()
 const own=f.registrations.find(x=>x.options.name==='main.conversation'),body=f.registrations.find(x=>x.options.name===OPENING_SESSION_SLOT)
 assert.ok(own?.active&&body?.active)
 assert.deepEqual(Object.keys(own.options.children),[OPENING_SESSION_SLOT])
 f.update(s=>({byId:{...s.byId,s:{...s.byId.s,blank:false,running:true}}}))
 assert.equal(own.active,false);assert.equal(body.active,false)
 assert.equal(f.registrations.filter(x=>x.options.name==='conversation.view'&&x.active).length,1)
 for(const dispose of f.cleanups)dispose()
})
test('only the current input owner can keep the first-send receipt surface alive',async()=>{
 const f=fixture();f.occupancy.setMode('play');await settle();await settle()
 const own=f.registrations.find(x=>x.options.name==='main.conversation'),body=f.registrations.find(x=>x.options.name===OPENING_SESSION_SLOT)
 const bridge=body.options.inject('s'),owner={}
 bridge.onComposerPending(owner,true)
 f.update(s=>({byId:{...s.byId,s:{...s.byId.s,blank:false,running:true}}}))
 await settle();assert.equal(own.active,true);assert.equal(bridge.getComposerPending(),true)
 bridge.onComposerPending({},false);await settle();assert.equal(own.active,true)
 bridge.onComposerPending(owner,false);await settle();assert.equal(own.active,false)
 for(const dispose of f.cleanups)dispose()
})
test('a pending composer receipt cannot retain a replaced session',async()=>{
 const f=fixture();f.occupancy.setMode('play');await settle();await settle()
 const own=f.registrations.find(x=>x.options.name==='main.conversation'),body=f.registrations.find(x=>x.options.name===OPENING_SESSION_SLOT)
 const bridge=body.options.inject('s'),owner={};bridge.onComposerPending(owner,true)
 f.update(s=>({byId:{s:{...s.byId.s,retainedBy:{}},ordinary:{...s.byId.ordinary,retainedBy:{mainView:1}}}}))
 assert.equal(own.active,false);assert.equal(bridge.getComposerPending(),false)
 bridge.onComposerPending(owner,true);await settle();assert.equal(own.active,false)
 for(const dispose of f.cleanups)dispose()
})
test('focus change and mode removal release the old opening before another classification finishes',async()=>{
 const f=fixture();f.occupancy.setMode('play');await settle();await settle()
 const own=f.registrations.find(x=>x.options.name==='main.conversation')
 f.update(s=>({byId:{s:{...s.byId.s,retainedBy:{}},ordinary:{...s.byId.ordinary,retainedBy:{mainView:1}}}}))
 assert.equal(own.active,false)
 await settle();await settle();assert.equal(f.registrations.some(x=>x.options.name==='main.conversation'&&x.active),false)
 f.occupancy.setMode('native');assert.equal(f.registrations.some(x=>x.active),false)
 for(const dispose of f.cleanups)dispose()
})
test('missing character never shadows the native blank-session layout',async()=>{
 const f=fixture();f.role(null);f.occupancy.setMode('play');await settle();await settle()
 assert.equal(f.registrations.some(x=>x.options.name==='main.conversation'),false)
 for(const dispose of f.cleanups)dispose()
})

test('failed character refresh releases the opening while retaining RP view preference',async t=>{
 const previousWindow=globalThis.window;globalThis.window=new EventTarget()
 t.after(()=>{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow})
 const f=fixture();t.after(()=>{for(const dispose of f.cleanups)dispose()})
 f.occupancy.setMode('play');await settle();await settle()
 const root=f.registrations.find(x=>x.options.name==='main.conversation'),view=f.registrations.find(x=>x.options.name==='conversation.view')
 assert.ok(root.active&&view.active)
 f.fail(true);window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));await settle();await settle()
 assert.equal(root.active,false);assert.equal(view.active,true)
 f.fail(false);window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));await settle();await settle()
 assert.ok(f.registrations.findLast(x=>x.options.name==='main.conversation').active)
 f.role('other');window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));await settle();await settle()
 assert.equal(f.registrations.some(x=>x.options.name==='main.conversation'&&x.active),false)
})

test('restored sessionless opening survives roster hydration and yields on a real native focus change', async t => {
 const previousWindow=globalThis.window, values=new Map([['pmp-dsh-tavern:active-opening-draft:v1','playthrough-draft']])
 globalThis.window=new EventTarget();window.sessionStorage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
 t.after(()=>{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow})
 let snapshot={phase:'pending',byId:{}}, notify=()=>{};const registrations=[],cleanups=[]
 const ctx={sessions:{list:{getSnapshot:()=>snapshot,subscribe:fn=>{notify=fn;return()=>{}}}},slots:{entries:()=>[],inject:(_,fn)=>cleanups.push(fn()),register(options,component){const row={options,component,active:true};registrations.push(row);return()=>{row.active=false}}},uiWorkspace:{openSession(){throw Error('Draft must not open a native Session')}}}
 const client={getWorkspace:async()=>({selected:true,rootPath:'/fixture'}),getCatalog:async()=>({playthroughs:[]})}
 const slots=installPlaySlotOccupancy(ctx,client);t.after(()=>cleanups.forEach(fn=>fn()));slots.setMode('play')
 const updates=[]; const unsubscribe=slots.subscribeDraft(()=>updates.push(slots.getActiveDraftId()));t.after(unsubscribe)
 assert.equal(slots.getActiveDraftId(),'playthrough-draft');slots.setMode('native');assert.equal(slots.getActiveDraftId(),null);slots.setMode('play');assert.equal(slots.getActiveDraftId(),'playthrough-draft')
 const draftRoot=registrations.find(row=>row.active&&row.options.name==='main.conversation')
 assert.equal(draftRoot.options.inject().draftId,'playthrough-draft');assert.equal(draftRoot.options.children,undefined)
 snapshot={phase:'ready',byId:{old:{id:'old',cwd:'/fixture',retainedBy:{mainView:1}}}};notify();await settle();assert.equal(draftRoot.active,true)
 snapshot={phase:'ready',byId:{new:{id:'new',cwd:'/fixture',retainedBy:{mainView:1}}}};notify();await settle()
 assert.equal(slots.getActiveDraftId(),null);assert(updates.includes(null));assert.equal(draftRoot.active,false);assert.equal(values.has('pmp-dsh-tavern:active-opening-draft:v1'),false)
})
