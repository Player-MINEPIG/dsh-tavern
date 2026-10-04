import { createElement as h, useEffect, useId, useRef, useState } from 'react'
import { translate } from './i18n.js'
import { BubbleEditor } from './bubble-editor.js'
import { RegexPanel } from './play/regex-panel.js'
import { RenderingSettings } from './rendering-settings.js'

const TABS = ['appearance', 'regex', 'external']

export function ConversationSettingsPanel({settings,status,busy,close,update,client,activeSnapshot,registerBeforeLeave,initialTab='appearance'}) {
  const [tab,setTab]=useState(initialTab), dirty=useRef({appearance:false,regex:false})
  const tabId = useId(), tabRefs = useRef({})
  function navigateTab(event, value) {
    const index = TABS.indexOf(value)
    const next = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length]
      : event.key === 'ArrowLeft' ? TABS[(index + TABS.length - 1) % TABS.length]
      : event.key === 'Home' ? TABS[0]
      : event.key === 'End' ? TABS[TABS.length - 1] : null
    if (!next) return
    event.preventDefault()
    setTab(next)
    tabRefs.current[next]?.focus()
  }
  const panelProps = value => ({
    hidden: tab !== value, role: 'tabpanel', tabIndex: 0,
    id: `${tabId}-panel-${value}`, 'aria-labelledby': `${tabId}-tab-${value}`,
  })
  useEffect(()=>{const warn=event=>{if(Object.values(dirty.current).some(Boolean)){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[])
  useEffect(()=>registerBeforeLeave?.(()=>!(busy||Object.values(dirty.current).some(Boolean))||window.confirm(translate('rendering.unsaved'))),[registerBeforeLeave,busy])
  return h('div',{className:'dtv-panel dtv-conversation-settings'},
    h('div',{className:'dtv-header'},h('div',{className:'dtv-title'},translate('conversationSettings.title')),h('button',{type:'button',className:'dtv-close',onClick:close,'aria-label':translate('appearance.close')},'✕')),
    h('div',{className:'dtv-body'},
      h('div', { className: 'dtv-settings-tabs', role: 'tablist', 'aria-label': translate('conversationSettings.title') },
        ...TABS.map(value => h('button', {
          key: value, type: 'button', role: 'tab', className: 'dtv-button',
          id: `${tabId}-tab-${value}`, 'aria-controls': `${tabId}-panel-${value}`,
          'aria-selected': tab === value, tabIndex: tab === value ? 0 : -1,
          ref: node => { tabRefs.current[value] = node },
          onClick: () => setTab(value), onKeyDown: event => navigateTab(event, value),
        }, translate('rendering.tab.' + value)))),
      h('div',panelProps('appearance'),h(BubbleEditor,{settings,update,busy,status,onDirty:value=>{dirty.current.appearance=value}}),h('button',{type:'button',className:'dtv-button',disabled:busy,onClick:()=>{if(!dirty.current.appearance||window.confirm(translate('rendering.unsaved')))update({...settings,bubbleStyle:undefined,textScale:1,actionScale:1})}},translate('conversationSettings.reset'))),
      h('div',panelProps('regex'),h(RegexPanel,{client,activeSnapshot,close,embedded:true,onDirty:value=>{dirty.current.regex=value}})),
      h('div',panelProps('external'),h(RenderingSettings,{client,activeSnapshot,settings,update,busy,status}))))
}
