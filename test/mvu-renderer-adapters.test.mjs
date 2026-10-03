import test from 'node:test'
import assert from 'node:assert/strict'
import {MVU_BUILTINS,mvuBuiltin,confirmMvuSchemas} from '../packages/client/src/play/mvu-builtins.js'
import {isSideEffectModuleReference} from '../packages/client/src/play/rendering-sources.js'
import {initialCardScope,greetingCardScope} from '../packages/client/src/play/mvu-scope.js'
test('builtin replacements require exact bytes and side-effect imports, never URL suffixes or runtime exports',()=>{
 const entry=MVU_BUILTINS[0]
 assert.equal(mvuBuiltin(entry.url,entry.sha256),entry)
 assert.equal(mvuBuiltin(entry.url+'?version=2',entry.sha256),null)
 assert.equal(mvuBuiltin(entry.url,'different'),null)
 assert.equal(isSideEffectModuleReference(`import '${entry.url}';\nMvu.getMvuData()`,entry.url),true)
 for(const source of [`import {value} from '${entry.url}'`,`import('${entry.url}')`,`export * from '${entry.url}'`,`import '${entry.url}';import('${entry.url}')`])assert.equal(isSideEffectModuleReference(source,entry.url),false)
})
test('complete schema source confirmation requires backend authority and supported descriptor version',()=>{
 const declarations=[{source:'exact schema source',sha256:'fixture',owner:'fixture'}]
 const snapshot={status:'available',resourceId:'resource',revision:3,variables:{mvu_schema:{mvuSchema:1,interpreterVersion:1,source:declarations[0].source}}}
 assert.equal(confirmMvuSchemas(declarations,snapshot)[0].status,'source-registered')
 for(const replacement of [undefined,{...snapshot,status:'unavailable'},{...snapshot,variables:{}}, {...snapshot,variables:{mvu_schema:{...snapshot.variables.mvu_schema,source:'different'}}}, {...snapshot,variables:{mvu_schema:{...snapshot.variables.mvu_schema,interpreterVersion:2}}}])assert.throws(()=>confirmMvuSchemas(declarations,replacement),/exact complete schema/)
})
test('initial coordinates require the resolved root and selected character with empty timeline',()=>{
 const input={playthrough:{id:'p',ext:{pmpDshTavern:{rootSessionId:'s',characterId:'c'}}},sessionId:'s',characterId:'c',timeline:{nodes:[]},turns:[]}
 assert.deepEqual(initialCardScope(input),{mode:'initial',playthroughId:'p',sessionId:'s',characterId:'c'})
 for(const patch of [{sessionId:'other'},{characterId:'other'},{timeline:null},{timeline:{nodes:[{}]}},{turns:[{}]}])assert.equal(initialCardScope({...input,...patch}),null)
})

test('greeting current read scope survives turns without granting an initial write scope',()=>{
 const input={playthrough:{id:'p',ext:{pmpDshTavern:{rootSessionId:'s',characterId:'c'}}},sessionId:'s',characterId:'c',timeline:{nodes:[{}]},turns:[{}]}
 assert.deepEqual(greetingCardScope(input),{mode:'greeting',playthroughId:'p',sessionId:'s',characterId:'c'})
 assert.equal(initialCardScope(input),null)
 for(const patch of [{sessionId:'other'},{characterId:'other'},{playthrough:null}])assert.equal(greetingCardScope({...input,...patch}),null)
})
