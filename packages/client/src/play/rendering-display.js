import {useEffect} from 'react'
import {renderingDependencies} from './rendering-dependencies.js'
import {renderingInventory} from './rendering-sources.js'

export function restoreRenderingDisplay({renderingSources,globalRenderingOwner:globalOwner,rules,bindings}) {
  return renderingDependencies.sync([
    ...renderingSources,
    ...(globalOwner?renderingInventory({regex_scripts:rules.filter(rule=>rule.scope.kind==='global')},{kind:'global',resourceId:globalOwner.slice(7)}):[]),
  ],[bindings.characterId&&'character:'+bindings.characterId,bindings.presetId&&'preset:'+bindings.presetId,globalOwner])
}

export function useRestoredRenderingDisplay(display,settings,onError) {
  const selection=JSON.stringify([settings.scriptEnablement,settings.renderingAdapters])
  useEffect(()=>{
    if(!display)return
    let active=true
    // Both the blank-session dock and chat need cached sources. Saved choices
    // may arrive later; revalidate without fetching sources or reloading history.
    restoreRenderingDisplay(display).catch(reason=>{
      if(active)onError(reason instanceof Error?reason.message:String(reason))
    })
    return()=>{active=false}
  },[display,selection,onError])
}
