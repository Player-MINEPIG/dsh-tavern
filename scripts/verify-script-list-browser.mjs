// Uses a fresh browser profile and only authored synthetic card code.
// No test downloads dependencies or executes imported user card code.
import {build} from 'esbuild'
import {cardWorkerDefines} from './build-card-worker.mjs'
import {spawn} from 'node:child_process'
import {readFileSync,writeFileSync,mkdtempSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const dir=mkdtempSync(join(tmpdir(),'tavern-worker-')),pause=ms=>new Promise(r=>setTimeout(r,ms))
let browser,ws
try{
 await build({define:await cardWorkerDefines(),entryPoints:['scripts/fixtures/script-list-browser.js'],bundle:true,platform:'browser',format:'iife',outfile:join(dir,'fixture.js')})
 writeFileSync(join(dir,'index.html'),'<!doctype html><meta charset="utf-8"><body><script src="fixture.js"></script></body>')
 browser=spawn(process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+join(dir,'profile'),'about:blank'],{stdio:'ignore'})
 for(let i=0;i<100&&!existsSync(join(dir,'profile/DevToolsActivePort'));i++)await pause(100)
 const port=readFileSync(join(dir,'profile/DevToolsActivePort'),'utf8').split('\n')[0]
 const tabs=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json())
 ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}))
 let id=0;const pending=new Map();ws.addEventListener('message',event=>{const value=JSON.parse(event.data);if(value.id){const item=pending.get(value.id);pending.delete(value.id);value.error?item.reject(Error(value.error.message)):item.resolve(value.result)}})
 const send=(method,params={})=>new Promise((resolve,reject)=>{setTimeout(()=>reject(Error('Browser protocol timeout')),15000).unref();pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
 await send('Page.navigate',{url:'file://'+join(dir,'index.html')})
 let results
 const clicked=new Set()
 for(let i=0;i<600;i++){
  const response=await send('Runtime.evaluate',{expression:'({report:document.querySelector("#results")?.textContent,click:globalThis.__trustedClick})',returnByValue:true})
  const state=response.result?.value
  if(state?.report){results=JSON.parse(state.report);break}
  if(state?.click&&!clicked.has(state.click.id)){clicked.add(state.click.id);const {x,y}=state.click;await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1})}
  await pause(100)
 }
 if(!results)throw Error('Browser fixture timed out')
 for(const result of results)console.log(`${result.pass?'PASS':'FAIL'} ${result.name}${result.detail?' '+JSON.stringify(result.detail):''}`)
 if(results.some(result=>!result.pass))process.exitCode=1
}finally{ws?.close();browser?.kill('SIGTERM');await pause(200);rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
