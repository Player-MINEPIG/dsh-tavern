import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-singlefile-browser-release-sync'

let modulePromise
const error = (code, message) => Object.assign(new Error(message), { code })
/** Independent EJS-style compiler. Compiled JavaScript is evaluated only in QuickJS. */
export function compileTemplate(content) {
  return compile(content)
}
function compile(content, checkBudget = () => {}) {
  if (typeof content !== 'string' || content.length > 131072) throw new TypeError('Template must be at most 128 Ki characters')
  const code = []
  let offset = 0
  const literal = value => { if (value) code.push(`print(${JSON.stringify(value)});\n`) }
  while (offset < content.length) {
    checkBudget()
    const start = content.indexOf('<%', offset)
    if (start < 0) { literal(content.slice(offset)); break }
    const modifier = content[start + 2], kind = modifier && '=#_%-'.includes(modifier) ? modifier : ''
    const bodyStart = start + 2 + kind.length, close = content.indexOf('%>', bodyStart)
    if (close < 0) throw new TypeError('Unclosed template tag')
    const end = close > bodyStart && '-_'.includes(content[close - 1]) ? content[close - 1] : ''
    let precedingEnd = start
    if (kind === '_') while (precedingEnd > offset && ' \t'.includes(content[precedingEnd - 1])) precedingEnd--
    literal(content.slice(offset, precedingEnd))
    const body = content.slice(bodyStart, close - end.length)
    if (kind === '%') literal('<%' + body + '%>')
    else if (kind === '=' || kind === '-') code.push(`print(${kind === '=' ? '__escape' : ''}(( ${body} )));\n`)
    else if (kind !== '#') code.push(`${body}\n`)
    offset = close + 2
    if (end === '-') {
      if (content.startsWith('\r\n', offset)) offset += 2
      else if (content[offset] === '\n') offset++
    }
    if (end === '_') while (offset < content.length && /\s/.test(content[offset])) offset++
  }
  checkBudget()
  return code.join('')
}

// Serialized into the VM; tokens preserve quoted boundaries without evaluating code.
function variablePathKeys(path) {
  const keys = []
  let i = 0
  const invalid = () => { throw new TypeError('Invalid variable path') }
  const bare = () => {
    const start = i
    while (i < path.length && !'.[]'.includes(path[i])) i++
    if (start === i) invalid()
    keys.push(path.slice(start, i))
  }
  if (path[0] !== '[') bare()
  while (i < path.length) {
    if (path[i] === '.') { i++; bare(); continue }
    if (path[i++] !== '[') invalid()
    const quote = path[i]
    let key = ''
    if (quote === '"' || quote === "'") {
      i++
      while (i < path.length && path[i] !== quote) {
        if (path[i] === '\\' && ++i === path.length) invalid()
        key += path[i++]
      }
      if (path[i++] !== quote) invalid()
    } else {
      const start = i
      while (i < path.length && path[i] >= '0' && path[i] <= '9') i++
      if (start === i) invalid()
      key = path.slice(start, i)
    }
    if (path[i++] !== ']') invalid()
    keys.push(key)
  }
  return keys
}

