import {claimGreetingSelection,greetingReadView} from './bound-greeting.js'
import {initialWriteViewScope} from './mvu-scope.js'
import {cardViewport,cardRootPresentation,usesCardViewport} from './card-viewport.js'
import {useCardDiagnostics} from './card-diagnostics.js'
import { imageSource, stageImages, observeImages, imageCss, IMAGE_SOURCE_ATTRIBUTE } from './card-images.js'
import { selectedPhoto } from './card-photo.js'
import {createPhotoPickerDiagnostic} from './card-photo-diagnostic.js'
import {DEPENDENCY_LIMITS} from './rendering-limits.js'
import {mvuBuiltin,confirmMvuSchemas,confirmMvuCommandHooks} from './mvu-builtins.js'
import {commandHookDeclaration} from '../../../mvu-adapter/src/command-hook-declaration.js'
import {renderingWriteRequests} from './rendering-write-requests.js'
import { createVirtualCardRuntime } from './card-worker-client.js'
import DOMPurify from 'dompurify'
import { createElement as h, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RichText, isCompleteHtmlDocument } from './rich-text.js'
import { createCardRuntime } from './card-runtime.js'
import { translate } from '../i18n.js'
import { discoverDependencies, isSideEffectModuleReference, externalUrl, loadWrapper, MAX_RENDER_SOURCE } from './rendering-sources.js'
import {adaptIdentityHtml,identityLoaderBootstrap} from './html-loader-adapters.js'
import {createCardScopedStorage} from './card-scoped-storage.js'
import {createIdentityOpeningBridge} from './identity-opening-bridge.js'
import {createFixedIdentityActionModel} from './identity-action-model.js'
import {createIdentityActionBridge} from './identity-action-bridge.js'
import {IdentityActionProposal} from './identity-action-view.js'
import {projectCardControlState,cardControlEventChecked} from './card-control-state.js'
import { renderingTrust } from './rendering-trust.js'
import {cardComposerIdentity,createCardComposerBridge} from './card-composer.js'

const TAGS = 'template suot div span p br hr section article header footer main aside h1 h2 h3 h4 h5 h6 ul ol li dl dt dd b strong i em small pre code blockquote table thead tbody tr th td details summary button label input textarea select option output progress meter img style svg g path circle ellipse rect line polyline polygon defs linearGradient radialGradient stop clipPath title desc'.split(' ')
const ATTRS = 'id class title style type value min max step checked disabled placeholder name rows cols open hidden accept width height alt src for selected data-action data-opening-choice data-opening-perk data-dtv-node data-dtv-image-source viewBox preserveAspectRatio d x y x1 y1 x2 y2 cx cy r rx ry points fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-opacity transform opacity offset stop-color stop-opacity gradientUnits gradientTransform clip-path'.split(' ')
export const CARD_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
export function cleanCardHtml(html, { inertImages = false } = {}) {
  const template = document.createElement('template')
  template.innerHTML = DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOW_DATA_ATTR: false, FORCE_BODY: true })
  // SUOT is a data marker only inside inert template content. Templates keep
  // their sanitized data for the virtual DOM; their scripts never become runs.
  for (const marker of template.content.querySelectorAll('suot')) marker.replaceWith(...marker.childNodes)
  for (const input of template.content.querySelectorAll('input')) {
    if (!['text','number','range','checkbox','radio','color','button','file'].includes(input.type)) input.setAttribute('type','text')
    if(input.type==='file'){input.setAttribute('accept','image/png,image/jpeg,image/webp');input.removeAttribute('value');input.removeAttribute('multiple');input.removeAttribute('webkitdirectory')}
  }
  for (const image of template.content.querySelectorAll('img')) {
    const source = imageSource(image.getAttribute('src') ?? image.getAttribute(IMAGE_SOURCE_ATTRIBUTE))
    image.removeAttribute('src'); image.removeAttribute(IMAGE_SOURCE_ATTRIBUTE)
    if (source) image.setAttribute('src', source)
  }
  for (const element of template.content.querySelectorAll('[style]')) element.setAttribute('style',imageCss(element.getAttribute('style')))
  for (const style of template.content.querySelectorAll('style')) style.textContent=imageCss(style.textContent)
  if (inertImages) stageImages(template.content)
  return template.innerHTML
}
export function splitCards(text) {
  const source = String(text ?? '')
  const parts = []
  let offset = 0, lineOffset = 0, fence = null
  for (const line of source.split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (!fence && marker) {
      fence = { marker: marker[1], index: lineOffset, content: lineOffset + line.length + 1, card: /^```(?:html)?[\t ]*$/.test(line), labelled: /^```html/.test(line) }
    } else if (fence && marker && marker[1][0] === fence.marker[0] && marker[1].length >= fence.marker.length && /^[\t ]*$/.test(marker[2])) {
      const html = source.slice(fence.content, Math.max(fence.content, lineOffset - 1))
      if (fence.card && /<(?:script|button|input|select|textarea)\b/i.test(html) && (fence.labelled || /^\s*<(?:body|html)\b/i.test(html) || isCompleteHtmlDocument(html))) {
        if (fence.index > offset) parts.push({ text: source.slice(offset, fence.index) })
        parts.push({ html }); offset = lineOffset + line.length
      }
      fence = null
    }
    lineOffset += line.length + 1
  }
  if (!parts.length && /^\s*(?:<!doctype html[^>]*>\s*)?<(?:html|body)\b/i.test(source) && /<\/(?:html|body)>\s*$/i.test(source) && /<(?:script|button|input|select|textarea)\b/i.test(source)) return [{ html: source }]
  if (offset < source.length || !parts.length) parts.push({ text: source.slice(offset) })
  return parts
}
function sourceRootPresentation(source) {
  const root=DOMPurify.sanitize(source,{WHOLE_DOCUMENT:true,RETURN_DOM:true,ALLOWED_TAGS:['html','head','body'],ALLOWED_ATTR:['class','style'],ALLOW_DATA_ATTR:false})
  const attributes=node=>({className:node?.getAttribute('class')??'',style:node?.getAttribute('style')??''})
  return cardRootPresentation({html:attributes(root),body:attributes(root.querySelector('body'))})
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
  return { html, scripts, root:sourceRootPresentation(source), unsupported: [...new Set(unsupported)] }
}

