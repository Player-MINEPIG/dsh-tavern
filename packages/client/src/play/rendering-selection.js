import {compileMvuSchema} from '../../../mvu-adapter/src/schema.js'
import {MVU_BUILTINS} from './mvu-builtins.js'
import {discoverDependencies,isSideEffectModuleReference} from './rendering-sources.js'

export const builtinCandidate=url=>MVU_BUILTINS.find(item=>item.url===url)??null
export const sourceEnabled=(source,trust)=>source.enablementAmbiguous?source.enabled!==false:trust.isEnabled(source.owner,source.preferenceKey??source.key,source.enabled!==false)

// Recognize invocation forms inertly. The shared bounded schema interpreter is
// the semantic authority; imports and arbitrary guest JavaScript never execute.
export function builtinReferenceSupport(content,dependency,source={},base,descriptor=builtinCandidate(dependency.url)) {
  if(!descriptor)return null
  if(descriptor.kind==='mvu-facade'){
    if(dependency.kind==='script')return true
    if(dependency.kind!=='module')return false
    try{
      const chunks=/^\s*</.test(content)?[...content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(match=>! /\bsrc\s*=/.test(match[1])).map(match=>match[2]):[content]
      const matching=chunks.filter(code=>discoverDependencies(code,base).some(item=>item.url===dependency.url))
      return matching.length>0&&matching.every(code=>isSideEffectModuleReference(code,dependency.url,base))
    }catch{return false}
  }
  if(descriptor.kind==='backend-schema'&&source.kind==='helper'&&!base&&dependency.kind==='module'){
    try{compileMvuSchema(content);return true}catch{return false}
  }
  return false
}
export function dependencyReferences(content,base,source,trust) {
  return discoverDependencies(content,base).map(item=>({...item,
    origins:source.origins??[source.path??source.key],
    selected:sourceEnabled(source,trust)&&(!item.url||trust.isEnabled(source.owner,item.url)),
    adapterSupport:builtinReferenceSupport(content,item,source,base,trust.builtinCandidate?.(item.url)??builtinCandidate(item.url)),
  }))
}
