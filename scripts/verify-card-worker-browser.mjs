// Uses a fresh browser profile and locally supplied fixed official-library fixtures.
// No test downloads dependencies or executes imported user card code.
import {build} from 'esbuild'
import {cardWorkerDefines} from './build-card-worker.mjs'
import {spawn} from 'node:child_process'
import {readFileSync,writeFileSync,mkdtempSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
const dir=mkdtempSync(join(tmpdir(),'tavern-worker-')),pause=ms=>new Promise(r=>setTimeout(r,ms))
const vendor=resolve(process.env.TAVERN_FRAMEWORK_VENDOR_DIR??'.local/rendering-acceptance/vendor')
const hashes={'jquery-3.6.0.js':'ff1523fb7389539c84c65aba19260648793bb4f5e29329d2ee8804bc37a3fe6e','react-18.3.1.js':'d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd','react-dom-18.3.1.js':'35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d','vue-3.5.13.js':'c459ba7cc8db65c982589fa5d64c7ff478877e8e5b0fd75683207cec6a4e89e8'}
const sources={};for(const [file,hash]of Object.entries(hashes)){const source=readFileSync(join(vendor,file),'utf8');if(createHash('sha256').update(source).digest('hex')!==hash)throw Error('Fixture digest mismatch: '+file);sources[file]=source}
let browser,ws
try{
 await build({define:await cardWorkerDefines(),entryPoints:[process.env.TAVERN_WORKER_FIXTURE??'scripts/fixtures/card-worker-browser.js'],bundle:true,platform:'browser',format:'iife',outfile:join(dir,'fixture.js'),banner:{js:'globalThis.__frameworkSources='+JSON.stringify(sources)+';'}})
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
 const clicked=new Set(),resized=new Set()
 for(let i=0;i<600;i++){
  const response=await send('Runtime.evaluate',{expression:'({report:document.querySelector("#results")?.textContent,click:globalThis.__trustedClick,viewport:globalThis.__browserViewport})',returnByValue:true})
  const state=response.result?.value
  if(state?.report){results=JSON.parse(state.report);break}
  if(state?.viewport&&!resized.has(state.viewport.id)){resized.add(state.viewport.id);await send('Emulation.setDeviceMetricsOverride',{width:state.viewport.width,height:state.viewport.height,deviceScaleFactor:1,mobile:false})}
  if(state?.click&&!clicked.has(state.click.id)){clicked.add(state.click.id);const {x,y}=state.click;await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1})}
  await pause(100)
 }
 if(!results)throw Error('Browser fixture timed out')
 for(const result of results)console.log(`${result.pass?'PASS':'FAIL'} ${result.name}${result.detail?' '+JSON.stringify(result.detail):''}`)
 if(results.some(result=>!result.pass))process.exitCode=1
}finally{ws?.close();browser?.kill('SIGTERM');await pause(200);rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
