import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-singlefile-browser-release-sync'
import { commandHookDeclaration } from './command-hook-declaration.js'
import { commandHookInput, commandsFromHook } from './command-hook-commands.js'
import { fail, json } from './value.js'

let modulePromise
// This VM has no Host functions, module loader, network or variable write API.
const bootstrap = `
(() => {
 const events=new Map([['global_Mvu_initialized',[]],['mag_command_parsed',[]]]);
 const on=(name,fn,last=false)=>{
  if(!events.has(name)||typeof fn!=='function')throw Error('Unsupported command event');
  const list=events.get(name),old=list.indexOf(fn);
  if(old>=0){if(!last)return()=>{};list.splice(old,1)}
  if(list.length>=16)throw Error('Command listener limit');list.push(fn);
  return()=>{const i=list.indexOf(fn);if(i>=0)list.splice(i,1)};
 };
 const emit=(name,...args)=>{for(const fn of [...events.get(name)]){
  const result=fn(...args);if(result&&typeof result.then==='function')throw Error('Async command callbacks are unsupported');
 }};
 globalThis.Mvu=Object.freeze({events:Object.freeze({COMMAND_PARSED:'mag_command_parsed'})});
 globalThis.eventOn=(name,fn)=>on(name,fn);
 globalThis.eventMakeLast=(name,fn)=>on(name,fn,true);
 globalThis.console=Object.freeze({log(){},warn(){},error(){},info(){},debug(){}});
 const extract=text=>{
  text=String(text);
  if([...text.matchAll(/<(?:本轮操作|本轮APP操作)>/g)].length!==1||[...text.matchAll(/<\\/(?:本轮操作|本轮APP操作)>/g)].length!==1)return '';
  const matches=[...text.matchAll(/<(本轮操作|本轮APP操作)>([\\s\\S]*?)<\\/\\1>/g)],body=matches[0]?.[2]?.trim();
  if(matches.length!==1||!body||body.length>30000||!body.includes('<本轮执行边界>')||!body.includes('<操作项>'))return '';
  return '<本轮操作>'+body+'</本轮操作>';
 };
 let context=null;
 globalThis.__commandGate=Object.freeze({latestUserText:()=>context?.userText??'',extractOperationBlock:extract});
 globalThis.__commandInitialized=()=>{emit('global_Mvu_initialized');return events.get('mag_command_parsed').length};
 globalThis.__commandProcess=input=>{
  if(context)throw Error('Reentrant command processing');context=input;
  try{const baseline=JSON.stringify(input.variables);emit('mag_command_parsed',input.variables,input.commands,input.text);
   if(JSON.stringify(input.variables)!==baseline)throw Error('Command callback changed its baseline');
   return JSON.stringify(input.commands);
  }finally{context=null}
 };
 for(const name of ['Mvu','eventOn','eventMakeLast','console','__commandGate','__commandInitialized','__commandProcess'])Object.defineProperty(globalThis,name,{writable:false,configurable:false});
})();`

/** One bounded source processor. Only candidate filtering and admitted literal repair. */
export async function createCommandProcessor(source) {
  const declaration = commandHookDeclaration(source)
  if (!declaration) fail('MVU_COMMAND_HOOK_DECLARATION', 'Complete command declaration required')
  const QuickJS = await (modulePromise ??= newQuickJSWASMModuleFromVariant(variant))
  const runtime = QuickJS.newRuntime()
  runtime.setMemoryLimit(32 * 1024 * 1024); runtime.setMaxStackSize(256 * 1024)
  let deadline = 0, ticks = 0, disposed = false
  runtime.setInterruptHandler(() => ++ticks > 1500 || performance.now() > deadline)
  const vm = runtime.newContext()
  const evaluate = code => {
    if (disposed) fail('MVU_COMMAND_HOOK_DISPOSED', 'Command processor disposed')
    deadline = performance.now() + 250; ticks = 0
    const result = vm.evalCode(code, 'mvu-command-source.js')
    if (result.error) { result.error.dispose(); fail('MVU_COMMAND_HOOK_EXECUTION', 'Command processor rejected the candidate') }
    try { return vm.dump(result.value) } finally { result.value.dispose() }
  }
  const dispose = () => { if (!disposed) { disposed = true; vm.dispose(); runtime.dispose() } }
  try {
    evaluate(bootstrap)
    if (declaration.gateGlobal) evaluate(`Object.defineProperty(globalThis,${JSON.stringify(declaration.gateGlobal)},{value:__commandGate,writable:false,configurable:false});`)
    evaluate(source)
    const listenerCount = evaluate('__commandInitialized()')
    if (!Number.isSafeInteger(listenerCount) || listenerCount < 1) fail('MVU_COMMAND_HOOK_REGISTRATION', 'Command callback was not registered')
    return {
      listenerCount, dispose,
      async process({ variables, text, userText = '' }) {
        const input = commandHookInput(text)
        if (typeof userText !== 'string' || userText.length > 64 * 1024) userText = ''
        const payload = { variables: json(variables), text, userText, commands: input.view }
        const encoded = JSON.stringify(JSON.stringify(payload))
        const result = evaluate(`__commandProcess(JSON.parse(${encoded}))`)
        let commands
        try { if (typeof result !== 'string' || result.length > 8 * 1024 * 1024) fail('MVU_COMMAND_HOOK_LIMIT', 'Command output too large'); commands = JSON.parse(result) } catch { fail('MVU_COMMAND_HOOK_OUTPUT', 'Invalid command output') }
        return commandsFromHook(commands, input.admitted, input.repairs)
      },
    }
  } catch (error) { dispose(); throw error }
}
