import {parse} from 'acorn'
import {OPENING_IDENTITY_SHA256} from '../../../opening-worldbook/manifest.js'
import {json,safeKey} from '../../../mvu-adapter/src/value.js'
import {sourceSha256} from './source-sha256.js'

// A fixed source-specific data transformation. No eval, Function, VM callback,
// property method or ambient object from the card enters this interpreter.
const names=['defaultCrimeRecord','defaultFemaleSensitivity','openingBaselineItems','emptyProfileExtras','openingRoleSeed','openingRoleTemplates','setRoleState','setPoolRoleAppearance','applyOpeningStateToRoot','openingPromptBlock','openingSceneInstruction','buildOpeningPrompt']
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const returned=Symbol('return'),continued=Symbol('continue')
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(item=>walk(item,visit));else if(value&&typeof value==='object')walk(value,visit)}
const path=node=>node.type==='Identifier'?node.name:node.type==='MemberExpression'&&!node.computed?path(node.object)+'.'+node.property.name:''
export function createFixedIdentityActionModel(source) {
 if(typeof source!=='string'||sourceSha256(source)!==OPENING_IDENTITY_SHA256)throw Error('Identity action source changed')
 const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(code=>code.includes('function buildOpeningPrompt'))
 if(scripts.length!==1)throw Error('Identity action source structure changed')
 const functions=new Map(),constants=Object.create(null)
 walk(parse(scripts[0],{ecmaVersion:'latest'}),node=>{
  if(node.type==='FunctionDeclaration'&&names.includes(node.id?.name)){if(functions.has(node.id.name))throw Error('Duplicate identity transformation');functions.set(node.id.name,node)}
  if(node.type==='VariableDeclarator'&&['DEFAULT_CLASS','OPENING_CHOICES','OPENING_PERKS','INITIAL_ROLE_NAMES'].includes(node.id?.name)){if(Object.hasOwn(constants,node.id.name))throw Error('Duplicate identity constant');constants[node.id.name]=node.init}
 })
 if(functions.size!==names.length||Object.keys(constants).length!==4)throw Error('Identity transformation unavailable')
 let fuel=0,depth=0,values
 const tick=()=>{if(--fuel<0||depth>32)throw Error('Identity transformation limit exceeded')}
 const call=(name,args)=>{
  tick()
  if(name==='String')return String(args[0])
  if(name==='isPlainObject')return plain(args[0])
  if(name==='cloneJson')return json(args[0])
  if(name==='identityValue'){const text=String(args[0]??'').trim();return text||args[1]||'未填写'}
  if(name==='openingChoiceById')return values.OPENING_CHOICES.find(item=>item.id===args[0])??values.OPENING_CHOICES[0]
  const fn=functions.get(name);if(!fn)throw Error('Unsupported identity transformation call')
  const env=Object.assign(Object.create(null),values);fn.params.forEach((param,index)=>{if(param.type!=='Identifier')throw Error('Unsupported identity parameter');env[param.name]=args[index]})
  depth++;try{const result=statement(fn.body,env);return result?.[returned]}finally{depth--}
 }
 const expression=(node,env)=>{
  tick()
  switch(node.type){
   case 'Literal':if(node.regex||node.bigint)throw Error('Unsupported identity literal');return node.value
   case 'Identifier':if(node.name==='undefined')return undefined;if(!Object.hasOwn(env,node.name))throw Error('Unknown identity value');return env[node.name]
   case 'ChainExpression':return expression(node.expression,env)
   case 'MemberExpression':{const object=expression(node.object,env);if(object==null&&node.optional)return undefined;if(object==null)throw Error('Missing identity value');const key=safeKey(node.computed?expression(node.property,env):node.property.name);return Object.hasOwn(object,key)?object[key]:undefined}
   case 'ObjectExpression':{const out={};for(const property of node.properties){if(property.type==='SpreadElement'){const value=expression(property.argument,env);if(!plain(value))throw Error('Invalid identity spread');for(const [key,child]of Object.entries(value))out[safeKey(key)]=child}else{if(property.type!=='Property'||property.kind!=='init'||property.method||property.computed)throw Error('Invalid identity property');out[safeKey(property.key.name??property.key.value)]=expression(property.value,env)}}return out}
   case 'ArrayExpression':return node.elements.map(item=>expression(item,env))
   case 'LogicalExpression':{const left=expression(node.left,env);if(node.operator==='||')return left||expression(node.right,env);if(node.operator==='&&')return left&&expression(node.right,env);if(node.operator==='??')return left??expression(node.right,env);break}
   case 'ConditionalExpression':return expression(node.test,env)?expression(node.consequent,env):expression(node.alternate,env)
   case 'UnaryExpression':if(node.operator==='!')return !expression(node.argument,env);break
   case 'BinaryExpression':{const left=expression(node.left,env),right=expression(node.right,env);if(node.operator==='===')return left===right;if(node.operator==='+'){if(!['string','number'].includes(typeof left)||!['string','number'].includes(typeof right))throw Error('Invalid identity concatenation');const value=left+right;if(String(value).length>128*1024)throw Error('Identity text limit exceeded');return value}break}
   case 'AssignmentExpression':{if(node.operator!=='='||node.left.type!=='MemberExpression')throw Error('Unsupported identity assignment');const object=expression(node.left.object,env),key=safeKey(node.left.computed?expression(node.left.property,env):node.left.property.name);if(!plain(object))throw Error('Invalid identity assignment');return object[key]=expression(node.right,env)}
   case 'CallExpression':{
    const args=node.arguments.map(item=>expression(item,env))
    if(node.callee.type==='Identifier')return call(node.callee.name,args)
    if(path(node.callee)==='Object.entries'){if(!plain(args[0]))throw Error('Invalid identity entries');return Object.entries(args[0])}
    if(path(node.callee)==='Object.prototype.hasOwnProperty.call')return Object.hasOwn(args[0],safeKey(args[1]))
    if(node.callee.type==='MemberExpression'&&!node.callee.computed){const object=expression(node.callee.object,env),method=node.callee.property.name;if(method==='trim'&&typeof object==='string'&&!args.length)return object.trim();if(method==='join'&&Array.isArray(object)&&args.length===1&&typeof args[0]==='string')return object.join(args[0])}
    throw Error('Unsupported identity method')
   }
  }
  throw Error('Unsupported identity expression')
 }
 const statement=(node,env)=>{
  tick()
  switch(node.type){
   case 'BlockStatement':for(const item of node.body){const result=statement(item,env);if(result===continued||result&&Object.hasOwn(result,returned))return result}return
   case 'ReturnStatement':return {[returned]:node.argument?expression(node.argument,env):undefined}
   case 'ExpressionStatement':expression(node.expression,env);return
   case 'VariableDeclaration':if(node.kind!=='const')throw Error('Unsupported identity declaration');for(const item of node.declarations){if(item.id.type!=='Identifier')throw Error('Invalid identity declaration');env[item.id.name]=expression(item.init,env)}return
   case 'IfStatement':if(expression(node.test,env))return statement(node.consequent,env);if(node.alternate)return statement(node.alternate,env);return
   case 'ContinueStatement':return continued
   case 'ForOfStatement':{const list=expression(node.right,env);if(!Array.isArray(list)||list.length>32||node.left.type!=='VariableDeclaration'||node.left.kind!=='const'||node.left.declarations.length!==1)throw Error('Unsupported identity loop');const pattern=node.left.declarations[0].id;for(const value of list){const local=Object.assign(Object.create(null),env);if(pattern.type==='Identifier')local[pattern.name]=value;else if(pattern.type==='ArrayPattern'&&Array.isArray(value)&&pattern.elements.every(item=>item.type==='Identifier'))pattern.elements.forEach((item,index)=>{local[item.name]=value[index]});else throw Error('Unsupported identity loop binding');const result=statement(node.body,local);if(result&&result!==continued&&Object.hasOwn(result,returned))return result}return}
  }
  throw Error('Unsupported identity statement')
 }
 fuel=20000;values=Object.create(null);for(const [key,node]of Object.entries(constants))values[key]=expression(node,values)
 const run=(name,args)=>{fuel=20000;depth=0;return call(name,args)}
 if(values.OPENING_CHOICES.map(item=>item.id).join(',')!=='default,police_done,hospital_done,alisa_party,pool'||values.OPENING_PERKS.map(item=>item.id).join(',')!=='scholarship,lucky-user,yamane-huge')throw Error('Identity choices changed')
 return Object.freeze({choices:json(values.OPENING_CHOICES),perks:json(values.OPENING_PERKS),initialRoles:json(values.INITIAL_ROLE_NAMES),apply(root,identity){const copy=json(root);run('applyOpeningStateToRoot',[copy,json(identity)]);return json(copy)},message(identity){const result=run('buildOpeningPrompt',[json(identity)]);if(typeof result!=='string'||result.length>4000)throw Error('Identity message exceeds limit');return result}})
}
