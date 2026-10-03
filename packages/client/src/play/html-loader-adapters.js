import {parse} from 'acorn'
import {sourceSha256} from './source-sha256.js'

// A reviewed compatibility snapshot, not a general permission to run its loader.
// The original wrapper is discarded. Only downloaded HTML runs in the VM.
export const IDENTITY_HTML_LOADER=Object.freeze({
  kind:'identity-html-loader',version:1,
  wrapperSha256:'0fdc93b6e5829a18ad4750b22fd2cbe0a3e7148cb77797745257d54cef91542b',
  htmlSha256:'6080f3339a447ad8bb8860615877af1b61675232a4d058a8fe9f5d64a8c81ea8',
  url:'https://cdn.jsdelivr.net/gh/5zyzz4msvd-spec/HApp5@2810e3201a70cc81599bc065dd4bf10e5db69f64/dist/webview/identity.html',
  assetBase:'https://cdn.jsdelivr.net/gh/5zyzz4msvd-spec/HApp5@2810e3201a70cc81599bc065dd4bf10e5db69f64/dist/webview/assets/',
})
export function htmlLoaderScript(source) {
  const body=String(source).trim().replace(/^```(?:html)?\s*\n([\s\S]*?)\n```\s*$/i,'$1').trim()
  return body.match(/^<body\s*>\s*<script\s*>([\s\S]*?)<\/script>\s*<\/body>$/i)?.[1].trim()??null
}
const literal=node=>node?.type==='Literal'&&typeof node.value==='string'?node.value:null
function loadCall(node,name,localBindings) {
  if(node?.type!=='ExpressionStatement')return false
  const call=node.expression,member=call?.callee,selector=member?.object
  return call.type==='CallExpression'&&call.arguments.length===1&&member.type==='MemberExpression'&&!member.computed&&member.property.name==='load'&&selector.type==='CallExpression'&&selector.callee.type==='Identifier'&&['$','jQuery'].includes(selector.callee.name)&&!localBindings.has(selector.callee.name)&&selector.arguments.length===1&&literal(selector.arguments[0])==='body'&&call.arguments[0].type==='Identifier'&&call.arguments[0].name===name
}
export function inspectHtmlLoader(source) {
  const code=htmlLoaderScript(source);if(code===null)return null
  if(code.includes('__ST_HYPNOOS_IDENTITY_FRONTEND_URL__')) {
    if(sourceSha256(code)!==IDENTITY_HTML_LOADER.wrapperSha256)throw Error('Identity HTML loader version changed; this compatibility snapshot must be reviewed again')
    return {...IDENTITY_HTML_LOADER,raw:IDENTITY_HTML_LOADER.url}
  }
  let tree;try{tree=parse(code,{ecmaVersion:'latest',sourceType:'script'})}catch{return null}
  if(tree.body.length!==1||tree.body[0].type!=='ExpressionStatement')return null
  const invocation=tree.body[0].expression,fn=invocation.callee
  if(invocation.type!=='CallExpression'||invocation.arguments.length||!['ArrowFunctionExpression','FunctionExpression'].includes(fn?.type)||fn.async||fn.generator||fn.params.length||fn.body.type!=='BlockStatement')return null
  const statements=fn.body.body,declaration=statements[0],entry=declaration?.declarations?.[0]
  // This exact two-statement grammar has only the URL const and named function
  // self-binding in its local scope. Neither may masquerade as global jQuery.
  const localBindings=new Set([fn.id?.name,entry?.id?.name].filter(Boolean))
  if(statements.length===2&&declaration.type==='VariableDeclaration'&&declaration.kind==='const'&&declaration.declarations.length===1&&entry.id.type==='Identifier'&&literal(entry.init)!==null&&loadCall(statements[1],entry.id.name,localBindings))return {kind:'fixed-html-loader',version:1,raw:entry.init.value}
  // Complex loaders need an explicit adapter; incidental effects cannot be lost.
  if(/\.(?:load)\s*\(|\bfetch\s*\(|\.srcdoc\s*=/.test(code))throw Error('Unsupported HTML loader structure; only a fixed URL and body load are supported')
  return null
}
export function identityLoaderBootstrap(wrapper) {
  if(wrapper?.kind!=='identity-html-loader')return null
  return `globalThis.__ST_HYPNOOS_ASSET_BASE__=${JSON.stringify(wrapper.assetBase)};
globalThis.__ST_HYPNOOS_IDENTITY_FRONTEND_URL__=${JSON.stringify(wrapper.url)};
globalThis.getContext=()=>TavernUI.getContext();
globalThis.getCurrentMessageId=()=>__call('boundScope').messageId;
globalThis.getCurrentChatId=()=>__call('cardStorageScope');
const __identityScopeOptions=options=>{
  if(options===undefined||options===null)return null;
  if(typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>!['type','message_id'].includes(key))||options.type!=='message')throw Error('Identity variables are bound to this card');
  const scope=__call('boundScope');
  if(options.message_id!=='latest'&&options.message_id!==scope.messageId)throw Error('Identity variables are bound to this card');
  return scope.messageId===null?null:{type:'message',message_id:scope.messageId};
};
window.Mvu=Object.freeze({...Mvu,getMvuData:options=>Mvu.getMvuData(__identityScopeOptions(options)),replaceMvuData:(data,options)=>Mvu.replaceMvuData(data,__identityScopeOptions(options))});
globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__=()=>getCurrentChatId();
globalThis.__ST_HYPNOOS_IDENTITY_TRANSIENT_SCOPE__=getCurrentChatId();
for(const key of ['getContext','getCurrentMessageId','getCurrentChatId','__ST_HYPNOOS_ASSET_BASE__','__ST_HYPNOOS_IDENTITY_FRONTEND_URL__','__ST_HYPNOOS_CHAT_STORAGE_SCOPE__','__ST_HYPNOOS_IDENTITY_TRANSIENT_SCOPE__'])window[key]=globalThis[key];
globalThis.__identityPropose=prompt=>TavernUI.proposeMessage(prompt);
`
}
export function adaptIdentityHtml(html,wrapper) {
  if(wrapper?.kind!=='identity-html-loader')return html
  if(sourceSha256(html)!==wrapper.htmlSha256)throw Error('Identity HTML source changed; this compatibility snapshot must be reviewed again')
  // Replace only the audited send completion function. It never touches Host DOM.
  const marker='  function finishIdentitySelection(prompt) {'
  const start=html.indexOf(marker),end=html.indexOf('\n  $("#identitySelect").addEventListener(',start)
  if(start<0||end<0)throw Error('Identity proposal adapter structure changed')
  const proposed=html.slice(0,start)+`  function finishIdentitySelection(prompt) {
    __identityPropose(prompt);
    setStatus("身份已写入，请在卡片下方确认开场提案。");
    saving = false;
    document.getElementById("identitySelect").disabled = false;
  }
`+html.slice(end)
  const openingStart=proposed.indexOf('  async function insertOpeningWorldbooks(identity) {'),openingEnd=proposed.indexOf('\n  function selectedCard() {',openingStart)
  if(openingStart<0||openingEnd<0)throw Error('Identity opening adapter structure changed')
  return proposed.slice(0,openingStart)+`  async function insertOpeningWorldbooks(identity) {
    return __identityOpening(String(identity?.["互斥开场ID"] || "default"));
  }
`+proposed.slice(openingEnd)
}
