import { CARD_CONVENIENCE } from './card-convenience.js'
import { CARD_PHOTO_RUNTIME } from './card-photo-runtime.js'
import { CARD_COMPOSER_RUNTIME } from './card-composer-runtime.js'
// This source runs inside the interpreter, not in the worker's native realm.
export const VIRTUAL_DOM_BOOTSTRAP = `
const __DOM=__TavernDOM;
const __doc=__DOM.parseHTML('<html><head></head><body></body></html>',globalThis);
globalThis.window=__doc.window;globalThis.self=window;globalThis.document=__doc.document;
for(const key of ['Node','Element','HTMLElement','HTMLTextAreaElement','SVGElement','Event','CustomEvent','MutationObserver','DOMParser'])globalThis[key]=__DOM[key];
// Linkedom's fragment inherits Node.textContent=null. Browser templates expose
// the concatenated inert descendant text instead (required by option parsers).
if(__DOM.DocumentFragment)Object.defineProperty(__DOM.DocumentFragment.prototype,'textContent',{get(){return [...this.childNodes].map(node=>node.textContent??'').join('')},set(value){this.replaceChildren(document.createTextNode(String(value??'')))},configurable:true});
document.implementation={createHTMLDocument:()=>__DOM.parseHTML('<html><head></head><body></body></html>').document};
globalThis.navigator=Object.freeze({userAgent:'Tavern isolated virtual DOM'});
globalThis.location=Object.freeze({href:'https://card.invalid/'});
globalThis.performance=Object.freeze({now:()=>Date.now()});
for(const target of [globalThis,window])for(const [name,key] of [['innerWidth','width'],['innerHeight','height']])if(!Object.getOwnPropertyDescriptor(target,name))Object.defineProperty(target,name,{get(){return __call('viewport')[key]},configurable:false});
globalThis.__viewportChanged=()=>window.dispatchEvent(new __DOM.Event('resize'));

globalThis.console=Object.freeze({log(){},warn(){},error(){},info(){},debug(){}});
function __call(op,args=[]){const value=JSON.parse(__host(JSON.stringify({op,args})));if(value.error)throw Error(value.error);return value.value}
if(document.createElement&&__DOM.HTMLTextAreaElement){${CARD_COMPOSER_RUNTIME}}
const __timers=new Map();let __timerId=0;
globalThis.setTimeout=(fn,delay=0,...args)=>{if(typeof fn!=='function')throw Error('Timer requires callback');const id=++__timerId;__timers.set(id,()=>fn(...args));__call('timer',[id,delay]);return id};
globalThis.clearTimeout=id=>{__timers.delete(id);__call('clearTimer',[id])};
globalThis.setInterval=(fn,delay=0,...args)=>{if(typeof fn!=='function')throw Error('Timer requires callback');const id=++__timerId;const tick=()=>{fn(...args);if(__timers.has(id))__call('timer',[id,Math.max(16,Number(delay)||0),true])};__timers.set(id,tick);__call('timer',[id,delay,true]);return id};
globalThis.clearInterval=globalThis.clearTimeout;
globalThis.requestAnimationFrame=fn=>setTimeout(()=>fn(performance.now()),16);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.__tick=(id,interval)=>{const fn=__timers.get(id);if(!interval)__timers.delete(id);if(fn)fn()};
${CARD_PHOTO_RUNTIME}
${CARD_CONVENIENCE}
const __subscribers=new Map();let __subscriberId=0;
const __getVariables=options=>__call('variables',[options??null]);
globalThis.getVariables=__getVariables;globalThis.getAllVariables=()=>__getVariables();
globalThis.TavernHelper=Object.freeze({getVariables:__getVariables,getAllVariables});
globalThis.TavernUI=Object.freeze({version:1,getContext:()=>__call('context'),getVariables:__getVariables,proposeMessage:text=>__call('propose',[String(text)]),onVariables:fn=>{if(typeof fn!=='function'||__subscribers.size>=64)throw Error('Invalid variable subscriber');const id=++__subscriberId;__subscribers.set(id,fn);return()=>__subscribers.delete(id)}});
const __mvuCallbacks=new Set(),__boundEvents=new Map(),__writes=new Map();let __writeId=0,__mvuRevision=-1,__mvuAvailable=false;globalThis.__setMvuRevision=(value,available=value>=0)=>{__mvuRevision=value;__mvuAvailable=available};
const __write=(operation,value,options)=>{if(__writes.size>=32)return Promise.reject(Error('Too many pending writes'));const id=++__writeId;return new Promise((resolve,reject)=>{__writes.set(id,{resolve,reject});try{__call('variableWrite',[id,operation,value,options??null])}catch(error){__writes.delete(id);reject(error)}})};
globalThis.__writeResult=(id,result)=>{const pending=__writes.get(id);if(!pending)return;__writes.delete(id);if(result.error)pending.reject(Object.assign(Error(result.error.message),{code:result.error.code}));else pending.resolve(result.variables)};
globalThis.Mvu=Object.freeze({getMvuData:options=>options==null?__getVariables():__call('mvuVariables',[options]),updateVariablesWith:ops=>{if(!Array.isArray(ops))return Promise.reject(Error('JSONPatch array required'));return __write('patch',ops)},replaceMvuData:(data,options)=>__write('replace',data,options),events:Object.freeze({VARIABLE_UPDATE_ENDED:'VARIABLE_UPDATE_ENDED'})});
globalThis.TavernHelper=Object.freeze({...TavernHelper,Mvu});
globalThis.tavern_events=Object.freeze({CHARACTER_FIRST_MESSAGE_SELECTED:'character_first_message_selected',MESSAGE_SWIPED:'message_swiped'});
globalThis.eventOn=(event,fn)=>{
 if(typeof fn!=='function'||![...Object.values(tavern_events),'VARIABLE_UPDATE_ENDED'].includes(event))throw Error('Unsupported bound card event');
 const listeners=event==='VARIABLE_UPDATE_ENDED'?__mvuCallbacks:(__boundEvents.get(event)??new Set());
 if(!listeners.has(fn)&&[...__boundEvents.values()].reduce((count,set)=>count+set.size,__mvuCallbacks.size)>=64)throw Error('Card event listener limit exceeded');
 listeners.add(fn);if(event!=='VARIABLE_UPDATE_ENDED')__boundEvents.set(event,listeners);return()=>listeners.delete(fn);
};
globalThis.getChatMessages=id=>__call('firstChatMessage',[id]);
globalThis.SillyTavern=Object.freeze({getContext:()=>{const view=__call('boundGreeting');if(!view)throw Error('Bound greeting unavailable');return {...TavernUI.getContext(),chat:Object.assign(Array(view.messageCount).fill(null),{0:view.message})}}});
for(const key of ['Mvu','TavernHelper','eventOn','tavern_events','getChatMessages','SillyTavern'])window[key]=globalThis[key];
globalThis.__greetingSelected=()=>{const choice=__call('boundGreetingSelection');if(!choice)return;const view=choice.view;for(const fn of [...(__boundEvents.get(tavern_events.CHARACTER_FIRST_MESSAGE_SELECTED)??[])])fn({input:view.message.mes,output:view.message.mes});if(choice.swiped)for(const fn of [...(__boundEvents.get(tavern_events.MESSAGE_SWIPED)??[])])fn(0)};
globalThis.__initializeBuiltinMvu=version=>{if(version!==1)throw Error('Unsupported built-in MVU facade version');return Mvu};
globalThis.waitGlobalInitialized=name=>name==='Mvu'?Promise.resolve():Promise.reject(Error('Unsupported global initialization'));
globalThis.__notifyVariables=snapshot=>{const available=snapshot.status==='available',changed=available&&(!__mvuAvailable||snapshot.revision>__mvuRevision);__mvuAvailable=available;for(const fn of __subscribers.values())fn(JSON.parse(JSON.stringify(snapshot)));if(changed){__mvuRevision=snapshot.revision;for(const fn of __mvuCallbacks)fn()}}
;
const __ids=new WeakMap(),__nodes=new Map();let __nodeId=0;
globalThis.__view=()=>{
 const nodes=[document.body,...document.body.querySelectorAll('*')];if(nodes.length>8192)throw Error('Card DOM limit exceeded');
 const alive=new Set();
 for(const node of nodes){if(!__ids.has(node))__ids.set(node,++__nodeId);const id=__ids.get(node);alive.add(id);__nodes.set(id,node);node.setAttribute('data-dtv-node',String(id))}
 for(const id of __nodes.keys())if(!alive.has(id))__nodes.delete(id);
 const controls=nodes.filter(node=>node.localName==='input'&&['radio','checkbox'].includes(node.type)).map(node=>({id:__ids.get(node),checked:node.checked===undefined?node.hasAttribute('checked'):node.checked===true}));if(controls.length>512)throw Error('Card control state limit exceeded');
 return JSON.stringify({bodyId:__ids.get(document.body),controls,root:{html:{className:document.documentElement.className,style:document.documentElement.getAttribute('style')??''},body:{className:document.body.className,style:document.body.getAttribute('style')??''}},html:document.body.innerHTML,styles:[...document.head.querySelectorAll('style')].map(node=>node.textContent).join('\\n')});
};
// Synchronous-looking getters suspend only this interpreter. The host measures
// the current sanitized view in this card's script-disabled iframe.
const __geometry=(node,pseudo)=>{
 const view=JSON.parse(__view());let id=0;
 if(node!==document.documentElement){
  const marker=node?.getAttribute?.('data-dtv-node');id=__ids.get(node);
  if(!marker||!Number.isSafeInteger(id)||id<=0||marker!==String(id)||__nodes.get(id)!==node||(node!==document.body&&!document.body.contains(node)))throw Error('Layout target is outside the rendered card');
 }
 const result=JSON.parse(__layout(JSON.stringify({id,view,pseudo})));if(result.error)throw Error(result.error);return result;
};
Element.prototype.getBoundingClientRect=function(){return __geometry(this).rect};
for(const key of ['scrollHeight','scrollWidth','offsetHeight','offsetWidth','clientHeight','clientWidth','offsetTop','offsetLeft'])Object.defineProperty(Element.prototype,key,{get(){return __geometry(this)[key]},configurable:true});
globalThis.getComputedStyle=(node,pseudo)=>{const data=__geometry(node,pseudo).computed;return Object.freeze({...data,getPropertyValue:name=>data[String(name)]??'',getPropertyPriority:()=>''})};
globalThis.__domEvent=data=>{
 const node=__nodes.get(data.target);if(!node)return;
 if(data.type==='change'&&data.photo!==undefined)__acceptPhoto(node,data.photo);
 globalThis.__beginComposerEvent?.();
 if(data.value!==undefined)node.value=data.value;if(data.checked!==undefined)node.checked=data.checked;
 const event=new __DOM.Event(data.type,{bubbles:true,cancelable:true});
 for(const name of ['key','code','keyCode','charCode','button','buttons','clientX','clientY','ctrlKey','altKey','shiftKey','metaKey'])if(data[name]!==undefined)event[name]=data[name];
 node.dispatchEvent(event);
};
globalThis.__ready=()=>{document.dispatchEvent(new __DOM.Event('DOMContentLoaded'));window.dispatchEvent(new __DOM.Event('DOMContentLoaded'));window.dispatchEvent(new __DOM.Event('load'))};
`
