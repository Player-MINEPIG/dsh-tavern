import DOMPurify from 'dompurify'
import { createElement as h, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RichText } from './rich-text.js'
import { createCardRuntime } from './card-runtime.js'
import { translate } from '../i18n.js'
import { discoverDependencies, externalUrl, loadWrapper, MAX_RENDER_SOURCE } from './rendering-sources.js'
import { renderingTrust } from './rendering-trust.js'

const TAGS = 'div span p br hr section article header footer main aside h1 h2 h3 h4 h5 h6 ul ol li dl dt dd b strong i em small pre code blockquote table thead tbody tr th td details summary button label input textarea select option output progress meter img style'.split(' ')
const ATTRS = 'id class title style type value min max step checked disabled placeholder name rows cols open width height alt src for selected data-action'.split(' ')
export const CARD_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
export function cleanCardHtml(html) {
  const template = document.createElement('template')
  template.innerHTML = DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOW_DATA_ATTR: false, FORCE_BODY: true })
  for (const input of template.content.querySelectorAll('input')) if (!['text','number','range','checkbox','radio','color','button'].includes(input.type)) input.setAttribute('type','text')
  for (const image of template.content.querySelectorAll('img')) if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image.getAttribute('src') ?? '')) image.removeAttribute('src')
  return template.innerHTML
}
export function splitCards(text) {
  const source = String(text ?? '')
  const parts = [], pattern = /^```(?:html)?[\t ]*\n([\s\S]*?)\n```[\t ]*$/gm
  let offset = 0
  for (const match of source.matchAll(pattern)) {
    if (!/<(?:script|button|input|select|textarea)\b/i.test(match[1]) || (!/^```html/i.test(match[0]) && !/^\s*<(?:body|html)\b/i.test(match[1]))) continue
    if (match.index > offset) parts.push({ text: source.slice(offset, match.index) })
    parts.push({ html: match[1] }); offset = match.index + match[0].length
  }
  if (!parts.length && /^\s*(?:<!doctype html[^>]*>\s*)?<(?:html|body)\b/i.test(source) && /<\/(?:html|body)>\s*$/i.test(source) && /<(?:script|button|input|select|textarea)\b/i.test(source)) return [{ html: source }]
  if (offset < source.length || !parts.length) parts.push({ text: source.slice(offset) })
  return parts
}
export function cardDocument(source) {
  // Parse inertly; scripts never enter the real browser's execution environment.
  const template = document.createElement('template'); template.innerHTML = source
  const scripts = [], unsupported = []
  for (const script of template.content.querySelectorAll('script')) {
    const type = script.getAttribute('type') ?? ''
    if (script.hasAttribute('src')) unsupported.push('appearance.unsupportedExternal')
    else if (type === 'module') unsupported.push('appearance.unsupportedModule')
    else if (type && !['text/javascript','application/javascript'].includes(type)) unsupported.push('appearance.unsupportedType')
    else scripts.push(script.textContent)
    script.remove()
  }
  for (const node of template.content.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) if (/^on/i.test(attr.name)) { unsupported.push('appearance.unsupportedEvents'); node.removeAttribute(attr.name) }
  }
  const html = cleanCardHtml(template.innerHTML)
  return { html, scripts, unsupported: [...new Set(unsupported)] }
}

export function prepareCardDocument(source, owners = [], helpers = [], trust = renderingTrust) {
  const modules = Object.create(null), runs = [], seen = new Set()
  let total = source.length
  const read = (url, ownerHint) => {
    if (!url) throw Error('Blocked dependency URL')
    const owner = ownerHint ?? owners.find(owner => trust.inspect(owner,url)?.approved)
    if (!owner) throw Error('Rendering dependency requires content review: ' + url)
    const content = trust.read(owner,url)
    if (!seen.has(url)) { seen.add(url); total += content.length }
    if (seen.size > 24 || total > 512 * 1024) throw Error('Rendering dependency graph exceeds limit')
    return {content,owner}
  }
  const collect = (content, base, owner, depth = 0) => {
    if (depth > 8) throw Error('Rendering dependency depth exceeds limit')
    for (const dependency of discoverDependencies(content,base).filter(item => item.kind === 'module')) {
      if (!dependency.url) throw Error('Blocked or unresolved module: ' + dependency.raw)
      const next = read(dependency.url,owner)
      if (Object.hasOwn(modules,dependency.url)) {
        if(modules[dependency.url]!==next.content)throw Error('Module content conflict across source owners')
        continue
      }
      modules[dependency.url] = next.content
      collect(next.content,dependency.url,next.owner,depth + 1)
    }
  }
  const wrapper = loadWrapper(source)
  let base, owner
  if (wrapper) {
    const result = read(wrapper.url); source = result.content; owner = result.owner; base = wrapper.url
    if (loadWrapper(source)) throw Error('Nested remote HTML wrappers are unsupported')
  }
  if (source.length > MAX_RENDER_SOURCE) throw Error('Card exceeds 128K characters')
  const template = document.createElement('template'); template.innerHTML = source
  for (const helper of helpers.filter(item => item.enabled)) {
    // The helper's exact source must still match what the user reviewed.
    const content = trust.read(helper.owner,helper.key)
    if (content !== helper.content) throw Error('Helper changed; review again')
    total += content.length
    if(total > 512 * 1024)throw Error('Rendering dependency graph exceeds limit')
    collect(content,undefined,helper.owner)
    runs.push({code:content,module:true,name:'helper-' + runs.length + '.js'})
  }
  for (const script of template.content.querySelectorAll('script')) {
    const type = script.getAttribute('type') ?? ''
    if (type && !['module','text/javascript','application/javascript'].includes(type)) throw Error('Unsupported script type')
    let code = script.textContent, name = base ? base + '#inline-' + runs.length : 'card-' + runs.length + '.js', scriptOwner = owner
    if (script.hasAttribute('src')) {
      name = externalUrl(script.getAttribute('src'),base)
      const result = read(name,owner); code = result.content; scriptOwner = result.owner
    }
    collect(code,externalUrl(name) ?? base,scriptOwner)
    runs.push({code,name,module:type === 'module'}); script.remove()
  }
  const data = cardDocument(template.innerHTML)
  return {...data,runs,modules}
}

export function createDomBridge(doc, context, onProposal, onError, helperBinding) {
  const nodes = [doc.body], ids = new WeakMap([[doc.body, 0]]), disposers = []
  let runtime, destroyed = false
  const subscriptions = new Map()
  function nodeId(node) {
    if (!node) return null
    if (!ids.has(node)) { if (nodes.length >= 2048) throw new Error('Card DOM limit exceeded'); ids.set(node,nodes.length); nodes.push(node) }
    return ids.get(node)
  }
  function node(id) { if (!Number.isInteger(id) || !nodes[id]) throw new Error('Unknown DOM handle'); return nodes[id] }
  function bounded(value, limit = 200) { if (typeof value !== 'string' || value.length > limit) throw new Error('Card value exceeds limit'); return value }
  const bridge = ({ op, args = [] }) => {
    if (destroyed) throw new Error('Card is disposed')
    if (op === 'variables') {
      if (!helperBinding) throw Error('Variable binding unavailable')
      const snapshot = helperBinding.getSnapshot(), options = args[0]
      if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key=>!['type','message_id'].includes(key)) || (options.type !== undefined && options.type !== 'message') || (options.message_id !== undefined && options.message_id !== snapshot.scope.messageId))) throw Error('Variable scope is bound to this card')
      if (snapshot.status !== 'available') throw Error('Variable snapshot unavailable')
      return structuredClone(snapshot.variables)
    }
    if (op === 'variablesSubscribe') {
      if (!helperBinding || !Number.isSafeInteger(args[0]) || subscriptions.size >= 64) throw Error('Variable subscription unavailable')
      if (subscriptions.has(args[0])) throw Error('Duplicate variable subscription')
      subscriptions.set(args[0], helperBinding.subscribe(snapshot=>{if(!destroyed)try{runtime.notifyVariables(args[0],snapshot)}catch(error){onError(error);destroy()}})); return
    }
    if (op === 'variablesUnsubscribe') { subscriptions.get(args[0])?.(); subscriptions.delete(args[0]); return }
    if (op === 'context') return structuredClone(context)
    if (op === 'propose') { onProposal(bounded(args[0], 4000)); return }
    if (op === 'byId') return nodeId([...doc.body.querySelectorAll('[id]')].find(el => el.id === bounded(args[0])))
    if (op === 'create') { const tag = bounded(args[0]); if (!TAGS.includes(tag) || ['style','img','input'].includes(tag)) throw new Error('Unsupported element'); return nodeId(doc.createElement(tag)) }
    const el = node(args[0])
    switch (op) {
      case 'query': return nodeId(el.querySelector(bounded(args[1])))
      case 'queryAll': return [...el.querySelectorAll(bounded(args[1]))].map(nodeId)
      case 'get': if (!['textContent','innerHTML','value','checked'].includes(args[1])) break; return el[args[1]] ?? null
      case 'set': {
        if (!['textContent','innerHTML','value','checked'].includes(args[1])) break
        const value = args[1] === 'checked' ? args[2] === true : bounded(args[2], 64 * 1024)
        el[args[1]] = args[1] === 'innerHTML' ? cleanCardHtml(value) : value
        if (doc.body.querySelectorAll('*').length > 2048) throw new Error('Card DOM limit exceeded')
        return
      }
      case 'attribute': if (!['id','class','title','disabled','aria-label','data-action'].includes(args[1])) break; el.setAttribute(args[1],bounded(args[2],1000)); return
      case 'getAttribute': return el.getAttribute(bounded(args[1]))
      case 'append': el.appendChild(node(args[1])); return
      case 'remove': if (el === doc.body) throw new Error('Cannot remove card root'); el.remove(); return
      case 'style': el.style.setProperty(bounded(args[1]),bounded(args[2],1000)); return
      case 'class': if (!['add','remove','toggle'].includes(args[1])) break; return el.classList[args[1]](bounded(args[2]))
      case 'listen': {
        if (!['click','input','change'].includes(args[1]) || !Number.isInteger(args[2]) || disposers.length >= 256) throw new Error('Unsupported event or listener limit exceeded')
        const listener = event => { if (destroyed) return; try { runtime.dispatch(args[2],nodeId(event.target)) } catch (error) { onError(error); destroy() } }
        el.addEventListener(args[1],listener); disposers.push(()=>el.removeEventListener(args[1],listener)); return
      }
    }
    throw new Error(`Unsupported card operation: ${String(op).slice(0,40)}`)
  }
  function destroy() { if (destroyed) return; destroyed=true; for (const dispose of disposers) dispose(); for(const dispose of subscriptions.values())dispose(); subscriptions.clear(); runtime?.dispose(); nodes.length=0 }
  return { bridge, attach: value => { runtime=value; if (destroyed) value.dispose() }, destroy }
}

const InteractiveCard = memo(function InteractiveCard({ source, enabled, scopeKey, context, onSend, owners = [], helpers = [], helperBinding, createBinding }) {
  const frame = useRef(null), cleanup = useRef(()=>{}), generation=useRef(0)
  const [trustRevision,setTrustRevision]=useState(renderingTrust.revision)
  useEffect(()=>renderingTrust.subscribe(()=>{generation.current++;cleanup.current();setTrustRevision(renderingTrust.revision())}),[])
  const [error,setError]=useState(''), [proposal,setProposal]=useState(''), [sending,setSending]=useState(false)
  const data = useMemo(() => {
    if (source.length > 128 * 1024) return { html: '', scripts: [], unsupported: ['Card exceeds 128K characters'] }
    if (!enabled) return cardDocument(source)
    try { return prepareCardDocument(source,owners,helpers) } catch(error) { return {...cardDocument(source),unsupported:[error.message]} }
  }, [source,enabled,trustRevision,JSON.stringify(owners),JSON.stringify(helpers)])
  const srcDoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${CARD_CSP}"><style>body{margin:12px;font:14px system-ui;color:#243042;background:#fff}*{box-sizing:border-box}img{max-width:100%}button,input,select,textarea{font:inherit}button{cursor:pointer}</style></head><body>${data.html}</body></html>`
  useLayoutEffect(()=>{setProposal('');setError('');return()=>{generation.current++;cleanup.current()}},[source,enabled,scopeKey,trustRevision,data])
  async function load() {
    const current=++generation.current; cleanup.current(); setError(''); setProposal('')
    const doc=frame.current?.contentDocument
    if (!doc) { setError('Card document unavailable'); return }
    const resize=()=>{ if(frame.current) frame.current.style.height=`${Math.max(100,Math.min(800,doc.body.scrollHeight+24))}px` }
    const observer=new ResizeObserver(resize);observer.observe(doc.body);resize()
    const controller=new AbortController()
    let dom, binding
    let cleaned=false
    cleanup.current=()=>{if(cleaned)return;cleaned=true;controller.abort();observer.disconnect();dom?.destroy();binding?.dispose()}
    if (!enabled || data.unsupported.length) return
    if (doc.body.querySelectorAll('*').length > 2048) { setError('Card DOM limit exceeded'); return }
    try {
      if(createBinding) {
        try { binding=await createBinding(controller.signal) } catch(error) { if(controller.signal.aborted)return /* Missing MVU is reported only if the card requests variables. */ }
        if(current!==generation.current){binding?.dispose();return}
      }
      dom=createDomBridge(doc,context,setProposal,e=>{setError(e.message);cleanup.current()},binding??helperBinding)
      const runtime=await createCardRuntime(dom.bridge, { modules:data.modules })
      if(current!==generation.current){runtime.dispose();return}
      dom.attach(runtime)
      for(const script of data.runs ?? data.scripts.map(code=>({code}))) runtime.evaluate(script.code,script)
      resize()
    }catch(error){if(current===generation.current){cleanup.current();setError(error.message)}}
  }
  return h('section',{className:'dtv-interactive-card'},
    h('iframe',{key:JSON.stringify([scopeKey,enabled,trustRevision,owners,helpers]),ref:frame,title:translate('appearance.card'),sandbox:'allow-same-origin',referrerPolicy:'no-referrer',srcDoc,onLoad:load,style:{width:'100%',minWidth:220,height:160,maxHeight:800,border:'1px solid #b9c2cf',borderRadius:8,background:'#fff'}}),
    !enabled && data.scripts.length ? h('small',null,translate('appearance.scriptsOff')):null,
    data.unsupported.length ? h('p',{role:'alert'},data.unsupported.map(reason => reason.startsWith('appearance.') ? translate(reason) : reason).join(' ') + ' ' + translate('appearance.cardStaticFallback')):null,
    error ? h('p',{role:'alert'},error):null,
    proposal ? h('div',{className:'dtv-card-proposal',style:{border:'1px solid currentColor',padding:10,marginTop:8}},
      h('strong',null,translate('appearance.proposed')),h('p',null,proposal),
      h('button',{type:'button',disabled:!onSend||sending,onClick:async()=>{setSending(true);try{await onSend(proposal);setProposal('')}catch(e){setError(e.message)}finally{setSending(false)}}},translate('appearance.sendProposal')),
      h('button',{type:'button',onClick:()=>setProposal('')},translate('appearance.close'))):null,
  )
})
export const MessageContent = memo(function MessageContent({text,...props}) {
  return h('div',{className:'dtv-play-rich'},...splitCards(text).map((part,index)=>part.html
    ? h(InteractiveCard,{key:index,source:part.html,...props})
    : h(RichText,{key:index,text:part.text})))
})
