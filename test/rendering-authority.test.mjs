import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createRenderingAuthority} from '../packages/rendering-authority/index.js'
import {createRenderingWriteRequests} from '../packages/client/src/play/rendering-write-requests.js'
const scope={sessionId:'session',nodeId:'node',variantId:'variant',endEventId:3}
const bundle={version:1,scope,owners:['character:fixture'],runs:[{code:'Mvu.getMvuData()',name:'fixture.js'}],modules:{},html:'<p>fixture</p>'}
const source=JSON.stringify(bundle),sourceIdentity={version:1,sha256:createHash('sha256').update(source).digest('hex'),scope}

test('downloaded and enabled execution binds exact source/scope without review or expiry',async()=>{
 const authority=createRenderingAuthority()
 for(const flags of [{},{downloaded:true},{enabled:true},{downloaded:true,enabled:false}])assert.throws(()=>authority.grant({source,sourceIdentity,...flags}),/downloaded/)
 assert.throws(()=>authority.grant({source:source+' ',sourceIdentity,downloaded:true,enabled:true}),/identity/)
 const grant=authority.grant({source,sourceIdentity,downloaded:true,enabled:true})
 assert.equal('expiresAt' in grant,false)
 assert.equal(authority.isCurrent(grant),true);assert.deepEqual(await authority.resolve(grant),{valid:true,write:true,scope})
 assert.equal(await authority.resolve({...grant,sourceIdentity:{...sourceIdentity,scope:{...scope,sessionId:'other'}}}),null)
 authority.revoke(grant.grantId);assert.equal(authority.isCurrent(grant),false)
 const second=authority.grant({source,sourceIdentity,downloaded:true,enabled:true});assert.notEqual(second.grantId,grant.grantId)
 authority.dispose();assert.equal(authority.isCurrent(second),false)
})

test('enabled downloaded UI execution acquires automatically and disposes late responses',async()=>{
 const authority=createRenderingAuthority(),deletes=[];let finish,hold=false,posts=0
 const registry=createRenderingWriteRequests({request:async(url,options)=>{
  if(options.method==='DELETE'){const id=url.split('/').at(-1);deletes.push(id);authority.revoke(id);return Response.json({ok:true})}
  posts++;const body=JSON.parse(options.body);assert.equal(body.downloaded,true);assert.equal(body.enabled,true);assert.equal('reviewed' in body,false)
  const grant=authority.grant(body);if(hold)await new Promise(resolve=>{finish=resolve});return Response.json({ok:true,...grant})
 }})
 assert.throws(()=>registry.register(bundle),/available sources/)
 const item=registry.register({...bundle,downloaded:true,enabled:true})
 const [grant,same]=await Promise.all([item.getGrant(),item.getGrant()]);assert.deepEqual(grant,same);assert.equal(posts,1)
 assert.equal(authority.isCurrent(grant),true)
 item.dispose();assert.equal(authority.isCurrent(grant),false);assert.equal(deletes.length,1)
 await assert.rejects(item.getGrant(),{name:'AbortError'})
 hold=true;const pending=registry.register({...bundle,downloaded:true,enabled:true}),request=pending.getGrant()
 const rejected=assert.rejects(request,{name:'AbortError'})
 while(!finish)await new Promise(r=>setTimeout(r,1))
 pending.dispose();finish();await rejected;assert.equal(new Set(deletes).size,2)
})

test('rebuilding and Host restart create fresh automatic bindings; scopes never migrate',async()=>{
 let authority=createRenderingAuthority()
 const registry=createRenderingWriteRequests({request:async(url,options)=>{
  if(options.method==='DELETE'){authority.revoke(url.split('/').at(-1));return Response.json({ok:true})}
  return Response.json(authority.grant(JSON.parse(options.body)))
 }})
 const item=registry.register({...bundle,downloaded:true,enabled:true}),first=await item.getGrant()
 authority.dispose();authority=createRenderingAuthority()
 const second=await item.renew();assert.notEqual(first.grantId,second.grantId);assert.equal(authority.isCurrent(second),true)
 item.dispose()
 const rebuilt=registry.register({...bundle,downloaded:true,enabled:true}),third=await rebuilt.getGrant();assert.equal(authority.isCurrent(third),true)
 rebuilt.dispose()
 const next=registry.register({...bundle,scope:{...scope,sessionId:'next'},downloaded:true,enabled:true}),fourth=await next.getGrant()
 assert.notEqual(fourth.sourceIdentity.sha256,third.sourceIdentity.sha256);assert.equal(fourth.sourceIdentity.scope.sessionId,'next');assert.equal(authority.isCurrent(third),false)
 next.dispose();authority.dispose()
})

test('grant HTTP mutations retain the existing local Origin security boundary',async()=>{
 const {Readable}=await import('node:stream')
 const {secureTavernApi}=await import('../packages/tavern-loader/src/api-security.js')
 const {createRenderingAuthorityHandler}=await import('../packages/rendering-authority/index.js')
 const authority=createRenderingAuthority(),handler=secureTavernApi(createRenderingAuthorityHandler(authority,{getConnection:()=>({admit:()=>({peer:{}})})}))
 const invoke=(method,url,origin,body)=>new Promise((resolve,reject)=>{
  const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[])
  Object.assign(req,{method,url,headers:{host:'127.0.0.1:8080',origin,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}})
  const res={statusCode:200,setHeader(){},end(body){resolve({status:res.statusCode,body:JSON.parse(body)})}}
  Promise.resolve(handler(req,res)).catch(reject)
 })
 const url='/pmp-dsh-tavern/api/v1/rendering-write-grants',origin='http://127.0.0.1:8080',body={source,sourceIdentity,downloaded:true,enabled:true}
 assert.equal((await invoke('POST',url,'https://untrusted.example',body)).status,403)
 const response=await invoke('POST',url,origin,body);assert.equal(response.status,200)
 const grant=response.body;assert.equal(authority.isCurrent(grant),true);assert.equal('source'in grant,false)
 const removed=await invoke('DELETE',url+'/'+grant.grantId,origin);assert.equal(removed.status,200);assert.equal(authority.isCurrent(grant),false)
 authority.dispose()
})