const bootstrap = `
const __pathKeys = ${variablePathKeys.toString()};
const __frozen = value => { if(value && typeof value === 'object') {Object.freeze(value);for(const item of Object.values(value))__frozen(item)};return value };
const __lookup = (kind,args=[]) => __frozen(JSON.parse(__dependency(JSON.stringify({kind,args}))));
const __vars = () => __lookup('variables');
const variables = new Proxy({}, {
  get: (_,key) => __vars()[key], has: (_,key) => key in __vars(), ownKeys: () => Reflect.ownKeys(__vars()),
  getOwnPropertyDescriptor: (_,key) => Object.hasOwn(__vars(),key) ? {enumerable:true,configurable:true,value:__vars()[key],writable:false} : undefined,
  set: () => false, defineProperty: () => false, deleteProperty: () => false, setPrototypeOf: () => false,
});
const __unsupported = name => {throw new Error('Unsupported template capability: '+name)};
const __escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&#34;',"'":'&#39;'}[c]));
const __path = (object,path) => {
  if(path === null || path === undefined || path === '')return object;
  if(typeof path !== 'string')throw new TypeError('Variable path must be a string');
  const keys=__pathKeys(path);
  for(const key of keys){if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe variable path');if(!object || !Object.hasOwn(object,key))return undefined;object=object[key]};return object;
};
function getvar(key,options={}) {
  if(typeof options === 'string')options={scope:options};
  if(!options || typeof options!=='object' || Array.isArray(options) || Object.keys(options).some(k=>!['scope','defaults','clone'].includes(k)))return __unsupported('getvar options');
  if(options.scope && options.scope!=='cache')return __unsupported('getvar scope '+options.scope);
  const value=__path(__vars(),key);return value===undefined?options.defaults:value;
}
const __match=(item,name)=>name instanceof RegExp?name.test(item.name??item.comment??''):String(item.id??item.uid)===String(name)||(item.name??item.comment)===name;
async function getwi(book,title,data) {
  if(data!==undefined)return __unsupported('getwi data/template recursion');
  if(title===undefined){title=book;book=''};
  if(typeof book!=='string')return __unsupported('getwi book');
  const books=__lookup('worldbook-catalog').filter(b=>!book||b.id===book||b.sourceId===book||b.name===book);
  for(const b of books){const entry=(b.entries??[]).find(e=>__match(e,title));if(entry)return __lookup('worldbook-entry',[b.id,entry.uid])};return '';
}
async function getpreset(name,data) {
  if(data!==undefined)return __unsupported('getpreset data/template recursion');
  const entry=__lookup('preset-catalog').find(p=>__match(p,name));return entry?__lookup('preset-entry',[entry.id]):'';
}
async function getchar(name,template,data) {
  if(template!==undefined || data!==undefined)return __unsupported('getchar custom template');
  const c=__lookup('character-catalog');return c && (name===undefined||__match(c,name))?__lookup('character-description',[c.id]):'';
}
const getWorldInfo=getwi,getPresetPrompt=getpreset,getChara=getchar;
const setvar=()=>__unsupported('setvar'),execute=()=>__unsupported('execute');
`

// Pure utility fallback for caller-owned JSON, never a Host/source permission API.
function snapshotLookup(snapshot, { kind, args }) {
  if (kind === 'variables') return snapshot.variables ?? {}
  if (kind === 'worldbook-catalog') return (snapshot.worldBooks ?? []).map(b => ({ id:b.id, name:b.name, entries:(b.entries??[]).map(e=>({uid:e.uid,comment:e.comment})) }))
  if (kind === 'worldbook-entry') return snapshot.worldBooks?.find(b=>b.id===args[0])?.entries?.find(e=>e.uid===args[1])?.content ?? ''
  if (kind === 'preset-catalog') return (snapshot.preset?.prompts??[]).map(p=>({id:p.identifier,name:p.name}))
  if (kind === 'preset-entry') return snapshot.preset?.prompts?.find(p=>p.identifier===args[0])?.content??''
  if (kind === 'character-catalog') return snapshot.character ? {id:snapshot.character.id,name:snapshot.character.name}:null
  if (kind === 'character-description') return snapshot.character?.id===args[0]?snapshot.character.data?.description??'':''
  throw error('TEMPLATE_DEPENDENCY_INVALID', 'Unsupported dependency request')
}

/**
 * A synchronous VM bridge only records an untrusted lookup; it never performs I/O.
 * Missing lookups suspend the run. The trusted caller authorizes outside the VM,
 * then a fresh, side-effect-free VM replays with that one response available.
 * Capturing the request in Host state means VM catch/global forgery cannot grant it.
 */
