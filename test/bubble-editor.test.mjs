import test from 'node:test'
import assert from 'node:assert/strict'
import {parseHTML} from 'linkedom'
import {createElement as h,act} from 'react'
import {createRoot} from 'react-dom/client'
import {Simulate} from 'react-dom/test-utils'
import {BubbleEditor} from '../packages/client/src/bubble-editor.js'
import {messageBubbleStyle} from '../packages/client/src/play/message-layout.js'
import {getClientUiSettings,setClientUiSettings} from '../packages/client/src/i18n.js'

test('appearance editor independently previews and applies user and assistant widths',async t=>{
 const saved=Object.fromEntries(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,globalThis[key]])),locale=getClientUiSettings()
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,IS_REACT_ACT_ENVIRONMENT:true});setClientUiSettings({locale:'en',scale:1},{announce:false})
 const container=document.getElementById('root'),root=createRoot(container);let applied
 t.after(async()=>{await act(()=>root.unmount());setClientUiSettings(locale,{announce:false});for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 const settings={textScale:1,actionScale:1}
 await act(()=>root.render(h(BubbleEditor,{settings,update:value=>{applied=value}})))
 const preview=()=>[...container.querySelector('[aria-label="Style preview"]').querySelectorAll('.dtv-message-content>div')].slice(0,2)
 const [user,assistant]=preview()
 assert.equal(user.style.width,'fit-content');assert.equal(assistant.style.width,'100%')
 const choose=async(role,value)=>act(()=>Simulate.change(container.querySelector(`[aria-label="${role} Bubble width"]`),{target:{value}}))
 await choose('User','full');await choose('Character','content')
 assert.equal(preview()[0].style.width,'100%');assert.equal(preview()[1].style.width,'fit-content')
 assert.equal(applied,undefined,'preview changes are drafts until Apply')
 const apply=[...container.querySelectorAll('button')].find(button=>button.textContent==='Apply and save')
 await act(()=>Simulate.click(apply))
 assert.equal(applied.bubbleStyle.user.widthMode,'full');assert.equal(applied.bubbleStyle.assistant.widthMode,'content')
 for(const [index,role] of ['user','assistant'].entries())assert.equal(messageBubbleStyle(applied.bubbleStyle,role).width,preview()[index].style.width,'saved message layout matches the preview')
})
