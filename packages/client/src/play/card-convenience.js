// Clean-room helpers for the observed data-display call shapes. This code runs
// only in the isolated interpreter; it never receives Host objects or transport.
export const CARD_CONVENIENCE = String.raw`
const __hiddenDisplay=new WeakMap();
globalThis.$=globalThis.jQuery=function(value){
 if(typeof value==='function'){value();return}
 const nodes=typeof value==='string'?[...document.querySelectorAll(value)]:value==null?[]:[value];
 const each=fn=>{for(const node of nodes)fn(node);return api};
 const classes=value=>String(value).split(/\s+/).filter(Boolean);
 const api={
  length:nodes.length,
  ready(callback){if(typeof callback!=='function')throw Error('Ready requires a function');callback();return api},
  text(value){if(value===undefined)return nodes[0]?.textContent;return each(node=>node.textContent=String(value))},
  html(value){if(value===undefined)return nodes[0]?.innerHTML;return each(node=>node.innerHTML=String(value))},
  on(type,fn){return each(node=>node.addEventListener(type,fn))},
  val(value){if(value===undefined)return nodes[0]?.value;return each(node=>node.value=value)},
  css(name,value){
   if(typeof name==='object'&&name!==null){for(const [key,item]of Object.entries(name))api.css(key,item);return api}
   if(value===undefined)return nodes[0]?getComputedStyle(nodes[0]).getPropertyValue(String(name)):undefined;
   return each(node=>node.style.setProperty(String(name).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),String(value)))
  },
  show(){return each(node=>{node.style.removeProperty('display');const previous=__hiddenDisplay.get(node);if(previous&&previous!=='none')node.style.setProperty('display',previous);__hiddenDisplay.delete(node);if(getComputedStyle(node).getPropertyValue('display')==='none')node.style.setProperty('display','block')})},
  hide(){return each(node=>{if(node.style.getPropertyValue('display')!=='none')__hiddenDisplay.set(node,node.style.getPropertyValue('display'));node.style.setProperty('display','none')})},
  addClass(value){return each(node=>node.classList.add(...classes(value)))},
  removeClass(value){return each(node=>node.classList.remove(...classes(value)))},
  empty(){return each(node=>node.replaceChildren())}
 };return api
};
const __dataPath=path=>{
 if(Array.isArray(path)){if(path.length>64)throw Error('Data path exceeds limit');return path.map(String)}
 if(typeof path!=='string'||path.length>1000)throw Error('Invalid data path');
 if(path==='')return [''];
 const parts=[];let offset=0;
 while(offset<path.length){
  if(offset>0&&path[offset]==='.'){
   offset++;if(offset===path.length||path[offset]==='[')throw Error('Invalid data path');
  }else if(offset>0&&path[offset]!=='[')throw Error('Invalid data path');
  const token=path[offset]==='['?/\[(?:"([^"\\]*)"|'([^'\\]*)'|(\d+))\]/y:/[^.\[\]]+/y;
  token.lastIndex=offset;const match=token.exec(path);if(!match)throw Error('Unsupported data path');
  parts.push(path[offset]==='['?(match[1]??match[2]??match[3]):match[0]);offset=token.lastIndex;
  if(parts.length>64)throw Error('Data path exceeds limit');
 }
 return parts
};
globalThis._=Object.freeze({
 get(value,path,fallback){
  const parts=__dataPath(path);for(const key of parts){if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe data path');if(value==null||!Object.prototype.hasOwnProperty.call(value,key))return fallback;value=value[key]}
  return value===undefined?fallback:value
 },
 isEmpty(value){return value==null||(['string'].includes(typeof value)||Array.isArray(value)?value.length===0:typeof value==='object'?Object.keys(value).length===0:true)}
});
globalThis.errorCatched=fn=>{
 if(typeof fn!=='function')throw Error('Error wrapper requires a function');
 const report=error=>{__call('reportError',[String(error?.message??error).slice(0,200)])};
 return function(...args){try{const result=fn.apply(this,args);return result&&typeof result.then==='function'?Promise.resolve(result).catch(report):result}catch(error){report(error)}}
};
`