test('grant admission fails closed before consuming a request body or mutating grants',async()=>{
 const {createRenderingAuthorityHandler}=await import('../packages/rendering-authority/index.js')
 for(const [connection,status] of [[null,503],[{admit:()=>({rejection:401})},401],[{admit:()=>({rejection:403})},403]]){
  const authority=createRenderingAuthority();let read=false,mutated=false
  const handler=createRenderingAuthorityHandler({grant(){mutated=true},revoke(){mutated=true}},{getConnection:()=>connection})
  for(const method of ['POST','DELETE']){
   const req={method,url:'/pmp-dsh-tavern/api/v1/rendering-write-grants/x',async *[Symbol.asyncIterator](){read=true;yield Buffer.from('{}')}}
   const res={setHeader(){},end(){}};await handler(req,res);assert.equal(res.statusCode,status)
  }
  assert.equal(read,false);assert.equal(mutated,false);authority.dispose()
 }
})

test('failed server revocation remains visible after card disposal and retries the same grant',async()=>{
 let fail=true;const deletes=[]
 const authority=createRenderingAuthority(),registry=createRenderingWriteRequests({request:async(url,options)=>{
  if(options.method==='DELETE'){deletes.push(url);if(fail)return new Response('{}',{status:503});authority.revoke(url.split('/').at(-1));return Response.json({ok:true})}
  return Response.json(authority.grant(JSON.parse(options.body)))
 }})
 const item=registry.register({...bundle,downloaded:true,enabled:true}),grant=await item.getGrant();item.dispose()
 await new Promise(r=>setTimeout(r,0));assert.equal(item.peekGrant(),null);assert.equal(authority.isCurrent(grant),true)
 const pending=registry.listRevocations();assert.equal(pending.length,1);assert.match(pending[0].error,/503/);assert.equal('grant' in pending[0],false)
 fail=false;await registry.retryRevocation(pending[0].id);assert.equal(authority.isCurrent(grant),false);assert.equal(registry.listRevocations().length,0);assert.equal(deletes[0],deletes[1]);authority.dispose()
})

test('lost create responses replay one execution and remain cleanable before an ID is returned',async()=>{
 const authority=createRenderingAuthority();let lost=true,firstId,posts=0
 const registry=createRenderingWriteRequests({request:async(url,options)=>{
  if(options.method==='DELETE'){authority.revoke(url.split('/').at(-1));return Response.json({ok:true})}
  const body=JSON.parse(options.body);posts++;firstId??=body.executionId;assert.equal(body.executionId,firstId)
  const grant=authority.grant(body);if(lost)throw Error('Response lost after allocation');return Response.json(grant)
 }})
 const item=registry.register({...bundle,downloaded:true,enabled:true})
 for(let i=0;i<80;i++)await assert.rejects(item.getGrant(),/Response lost/)
 lost=false;const grant=await item.getGrant();assert.equal(posts,81);assert.equal(grant.grantId,firstId)
 const other=[];for(let i=0;i<63;i++)other.push(authority.grant({source,sourceIdentity,downloaded:true,enabled:true}))
 assert.throws(()=>authority.grant({source,sourceIdentity,downloaded:true,enabled:true}),/limit/)
 item.dispose();await new Promise(r=>setTimeout(r,0));assert.equal(authority.isCurrent(grant),false)
 assert.ok(authority.grant({source,sourceIdentity,downloaded:true,enabled:true}))
 for(const g of other)authority.revoke(g.grantId)
 authority.dispose()
})
test('a lost-response execution is disposed by its known identity; cleanup failures remain retryable',async()=>{
 const authority=createRenderingAuthority();let id,identity,failed=true
 const registry=createRenderingWriteRequests({request:async(url,options)=>{
  if(options.method==='DELETE'){if(failed)return new Response('{}',{status:503});authority.revoke(url.split('/').at(-1));return Response.json({ok:true})}
  const body=JSON.parse(options.body);id=body.executionId;identity=body.sourceIdentity;authority.grant(body);throw Error('Response lost')
 }})
 const item=registry.register({...bundle,downloaded:true,enabled:true});await assert.rejects(item.getGrant(),/Response lost/);item.dispose()
 await new Promise(r=>setTimeout(r,0));assert.equal(authority.isCurrent({grantId:id,sourceIdentity:identity}),true)
 const [pending]=registry.listRevocations();assert.ok(pending);failed=false;await registry.retryRevocation(pending.id)
 assert.equal(authority.isCurrent({grantId:id,sourceIdentity:identity}),false);assert.equal(registry.listRevocations().length,0)
 authority.dispose()
})
test('execution identity conflicts never replace the original source binding',()=>{
 const authority=createRenderingAuthority(),executionId=crypto.randomUUID(),grant=authority.grant({source,sourceIdentity,executionId,downloaded:true,enabled:true})
 assert.deepEqual(authority.grant({source,sourceIdentity,executionId,downloaded:true,enabled:true}),grant)
 const changed=source+' ',identity={...sourceIdentity,sha256:createHash('sha256').update(changed).digest('hex')}
 assert.throws(()=>authority.grant({source:changed,sourceIdentity:identity,executionId,downloaded:true,enabled:true}),/identity changed/)
 assert.equal(authority.isCurrent(grant),true);authority.dispose()
})