export function prepareCardDocument(source, owners = [], helpers = [], trust = renderingTrust) {
  const modules = Object.create(null), runs = [], seen = new Set(), reviewed = new Set(), adapters = [], schemaDeclarations = [], commandDeclarations = []
  let total = source.length, expanded = source.length, virtual = false
  const analyzed=new Map(),pending=[]
  const read = (url, ownerHint) => {
    if (!url) throw Error('Blocked dependency URL')
    const owner = ownerHint ?? owners.find(owner => trust.isEnabled(owner,url) && trust.inspect(owner,url)?.approved)
    if (!owner) throw Error('Rendering dependency is not downloaded: ' + url)
    const content = trust.read(owner,url)
    if (!seen.has(url)) { seen.add(url); total += content.length }
    if (seen.size > DEPENDENCY_LIMITS.count || total > DEPENDENCY_LIMITS.bytes) throw Error('Rendering dependency graph exceeds limit')
    const record=trust.inspect(owner,url)
    if(record?.depth!==undefined&&(!Number.isSafeInteger(record.depth)||record.depth<0||record.depth>DEPENDENCY_LIMITS.depth))throw Error('Invalid rendering dependency depth')
    return {content,owner,depth:record?.depth,builtin:record?.builtin?mvuBuiltin(url,record.digest):null}
  }
  // Original inline source is outside the acquired graph; its first URL is
  // depth zero, matching acquisition. Downloaded HTML/scripts start inside it.
  const collect = (content, base, owner, depth = -1) => pending.push({content,base,owner,depth})
  const collectModules = () => { while(pending.length) {
    // Seed every entry before walking edges. Minimum URL depth, not DFS path
    // length, matches acquisition even when references converge or cycle.
    pending.sort((a,b)=>a.depth-b.depth)
    const {content,base,owner,depth}=pending.shift()
    const analysisKey=JSON.stringify([owner,base]);let keys=analyzed.get(content);if(keys?.has(analysisKey))continue;if(!keys){keys=new Set();analyzed.set(content,keys)}keys.add(analysisKey)
    if (depth > DEPENDENCY_LIMITS.depth) throw Error('Rendering dependency depth exceeds limit')
    for (const dependency of discoverDependencies(content,base).filter(item => item.kind === 'module')) {
      if (!dependency.url) throw Error('Blocked or unresolved module: ' + dependency.raw)
      const next = read(dependency.url,owner)
      if(next.builtin){
        if(next.builtin.kind!=='mvu-facade')throw Error('Schema adapter requires complete declaration source confirmation; runtime Zod registration is unsupported')
        if(!isSideEffectModuleReference(content,dependency.url,base))throw Error('Built-in MVU adapter supports only a side-effect initialization import')
        if(Object.hasOwn(modules,dependency.url)&&modules[dependency.url]!=='globalThis.__initializeBuiltinMvu(1);')throw Error('Conflicting built-in adapter modes across source owners')
        modules[dependency.url]='globalThis.__initializeBuiltinMvu(1);'
        if(!adapters.some(item=>item.url===dependency.url&&item.owner===next.owner))adapters.push({...next.builtin,owner:next.owner,replacement:'Tavern scoped MVU facade; original module is not executed'})
        continue
      }
      if (Object.hasOwn(modules,dependency.url)) {
        if(modules[dependency.url]!==next.content)throw Error('Module content conflict across source owners')
      }
      const reviewKey=JSON.stringify([next.owner,dependency.url])
      if(reviewed.has(reviewKey))continue
      reviewed.add(reviewKey)
      modules[dependency.url] = next.content
      collect(next.content,dependency.url,next.owner,Math.min(depth + 1,next.depth??Infinity))
    }
  } }
  const wrapper = loadWrapper(source)
  let identitySource
  let base, owner,baseDepth
  if (wrapper) {
    virtual = true
    const result = read(wrapper.url); source = result.content; owner = result.owner; base = wrapper.url;baseDepth=result.depth??0
    if (loadWrapper(source)) throw Error('Nested remote HTML wrappers are unsupported')
    if(wrapper.kind==='identity-html-loader'){
      identitySource=source
      source=adaptIdentityHtml(source,wrapper)
      runs.push({code:identityLoaderBootstrap(wrapper),name:'identity-loader-adapter-v1.js'});adapters.push({...wrapper,replacement:'Scoped HTML, storage and explicit proposal adapter; original wrapper is not executed'})
    }
  }
  if (source.length > 1024*1024) throw Error('Card HTML exceeds 1 MiB')
  const root=cardDocument(source).root
  const template = document.createElement('template'); template.innerHTML = source
  for (const helper of helpers.filter(item => item.enablementAmbiguous ? item.enabled : trust.isEnabled(item.owner,item.preferenceKey??item.key,item.enabled))) {
    // Inline scripts follow the card master switch and their saved enablement.
    virtual = true
    const content = helper.content
    total += content.length
    if(total > DEPENDENCY_LIMITS.bytes)throw Error('Rendering dependency graph exceeds limit')
    expanded+=content.length;if(expanded>DEPENDENCY_LIMITS.bytes||runs.length>=128)throw Error('Expanded card input exceeds limit')
    const schemaDependencies=discoverDependencies(content).filter(item=>item.kind==='module').map(item=>({item,record:trust.inspect(helper.owner,item.url)})).filter(({item,record})=>record?.builtin&&mvuBuiltin(item.url,record.digest)?.kind==='backend-schema')
    if(schemaDependencies.length){
      for(const {item,record} of schemaDependencies){trust.read(helper.owner,item.url);adapters.push({...mvuBuiltin(item.url,record.digest),owner:helper.owner,replacement:'Complete schema declaration handled by the backend interpreter'})}
      schemaDeclarations.push({source:content,owner:helper.owner,key:helper.key,sha256:helper.contentDigest??trust.inspect(helper.owner,helper.key)?.digest})
      continue
    }
    if(commandHookDeclaration(content)){
      const declaration={source:content,owner:helper.owner,key:helper.key}
      commandDeclarations.push(declaration)
      adapters.push({kind:'backend-command-hook',version:1,...declaration,replacement:'Source-owned precommit command processing; original script is not executed in display VMs'})
      continue
    }
    collect(content,undefined,helper.owner)
    runs.push({code:content,module:true,name:'helper-' + runs.length + '.js'})
  }
  for (const script of template.content.querySelectorAll('script')) {
    const type = script.getAttribute('type') ?? ''
    if (type && !['module','text/javascript','application/javascript','text/babel','text/jsx'].includes(type)) throw Error('Unsupported script type')
    let code = script.textContent, name = base ? base + '#inline-' + runs.length : 'card-' + runs.length + '.js', scriptOwner = owner,scriptDepth=base?baseDepth:-1
    if (script.hasAttribute('src')) {
      virtual=true
      name = externalUrl(script.getAttribute('src'),base)
      const result = read(name,owner); code = result.content; scriptOwner = result.owner;scriptDepth=result.depth??(base?baseDepth+1:0)
      if(result.builtin){if(result.builtin.kind!=='mvu-facade')throw Error('Schema adapter requires a complete Helper declaration');adapters.push({...result.builtin,owner:scriptOwner,replacement:'Tavern scoped MVU facade; original script is not executed'});code='globalThis.__initializeBuiltinMvu(1);'}
    }
    expanded+=code.length;if(expanded>DEPENDENCY_LIMITS.bytes||runs.length>=128)throw Error('Expanded card input exceeds limit')
    collect(code,externalUrl(name) ?? base,scriptOwner,scriptDepth)
    if(['text/babel','text/jsx'].includes(type)||/\b(?:SillyTavern|HTMLTextAreaElement|Mvu|eventOn|waitGlobalInitialized|errorCatched|innerWidth|innerHeight|documentElement|getBoundingClientRect|getComputedStyle|scrollHeight|scrollWidth|offsetHeight|offsetWidth|clientHeight|clientWidth)\b/.test(code)||/\b_\s*\.\s*(?:get|isEmpty)\b|\.\s*(?:css|show|hide|addClass|removeClass|empty)\s*\(/.test(code))virtual=true
    runs.push({code,name,type,module:type === 'module'}); script.remove()
  }
  collectModules()
  const data = cardDocument(template.innerHTML)
  return {...data,root,runs,modules,virtual,adapters,schemaDeclarations,commandDeclarations,cardStorage:wrapper?.kind==='identity-html-loader',identitySource}
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
    if (op === 'create') { const tag = bounded(args[0]); if (!TAGS.includes(tag) || ['style','img','input','template','suot'].includes(tag)) throw new Error('Unsupported element'); return nodeId(doc.createElement(tag)) }
    const el = node(args[0])
    switch (op) {
      case 'query': return nodeId(el.querySelector(bounded(args[1])))
      case 'queryAll': return [...el.querySelectorAll(bounded(args[1]))].map(nodeId)
      case 'get': if (!['textContent','innerHTML','value','checked'].includes(args[1])) break; return el[args[1]] ?? null
      case 'set': {
        if (!['textContent','innerHTML','value','checked'].includes(args[1])) break
        const value = args[1] === 'checked' ? args[2] === true : bounded(args[2], 64 * 1024)
        el[args[1]] = args[1] === 'innerHTML' ? cleanCardHtml(value, {inertImages:true}) : value
        if (doc.body.querySelectorAll('*').length > 2048) throw new Error('Card DOM limit exceeded')
        return
      }
      case 'attribute': if (!['id','class','title','disabled','aria-label','data-action'].includes(args[1])) break; el.setAttribute(args[1],bounded(args[2],1000)); return
      case 'getAttribute': return el.getAttribute(bounded(args[1]))
      case 'append': el.appendChild(node(args[1])); return
      case 'remove': if (el === doc.body) throw new Error('Cannot remove card root'); el.remove(); return
      case 'style': {const property=bounded(args[1]),value=imageCss(`${property}:${bounded(args[2],1000)}`);el.style.setProperty(property,value?value.slice(value.indexOf(':')+1):'');return}
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

const InteractiveCard = memo(function InteractiveCard({ source, enabled, scopeKey, context, onSend, composer, owners = [], helpers = [], helperBinding, createBinding, writeScope, openingBinding }) {
  const frame = useRef(null), cleanup = useRef(()=>{}), generation=useRef(0),sourceFrameRevision=useRef(0)
  const sourceFrameKey=useMemo(()=>++sourceFrameRevision.current,[source])
  const [trustRevision,setTrustRevision]=useState(renderingTrust.revision)
  useEffect(()=>renderingTrust.subscribe(()=>{generation.current++;cleanup.current();setTrustRevision(renderingTrust.revision())}),[])
  const [viewportLayout,setViewportLayout]=useState(false)
  const [media,setMedia]=useState(null)
  const [photoError,setPhotoError]=useState('')
  const [error,setError]=useState(''), [proposal,setProposal]=useState(''), [sending,setSending]=useState(false)
  const [openingProposal,setOpeningProposal]=useState(null),[openingProgress,setOpeningProgress]=useState('')
  const [identityProposal,setIdentityProposal]=useState(null)
  const openingBridge=useRef(null),identityBridge=useRef(null),proposalVersion=useRef(0)
  const replaceProposal=value=>{proposalVersion.current++;setProposal(value)}
  const [closed,setClosed]=useState(false)
  const data = useMemo(() => {
    if (source.length > 128 * 1024) return { html: '', scripts: [], unsupported: ['Card exceeds 128K characters'] }
    try { if(!enabled)return cardDocument(source);const prepared=prepareCardDocument(source,owners,helpers);if(/<input\b[^>]*type=["']?file\b/i.test(prepared.html))prepared.virtual=true;return prepared } catch(error) { try{return {...cardDocument(source),unsupported:[error.message]}}catch{return {html:'',scripts:[],unsupported:[error.message]}} }
  }, [source,enabled,trustRevision,JSON.stringify(owners),JSON.stringify(helpers)])
  const srcDoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${CARD_CSP}"><style>body{display:flow-root;margin:0;font:14px system-ui;color:#243042;background:transparent}html{color-scheme:light dark}*{box-sizing:border-box}img{max-width:100%}button,input,select,textarea{font:inherit}button{cursor:pointer}</style></head><body>${cleanCardHtml(data.html,{inertImages:true})}</body></html>`
  const unsupportedMessage=data.unsupported.length?data.unsupported.map(reason=>reason.startsWith('appearance.')?translate(reason):reason).join(' ')+' '+translate('appearance.cardStaticFallback'):''
  const diagnosticsOutside=useCardDiagnostics([unsupportedMessage,error,photoError].filter(Boolean))
  useLayoutEffect(()=>{setClosed(false);replaceProposal('');setError('');setMedia(null);setPhotoError('');setOpeningProposal(null);setOpeningProgress('');setIdentityProposal(null);return()=>{generation.current++;cleanup.current()}},[source,enabled,scopeKey,trustRevision,data,JSON.stringify(openingBinding)])
  async function load() {
    const current=++generation.current; cleanup.current(); setError(''); replaceProposal('');setIdentityProposal(null)
    const doc=frame.current?.contentDocument
    if (!doc) { setError('Card document unavailable'); return }
    const ownFrame=frame.current
    // A transparent frame needs the surrounding message's default foreground.
    // Card-owned styles still follow this fixed base rule and can override it.
    const baseRules=doc.head.querySelector('style')?.sheet?.cssRules,frameStyle=getComputedStyle(ownFrame)
    if(baseRules?.[0]?.style)baseRules[0].style.color=frameStyle.color
    if(baseRules?.[1]?.style)baseRules[1].style.colorScheme=frameStyle.colorScheme
    let photoDiagnostic
    if(typeof TAVERN_PHOTO_DIAGNOSTIC!=='undefined'&&TAVERN_PHOTO_DIAGNOSTIC)try{photoDiagnostic=createPhotoPickerDiagnostic(doc,ownFrame.parentElement)}catch{}
    const initialRoot=cardRootPresentation(data.root)
    const projectRoot=root=>{for(const [key,node] of [['html',doc.documentElement],['body',doc.body]]){node.setAttribute('class',root[key].className);node.setAttribute('style',imageCss(root[key].style))}}
    projectRoot(initialRoot)
    let viewportMode=usesCardViewport(data.html,'',initialRoot),viewportFrame=0,lastViewport
    const controller=new AbortController()
    let images, dom, binding, virtualRuntime, stopVariables, removeEvents=()=>{},writeRequest,writeBinding,writeLoading,writeController,writeEpoch=0,cardStorage,composerBridge
    const applyViewportMode=()=>{ownFrame.parentElement.setAttribute('data-dtv-viewport',String(viewportMode));setViewportLayout(viewportMode)}
    applyViewportMode()
    const readViewport=()=>cardViewport({width:ownFrame.clientWidth,height:ownFrame.clientHeight})
    const resize=()=>{
      if(current!==generation.current||frame.current!==ownFrame||!ownFrame.isConnected)return
      const content=ownFrame.parentElement.parentElement,boundary=content.parentElement
      const fillsOpening=viewportMode&&content.classList.contains('dtv-play-rich')&&content.children.length===1&&boundary?.matches('.dtv-play-opening-body[data-dtv-card-viewport-boundary]')
      ownFrame.style.height=viewportMode?(fillsOpening?'100%':'clamp(362px,75dvh,800px)'):`${Math.max(100,Math.min(800,doc.body.scrollHeight))}px`
      if(!viewportFrame)viewportFrame=requestAnimationFrame(()=>{
        viewportFrame=0
        if(current!==generation.current||frame.current!==ownFrame||!ownFrame.isConnected||controller.signal.aborted)return
        if(ownFrame.clientWidth<1||ownFrame.clientHeight<1)return
        try{const value=readViewport();if(value.width!==lastViewport?.width||value.height!==lastViewport?.height){lastViewport=value;virtualRuntime?.resize(value)}}catch(error){setError(error.message);cleanup.current()}
      })
    }
    const observer=new ResizeObserver(resize);observer.observe(doc.body);observer.observe(ownFrame);resize()
    let photoController,photoEpoch=0
    const revokeWrites=()=>{
      identityBridge.current?.invalidate('Variable write permission changed')
      const ticket=++writeEpoch,hadWriteBinding=!!writeBinding
      writeController?.abort();writeController=null;writeBinding?.dispose();writeBinding=null;writeLoading=null
      if(hadWriteBinding){stopVariables?.();stopVariables=null}
      if(hadWriteBinding&&!cleaned&&createBinding)createBinding(controller.signal).then(next=>{
        if(cleaned||ticket!==writeEpoch){next.dispose();return}
        binding=next;virtualRuntime?.notifyVariables(next.getSnapshot());stopVariables=next.subscribe(value=>virtualRuntime?.notifyVariables(value))
      }).catch(()=>{})
    }
    let cleaned=false
    cleanup.current=()=>{if(cleaned)return;cleaned=true;controller.abort();photoEpoch++;photoController?.abort();photoDiagnostic?.dispose();identityBridge.current?.dispose();identityBridge.current=null;openingBridge.current?.dispose();openingBridge.current=null;observer.disconnect();images?.dispose();cancelAnimationFrame(viewportFrame);viewportFrame=0;dom?.destroy();virtualRuntime?.dispose();cardStorage?.dispose();composerBridge?.dispose();stopVariables?.();removeEvents();binding?.dispose();writeRequest?.dispose();revokeWrites()}
    images=observeImages(doc.body,{frame:frame.current,unavailable:translate('appearance.imageUnavailable'),onStatus:value=>{if(!cleaned&&current===generation.current)setMedia(value)}})
    if (!enabled || data.unsupported.length) return
    if (doc.body.querySelectorAll('*').length > 2048) { setError('Card DOM limit exceeded'); return }
    try {
      if(createBinding) {
        try { binding=await createBinding(controller.signal) } catch(error) { if(controller.signal.aborted)return /* Missing MVU is reported only if the card requests variables. */ }
        if(current!==generation.current){binding?.dispose();return}
      }
      if(data.virtual) {
        if(data.cardStorage)cardStorage=createCardScopedStorage({storage:window.localStorage,owners,scopeKey,sourceIdentity:source})
        if(data.identitySource&&openingBinding)openingBridge.current=createIdentityOpeningBridge({sourceIdentity:openingBinding,identitySource:data.identitySource,signal:controller.signal,onProposal:value=>{if(!cleaned&&current===generation.current)setOpeningProposal(value)},onProgress:value=>{if(!cleaned&&current===generation.current)setOpeningProgress(value)}})
        const identity=await cardComposerIdentity(scopeKey,source)
        if(cleaned||current!==generation.current)return
        let storage
        try{storage=window.localStorage}catch{/* An attempted save reports unavailable storage. */}
        composerBridge=createCardComposerBridge({identity,adapter:composer,storage,onClose:()=>{if(!cleaned&&current===generation.current){setClosed(true);queueMicrotask(()=>{if(current===generation.current)cleanup.current()})}}})
        if(composerBridge.modeError)setError(composerBridge.modeError)
        const activeBinding=binding??helperBinding
        confirmMvuSchemas(data.schemaDeclarations??[],activeBinding?.getSnapshot())
        confirmMvuCommandHooks(data.commandDeclarations??[],activeBinding?.getSnapshot())
        const events=['click','input','change','keydown','keyup','pointerdown','pointerup']
        const controlPhases=new WeakMap()
        const handler=event=>{
          const target=event.target.closest?.('[data-dtv-node]');if(!target)return
          const identityEdit=['input','change'].includes(event.type)&&['input','textarea','select'].includes(target.localName)||event.type==='click'&&(target.closest?.('#identityBooks')||['identityBack','identityUpload','identityClearPhoto','identityFillUser','identityReset'].includes(target.id))
          if(identityEdit&&identityBridge.current){identityBridge.current.invalidate('Identity selection edited');openingBridge.current?.cancel()}
          const value={type:event.type,target:Number(target.dataset.dtvNode)}
          if(target.localName==='input'&&target.type==='file'){
            // The native File and its original metadata stay in this closure.
            // Synthetic events cannot transfer bytes or grant composer actions.
            if(event.type!=='change'||event.isTrusted!==true)return
            const file=target.files?.[0];target.value='';if(!file)return
            const ticket=++photoEpoch;photoController?.abort();photoController=new AbortController();const signal=photoController.signal
            setPhotoError('')
            selectedPhoto(file,signal).then(photo=>{
              if(cleaned||ticket!==photoEpoch||current!==generation.current||!target.isConnected||target.ownerDocument!==doc)return
              virtualRuntime?.dispatch({...value,photo},{trusted:false})
            },()=>{if(!signal.aborted&&!cleaned&&ticket===photoEpoch&&current===generation.current)setPhotoError(translate('appearance.photoUnavailable'))})
            return
          }
          const control=target.localName==='input'&&['radio','checkbox'].includes(target.type)
          if(['input','textarea','select'].includes(target.localName)){value.value=String(target.value).slice(0,64000);const checked=control?cardControlEventChecked(event.type,target,controlPhases):target.checked===true;if(checked!==undefined)value.checked=checked}
          for(const key of ['key','code','keyCode','charCode','button','buttons','clientX','clientY','ctrlKey','altKey','shiftKey','metaKey'])if(event[key]!==undefined)value[key]=event[key]
          virtualRuntime?.dispatch(value,{trusted:event.isTrusted===true,control})
        }
        for(const type of events)doc.body.addEventListener(type,handler)
        removeEvents=()=>{for(const type of events)doc.body.removeEventListener(type,handler)}
        let variableWriteScope
        if(writeScope&&createBinding)try{variableWriteScope=initialWriteViewScope(writeScope,activeBinding?.getSnapshot())}catch{/* Missing MVU denies writes; ordinary cards can still render. */}
        if(variableWriteScope)writeRequest=renderingWriteRequests.register({scope:variableWriteScope,owners,runs:data.runs,modules:data.modules,html:data.html,adapters:data.adapters,schemaDeclarations:data.schemaDeclarations,onRevoke:revokeWrites})
        const ensureWriteBinding=async()=>{
          const grant=writeRequest?.getGrant()
          if(!grant)throw Object.assign(Error('Variable writes require separate authorization in conversation settings'),{code:'MVU_WRITE_DENIED'})
          if(!writeBinding){
            if(!writeLoading){const pendingController=new AbortController();writeController=pendingController;writeLoading=createBinding(pendingController.signal,grant).then(next=>{if(pendingController.signal.aborted||cleaned){next.dispose();throw Error('Variable write binding cancelled')}stopVariables?.();binding?.dispose();binding=next;writeBinding=next;stopVariables=next.subscribe(snapshot=>virtualRuntime?.notifyVariables(snapshot));return next}).finally(()=>{if(writeController===pendingController)writeLoading=null})}
            await writeLoading
          }
          return writeBinding
        }
        if(data.identitySource&&openingBridge.current)identityBridge.current=createIdentityActionBridge({
          model:createFixedIdentityActionModel(data.identitySource),
          prepareBinding:async()=>{
            const bound=await ensureWriteBinding(),epoch=writeEpoch,grantKey=JSON.stringify(writeRequest.getGrant())
            return {binding:bound,messageLease:{generation:current,revision:proposalVersion.current},isCurrent:()=>!cleaned&&!controller.signal.aborted&&current===generation.current&&epoch===writeEpoch&&writeBinding===bound&&JSON.stringify(writeRequest?.getGrant())===grantKey}
          },
          onState:value=>{if(!cleaned&&current===generation.current)setIdentityProposal(value)},
          deliverMessage:(message,lease)=>{
            if(cleaned||current!==generation.current||lease.generation!==current||lease.revision!==proposalVersion.current)throw Error('A newer message proposal belongs to this card')
            // This separate proposal never edits or clears the native input draft.
            replaceProposal(message)
          },
        })
        let acceptedView
        const displayView=(view,targetId,controlsCurrent=true)=>{
            if(cleaned||current!==generation.current)throw Error('Card view generation expired')
            if(!view||Array.isArray(view)||typeof view.html!=='string'||typeof view.styles!=='string'||!Number.isSafeInteger(view.bodyId)||view.bodyId<=0||JSON.stringify(view).length>1024*1024)throw Error('Invalid card view')
            const controlsKey=JSON.stringify(view.controls??[])
            const root=cardRootPresentation(view.root),rootKey=JSON.stringify(root)
            const diagnosticView=photoDiagnostic?{htmlChars:view.html.length,styleChars:view.styles.length,htmlChanged:acceptedView?.html!==view.html,stylesChanged:acceptedView?.styles!==view.styles,bodyChanged:acceptedView?.bodyId!==view.bodyId,rootChanged:acceptedView?.rootKey!==rootKey}:null
            if(acceptedView?.html===view.html&&acceptedView.styles===view.styles&&acceptedView.bodyId===view.bodyId&&acceptedView.rootKey===rootKey){
              if(targetId!==undefined&&!acceptedView.nodes.has(targetId))throw Error('Layout target is not in this card')
              projectCardControlState(view.controls,acceptedView.nodes,{connected:true,apply:controlsCurrent})
              if(controlsCurrent)acceptedView.controlsKey=controlsKey
              photoDiagnostic?.view({...diagnosticView,reused:true})
              return acceptedView.nodes
            }
            // Parse inertly under the byte limit. The trusted receiver counts the
            // sanitized structure before adopting anything into the layout DOM.
            const template=doc.createElement('template');template.innerHTML=cleanCardHtml(view.html,{inertImages:true})
            const nodes=new Map([[0,doc.documentElement],[view.bodyId,doc.body]])
            const walker=doc.createTreeWalker(template.content,0xffffffff);let count=1,node
            while((node=walker.nextNode())){
              if(++count>8192)throw Error('Card DOM limit exceeded')
              if(node.nodeType!==1)continue
              const marker=node.getAttribute('data-dtv-node')
              if(marker===null)continue
              const id=Number(marker)
              if(!Number.isSafeInteger(id)||id<=0||String(id)!==marker||nodes.has(id))throw Error('Invalid card node identity')
              nodes.set(id,node)
            }
            if(targetId!==undefined&&!nodes.has(targetId))throw Error('Layout target is not in this card')
            projectCardControlState(view.controls,nodes,{preserve:controlsCurrent?undefined:acceptedView?.nodes})
            const style=doc.createElement('style');style.textContent=imageCss(view.styles)
            const focused=doc.activeElement,id=focused?.dataset?.dtvNode,selection=[focused?.selectionStart,focused?.selectionEnd],scroll=[doc.documentElement.scrollLeft,doc.documentElement.scrollTop]
            projectRoot(root);images?.refresh();viewportMode=usesCardViewport(view.html,view.styles,root);applyViewportMode()
            photoDiagnostic?.beforeReplace(diagnosticView)
            doc.body.replaceChildren(template.content,style)
            doc.body.setAttribute('data-dtv-node',String(view.bodyId))
            images?.refresh()
            acceptedView={html:view.html,styles:view.styles,bodyId:view.bodyId,rootKey,controlsKey,nodes}
            photoDiagnostic?.view({...diagnosticView,reused:false})
            if(id){const restored=nodes.get(Number(id));restored?.focus();if(typeof selection[0]==='number')try{restored.setSelectionRange(...selection)}catch{}}
            doc.documentElement.scrollLeft=scroll[0];doc.documentElement.scrollTop=scroll[1];resize()
            return nodes
        }
        virtualRuntime=createVirtualCardRuntime({html:data.html,root:initialRoot,viewport:readViewport(),runs:data.runs,modules:data.modules,context:{...context,boundGreeting:greetingReadView(context?.boundGreeting)},variables:activeBinding?.getSnapshot(),cardStorage:cardStorage?.initial,identityOpening:!!openingBridge.current,identityAction:!!identityBridge.current,composer:composerBridge.initial},{
          onOpening:async(openingId,{signal})=>{
            signal.throwIfAborted();if(cleaned||current!==generation.current||!openingBridge.current||!identityBridge.current)throw Error('Opening card generation expired')
            const action=identityBridge.current,token=action.beginOpening(openingId)
            try{const result=await openingBridge.current.request(openingId);signal.throwIfAborted();if(!action.completeOpening(token,result))throw Error('Opening selection changed');return result}catch(error){action.failOpening(token,'Opening did not complete');throw error}
          },
          onIdentityAction:(packet,{signal})=>{
            signal.throwIfAborted();if(cleaned||current!==generation.current||!identityBridge.current)throw Error('Identity card generation expired')
            const action=identityBridge.current,abort=()=>action.invalidate('Identity request cancelled')
            signal.addEventListener('abort',abort,{once:true})
            return action.request(packet).finally(()=>signal.removeEventListener('abort',abort))
          },
          onStorage:request=>{if(cleaned||current!==generation.current)throw Error('Card storage generation expired');return cardStorage.request(request)},
          onAction:async request=>{
            try{if(cleaned||current!==generation.current)throw Error('Card input generation expired');const result=await composerBridge.request(request);if(!cleaned&&current===generation.current)setError('');return result}
            catch(error){if(!cleaned&&current===generation.current)setError(error.message);throw error}
          },
          onResize:height=>{if(!cleaned&&current===generation.current&&frame.current?.contentDocument===doc){if(viewportMode)resize();else frame.current.style.height=`${Math.max(100,Math.min(800,height))}px`}},
          onActionEnd:()=>{if(!cleaned&&current===generation.current)composerBridge.finishRequest()},
          onWrite:async({operation,value,options,cause,observedRevision,operationId,signal})=>{
            try{
              signal?.throwIfAborted()
              await ensureWriteBinding()
              signal?.throwIfAborted()
              const snapshot=writeBinding.getSnapshot()
              if(options!==null&&options!==undefined&&(typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>!['type','message_id'].includes(key))||(options.type!==undefined&&options.type!=='message')||(options.message_id!==undefined&&options.message_id!==snapshot.scope?.messageId)))throw Error('Variable scope is bound to this card')
              const result=await writeBinding.write({operation,value,expectedRevision:observedRevision,operationId,cause,signal:signal?AbortSignal.any([signal,writeController.signal]):writeController.signal})
              if(cleaned||current!==generation.current)throw Error('Variable write cancelled')
              setError('');return result
            }catch(error){if(!cleaned&&current===generation.current)setError(error.message);throw error}
          },
          onProposal:value=>{if(current===generation.current)replaceProposal(value)},
          onError:error=>{if(current===generation.current){setError(error.message+(error.operationId?' · operationId: '+error.operationId:''));cleanup.current()}},
          onGreetingReady:()=>claimGreetingSelection(context?.boundGreeting?.selectionReceipt),
          onView:displayView,
          onPhotoPick:request=>{
            try{
              const nodes=displayView(request.view,request.id),node=nodes.get(request.id)
              if(!node||node.ownerDocument!==doc||!node.isConnected||node.localName!=='input'||node.type!=='file'||!doc.body.contains(node))throw Error('Invalid photo input')
              if(!doc.defaultView.navigator.userActivation?.isActive)throw Error('Photo selection needs a current user click')
              photoDiagnostic?.pick(node)
              node.click()
              photoDiagnostic?.clickReturned()
            }catch{photoDiagnostic?.rejected();if(!cleaned&&current===generation.current)setPhotoError(translate('appearance.photoUnavailable'))}
          },
          onMeasure:(request,{signal,controlsCurrent})=>{
            signal.throwIfAborted();if(cleaned||current!==generation.current||!frame.current?.isConnected||frame.current.contentDocument!==doc)throw Error('Card measurement generation expired')
            if(!Number.isSafeInteger(request.id)||request.id<0||!['',null,undefined,'::before','::after'].includes(request.pseudo))throw Error('Invalid card measurement')
            const nodes=displayView(request.view,request.id,controlsCurrent),node=nodes.get(request.id)
            if(!node||node.ownerDocument!==doc||!node.isConnected||(request.id!==0&&(node.getAttribute('data-dtv-node')!==String(request.id)||(node!==doc.body&&!doc.body.contains(node)))))throw Error('Layout target is not in this card')
            const rectangle=node.getBoundingClientRect(),style=doc.defaultView.getComputedStyle(node,request.pseudo||null),computed=Object.create(null)
            if(style.length>1024)throw Error('Computed style exceeds property limit')
            for(const property of style){const value=style.getPropertyValue(property);computed[property]=value;computed[property.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value}
            const result={rect:Object.fromEntries(['x','y','width','height','top','right','bottom','left'].map(key=>[key,rectangle[key]])),computed}
            for(const key of ['scrollHeight','scrollWidth','offsetHeight','offsetWidth','clientHeight','clientWidth','offsetTop','offsetLeft'])result[key]=node[key]
            signal.throwIfAborted();return result
          },
        })
        if(activeBinding)stopVariables=activeBinding.subscribe(value=>virtualRuntime?.notifyVariables(value))
        return
      }
      dom=createDomBridge(doc,context,replaceProposal,e=>{setError(e.message);cleanup.current()},binding??helperBinding)
      const runtime=await createCardRuntime(dom.bridge, { modules:data.modules })
      if(current!==generation.current){runtime.dispose();return}
      dom.attach(runtime)
      for(const script of data.runs ?? data.scripts.map(code=>({code}))) runtime.evaluate(script.code,script)
      resize()
    }catch(error){if(current===generation.current){cleanup.current();setError(error.message)}}
  }
  // Extracting scripts can leave srcDoc identical after a source edit. Give
  // that source its own iframe so onLoad recreates the disposed runtime.
  return h('section',{className:'dtv-interactive-card','data-dtv-viewport':String(viewportLayout)},
    closed?h('p',{role:'status'},translate('appearance.cardSendAccepted')):h('iframe',{key:JSON.stringify([sourceFrameKey,scopeKey,enabled,trustRevision,owners,helpers,openingBinding]),ref:frame,title:translate('appearance.card'),sandbox:'allow-same-origin',referrerPolicy:'no-referrer',srcDoc,onLoad:load,style:{display:'block',width:'100%',boxSizing:'border-box',minWidth:220,height:160,maxHeight:800,border:0,borderRadius:0,background:'transparent'}}),
    !enabled && data.scripts.length ? h('small',null,translate('appearance.scriptsOff')):null,
    !diagnosticsOutside&&unsupportedMessage ? h('p',{role:'alert'},unsupportedMessage):null,
    !diagnosticsOutside&&error ? h('p',{role:'alert'},error):null,
    !diagnosticsOutside&&photoError ? h('p',{className:'dtv-card-photo-error',role:'alert'},photoError):null,
    media?.total ? h('small',{className:'dtv-card-media',role:'status'},translate('appearance.imageStatus',{visible:media.visible,loaded:media.loaded,loading:media.loading+media.queued,failed:media.failed})):null,
    openingProgress?h('p',{role:'status'},translate('appearance.openingProgress')):null,
    openingProposal?h('section',{className:'dtv-card-opening-proposal',style:{border:'1px solid currentColor',padding:10,marginTop:8}},
      h('strong',null,translate('appearance.openingProposal')),
      h('p',null,translate('appearance.openingScope')),
      h('details',null,h('summary',null,translate('appearance.openingEntries',{count:openingProposal.entryCount})),...openingProposal.entries.map((entry,index)=>h('article',{key:index},h('strong',null,entry.name),h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},entry.content)))),
      openingProposal.error?h('p',{role:'alert'},openingProposal.error):null,
      h('button',{type:'button',disabled:openingProposal.busy,onClick:event=>{if(event.isTrusted!==true)return;openingBridge.current?.confirm(openingProposal.proposalId,{trusted:true}).catch(error=>setError(error.message))}},translate('appearance.openingConfirm')),
      h('button',{type:'button',disabled:openingProposal.busy,onClick:()=>openingBridge.current?.cancel()},translate('appearance.close'))):null,
    h(IdentityActionProposal,{proposal:identityProposal,bridge:identityBridge.current,onError:setError}),
    proposal ? h('div',{className:'dtv-card-proposal',style:{border:'1px solid currentColor',padding:10,marginTop:8}},
      h('strong',null,translate('appearance.proposed')),h('p',null,proposal),
      h('button',{type:'button',disabled:!onSend||sending,onClick:async event=>{if(event.isTrusted!==true)return;const revision=proposalVersion.current;setSending(true);try{await onSend(proposal);if(revision===proposalVersion.current)replaceProposal('')}catch(e){setError(e.message)}finally{setSending(false)}}},translate('appearance.sendProposal')),
      h('button',{type:'button',onClick:()=>replaceProposal('')},translate('appearance.close'))):null,
  )
})
export const MessageContent = memo(function MessageContent({text,textStyle,...props}) {
  return h('div',{className:'dtv-play-rich'},...splitCards(text).map((part,index)=>part.html
    ? h(InteractiveCard,{key:index,source:part.html,...props,scopeKey:JSON.stringify([props.scopeKey,index])})
    : !part.text.trim()?null:h(RichText,{key:index,text:part.text,textStyle})))
})
