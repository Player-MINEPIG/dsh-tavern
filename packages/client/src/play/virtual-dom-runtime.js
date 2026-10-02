// This source runs inside the interpreter, not in the worker's native realm.
export const VIRTUAL_DOM_BOOTSTRAP = `
const __DOM=__TavernDOM;
const __doc=__DOM.parseHTML('<html><head></head><body></body></html>');
globalThis.window=__doc.window;globalThis.self=window;globalThis.document=__doc.document;
for(const key of ['Node','Element','HTMLElement','SVGElement','Event','CustomEvent','MutationObserver','DOMParser'])globalThis[key]=__DOM[key];
document.implementation={createHTMLDocument:()=>__DOM.parseHTML('<html><head></head><body></body></html>').document};
globalThis.navigator=Object.freeze({userAgent:'Tavern isolated virtual DOM'});
globalThis.location=Object.freeze({href:'https://card.invalid/'});
globalThis.performance=Object.freeze({now:()=>Date.now()});
globalThis.console=Object.freeze({log(){},warn(){},error(){},info(){},debug(){}});
function __call(op,args=[]){const value=JSON.parse(__host(JSON.stringify({op,args})));if(value.error)throw Error(value.error);return value.value}
const __timers=new Map();let __timerId=0;
globalThis.setTimeout=(fn,delay=0,...args)=>{if(typeof fn!=='function')throw Error('Timer requires callback');const id=++__timerId;__timers.set(id,()=>fn(...args));__call('timer',[id,delay]);return id};
globalThis.clearTimeout=id=>{__timers.delete(id);__call('clearTimer',[id])};
globalThis.setInterval=(fn,delay=0,...args)=>{if(typeof fn!=='function')throw Error('Timer requires callback');const id=++__timerId;const tick=()=>{fn(...args);if(__timers.has(id))__call('timer',[id,Math.max(16,Number(delay)||0),true])};__timers.set(id,tick);__call('timer',[id,delay,true]);return id};
globalThis.clearInterval=globalThis.clearTimeout;
globalThis.requestAnimationFrame=fn=>setTimeout(()=>fn(performance.now()),16);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.__tick=(id,interval)=>{const fn=__timers.get(id);if(!interval)__timers.delete(id);if(fn)fn()};
// Small clean-room convenience facade; a reviewed jQuery can replace it.
globalThis.$=globalThis.jQuery=value=>{if(typeof value==='function'){value();return}const nodes=typeof value==='string'?[...document.querySelectorAll(value)]:[value];const api={text:value=>{if(value===undefined)return nodes[0]?.textContent;for(const node of nodes)node.textContent=String(value);return api},html:value=>{if(value===undefined)return nodes[0]?.innerHTML;for(const node of nodes)node.innerHTML=String(value);return api},on:(type,fn)=>{for(const node of nodes)node.addEventListener(type,fn);return api},val:value=>{if(value===undefined)return nodes[0]?.value;for(const node of nodes)node.value=value;return api}};return api};
const __subscribers=new Map();let __subscriberId=0;
const __getVariables=options=>__call('variables',[options??null]);
globalThis.getVariables=__getVariables;globalThis.getAllVariables=()=>__getVariables();
globalThis.TavernHelper=Object.freeze({getVariables:__getVariables,getAllVariables});
globalThis.TavernUI=Object.freeze({version:1,getContext:()=>__call('context'),getVariables:__getVariables,proposeMessage:text=>__call('propose',[String(text)]),onVariables:fn=>{if(typeof fn!=='function'||__subscribers.size>=64)throw Error('Invalid variable subscriber');const id=++__subscriberId;__subscribers.set(id,fn);return()=>__subscribers.delete(id)}});
const __mvuCallbacks=new Set(),__writes=new Map();let __writeId=0,__mvuRevision=-1;globalThis.__setMvuRevision=value=>{__mvuRevision=value};
const __write=(operation,value,options)=>{if(__writes.size>=32)return Promise.reject(Error('Too many pending writes'));const id=++__writeId;return new Promise((resolve,reject)=>{__writes.set(id,{resolve,reject});try{__call('variableWrite',[id,operation,value,options??null])}catch(error){__writes.delete(id);reject(error)}})};
globalThis.__writeResult=(id,result)=>{const pending=__writes.get(id);if(!pending)return;__writes.delete(id);if(result.error)pending.reject(Object.assign(Error(result.error.message),{code:result.error.code}));else pending.resolve(result.variables)};
globalThis.Mvu=Object.freeze({getMvuData:__getVariables,updateVariablesWith:ops=>{if(!Array.isArray(ops))return Promise.reject(Error('JSONPatch array required'));return __write('patch',ops)},replaceMvuData:(data,options)=>__write('replace',data,options),events:Object.freeze({VARIABLE_UPDATE_ENDED:'VARIABLE_UPDATE_ENDED'})});
globalThis.TavernHelper=Object.freeze({...TavernHelper,Mvu});
globalThis.eventOn=(event,fn)=>{if(event!=='VARIABLE_UPDATE_ENDED'||typeof fn!=='function'||__mvuCallbacks.size>=64)throw Error('Unsupported bound MVU event');__mvuCallbacks.add(fn);return()=>__mvuCallbacks.delete(fn)};
globalThis.waitGlobalInitialized=name=>name==='Mvu'?Promise.resolve():Promise.reject(Error('Unsupported global initialization'));
globalThis.__notifyVariables=snapshot=>{for(const fn of __subscribers.values())fn(JSON.parse(JSON.stringify(snapshot)));if(snapshot.status==='available'&&snapshot.revision>__mvuRevision){__mvuRevision=snapshot.revision;for(const fn of __mvuCallbacks)fn()}}
;
const __ids=new WeakMap(),__nodes=new Map();let __nodeId=0;
globalThis.__view=()=>{
 const nodes=[document.body,...document.body.querySelectorAll('*')];if(nodes.length>8192)throw Error('Card DOM limit exceeded');
 const alive=new Set();
 for(const node of nodes){if(!__ids.has(node))__ids.set(node,++__nodeId);const id=__ids.get(node);alive.add(id);__nodes.set(id,node);node.setAttribute('data-dtv-node',String(id))}
 for(const id of __nodes.keys())if(!alive.has(id))__nodes.delete(id);
 return JSON.stringify({html:document.body.innerHTML,styles:[...document.head.querySelectorAll('style')].map(node=>node.textContent).join('\\n')});
};
globalThis.__domEvent=data=>{
 const node=__nodes.get(data.target);if(!node)return;
 if(data.value!==undefined)node.value=data.value;if(data.checked!==undefined)node.checked=data.checked;
 const event=new __DOM.Event(data.type,{bubbles:true,cancelable:true});
 for(const name of ['key','code','keyCode','charCode','button','buttons','clientX','clientY','ctrlKey','altKey','shiftKey','metaKey'])if(data[name]!==undefined)event[name]=data[name];
 node.dispatchEvent(event);
};
globalThis.__ready=()=>{document.dispatchEvent(new __DOM.Event('DOMContentLoaded'));window.dispatchEvent(new __DOM.Event('load'))};
`
