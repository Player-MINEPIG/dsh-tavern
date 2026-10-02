import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-singlefile-browser-release-sync'

let modulePromise
const getModule = () => modulePromise ??= newQuickJSWASMModuleFromVariant(variant)
const BOOTSTRAP = `
const callbacks = new Map();
let nextCallback = 0;
function call(op, args = []) {
  const result = JSON.parse(__bridge(JSON.stringify({op,args})));
  if (result.error) throw new Error(result.error);
  return result.value;
}
function element(id) {
  if (id === null) return null;
  return {
    get textContent(){return call('get',[id,'textContent'])}, set textContent(v){call('set',[id,'textContent',String(v)])},
    get innerHTML(){return call('get',[id,'innerHTML'])}, set innerHTML(v){call('set',[id,'innerHTML',String(v)])},
    get value(){return call('get',[id,'value'])}, set value(v){call('set',[id,'value',String(v)])},
    get checked(){return call('get',[id,'checked'])}, set checked(v){call('set',[id,'checked',Boolean(v)])},
    querySelector(s){return element(call('query',[id,String(s)]))},
    querySelectorAll(s){return call('queryAll',[id,String(s)]).map(element)},
    setAttribute(k,v){call('attribute',[id,String(k),String(v)])},
    getAttribute(k){return call('getAttribute',[id,String(k)])},
    appendChild(child){call('append',[id,child.__id]);return child},
    remove(){call('remove',[id])},
    addEventListener(type, callback){const key=++nextCallback;callbacks.set(key,callback);call('listen',[id,String(type),key])},
    style: {setProperty(k,v){call('style',[id,String(k),String(v)])}},
    classList: {add(v){call('class',[id,'add',String(v)])},remove(v){call('class',[id,'remove',String(v)])},toggle(v){return call('class',[id,'toggle',String(v)])}},
    __id:id,
  };
}
globalThis.document = Object.freeze({
  body: element(0),
  querySelector: s => element(call('query',[0,String(s)])),
  querySelectorAll: s => call('queryAll',[0,String(s)]).map(element),
  getElementById: s => element(call('byId',[String(s)])),
  createElement: tag => element(call('create',[String(tag)])),
  addEventListener: (event, callback) => {if(event !== 'DOMContentLoaded') throw new Error('Unsupported document event');callback()},
});
globalThis.window = globalThis;
globalThis.TavernUI = Object.freeze({
  version:1,
  getContext:()=>call('context'),
  proposeMessage:text=>call('propose',[String(text)]),
  getVariables:options=>call('variables',[options??null]),
  onVariables:callback=>{if(typeof callback!=='function')throw new TypeError('Callback required');const id=++nextCallback;callbacks.set(id,callback);call('variablesSubscribe',[id]);return()=>{callbacks.delete(id);call('variablesUnsubscribe',[id])}},
});
// Clean-room Helper subset. The host supplies a scoped JSON snapshot only.
globalThis.getAllVariables=()=>call('variables');
globalThis.getVariables=options=>call('variables',[options??null]);
globalThis.TavernHelper=Object.freeze({getVariables:globalThis.getVariables,getAllVariables:globalThis.getAllVariables});
// Small DOM convenience subset; deliberately no AJAX or browser object escape.
globalThis.$=globalThis.jQuery=function(selector){
  if(typeof selector==='function'){selector();return}
  const nodes=selector==='body'?[document.body]:typeof selector==='string'?document.querySelectorAll(selector):[selector];
  return {
    length:nodes.length,
    text(value){if(value===undefined)return nodes[0]?.textContent;nodes.forEach(n=>n.textContent=value);return this},
    html(value){if(value===undefined)return nodes[0]?.innerHTML;nodes.forEach(n=>n.innerHTML=value);return this},
    val(value){if(value===undefined)return nodes[0]?.value;nodes.forEach(n=>n.value=value);return this},
    on(event,callback){nodes.forEach(n=>n.addEventListener(event,callback));return this},
    ready(callback){callback();return this},
  };
};
globalThis.__variables=(id,snapshot)=>{const fn=callbacks.get(id);if(fn)fn(snapshot)};
globalThis.__dispatch=(id,target)=>{const fn=callbacks.get(id);if(fn)fn({target:element(target),currentTarget:element(target),preventDefault(){},stopPropagation(){}})};
`

// No native DOM/window/fetch/require handles cross this boundary. The one host
// function accepts and returns bounded JSON. Every interpreter entry is metered.
export async function createCardRuntime(bridge, { memoryLimit = 8 * 1024 * 1024, timeLimit = 60, modules = {} } = {}) {
  const QuickJS = await getModule()
  const runtime = QuickJS.newRuntime()
  runtime.setMemoryLimit(memoryLimit)
  runtime.setMaxStackSize(256 * 1024)
  let deadline = 0, operations = 0, interrupts = 0, disposed = false
  runtime.setInterruptHandler(() => ++interrupts > 500 || performance.now() > deadline)
  runtime.setModuleLoader(name => {
    if (!Object.hasOwn(modules,name)) return {error:new Error('Unreviewed module')}
    return modules[name]
  }, (base,name) => {
    try { return new URL(name,base).href } catch { return name }
  })
  const vm = runtime.newContext()
  const native = vm.newFunction('__bridge', arg => {
    if (++operations > 1000 || performance.now() > deadline) throw new Error('Card operation budget exceeded')
    const json = vm.getString(arg)
    if (json.length > 128 * 1024) throw new Error('Card bridge input too large')
    let result
    try { result = { value: bridge(JSON.parse(json)) ?? null } } catch (error) { result = { error: String(error.message).slice(0, 200) } }
    const output = JSON.stringify(result)
    if (output.length > 128 * 1024) throw new Error('Card bridge output too large')
    return vm.newString(output)
  })
  vm.setProp(vm.global, '__bridge', native); native.dispose()
  const evaluate = (code, {module = false, name = 'tavern-card.js'} = {}) => {
    if (disposed) throw new Error('Card is disposed')
    if (code.length > 128 * 1024) throw new Error('Card script too large')
    deadline = performance.now() + timeLimit; operations = 0; interrupts = 0
    const result = vm.evalCode(code, name, {type:module ? 'module' : 'global'})
    if (result.error) { result.error.dispose(); throw new Error('Card script failed, used an unsupported API, or exceeded its execution limit') }
    result.value.dispose()
    const jobs = runtime.executePendingJobs(100)
    if (jobs.error) { jobs.error.dispose(); throw new Error('Card asynchronous job failed') }
    if (runtime.hasPendingJob()) throw new Error('Card pending job limit exceeded')
  }
  const dispose = () => { if (!disposed) { disposed = true; vm.dispose(); runtime.dispose() } }
  try { evaluate(BOOTSTRAP) } catch (error) { dispose(); throw error }
  return { evaluate, notifyVariables:(id,snapshot)=>evaluate(`__variables(${JSON.stringify(id)},${JSON.stringify(snapshot)})`), dispatch: (id, target) => evaluate(`__dispatch(${JSON.stringify(id)},${JSON.stringify(target)})`), dispose }
}
