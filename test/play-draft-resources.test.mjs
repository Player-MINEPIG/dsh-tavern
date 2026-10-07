import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { createElement as h, act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { createDraftResourceTarget } from '../packages/client/src/play/draft-resources.js'
import { PresetSidebar } from '../packages/preset/src/client.js'
import { UserPanel } from '../packages/user/src/client.js'
import { WorldBookPanel } from '../packages/world-book-library/src/client.js'
import { CharacterPanel } from '../packages/character/src/client.js'
import { AssemblyPanel } from 'dsh-prompt-assembler/panel'
import { launcherResourceStatuses } from '../packages/client/src/state.js'
import { getClientUiSettings, setClientUiSettings } from '../packages/client/src/i18n.js'

 test('launcher resource panels edit the opening draft and leave native session selections alone', async t => {
  const saved = Object.fromEntries(['window','document','Event','fetch','getComputedStyle','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,globalThis[key]])), settings=getClientUiSettings()
  const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>')
  Object.assign(globalThis,{window,document,Event:window.Event,getComputedStyle:()=>({display:'block'}),IS_REACT_ACT_ENVIRONMENT:true})
  setClientUiSettings({locale:'en',scale:1},{announce:false})
  let draft={id:'draft',phase:'draft',revision:0,selection:{presetId:'p1',userId:'u1',characterCardId:'c1',character:{greetingIndex:0},worldBookIds:['b1']},assembly:{id:'a1',name:'Assembly one',rules:[]}}
  const originals=structuredClone(draft), writes=[], calls=[]
  const presets=[{id:'p1',name:'Preset one',sampling:{},prompts:[],promptOrder:[]},{id:'p2',name:'Preset two',sampling:{},prompts:[],promptOrder:[]}],users=[{id:'u1',name:'User one',description:''}],books=[{id:'b1',name:'Book one',book:{entries:[]}}],characters=[{id:'c1',name:'Character one',source:{format:'json'},compatibility:{warnings:[],unsupportedFeatures:[],unknownMacroNames:[]},data:{characterBook:null,firstMessage:'Greeting'}},{id:'c2',name:'Other character',source:{format:'json'},compatibility:{warnings:[],unsupportedFeatures:[],unknownMacroNames:[]},data:{characterBook:null,firstMessage:'Other'}}],assemblies=[draft.assembly,{id:'a2',name:'Assembly two',version:1,rules:[]}]
  const client={getDraft:async()=>({draft:structuredClone(draft)}),putDraft:async(id,patch)=>{assert.equal(id,'draft');assert.equal(patch.expectedRevision,draft.revision);writes.push(patch);draft={...draft,...patch,revision:draft.revision+1};if(Object.hasOwn(patch,'assemblyPresetId'))draft.assembly=assemblies.find(row=>row.id===patch.assemblyPresetId)??null;return{draft:structuredClone(draft)}}}
  const fetcher=async(url,options={})=>{
    calls.push({url,method:options.method??'GET'})
    if (url.endsWith('/drafts/draft/preview')) {
      assert.equal(options.method, 'POST')
      const body = JSON.parse(options.body)
      assert.equal(body.expectedRevision, draft.revision); assert.equal(body.preset.id, 'a2')
      return Response.json({ ok: true, preview: { scope: 'opening-draft', nodes: [], messages: [], diagnostics: [] } })
    }
    assert.equal(options.method??'GET','GET','no native session writes')
    let data
    const route=url.split('?')[0].replace('/pmp-dsh-tavern/api/v1','')
    if(route==='/presets')data={presets,selectedId:'native-global-preset'}
    else if(route==='/users')data={users}
    else if(route==='/world-books')data={worldBooks:books}
    else if(route.startsWith('/world-books/'))data={worldBook:books[0]}
    else if(route==='/characters')data={characters}
    else if(route.endsWith('/world-books'))data={binding:{worldBookIds:[]}}
    else if(route.startsWith('/presets/'))data={preset:presets.find(row=>route.endsWith(row.id))}
    else if(route.startsWith('/users/'))data={user:users[0]}
    else if(route.startsWith('/characters/'))data={character:characters.find(row=>route.endsWith(row.id))}
    else if(url.startsWith('/dsh-prompt-assembler'))data={presets:assemblies,selection:{id:'native-strategy',name:'Native strategy'},capability:true,sources:[],defaultPresetId:'a1'}
    else throw Error(url)
    return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})
  }
  globalThis.fetch=fetcher
  const target=createDraftResourceTarget({client,draftId:'draft',label:'Opening draft',fetcher}),container=document.getElementById('root'),root=createRoot(container)
  t.after(async()=>{await act(()=>root.unmount());setClientUiSettings(settings,{announce:false});for(const[key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
  const render=async(Component,props={})=>act(async()=>{root.render(h(Component,{key:Component.name,bindingTarget:target,sessionId:null,sessionBlank:true,close(){},...props}));await new Promise(resolve=>setImmediate(resolve))})
  const button=text=>[...container.querySelectorAll('button')].find(row=>row.textContent===text)
  await render(PresetSidebar,{autoOpen:false,closePanel(){},openPanel(){}})
  assert(container.textContent.includes('Preset one'))
  const chooser=container.querySelector('select')
  await act(async()=>{Simulate.change(chooser,{target:{value:'p2'}});await new Promise(resolve=>setImmediate(resolve))})
  await act(async()=>{Simulate.click(container.querySelector('.dtt-actions .dtt-button-primary'));await new Promise(resolve=>setImmediate(resolve))})
  assert.equal(draft.selection.presetId,'p2')
  assert.equal(launcherResourceStatuses(await target.active()).preset.title,'Preset two')
  await render(UserPanel);assert(container.textContent.includes('User one'));assert(!container.querySelector('.dtu-actions .dtu-primary').disabled)
  await render(WorldBookPanel);assert(container.textContent.includes('Book one'));assert(container.textContent.includes('Opening draft'))
  await render(CharacterPanel);assert(container.textContent.includes('Character one'));assert(container.textContent.includes('Opening draft'))
  assert(container.querySelector('.dcc-actions button:nth-child(2)').disabled,'draft character cannot be detached')
  await act(async()=>{Simulate.change(container.querySelector('.dcc-browse select'),{target:{value:'c2'}});await new Promise(resolve=>setImmediate(resolve))})
  assert(container.querySelector('.dcc-actions .dcc-primary').disabled,'another character requires another playthrough')
  await render(AssemblyPanel,{selectionTarget:target,locale:'en',fetcher,standalone:true})
  assert(container.textContent.includes('Applied: Assembly one'));assert(!button('Apply to this session').disabled)
  await act(()=>Simulate.change(container.querySelector('.dta-grid select'),{target:{value:'a2'}}))
  await act(async()=>{Simulate.click(button('Apply to this session'));await new Promise(resolve=>setImmediate(resolve))})
  assert.equal(draft.assembly.id,'a2');assert(container.textContent.includes('Applied: Assembly two'),container.textContent)
  assert(!button('Preview current configuration').disabled,'opening drafts have an explicit preview target')
  assert(button('View latest actual request').disabled, 'no actual request exists before sending')
  await act(async()=>{Simulate.click(button('Preview current configuration'));await new Promise(resolve=>setImmediate(resolve))})
  assert(container.textContent.includes('opening draft’s logical order'), container.textContent)
  assert(calls.some(call=>call.url.endsWith('/drafts/draft/preview')))
  assert(!calls.some(call=>call.url.endsWith('/assembly-presets/preview')), 'never preview an unrelated native session')
  assert.equal(draft.selection.characterCardId,originals.selection.characterCardId)
  assert.equal(writes.length,2);assert(calls.every(call=>!call.url.includes('sessionId=native')))
  draft.phase='preparing'
  await assert.rejects(target.request('/character-selection',{method:'POST',body:JSON.stringify({characterCardId:'c2'})}),/new playthrough/)
 })

for (const source of ['embedded', 'character', 'preset', 'user', 'none', 'all']) {
 test(`draft world-book status includes ${source} sources without activation or native Session reads`, async () => {
  const has = value => source === value || source === 'all'
  const selection = { characterCardId:'c', presetId:'p', userId:'u', worldBookIds:source === 'all' ? ['b'] : [], character:{greetingIndex:0} }
  const character = { id:'c', name:'Card', data:{characterBook:has('embedded') ? {entries:[{enabled:false,content:'not triggered'}]} : null} }
  const calls = [], client = {getDraft:async()=>({draft:{id:'d',phase:'draft',selection}})}
  const fetcher = async url => {
   calls.push(url);assert(!url.includes('sessionId='))
   const route=url.replace('/pmp-dsh-tavern/api/v1','')
   const result = route === '/characters/c' ? {character}
    : route === '/presets/p' ? {preset:{id:'p',name:'Preset'}}
    : route === '/users/u' ? {user:{id:'u',name:'User'}}
    : route === '/world-books' ? {worldBooks:[{id:'b',name:'Bound book'},{id:'unused',name:'Not selected'}]}
    : route === '/characters/c/world-books' ? {binding:{worldBookIds:has('character') ? ['b'] : []}}
    : route === '/presets/p/world-books' ? {binding:{worldBookIds:has('preset') ? ['b'] : []}}
    : route === '/users/u/world-books' ? {binding:{worldBookIds:has('user') ? ['b'] : []}}
    : null
   assert(result,url);return Response.json(result)
  }
  const target=createDraftResourceTarget({client,draftId:'d',fetcher}), snapshot=await target.active(), status=launcherResourceStatuses(snapshot)['world-info']
  assert.equal(status.bound,source!=='none')
  assert.equal(status.count,source==='none' ? 0 : source==='all' ? 2 : 1)
  assert(!status.title?.includes('Not selected'))
  if(has('embedded')) assert(snapshot.resources.worldBooks.some(row=>row.kind==='embedded-character-book'&&row.id==='character:c:embedded-world-book'))
  if(source==='all') {
   assert.deepEqual(snapshot.sessionSelection.worldBookIds,['b']);assert.deepEqual(snapshot.selection.worldBookIds,['b'])
   assert.deepEqual(snapshot.worldBookSelection.characterBoundIds,['b']);assert.deepEqual(snapshot.worldBookSelection.presetBoundIds,['b']);assert.deepEqual(snapshot.worldBookSelection.userBoundIds,['b'])
  }
  assert.deepEqual(selection.worldBookIds,source==='all' ? ['b'] : [],'aggregation must not save implicit bindings as explicit choices')
 })
}
