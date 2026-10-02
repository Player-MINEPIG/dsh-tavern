// Discovery is inert: it does not fetch, evaluate, or confer trust on source text.
export const MAX_RENDER_SOURCE = 128 * 1024
export function externalUrl(value, base) {
  try {
    const url = new URL(value, base)
    const host = url.hostname.toLowerCase()
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
  for (const match of String(source).matchAll(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1/gi)) add('script', match[2])
  for (const match of String(source).matchAll(/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?(['"])(.*?)\1/g)) add('module', match[2])
  for (const match of String(source).matchAll(/\bimport\s*\(\s*(['"])(.*?)\1\s*\)/g)) add('module', match[2])
  for (const match of String(source).matchAll(/\bload\s*\(\s*(['"])(.*?)\1/g)) add('html', match[2])
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
