import { renderingSettingsStyles } from './rendering-settings-styles.js'
import { updateScriptEnablement } from '../../presentation/script-enablement.js'
import { updateRenderingAdapter } from '../../presentation/rendering-adapters.js'
import {builtinCandidate} from './play/rendering-selection.js'
import {renderingWriteRequests} from './play/rendering-write-requests.js'
import { renderingDependencies, dependencyProgress } from './play/rendering-dependencies.js'
import { createElement as h, useEffect, useRef, useState } from 'react'
import { translate } from './i18n.js'
import { CLIENT_REFRESH_EVENT } from '../../identity.js'
import { activeRegexBindings } from './play/regex-panel.js'
import { getRegexDocument } from './play/regex.js'
import { readRenderingWorkspace, identifyRenderingSources, renderingInventory } from './play/rendering-sources.js'
import { renderingTrust } from './play/rendering-trust.js'

let HostTooltip
export function configureRenderingTooltip(Tooltip) { HostTooltip = Tooltip }

export function RenderingSettings({client,activeSnapshot,settings={},update,busy=false,status}) {
  const [sources,setSources]=useState([]), [error,setError]=useState(''), [version,setVersion]=useState(0)
  const [revision,setRevision]=useState(renderingTrust.revision), [dependencyRevision,setDependencyRevision]=useState(0)
  const generation=useRef(0)
  const [,setWriteRevision]=useState(0)
  useEffect(()=>renderingWriteRequests.subscribe(()=>setWriteRevision(v=>v+1)),[])
  const bindings=activeRegexBindings(activeSnapshot)
  useEffect(()=>renderingDependencies.subscribe(()=>setDependencyRevision(value=>value+1)),[])
  useEffect(()=>renderingTrust.subscribe(()=>setRevision(renderingTrust.revision())),[])
  useEffect(()=>{const refresh=()=>setVersion(v=>v+1);window.addEventListener(CLIENT_REFRESH_EVENT,refresh);return()=>window.removeEventListener(CLIENT_REFRESH_EVENT,refresh)},[])
  useEffect(()=>{
    const ticket=++generation.current;setSources([]);setError('')
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
      if(ticket===generation.current){setSources(inventory);await renderingDependencies.sync(inventory,[bindings.characterId&&'character:'+bindings.characterId,bindings.presetId&&'preset:'+bindings.presetId,globalOwner])}
    }).catch(error=>{if(ticket===generation.current)setError(error.message)})
    return()=>{generation.current++}
  },[client,bindings.characterId,bindings.presetId,version])
  useEffect(()=>{
    if(sources.length)void renderingDependencies.sync(sources).catch(error=>setError(error.message))
  },[sources,settings.scriptEnablement,settings.renderingAdapters])
  const run=async callback=>{try{setError('');await callback()}catch(error){setError(error.message)}}
  const help = (label, text) => h(HostTooltip??'span',HostTooltip?{label:text,portal:true,maxWidth:320,side:'bottom',openOnClick:true}:{title:text},h('button',{type:'button',className:'dtv-script-info','aria-label':label},'ⓘ'))
  const sourceView = content => h('textarea',{className:'dtv-script-source',readOnly:true,value:content,spellCheck:false,wrap:'off','aria-label':translate('rendering.source')})
  const changeEnabled = (entry, enabled) => run(()=>update?.({...settings,scriptEnablement:updateScriptEnablement(settings.scriptEnablement,entry.owner,entry.preferenceKey??entry.key,enabled)}))
  const changeAdapter = (owner,source,mode) => run(()=>update?.({...settings,renderingAdapters:updateRenderingAdapter(settings.renderingAdapters,owner,source,mode==='auto'?undefined:mode)}))
  const helpers=sources.filter(source=>source.kind==='helper')
  const owners=[...new Set(sources.filter(source=>source.dependencies.length).map(source=>source.owner))]
  const renderHelper = entry => {
    const enabled=entry.enablementAmbiguous?entry.enabled:renderingTrust.isEnabled(entry.owner,entry.preferenceKey??entry.key,entry.enabled)
    const overridden=!entry.enablementAmbiguous&&(settings.scriptEnablement?.entries??[]).some(item=>item.owner===entry.owner&&item.key===(entry.preferenceKey??entry.key))
    return h('details',{key:entry.key,className:'dtv-entry dtv-script-entry','data-enabled':enabled},
      h('summary',null,
        h('input',{type:'checkbox',checked:enabled,disabled:busy||!update||entry.enablementAmbiguous,'aria-label':translate('rendering.enableEntry',{name:entry.name}),onClick:event=>event.stopPropagation(),onChange:event=>changeEnabled(entry,event.target.checked)}),
        h('span',{className:'dtv-entry-name'},entry.name),h('span',{className:'dtv-entry-state'},translate(enabled?'rendering.enabled':'rendering.disabled'))),
      h('div',{className:'dtv-entry-body'},
        entry.enablementAmbiguous?h('p',{className:'dtv-script-meta'},translate('rendering.ambiguousIdentity')):null,
        h('p',{className:'dtv-script-meta'},entry.owner,' · ',entry.path),sourceView(entry.content),
        overridden?h('button',{type:'button',className:'dtv-button',disabled:busy,onClick:()=>changeEnabled(entry,undefined)},translate('rendering.resetEntry')):null))
  }
  const renderGraph = owner => {
    const graph=renderingDependencies.inspect(owner),state=graph?.status??'loading',items=graph?.items??[]
    const working=state==='downloading'||state==='loading'
    const progress=dependencyProgress(graph),count=progress.discovered+(progress.capped?'+':'')
    const label=!graph?translate('rendering.graph.unknown'):progress.complete?progress.ready+' / '+count+' · '+translate('rendering.graph.complete'):
      ['waiting','changed','loading','remote'].includes(state)?'0 / '+count+' · '+translate('rendering.graph.roots'):
      translate('rendering.graph.discovered',{ready:progress.ready,count})+' · '+translate(state==='downloading'?'rendering.graph.discovering':'rendering.graph.incomplete')
    return h('section',{key:owner,className:'dtv-script-group dtv-dependency-graph'},
      h('p',{className:'dtv-script-meta'},owner),
      h('p',{role:'status'},translate('rendering.graph.'+state),' · ',label),
      progress.failed?h('p',{className:'dtv-script-meta'},translate('rendering.graph.issues',{count:progress.failed})):null,
      state==='downloading'?h('progress',{'aria-label':translate('rendering.graph.downloading'),value:progress.ready+progress.failed,max:Math.max(1,progress.discovered)}):null,
      graph?.error?h('p',{role:'alert',className:'dtv-script-meta'},graph.error):null,
      progress.omitted?h('p',{role:'alert',className:'dtv-script-meta'},translate('rendering.graph.omitted',{count:progress.omitted+(progress.capped?'+':'')})):null,
      h('p',{className:'dtv-script-meta'},translate('rendering.selectionScope')),
      h('div',{className:'dtv-script-actions'},
        h('button',{type:'button',className:'dtv-button',disabled:working,onClick:()=>run(()=>renderingDependencies.acquire(owner,{refresh:state!=='waiting'}))},translate(state==='waiting'?'rendering.acquire':state==='changed'?'rendering.acquireUpdate':'rendering.redownload')),
        h('button',{type:'button',className:'dtv-button',disabled:state==='loading',onClick:()=>run(()=>renderingDependencies.uninstall(owner))},translate(state==='downloading'?'rendering.cancel':'rendering.uninstall'))),
      h('div',{className:'dtv-dependency-items'},...[...items,...(graph?.excluded??[])].map(item=>{
        const enabled=renderingTrust.isEnabled(owner,item.url),selected=item.status!=='disabled',candidate=builtinCandidate(item.url)
        const cached=graph?.retained?.find(record=>record.url===item.url),content=item.content??cached?.content
        const displayUrl=item.url?new URL(item.url).hostname+new URL(item.url).pathname:item.key
        return h('details',{key:item.key,className:'dtv-entry','data-selected':selected},
          h('summary',null,h('input',{type:'checkbox',checked:enabled,disabled:!item.url||busy||!update,'aria-label':translate('rendering.enableEntry',{name:item.key}),onClick:event=>event.stopPropagation(),onChange:event=>changeEnabled({owner,key:item.url},event.target.checked)}),h('span',{className:'dtv-entry-name'},displayUrl),h('span',{className:'dtv-entry-state'},translate(!selected?'rendering.excluded':item.builtin?'rendering.builtinProvided':enabled?'rendering.graph.'+item.status:'rendering.disabled'))),
          h('div',{className:'dtv-entry-body'},h('p',{className:'dtv-script-meta'},item.key),item.error?h('p',{role:'alert',className:'dtv-script-meta'},item.error):null,
            item.origins?.length?h('p',{className:'dtv-script-meta'},translate('rendering.origins'),item.origins.join(' · ')):null,
            candidate?h('label',{className:'dtv-script-control'},translate('rendering.adapterMode'),h('select',{className:'dtv-select',disabled:busy||!update,'aria-label':translate('rendering.adapterMode')+' '+item.key,value:renderingTrust.adapterIntent(owner,item.url)??'auto',onChange:event=>changeAdapter(owner,item.url,event.target.value)},h('option',{value:'auto'},translate('rendering.adapterAuto')),h('option',{value:'builtin'},translate('rendering.adapterBuiltin')),h('option',{value:'original'},translate('rendering.adapterOriginal')))):null,
            item.builtin?help(translate('rendering.adapterHelp'),translate('rendering.builtinMvu')):null,
            content!==undefined?sourceView(content):null))
      })),
      graph?.retained?.length?h('details',{className:'dtv-script-group dtv-retained-dependencies'},h('summary',null,translate('rendering.retained',{count:graph.retained.length})),h('p',{className:'dtv-script-meta'},translate('rendering.retainedHelp')),...graph.retained.map(item=>h('details',{key:item.url,className:'dtv-entry'},h('summary',null,h('span',{className:'dtv-entry-name'},item.url)),h('div',{className:'dtv-entry-body'},sourceView(item.content))))):null)
  }
  return h('section',{className:'dtv-rendering-settings','data-revision':revision+'-'+dependencyRevision},
    h('style',null,renderingSettingsStyles),h('h3',null,translate('rendering.title')),
    h('label',{className:'dtv-script-control'},h('input',{type:'checkbox',checked:settings.interactiveCards===true,disabled:busy||!update,onChange:event=>update({...settings,interactiveCards:event.target.checked})}),translate('rendering.master')),
    h('p',{className:'dtv-script-meta'},translate(settings.interactiveCards===true?'rendering.masterOn':'rendering.masterOff')),
    status?.text?h('p',{className:'dtv-script-meta',role:status.error?'alert':'status'},status.text):null,
    h('section',{className:'dtv-script-group'},h('div',{className:'dtv-script-actions'},h('h4',null,translate('rendering.cardScripts')),help(translate('rendering.safetyDetails'),translate('rendering.enablementHelp'))),...helpers.map(renderHelper),!helpers.length?h('p',{className:'dtv-script-meta'},translate('rendering.none')):null),
    h('section',{className:'dtv-script-group'},h('div',{className:'dtv-script-actions'},h('h4',null,translate('rendering.dependencies')),help(translate('rendering.safetyDetails'),translate('rendering.boundary'))),...owners.map(renderGraph),!owners.length?h('p',{className:'dtv-script-meta'},translate('rendering.none')):null),
    h('section',{className:'dtv-script-group dtv-script-operations'},
      h('div',{className:'dtv-script-actions'},h('h4',null,translate('rendering.operations')),help(translate('rendering.safetyDetails'),translate('rendering.lifetime'))),
      ...renderingWriteRequests.listRevocations().map(item=>h('div',{key:item.id,role:'alert'},h('p',null,translate('rendering.revokePending'),item.error?' · '+item.error:''),h('button',{type:'button',disabled:item.pending,onClick:()=>run(()=>renderingWriteRequests.retryRevocation(item.id))},translate('rendering.retryRevoke')))),
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
