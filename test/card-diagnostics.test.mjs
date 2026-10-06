import test from 'node:test'
import assert from 'node:assert/strict'
import {parseHTML} from 'linkedom'
import {createElement as h,act} from 'react'
import {createRoot} from 'react-dom/client'
import {CardDiagnosticBoundary,useCardDiagnostics} from '../packages/client/src/play/card-diagnostics.js'

function Source({messages,cardId}){useCardDiagnostics(messages,cardId);return h('span',{'data-dtv-card-instance':cardId},'card content')}

test('card notices stay outside the bubble and follow each mounted card independently',async t=>{
 const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,IS_REACT_ACT_ENVIRONMENT:true})
 const container=document.getElementById('root'),root=createRoot(container)
 t.after(async()=>{await act(()=>root.unmount());for(const [key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 const render=async cards=>act(()=>root.render(h(CardDiagnosticBoundary,null,h('div',{className:'dtv-play-chat-bubble'},...cards.map(([id,messages])=>h(Source,{key:id,cardId:id,messages}))))))
 await render([['a',['runtime failed']],['b',['photo failed']]])
 assert.equal(container.querySelectorAll('[role=alert]').length,2)
 assert.equal(container.querySelector('.dtv-play-chat-bubble [role=alert]'),null)
 assert.deepEqual([...container.querySelectorAll('[role=alert]')].map(el=>el.dataset.dtvCardInstance),['a','b'])
 const notice=container.querySelector('.dtv-card-diagnostic')
 assert.equal(notice.style.background,'#fff5cc')
 await act(()=>notice.querySelector('button').click())
 assert.deepEqual([...container.querySelectorAll('[role=alert]')].map(el=>el.textContent),['photo failed'])
 await render([['a',['runtime failed']],['b',['photo failed']]])
 assert.deepEqual([...container.querySelectorAll('[role=alert]')].map(el=>el.textContent),['photo failed'])
 await render([['a',['new runtime failure']],['b',['photo failed']]])
 assert.equal(container.querySelectorAll('[role=alert]').length,2)
 await render([['a',['runtime failed']],['b',[]]])
 assert.deepEqual([...container.querySelectorAll('[role=alert]')].map(el=>el.textContent),['runtime failed'])
 await render([['a',['<img src=x onerror=alert(1)>']]])
 assert.equal(container.querySelector('[role=alert]').textContent,'<img src=x onerror=alert(1)>')
 assert.equal(container.querySelector('img'),null)
 await render([['a',[]]])
 assert.equal(container.querySelector('[data-dtv-card-diagnostics]'),null)
 await render([['c',['new source failed']]])
 assert.equal(container.querySelectorAll('[role=alert]').length,1)
 await render([])
 assert.equal(container.querySelector('[role=alert]'),null)
})
