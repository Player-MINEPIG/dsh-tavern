import { downloadRenderingSource } from './play/rendering-download.js'
import { createElement as h, useEffect, useRef, useState } from 'react'
import { translate } from './i18n.js'
import { CLIENT_REFRESH_EVENT } from '../../identity.js'
import { activeRegexBindings } from './play/regex-panel.js'
import { getRegexDocument } from './play/regex.js'
import { discoverDependencies, renderingInventory } from './play/rendering-sources.js'
import { renderingTrust } from './play/rendering-trust.js'

export function RenderingSettings({client,activeSnapshot}) {
  const [sources,setSources]=useState([]), [error,setError]=useState(''), [version,setVersion]=useState(0)
  const [revision,setRevision]=useState(renderingTrust.revision), [selected,setSelected]=useState(null)
  const generation=useRef(0), input=useRef(null), downloading=useRef(null)
  const [downloadKey,setDownloadKey]=useState(null)
  const bindings=activeRegexBindings(activeSnapshot)
  useEffect(()=>renderingTrust.subscribe(()=>setRevision(renderingTrust.revision())),[])
  useEffect(()=>{const refresh=()=>setVersion(v=>v+1);window.addEventListener(CLIENT_REFRESH_EVENT,refresh);return()=>window.removeEventListener(CLIENT_REFRESH_EVENT,refresh)},[])
  useEffect(()=>{
    const ticket=++generation.current;downloading.current?.abort();setDownloadKey(null);setSources([]);setError('');setSelected(null)
    Promise.all([
      bindings.characterId ? client.getCharacter(bindings.characterId):null,
      bindings.presetId ? client.getPreset(bindings.presetId):null,
      getRegexDocument(client).catch(error=>{if(ticket===generation.current)setError(error.message);return{rules:[]}}),
    ]).then(([character,preset,regex])=>{
      if(ticket!==generation.current)return
      setSources([
        ...renderingInventory(character?.character??character,{kind:'character',resourceId:bindings.characterId}),
        ...renderingInventory(preset?.preset??preset,{kind:'preset',resourceId:bindings.presetId}),
        ...renderingInventory({regex_scripts:regex.rules.filter(rule=>rule.scope.kind==='global')},{kind:'global',resourceId:'global'}),
      ])
    }).catch(error=>{if(ticket===generation.current)setError(error.message)})
    return()=>{generation.current++;downloading.current?.abort()}
  },[client,bindings.characterId,bindings.presetId,version])
  const entries=[]
  function add(entry,depth=0){
    const existing=entries.find(item=>item.owner===entry.owner&&item.key===entry.key)
    if(existing){existing.origins=[...new Set([...(existing.origins??[]),...(entry.origins??[])])];return}
    if(entries.length>=128)return
    entries.push(entry)
    const staged=renderingTrust.inspect(entry.owner,entry.key)
    if(staged&&depth<8)for(const dependency of discoverDependencies(staged.content,entry.url))add({...dependency,owner:entry.owner,key:dependency.url??dependency.raw,name:dependency.raw,kind:dependency.kind,enabled:true,origins:[...(entry.origins??[]),entry.key]},depth+1)
  }
  for(const source of sources){
    if(source.kind==='helper')add(source)
    for(const dependency of source.dependencies)add({...dependency,owner:source.owner,key:dependency.url??dependency.raw,name:dependency.raw,kind:dependency.kind,enabled:source.enabled,origins:[source.path]})
  }
  const run=async callback=>{try{setError('');await callback()}catch(error){setError(error.message)}}
  return h('section',{className:'dtv-rendering-settings','data-revision':revision},
    h('h3',null,translate('rendering.title')),
    h('p',null,translate('rendering.boundary')),
    h('p',null,translate('rendering.lifetime')),
    h('button',{type:'button',className:'dtv-button',onClick:()=>{downloading.current?.abort();renderingTrust.clear()}},translate('rendering.revokeAll')),
    h('input',{type:'file',hidden:true,ref:input,accept:'.js,.mjs,.html,.txt',onChange:event=>{
      const file=event.target.files?.[0], target=selected, ticket=generation.current;event.target.value=''
      if(!file||!target)return
      run(async()=>{if(file.size>128*1024)throw Error('Source exceeds 128 KiB');const content=await file.text();if(ticket!==generation.current)return;await renderingTrust.stage(target.owner,target.key,content)})
    }}),
    !entries.length?h('p',null,translate('rendering.empty')):null,
    ...entries.map(entry=>{
      const review=renderingTrust.inspect(entry.owner,entry.key)
      const changed=entry.kind==='helper'&&review?.content!==entry.content
      const approved=review?.approved&&!changed
      return h('details',{key:JSON.stringify([entry.owner,entry.key]),className:'dtv-entry'},
        h('summary',null,entry.name,' · ',translate(entry.blocked?'rendering.blocked':approved?'rendering.approved':review&&!changed?'rendering.staged':'rendering.waiting')),
        h('p',null,entry.owner,' · ',entry.kind),
        h('p',null,(entry.origins??[entry.path]).filter(Boolean).join(' → ')),
        !entry.enabled?h('p',null,translate('rendering.sourceDisabled')):null,
        h('p',null,entry.key),
        entry.blocked||entry.kind==='helper'?null:h('button',{type:'button',className:'dtv-button',disabled:downloadKey===entry.key,onClick:()=>run(async()=>{
          downloading.current?.abort();const controller=new AbortController();downloading.current=controller;setDownloadKey(entry.key);const ticket=generation.current;const timer=setTimeout(()=>controller.abort(),15000)
          try{const content=await downloadRenderingSource(entry.url,{signal:controller.signal});if(ticket===generation.current&&!controller.signal.aborted)await renderingTrust.stage(entry.owner,entry.key,content)}finally{clearTimeout(timer);if(downloading.current===controller){downloading.current=null;setDownloadKey(null)}}
        })},translate('rendering.download')),
        downloadKey===entry.key?h('button',{type:'button',className:'dtv-button',onClick:()=>downloading.current?.abort()},translate('rendering.cancel')):null,
        entry.blocked?null:h('button',{type:'button',className:'dtv-button',onClick:()=>entry.kind==='helper'?run(()=>renderingTrust.stage(entry.owner,entry.key,entry.content)):(setSelected(entry),input.current.click())},translate(entry.kind==='helper'?'rendering.reviewInline':'rendering.import')),
        review?h('div',null,
          h('p',null,'SHA-256: ',review.digest??translate('common.loading')),
          h('textarea',{readOnly:true,value:review.content,rows:8,'aria-label':translate('rendering.source'),style:{width:'100%',boxSizing:'border-box'}}),
          h('button',{type:'button',className:'dtv-button',disabled:!review.digest||approved||changed||entry.blocked||!entry.enabled,onClick:()=>run(()=>renderingTrust.approve(entry.owner,entry.key,review.digest))},translate('rendering.approve')),
          h('button',{type:'button',className:'dtv-button',onClick:()=>{if(downloadKey===entry.key)downloading.current?.abort();renderingTrust.revoke(entry.owner,entry.key)}},translate('rendering.revoke'))):null)
    }),
    error?h('p',{role:'alert'},error):null)
}
