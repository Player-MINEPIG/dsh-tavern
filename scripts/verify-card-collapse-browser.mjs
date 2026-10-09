import {build} from 'esbuild'
import {cardWorkerDefines} from './build-card-worker.mjs'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import assert from 'node:assert/strict'

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const dir=mkdtempSync(join(tmpdir(),'tavern-card-collapse-'))
const output=process.env.TAVERN_CARD_COLLAPSE_OUTPUT??'.local/card-collapse-browser'
const executable=process.env.TAVERN_CHROME_PATH??['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync)
assert.ok(executable,'Set TAVERN_CHROME_PATH to a Chromium executable')
mkdirSync(output,{recursive:true})
await build({define:await cardWorkerDefines(),entryPoints:['scripts/fixtures/card-collapse-browser.js'],bundle:true,platform:'browser',format:'iife',outfile:join(dir,'fixture.js')})
const server=createServer((req,res)=>{
  res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html')
  res.end(req.url==='/fixture.js'?readFileSync(join(dir,'fixture.js')):'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script src="/fixture.js"></script>')
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin='http://127.0.0.1:'+server.address().port
let chrome,socket,serial=0
const pending=new Map()
try {
  chrome=spawn(executable,['--headless','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+join(dir,'profile'),'about:blank'],{stdio:'ignore'})
  const path=join(dir,'profile','DevToolsActivePort')
  for(let i=0;i<200&&!existsSync(path);i++)await pause(50)
  assert.ok(existsSync(path),'Chromium remote debugging started')
  const port=Number(readFileSync(path,'utf8').split('\n')[0])
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),target=pages.find(page=>page.type==='page')
  socket=new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
  socket.addEventListener('message',event=>{const data=JSON.parse(event.data),ticket=pending.get(data.id);if(ticket){pending.delete(data.id);data.error?ticket.reject(Error(data.error.message)):ticket.resolve(data.result)}})
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value}
  await call('Runtime.enable');await call('Page.enable')
  for(const width of [1440,390]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:false})
    await call('Page.navigate',{url:origin})
    const clicks=new Set(),shots=new Set();let report
    for(let i=0;i<500;i++) {
      const state=await evaluate('({report:document.querySelector("#results")?.textContent,click:window.__trustedClick,shot:window.__screenshot})')
      if(state.report){report=JSON.parse(state.report);break}
      if(state.click&&!clicks.has(state.click.id)) {
        clicks.add(state.click.id);const {x,y}=state.click
        await call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y})
        await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x,y})
        await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x,y});await evaluate('globalThis.__clicked=[...(globalThis.__clicked??[]),'+JSON.stringify(state.click.id)+']')
      }
      if(state.shot&&!shots.has(state.shot)) {
        shots.add(state.shot)
        const capture=await call('Page.captureScreenshot',{format:'png'})
        writeFileSync(join(output,state.shot+'-'+width+'.png'),Buffer.from(capture.data,'base64'))
        await evaluate('globalThis.__screenshots=[...(globalThis.__screenshots??[]),'+JSON.stringify(state.shot)+']')
      }
      await pause(50)
    }
    assert.ok(report,'Fixture completed at '+width)
    writeFileSync(join(output,'report-'+width+'.json'),JSON.stringify(report,null,2))
    console.log(JSON.stringify({width,passed:report.filter(check=>check.pass).length,failed:report.filter(check=>!check.pass)}))
    assert.ok(report.every(check=>check.pass),'Collapse at '+width)
  }
} finally {
  socket?.close();chrome?.kill()
  await new Promise(resolve=>server.close(resolve));await pause(100)
  rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100})
}
