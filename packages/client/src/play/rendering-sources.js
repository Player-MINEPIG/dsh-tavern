import { Parser } from 'acorn'
import jsx from 'acorn-jsx'
const SourceParser=Parser.extend(jsx())
// Discovery is inert: it does not fetch, evaluate, or confer trust on source text.
export const MAX_RENDER_SOURCE = 8 * 1024 * 1024
export function externalUrl(value, base) {
  try {
    const url = new URL(value, base)
    const host = url.hostname.toLowerCase().replace(/\.+$/, '')
    url.hostname=host
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') ||
      /^[\d.]+$/.test(host) || host.includes(':') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return null
    url.hash = ''
    return url.href
  } catch { return null }
}
export function discoverDependencies(source, base) {
  const found = []
  const add = (kind, raw) => {
    const url = externalUrl(raw, base)
    if (!found.some(item => item.kind === kind && item.raw === raw)) found.push({kind,raw,url,blocked:!url})
  }
  const text=String(source), chunks=[]
  if (/^\s*</.test(text)||/(?:^|\n)```(?:html)?[\t ]*\n\s*</i.test(text)) {
    for(const match of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const src=match[1].match(/\bsrc\s*=\s*(['"])(.*?)\1/i)
      if(src)add('script',src[2]);else chunks.push(match[2])
    }
  } else chunks.push(text)
  for(const code of chunks) {
    let tree
    try { tree=SourceParser.parse(code,{ecmaVersion:'latest',sourceType:'module'}) }
    catch { try { tree=SourceParser.parse(code,{ecmaVersion:'latest',sourceType:'script'}) } catch { found.push({kind:'module',raw:'Unparseable JavaScript dependency graph',url:null,blocked:true});continue } }
    const pending=[tree]
    while(pending.length) {
      const node=pending.pop()
      if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)add('module',node.source.value)
      if(node.type==='ImportExpression') {
        if(node.source.type==='Literal'&&typeof node.source.value==='string')add('module',node.source.value)
        else found.push({kind:'module',raw:'Computed dynamic import requires a fixed reviewed URL',url:null,blocked:true})
      }
      if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.property.name==='load'&&node.arguments[0]?.type==='Literal'&&typeof node.arguments[0].value==='string')add('html',node.arguments[0].value)
      for(const value of Object.values(node)) {
        if(Array.isArray(value)){for(const item of value)if(item&&typeof item.type==='string')pending.push(item)}
        else if(value&&typeof value.type==='string')pending.push(value)
      }
    }
  }
  return found
}
export function loadWrapper(source) {
  // Deliberately narrow: no callback, selector suffix, request body or expressions.
  const body = String(source).trim().replace(/^```(?:html)?\s*\n([\s\S]*?)\n```\s*$/i, '$1').trim()
  const match = body.match(/^<body\s*>\s*<script\s*>\s*(?:\$|jQuery)\(\s*(['"])body\1\s*\)\.load\(\s*(['"])([^'"\n]+)\2\s*\)\s*;?\s*<\/script>\s*<\/body>$/i)
  return match ? {raw:match[3],url:externalUrl(match[3])} : null
}
export function helperScripts(resource) {
  const raw = resource?.source?.raw ?? resource
  let helper = raw?.data?.extensions?.tavern_helper ?? raw?.extensions?.tavern_helper
  if (Array.isArray(helper)) helper = Object.fromEntries(helper.filter(entry => Array.isArray(entry) && entry.length === 2 && ['scripts','variables'].includes(entry[0])))
  const result = []
  function visit(items, prefix = 'scripts', depth = 0, parentEnabled = true) {
    if (!Array.isArray(items) || depth > 8) return
    items.slice(0,128).forEach((entry,index) => {
      const value = entry?.value && typeof entry.value === 'object' ? entry.value : entry
      if (!value || typeof value !== 'object') return
      const path = `${prefix}[${index}]`, enabled = parentEnabled && value.enabled !== false && entry.enabled !== false
      if (typeof value.content === 'string') result.push({path,name:String(value.name ?? value.id ?? path).slice(0,160),content:value.content,enabled})
      visit(value.scripts ?? value.children, path, depth + 1, enabled)
    })
  }
  visit(helper?.scripts)
  return result
}
export function renderingInventory(resource, {kind,resourceId}) {
  const raw = resource?.source?.raw ?? resource
  const owner = `${kind}:${resourceId}`
  const scripts = helperScripts(resource).map(script => ({...script,owner,kind:'helper',key:`${owner}:${script.path}`}))
  const cardData=raw?.data??raw
  for(const [path,content] of [['first_mes',cardData?.first_mes],...(Array.isArray(cardData?.alternate_greetings)?cardData.alternate_greetings.slice(0,128).map((text,index)=>[`alternate_greetings[${index}]`,text]):[])]) {
    if(typeof content==='string'&&/<(?:body|html|script)\b/i.test(content))scripts.push({owner,key:`${owner}:${path}`,path,kind:'greeting',name:path,content,enabled:true})
  }
  const regex = raw?.data?.extensions?.regex_scripts ?? raw?.extensions?.regex_scripts ?? raw?.regex_scripts ?? []
  if (Array.isArray(regex)) regex.slice(0,256).forEach((rule,index) => {
    const content = rule?.replaceString ?? rule?.replace_string ?? rule?.replacement ?? rule?.replace
    if (typeof content === 'string' && /<(?:body|html|script)\b/i.test(content)) scripts.push({owner,key:`${owner}:regex[${index}]`,path:`regex[${index}]`,kind:'regex',name:String(rule.scriptName ?? rule.name ?? index),content,enabled:rule.disabled !== true && rule.enabled !== false})
  })
  return scripts.map(script => ({...script,dependencies:discoverDependencies(script.content)}))
}

export function isSideEffectModuleReference(code,url,base) {
 const tree=SourceParser.parse(code,{ecmaVersion:'latest',sourceType:'module'})
 let matched=false
 const pending=[tree]
 while(pending.length){const node=pending.pop()
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source&&externalUrl(node.source.value,base)===url){if(node.type!=='ImportDeclaration'||node.specifiers.length)return false;matched=true}
  if(node.type==='ImportExpression'&&node.source.type==='Literal'&&externalUrl(node.source.value,base)===url)return false
  for(const value of Object.values(node)){if(Array.isArray(value)){for(const item of value)if(item?.type)pending.push(item)}else if(value?.type)pending.push(value)}
 }
 return matched
}
