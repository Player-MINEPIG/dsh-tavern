// Diagnostic builds only. This receiver observes trusted, owned DOM objects;
// it never reads file contents/metadata or forwards anything to the guest VM.
// Snapshot summaries contain lengths and equality facts, never guest strings.
const EVENT_LIMIT=64,INPUT_LIMIT=16,COUNTER_LIMIT=65535
export function createPhotoPickerDiagnostic(doc,container) {
 const instance=crypto.randomUUID()
 const output=container.ownerDocument.createElement('pre')
 output.hidden=true;output.setAttribute('data-dtv-photo-diagnostic','')
 const tokens=new WeakMap(),events=[],stats={views:0,replacements:0,trustedChanges:0,syntheticChanges:0,cancels:0}
 let nextToken=0,sequence=0,dropped=0,disposed=false,picked=null,lastToken=null,lastConnected=null,removePicked=()=>{}
 const started=performance.now(),increment=value=>Math.min(COUNTER_LIMIT,value+1)
 const token=node=>{if(!tokens.has(node)){if(nextToken>=COUNTER_LIMIT)return null;tokens.set(node,++nextToken)}return tokens.get(node)}
 const owned=node=>node?.ownerDocument===doc&&node.localName==='input'&&node.type==='file'
 const connected=node=>node.isConnected===true&&doc.body.contains(node)
 const inputs=()=>[...doc.body.querySelectorAll('input[type="file"]')].slice(0,INPUT_LIMIT).filter(owned).map(node=>({token:token(node),connected:connected(node)}))
 const record=(kind,summary)=>{
  if(disposed)return
  const event={sequence:sequence=increment(sequence),atMs:Math.min(86400000,Math.max(0,Math.round(performance.now()-started))),kind,
   picked:picked?{token:token(picked),connected:connected(picked),pending:true}:{token:lastToken,connected:null,pending:false},inputs:inputs()}
  if(summary)event.view=summary
  events.push(event);if(events.length>EVENT_LIMIT){events.shift();dropped=increment(dropped)}
  output.textContent=JSON.stringify({code:'TAVERN_PHOTO_PICKER_DIAGNOSTIC_V1',instance,limits:{events:EVENT_LIMIT,inputs:INPUT_LIMIT},saturated:sequence===COUNTER_LIMIT||nextToken===COUNTER_LIMIT,dropped,stats,events})
 }
 // Diagnostic failures must never change picker, view, event or cleanup flow.
 const safely=callback=>(...args)=>{if(!disposed)try{callback(...args)}catch{}}
 const release=()=>{removePicked();removePicked=()=>{};picked=null;lastConnected=null}
 const summary=value=>({reused:value.reused===true,htmlChars:Math.min(1048576,Math.max(0,value.htmlChars|0)),styleChars:Math.min(1048576,Math.max(0,value.styleChars|0)),htmlChanged:value.htmlChanged===true,stylesChanged:value.stylesChanged===true,rootChanged:value.rootChanged===true,bodyChanged:value.bodyChanged===true})
 const observer=new doc.defaultView.MutationObserver(safely(()=>{
  if(!picked)return
  const now=connected(picked);if(now!==lastConnected){lastConnected=now;record('picked-connectivity')}
 }))
 try{observer.observe(doc.body,{childList:true,subtree:true});record('created');container.append(output)}catch(error){observer.disconnect();output.remove();throw error}
 return {
  beforeReplace:safely(value=>record('before-view-replace',summary(value))),
  view:safely(value=>{stats.views=increment(stats.views);if(!value.reused)stats.replacements=increment(stats.replacements);record(value.reused?'view-reuse':'view-replace',summary(value))}),
  pick:safely(node=>{
   if(!owned(node)||!connected(node))return
   release();picked=node;lastToken=token(node);lastConnected=connected(node)
   const change=safely(event=>{if(event.isTrusted===true)stats.trustedChanges=increment(stats.trustedChanges);else stats.syntheticChanges=increment(stats.syntheticChanges);record(event.isTrusted===true?'trusted-change':'synthetic-change');if(event.isTrusted===true)release()})
   const cancel=safely(event=>{if(event.isTrusted!==true)return;stats.cancels=increment(stats.cancels);record('trusted-cancel');release()})
   node.addEventListener('change',change,true);node.addEventListener('cancel',cancel,true)
   removePicked=()=>{node.removeEventListener('change',change,true);node.removeEventListener('cancel',cancel,true)}
   record('pick-click-start')
  }),
  clickReturned:safely(()=>record('pick-click-return')),
  rejected:safely(()=>{record('pick-rejected');release()}),
  dispose(){if(disposed)return;disposed=true;for(const cleanup of [()=>observer.disconnect(),release,()=>{events.length=0},()=>output.remove()])try{cleanup()}catch{}},
 }
}
