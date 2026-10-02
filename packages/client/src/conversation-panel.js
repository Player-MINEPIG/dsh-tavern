import { createElement as h, useEffect, useRef, useState } from 'react'
import { translate } from './i18n.js'
import { BubbleEditor } from './bubble-editor.js'
import { RegexPanel } from './play/regex-panel.js'
import { RenderingSettings } from './rendering-settings.js'

export function ConversationSettingsPanel({settings,status,busy,close,update,reset,client,activeSnapshot,registerBeforeLeave,initialTab='appearance'}) {
  const [tab,setTab]=useState(initialTab), dirty=useRef({appearance:false,regex:false})
  useEffect(()=>{const warn=event=>{if(Object.values(dirty.current).some(Boolean)){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[])
  useEffect(()=>registerBeforeLeave?.(()=>!(busy||Object.values(dirty.current).some(Boolean))||window.confirm(translate('rendering.unsaved'))),[registerBeforeLeave,busy])
  return h('div',{className:'dtv-panel dtv-conversation-settings'},
    h('div',{className:'dtv-header',style:{paddingRight:68}},h('div',{className:'dtv-title'},translate('conversationSettings.title')),h('button',{type:'button',className:'dtv-close',onClick:close,'aria-label':translate('appearance.close')},'✕')),
    h('div',{className:'dtv-body'},
      h('div',{role:'tablist','aria-label':translate('conversationSettings.title'),style:{display:'flex',gap:8,flexWrap:'wrap'}},...['appearance','regex','external'].map(value=>h('button',{key:value,type:'button',role:'tab','aria-selected':tab===value,className:'dtv-button',onClick:()=>setTab(value)},translate('rendering.tab.'+value)))),
      h('div',{hidden:tab!=='appearance',role:'tabpanel'},h(BubbleEditor,{settings,update,busy,status,onDirty:value=>{dirty.current.appearance=value}}),h('button',{type:'button',className:'dtv-button',disabled:busy,onClick:()=>{if(!dirty.current.appearance||window.confirm(translate('rendering.unsaved')))reset()}},translate('conversationSettings.reset'))),
      h('div',{hidden:tab!=='regex',role:'tabpanel'},h(RegexPanel,{client,activeSnapshot,close,embedded:true,onDirty:value=>{dirty.current.regex=value}})),
      h('div',{hidden:tab!=='external',role:'tabpanel'},h(RenderingSettings,{client,activeSnapshot}))))
}
