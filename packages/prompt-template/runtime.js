import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-singlefile-browser-release-sync'

let modulePromise
const error = (code, message) => Object.assign(new Error(message), { code })
/** Independent EJS-style compiler. Compiled JavaScript is evaluated only in QuickJS. */
export function compileTemplate(content) {
  if (typeof content !== 'string' || content.length > 131072) throw new TypeError('Template must be at most 128 Ki characters')
  let code = '', offset = 0
  const tags = /<%([=#_%\-]?)([\s\S]*?)([-_]?%>)/g
  const literal = value => { if (value) code += `print(${JSON.stringify(value)});\n` }
  for (const match of content.matchAll(tags)) {
    let preceding = content.slice(offset, match.index)
    if (match[1] === '_') preceding = preceding.replace(/[ \t]*$/, '')
    literal(preceding)
    const [whole, kind, body, end] = match
    if (kind === '%') literal('<%' + body + '%>')
    else if (kind === '=' || kind === '-') code += `print(${kind === '=' ? '__escape' : ''}(( ${body} )));\n`
    else if (kind !== '#') code += `${body}\n`
    offset = match.index + whole.length
    if (end === '-%>') offset += content.slice(offset).match(/^\r?\n/)?.[0].length ?? 0
    if (end === '_%>') offset += content.slice(offset).match(/^\s*/)?.[0].length ?? 0
  }
  const tail = content.slice(offset)
  if (tail.includes('<%')) throw new TypeError('Unclosed template tag')
  literal(tail)
  return code
}

const bootstrap = `
const __frozen = value => { if(value && typeof value === 'object') {Object.freeze(value);for(const item of Object.values(value))__frozen(item)};return value };
const __data = __frozen(JSON.parse(__input));
const variables = __data.variables ?? {};
const __unsupported = name => {throw new Error('Unsupported template capability: '+name)};
const __escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&#34;',"'":'&#39;'}[c]));
const __path = (object,path) => {
  if(path === null || path === undefined || path === '')return object;
  if(typeof path !== 'string')throw new TypeError('Variable path must be a string');
  const keys=path.replace(/\\[(?:"([^"\\]]+)"|'([^'\\]]+)'|(\\d+))\\]/g,(_,a,b,c)=>'.'+(a??b??c)).split('.');
  for(const key of keys){if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe variable path');if(!object || !Object.hasOwn(object,key))return undefined;object=object[key]};return object;
};
function getvar(key,options={}) {
  if(typeof options === 'string')options={scope:options};
  if(!options || typeof options!=='object' || Array.isArray(options) || Object.keys(options).some(k=>!['scope','defaults','clone'].includes(k)))return __unsupported('getvar options');
  if(options.scope && options.scope!=='cache')return __unsupported('getvar scope '+options.scope);
  const value=__path(variables,key);return value===undefined?options.defaults:value;
}
const __match=(item,name)=>name instanceof RegExp?name.test(item.name??item.comment??''):String(item.id??item.uid)===String(name)||(item.name??item.comment)===name;
async function getwi(book,title,data) {
  if(data!==undefined)return __unsupported('getwi data/template recursion');
  if(title===undefined){title=book;book=''};
  if(typeof book!=='string')return __unsupported('getwi book');
  const books=(__data.worldBooks??[]).filter(b=>!book||b.id===book||b.name===book);
  const found=books.flatMap(b=>b.entries??[]).find(e=>__match(e,title));return found?.content??'';
}
async function getpreset(name,data) {
  if(data!==undefined)return __unsupported('getpreset data/template recursion');
  return (__data.preset?.prompts??[]).find(p=>__match({...p,id:p.identifier},name))?.content??'';
}
async function getchar(name,template,data) {
  if(template!==undefined || data!==undefined)return __unsupported('getchar custom template');
  const c=__data.character;
  if(!c || (name!==undefined && !__match(c,name)))return '';
  return c.data?.description??'';
}
const getWorldInfo=getwi,getPresetPrompt=getpreset,getChara=getchar;
const setvar=()=>__unsupported('setvar'),execute=()=>__unsupported('execute');
`

/** No Host callbacks, modules, filesystem, network, timers or Agent handles. */
export async function renderTemplate(content, snapshot = {}, { signal, timeLimit = 75, memoryLimit = 16 * 1024 * 1024, maxOutput = 524288 } = {}) {
  signal?.throwIfAborted()
  const compiled = compileTemplate(content), input = JSON.stringify(snapshot)
  if (Buffer.byteLength(input) > 2 * 1024 * 1024) throw error('TEMPLATE_INPUT_LIMIT', 'Template snapshot exceeds 2 MiB')
  const module = await (modulePromise ??= newQuickJSWASMModuleFromVariant(variant))
  signal?.throwIfAborted()
  const runtime = module.newRuntime()
  runtime.setMemoryLimit(memoryLimit); runtime.setMaxStackSize(256 * 1024)
  const deadline = performance.now() + timeLimit
  let interrupts = 0
  runtime.setInterruptHandler(() => signal?.aborted || ++interrupts > 1000 || performance.now() > deadline)
  runtime.setModuleLoader(() => ({ error: new Error('Template imports are disabled') }))
  const vm = runtime.newContext()
  const evaluate = code => {
    const result = vm.evalCode(code, 'tavern-template.js')
    if (result.error) { const detail = vm.dump(result.error); result.error.dispose(); throw error('TEMPLATE_EXECUTION_FAILED', String(detail?.message ?? 'Template execution failed').slice(0, 300)) }
    const value = vm.dump(result.value); result.value.dispose(); return value
  }
  try {
    evaluate(`const __input=${JSON.stringify(input)};${bootstrap}\nglobalThis.__result=null;\n(async()=>{let __output='';const print=(...values)=>{__output+=values.map(v=>v==null?'':String(v)).join('');if(__output.length>${maxOutput})throw new Error('Template output limit exceeded')};${compiled}\nreturn __output})().then(value=>{globalThis.__result={value}},e=>{globalThis.__result={error:String(e?.message??e)}});void 0;`)
    let jobs = 0
    while (runtime.hasPendingJob()) {
      if (++jobs > 1000 || performance.now() > deadline) throw error('TEMPLATE_EXECUTION_LIMIT', 'Template asynchronous job budget exceeded')
      signal?.throwIfAborted()
      const result = runtime.executePendingJobs(1)
      if (result.error) { result.error.dispose(); throw error('TEMPLATE_EXECUTION_FAILED', 'Template async job failed') }
    }
    const result = evaluate('globalThis.__result')
    signal?.throwIfAborted()
    if (!result) throw error('TEMPLATE_UNSETTLED', 'Template promise did not settle')
    if (result.error) throw error('TEMPLATE_EXECUTION_FAILED', result.error.slice(0, 300))
    if (typeof result.value !== 'string' || Buffer.byteLength(result.value) > maxOutput) throw error('TEMPLATE_OUTPUT_LIMIT', 'Template output limit exceeded')
    return result.value
  } finally { vm.dispose(); runtime.dispose() }
}
