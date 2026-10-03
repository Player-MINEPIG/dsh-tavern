import { renderingSettingsStyles } from './rendering-settings-styles.js'
import { updateScriptEnablement } from '../../presentation/script-enablement.js'
import {mvuBuiltin} from './play/mvu-builtins.js'
import {renderingWriteRequests} from './play/rendering-write-requests.js'
import { downloadRenderingSource } from './play/rendering-download.js'
import { createElement as h, useEffect, useRef, useState } from 'react'
import { translate } from './i18n.js'
import { CLIENT_REFRESH_EVENT } from '../../identity.js'
import { activeRegexBindings } from './play/regex-panel.js'
import { getRegexDocument } from './play/regex.js'
import { readRenderingWorkspace, identifyRenderingSources, renderingEntries, renderingInventory } from './play/rendering-sources.js'
import { renderingTrust } from './play/rendering-trust.js'

let HostTooltip
export function configureRenderingTooltip(Tooltip) { HostTooltip = Tooltip }

export function RenderingSettings({client,activeSnapshot,settings={},update,busy=false,status}) {
  const [sources,setSources]=useState([]), [error,setError]=useState(''), [version,setVersion]=useState(0)
  const [revision,setRevision]=useState(renderingTrust.revision), [selected,setSelected]=useState(null)
  const generation=useRef(0), input=useRef(null), downloading=useRef(null)
  const [downloadKey,setDownloadKey]=useState(null)
  const [,setWriteRevision]=useState(0)
  useEffect(()=>renderingWriteRequests.subscribe(()=>setWriteRevision(v=>v+1)),[])
  const bindings=activeRegexBindings(activeSnapshot)
  useEffect(()=>renderingTrust.subscribe(()=>setRevision(renderingTrust.revision())),[])
  useEffect(()=>{const refresh=()=>setVersion(v=>v+1);window.addEventListener(CLIENT_REFRESH_EVENT,refresh);return()=>window.removeEventListener(CLIENT_REFRESH_EVENT,refresh)},[])
  useEffect(()=>{
    const ticket=++generation.current;downloading.current?.abort();setDownloadKey(null);setSources([]);setError('');setSelected(null)
    Promise.all([
      bindings.characterId ? client.getCharacter(bindings.characterId):null,
      bindings.presetId ? client.getPreset(bindings.presetId):null,
      readRenderingWorkspace(client,()=>getRegexDocument(client).catch(error=>{if(ticket===generation.current)setError(error.message);return{rules:[]}})),
    ]).then(async ([character,preset,{owner:globalOwner,resource:regex}])=>{
      if(ticket!==generation.current)return
      const inventory=await identifyRenderingSources([
        ...renderingInventory(character?.character??character,{kind:'character',resourceId:bindings.characterId}),
        ...renderingInventory(preset?.preset??preset,{kind:'preset',resourceId:bindings.presetId}),
        ...(globalOwner?renderingInventory({regex_scripts:regex.rules.filter(rule=>rule.scope.kind==='global')},{kind:'global',resourceId:globalOwner.slice(7)}):[]),
      ])
      if(ticket===generation.current)setSources(inventory)
    }).catch(error=>{if(ticket===generation.current)setError(error.message)})
    return()=>{generation.current++;downloading.current?.abort()}
  },[client,bindings.characterId,bindings.presetId,version])
  const entries=renderingEntries(sources,renderingTrust)
  const run=async callback=>{try{setError('');await callback()}catch(error){setError(error.message)}}
  const help = (label, text) => h(HostTooltip??'span',HostTooltip?{label:text,portal:true,maxWidth:320,side:'bottom',openOnClick:true}:{title:text},h('button',{type:'button',className:'dtv-script-info','aria-label':label},'ⓘ'))
  const sourceView = content => h('textarea',{className:'dtv-script-source',readOnly:true,value:content,spellCheck:false,wrap:'off','aria-label':translate('rendering.source')})
  const changeEnabled = (entry, enabled) => run(()=>update?.({...settings,scriptEnablement:updateScriptEnablement(settings.scriptEnablement,entry.owner,entry.preferenceKey??entry.key,enabled)}))
  const renderEntry = entry => {
    const review=renderingTrust.inspect(entry.owner,entry.key)
    const changed=entry.kind==='helper'&&review?.content!==entry.content
    const approved=review?.approved&&!changed
    const enabled=renderingTrust.isEnabled(entry.owner,entry.preferenceKey??entry.key,entry.enabled)
    const overridden=(settings.scriptEnablement?.entries??[]).some(item=>item.owner===entry.owner&&item.key===(entry.preferenceKey??entry.key))
    const displayName=entry.kind==='helper'||!entry.url?entry.name:new URL(entry.url).hostname+' /…/'+entry.url.split('/').at(-1).slice(-32)
    const state=entry.blocked?'rendering.blocked':!enabled?'rendering.disabled':approved?'rendering.approved':review&&!changed?'rendering.staged':entry.kind==='helper'?'rendering.needsReview':'rendering.waiting'
    return h('details',{key:JSON.stringify([entry.owner,entry.key]),className:'dtv-entry dtv-script-entry','data-enabled':enabled},
      h('summary',null,
        h('input',{type:'checkbox',checked:enabled,disabled:busy||!update||entry.blocked,'aria-label':translate('rendering.enableEntry',{name:entry.name}),onClick:event=>event.stopPropagation(),onChange:event=>changeEnabled(entry,event.target.checked)}),
        h('span',{className:'dtv-entry-name',title:entry.name},displayName),h('span',{className:'dtv-entry-state'},translate(state))),
      h('div',{className:'dtv-entry-body'},
        h('p',{className:'dtv-script-meta'},entry.owner,' · ',(entry.origins??[entry.path]).filter(Boolean).join(' → ')),
        entry.kind==='helper'?sourceView(entry.content):h('p',{className:'dtv-script-meta'},entry.key),
        entry.kind!=='helper'&&review?sourceView(review.content):null,
        entry.kind!=='helper'&&!review?h('p',{className:'dtv-script-meta'},translate('rendering.importToRead')):null,
        h('div',{className:'dtv-script-actions'},
          entry.blocked||entry.kind==='helper'?null:h('button',{type:'button',className:'dtv-button',disabled:downloadKey===entry.key,onClick:()=>run(async()=>{
            downloading.current?.abort();const controller=new AbortController();downloading.current=controller;setDownloadKey(entry.key);const ticket=generation.current;const timer=setTimeout(()=>controller.abort(),15000)
            try{const content=await downloadRenderingSource(entry.url,{signal:controller.signal});if(ticket===generation.current&&!controller.signal.aborted)await renderingTrust.stage(entry.owner,entry.key,content)}finally{clearTimeout(timer);if(downloading.current===controller){downloading.current=null;setDownloadKey(null)}}
          })},translate('rendering.download')),
          downloadKey===entry.key?h('button',{type:'button',className:'dtv-button',onClick:()=>downloading.current?.abort()},translate('rendering.cancel')):null,
          entry.blocked?null:h('button',{type:'button',className:'dtv-button',onClick:()=>entry.kind==='helper'?run(()=>renderingTrust.stage(entry.owner,entry.key,entry.content)):(setSelected(entry),input.current.click())},translate(entry.kind==='helper'?'rendering.reviewInline':'rendering.import')),
          overridden?h('button',{type:'button',className:'dtv-button',disabled:busy,onClick:()=>changeEnabled(entry,undefined)},translate('rendering.resetEntry')):null),
        review?h('div',{className:'dtv-script-group'},
          changed?h('p',{className:'dtv-script-meta'},translate('rendering.changed')):null,
          approved&&mvuBuiltin(entry.url,review.digest)?h('label',{className:'dtv-check'},
            h('input',{type:'checkbox',checked:review.builtin===true,onChange:event=>run(()=>renderingTrust.setBuiltin(entry.owner,entry.key,event.target.checked))}),translate('rendering.builtinMvu')):null,
          h('div',{className:'dtv-script-actions'},help(translate('rendering.sourceDetails'),'SHA-256: '+(review.digest??translate('common.loading')))),
          h('div',{className:'dtv-script-actions'},
            h('button',{type:'button',className:'dtv-button',disabled:!review.digest||approved||changed||entry.blocked||!enabled,onClick:()=>run(()=>renderingTrust.approve(entry.owner,entry.key,review.digest))},translate('rendering.approve')),
            h('button',{type:'button',className:'dtv-button',onClick:()=>{if(downloadKey===entry.key)downloading.current?.abort();renderingTrust.revoke(entry.owner,entry.key)}},translate('rendering.revoke')))):null))
  }
  return h('section',{className:'dtv-rendering-settings','data-revision':revision},
    h('style',null,renderingSettingsStyles),
    h('h3',null,translate('rendering.title')),
    h('label',{className:'dtv-script-control'},h('input',{type:'checkbox',checked:settings.interactiveCards===true,disabled:busy||!update,onChange:event=>update({...settings,interactiveCards:event.target.checked})}),translate('rendering.master')),
    h('p',{className:'dtv-script-meta'},translate(settings.interactiveCards===true?'rendering.masterOn':'rendering.masterOff')),
    status?.text?h('p',{className:'dtv-script-meta',role:status.error?'alert':'status'},status.text):null,
    h('input',{type:'file',hidden:true,ref:input,accept:'.js,.mjs,.html,.txt',onChange:event=>{
      const file=event.target.files?.[0], target=selected, ticket=generation.current;event.target.value=''
      if(!file||!target)return
      run(async()=>{if(file.size>8*1024*1024)throw Error('Source exceeds 8 MiB');const content=await file.text();if(ticket!==generation.current)return;await renderingTrust.stage(target.owner,target.key,content)})
    }}),
    ...['helper','dependency'].map(group=>h('section',{key:group,className:'dtv-script-group','aria-label':translate(group==='helper'?'rendering.cardScripts':'rendering.dependencies')},
      h('div',{className:'dtv-script-actions'},h('h4',null,translate(group==='helper'?'rendering.cardScripts':'rendering.dependencies')),help(translate('rendering.safetyDetails'),translate(group==='helper'?'rendering.enablementHelp':'rendering.boundary'))),
      ...entries.filter(entry=>(entry.kind==='helper')===(group==='helper')).map(renderEntry),
      !entries.some(entry=>(entry.kind==='helper')===(group==='helper'))?h('p',{className:'dtv-script-meta'},translate('rendering.none')):null)),
    h('section',{className:'dtv-script-group dtv-script-operations'},
      h('div',{className:'dtv-script-actions'},h('h4',null,translate('rendering.operations')),help(translate('rendering.safetyDetails'),translate('rendering.lifetime'))),
      h('div',{className:'dtv-script-actions'},h('button',{type:'button',className:'dtv-button',onClick:()=>{downloading.current?.abort();renderingTrust.clear()}},translate('rendering.revokeAll'))),
        ...renderingWriteRequests.listRevocations().map(item=>h('div',{key:item.id,role:'alert'},
          h('p',null,translate('rendering.revokePending'),item.error?' · '+item.error:''),
          h('button',{type:'button',disabled:item.pending,onClick:()=>run(()=>renderingWriteRequests.retryRevocation(item.id))},translate('rendering.retryRevoke')))),
      h('details',{className:'dtv-script-group dtv-write-permissions'},
        h('summary',null,translate('rendering.writeTitle'),' · ',translate(renderingWriteRequests.list().some(entry=>entry.granted)?'rendering.writeGranted':'rendering.writeOff')),
        h('div',{className:'dtv-script-actions'},help(translate('rendering.writeTitle'),translate('rendering.writeBoundary'))),
        ...renderingWriteRequests.list().map(entry=>h('details',{key:entry.id,className:'dtv-write-review'},
          h('summary',null,entry.sourceIdentity?.scope?.nodeId??entry.id,' · ',translate(entry.granted?'rendering.writeGranted':'rendering.writeOff')),
          h('p',{className:'dtv-script-meta'},'SHA-256: ',entry.sourceIdentity?.sha256??translate('common.loading')),
          sourceView(entry.source),
          h('div',{className:'dtv-script-actions'},
            h('button',{type:'button',className:'dtv-button',disabled:!entry.sourceIdentity||entry.reviewed,onClick:()=>run(()=>renderingWriteRequests.review(entry.id))},translate('rendering.reviewBundle')),
            h('button',{type:'button',className:'dtv-button',disabled:!entry.reviewed||entry.granted,onClick:()=>run(()=>renderingWriteRequests.authorize(entry.id))},translate('rendering.allowWrites')),
            h('button',{type:'button',className:'dtv-button',onClick:()=>renderingWriteRequests.revoke(entry.id)},translate('rendering.revokeWrites'))),
          entry.error?h('p',{role:'alert'},entry.error):null)))),
    error?h('p',{role:'alert'},error):null)
}
