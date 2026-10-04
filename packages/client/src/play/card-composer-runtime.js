// Evaluated only inside QuickJS, with interpreter-owned DOM nodes and objects.
export const CARD_COMPOSER_RUNTIME = `
const __composerInitial=__call('composerContext')??{available:false,directSend:true};
const __composerAction=(operation,value)=>{const result=JSON.parse(__action(JSON.stringify({operation,value})));if(result.error)throw Error(result.error);return result.value};
const __composerTextarea=document.createElement('textarea');
let __filledValue=null;
globalThis.__beginComposerEvent=()=>{__filledValue=null};
__composerTextarea.dispatchEvent=event=>{
 if(!event||!['input','change'].includes(event.type))throw Error('Unsupported composer event');
 const text=String(__composerTextarea.value);
 if(text!==__filledValue){__composerAction('fill',text);__filledValue=text}
 return true;
};
// insertText selects the inserted text in the public resident draft editor.
__composerTextarea.focus=()=>{};
const __extensionSettings={XiaJin:{directSend:__composerInitial.directSend===true}};
const __saveMode=()=>__composerAction('saveMode',__extensionSettings.XiaJin.directSend);
const __generate=()=>{
 if(__extensionSettings.XiaJin.directSend!==true)throw Error('Direct mode is not enabled');
 return __composerAction('send',{mode:'direct',text:String(__composerTextarea.value)});
};
const __stContext=Object.freeze({extensionSettings:__extensionSettings,generate:__generate,saveSettingsDebounced:__saveMode});
const __st=Object.freeze({getContext:()=>__stContext,saveSettingsDebounced:__saveMode});
const __frameProxy=Object.freeze({contentWindow:window,remove:()=>__composerAction('close')});
const __sendProxy=Object.freeze({click:__generate});
const __parentDocument=Object.freeze({
 getElementById:id=>id==='send_textarea'?(__composerInitial.available?__composerTextarea:null):id==='send_but'?(__composerInitial.available?__sendProxy:null):null,
 querySelectorAll:selector=>selector==='iframe'?[__frameProxy]:[],
});
const __parentProxy=Object.freeze({SillyTavern:__st,document:__parentDocument,postMessage:message=>{
 if(!message||typeof message!=='object'||Array.isArray(message)||Object.keys(message).some(key=>!['type','height'].includes(key))||message.type!=='resizeIframe'||typeof message.height!=='number'||!Number.isFinite(message.height)||message.height<0)throw Error('Unsupported parent message');
 __call('composerResize',[message.height]);
}});
// Linkedom's defaultView delegates globals. Define these on this VM's global,
// preserving per-interpreter ownership even in native test contexts.
Object.defineProperty(globalThis,'parent',{value:__parentProxy,writable:false,configurable:false});
Object.defineProperty(globalThis,'top',{value:__parentProxy,writable:false,configurable:false});
`