export async function renderTemplate(content, snapshot = {}, { signal, timeLimit = 75, memoryLimit = 16 * 1024 * 1024, maxOutput = 524288, resolveDependency } = {}) {
  signal?.throwIfAborted()
  const compileStarted = performance.now()
  const compiled = compile(content, () => {
    signal?.throwIfAborted()
    if (performance.now() - compileStarted >= timeLimit) throw error('TEMPLATE_EXECUTION_LIMIT', 'Template compilation budget exceeded')
  })
  let spent = performance.now() - compileStarted
  const lookup = resolveDependency ?? (request => snapshotLookup(snapshot, request))
  const module = await (modulePromise ??= newQuickJSWASMModuleFromVariant(variant))
  const cache = new Map()
  let inputBytes = 0, operations = 0
  for (let pass = 0; pass <= 32; pass++) {
    signal?.throwIfAborted()
    if (spent >= timeLimit) throw error('TEMPLATE_EXECUTION_LIMIT', 'Template execution budget exceeded')
    const runtime = module.newRuntime(), started = performance.now(), deadline = started + timeLimit - spent
    runtime.setMemoryLimit(memoryLimit); runtime.setMaxStackSize(256 * 1024)
    let interrupts = 0, pending = null, bridgeFailure = null, output
    runtime.setInterruptHandler(() => signal?.aborted || ++interrupts > 1000 || performance.now() > deadline)
    runtime.setModuleLoader(() => ({ error: new Error('Template imports are disabled') }))
    const vm = runtime.newContext()
    const bridge = vm.newFunction('__dependency', handle => {
      try {
        if (++operations > 512) throw error('TEMPLATE_DEPENDENCY_LIMIT', 'Template lookup budget exceeded')
        const raw = vm.getString(handle)
        if (raw.length > 4096) throw error('TEMPLATE_DEPENDENCY_INVALID', 'Template lookup too large')
        const request = JSON.parse(raw)
        if (!request || typeof request.kind !== 'string' || !Array.isArray(request.args) || request.args.length > 2 || request.args.some(v=>typeof v!=='string'&&typeof v!=='number')) throw error('TEMPLATE_DEPENDENCY_INVALID', 'Invalid template lookup')
        const key = JSON.stringify([request.kind,request.args])
        if (cache.has(key)) return vm.newString(cache.get(key))
        pending ??= { key, request }
        return { error: vm.newError('Template dependency pending') }
      } catch (e) { bridgeFailure = e; return { error: vm.newError('Template lookup rejected') } }
    })
    vm.setProp(vm.global, '__dependency', bridge); bridge.dispose()
    const evaluate = code => {
      const result = vm.evalCode(code, 'tavern-template.js')
      if (result.error) { const detail = vm.dump(result.error); result.error.dispose(); throw error('TEMPLATE_EXECUTION_FAILED', String(detail?.message ?? 'Template execution failed').slice(0, 300)) }
      const value = vm.dump(result.value); result.value.dispose(); return value
    }
    try {
      evaluate(`${bootstrap}\nglobalThis.__result=null;\n(async()=>{let __output='';const print=(...values)=>{__output+=values.map(v=>v==null?'':String(v)).join('');if(__output.length>${maxOutput})throw new Error('Template output limit exceeded')};${compiled}\nreturn __output})().then(value=>{globalThis.__result={value}},e=>{globalThis.__result={error:String(e?.message??e)}});void 0;`)
      let jobs = 0
      while (runtime.hasPendingJob() && !pending && !bridgeFailure) {
        if (++jobs > 1000 || performance.now() > deadline) throw error('TEMPLATE_EXECUTION_LIMIT', 'Template asynchronous job budget exceeded')
        signal?.throwIfAborted()
        const result = runtime.executePendingJobs(1)
        if (result.error) { result.error.dispose(); throw error('TEMPLATE_EXECUTION_FAILED', 'Template async job failed') }
      }
      if (bridgeFailure) throw bridgeFailure
      if (!pending) {
        const result = evaluate('globalThis.__result')
        if (!result) throw error('TEMPLATE_UNSETTLED', 'Template promise did not settle')
        if (result.error) throw error('TEMPLATE_EXECUTION_FAILED', result.error.slice(0, 300))
        if (typeof result.value !== 'string' || Buffer.byteLength(result.value) > maxOutput) throw error('TEMPLATE_OUTPUT_LIMIT', 'Template output limit exceeded')
        output = result.value
      }
    } finally { vm.dispose(); runtime.dispose(); spent += performance.now() - started }
    signal?.throwIfAborted()
    if (!pending) return output
    if (pass === 32) throw error('TEMPLATE_DEPENDENCY_LIMIT', 'Template dependency expansion budget exceeded')
    const response = JSON.stringify(await lookup(structuredClone(pending.request)))
    signal?.throwIfAborted()
    if (typeof response !== 'string' || (inputBytes += Buffer.byteLength(response)) > 2 * 1024 * 1024) throw error('TEMPLATE_INPUT_LIMIT', 'Template dependency snapshots exceed 2 MiB')
    cache.set(pending.key, response)
  }
}
