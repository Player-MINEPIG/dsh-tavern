import DOMPurify from 'dompurify'
import { createElement as h, memo, useEffect, useMemo, useRef, useState } from 'react'
import { RichText } from './rich-text.js'
import { createCardRuntime } from './card-runtime.js'
import { translate } from '../i18n.js'

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
  const parts = [], pattern = /^```html\s*\n([\s\S]*?)\n```[\t ]*$/gm
  let offset = 0
  for (const match of source.matchAll(pattern)) {
    if (!/<(?:script|button|input|select|textarea)\b/i.test(match[1])) continue
    if (match.index > offset) parts.push({ text: source.slice(offset, match.index) })
    parts.push({ html: match[1] }); offset = match.index + match[0].length
  }
  if (!parts.length && /^\s*(?:<!doctype html[^>]*>\s*)?<html\b/i.test(source) && /<\/html>\s*$/i.test(source) && /<(?:script|button|input|select|textarea)\b/i.test(source)) return [{ html: source }]
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

export function createDomBridge(doc, context, onProposal, onError) {
  const nodes = [doc.body], ids = new WeakMap([[doc.body, 0]]), disposers = []
  let runtime, destroyed = false
  function nodeId(node) {
    if (!node) return null
    if (!ids.has(node)) { if (nodes.length >= 2048) throw new Error('Card DOM limit exceeded'); ids.set(node,nodes.length); nodes.push(node) }
    return ids.get(node)
  }
  function node(id) { if (!Number.isInteger(id) || !nodes[id]) throw new Error('Unknown DOM handle'); return nodes[id] }
  function bounded(value, limit = 200) { if (typeof value !== 'string' || value.length > limit) throw new Error('Card value exceeds limit'); return value }
  const bridge = ({ op, args = [] }) => {
    if (destroyed) throw new Error('Card is disposed')
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
  function destroy() { if (destroyed) return; destroyed=true; for (const dispose of disposers) dispose(); runtime?.dispose(); nodes.length=0 }
  return { bridge, attach: value => { runtime=value; if (destroyed) value.dispose() }, destroy }
}

const InteractiveCard = memo(function InteractiveCard({ source, enabled, scopeKey, context, onSend }) {
  const frame = useRef(null), cleanup = useRef(()=>{}), generation=useRef(0)
  const [error,setError]=useState(''), [proposal,setProposal]=useState(''), [sending,setSending]=useState(false)
  const data = useMemo(() => {
    if (source.length > 128 * 1024) return { html: '', scripts: [], unsupported: ['Card exceeds 128K characters'] }
    return cardDocument(source)
  }, [source])
  const srcDoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${CARD_CSP}"><style>body{margin:12px;font:14px system-ui;color:#243042;background:#fff}*{box-sizing:border-box}img{max-width:100%}button,input,select,textarea{font:inherit}button{cursor:pointer}</style></head><body>${data.html}</body></html>`
  useEffect(()=>()=>{generation.current++;cleanup.current()},[source,enabled,scopeKey])
  async function load() {
    const current=++generation.current; cleanup.current(); setError(''); setProposal('')
    const doc=frame.current?.contentDocument
    if (!doc) { setError('Card document unavailable'); return }
    const resize=()=>{ if(frame.current) frame.current.style.height=`${Math.max(100,Math.min(800,doc.body.scrollHeight+24))}px` }
    const observer=new ResizeObserver(resize);observer.observe(doc.body);resize()
    const dom=createDomBridge(doc,context,setProposal,e=>setError(e.message))
    cleanup.current=()=>{observer.disconnect();dom.destroy()}
    if (!enabled || data.unsupported.length) return
    if (doc.body.querySelectorAll('*').length > 2048) { setError('Card DOM limit exceeded'); return }
    try {
      const runtime=await createCardRuntime(dom.bridge)
      if(current!==generation.current){runtime.dispose();return}
      dom.attach(runtime)
      for(const script of data.scripts) runtime.evaluate(script)
      resize()
    }catch(error){dom.destroy();setError(error.message)}
  }
  return h('section',{className:'dtv-interactive-card'},
    h('iframe',{key:`${scopeKey}:${enabled}`,ref:frame,title:translate('appearance.card'),sandbox:'allow-same-origin',referrerPolicy:'no-referrer',srcDoc,onLoad:load,style:{width:'100%',minWidth:220,height:160,maxHeight:800,border:'1px solid #b9c2cf',borderRadius:8,background:'#fff'}}),
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
