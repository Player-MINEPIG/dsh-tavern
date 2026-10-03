import {build} from 'esbuild'
import {cardWorkerDefines} from './build-card-worker.mjs'
import {createRequire} from 'node:module'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createServer} from 'node:http'
import assert from 'node:assert/strict'
const {chromium}=createRequire(join(resolve(process.env.TAVERN_BROWSER_TOOLS_ROOT??'.'),'package.json'))('playwright')
const before=process.env.TAVERN_EXPECT_SOURCE_STALE==='1',output=resolve(`.local/card-source-${before?'before':'after'}`);mkdirSync(output,{recursive:true})
const dir=mkdtempSync(join(tmpdir(),'tavern-source-recreate-'))
await build({define:await cardWorkerDefines(),entryPoints:['scripts/fixtures/card-source-recreate-browser.js'],bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')})
let pageRequests=0
const server=createServer((req,res)=>{if(req.url==='/'||req.url==='/direct')pageRequests++;res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?readFileSync(join(dir,'fixture.js')):'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script src="/fixture.js"></script>')})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`
let browser
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-background-networking']})
 for(const width of [1440,390])for(const virtual of [true,false]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),results=[],errors=[],outside=[],states={}
  page.on('pageerror',error=>errors.push(error.message));await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){outside.push(route.request().url());return route.abort()}return route.continue()})
  const check=(name,pass)=>{results.push({name,pass});assert.ok(pass,name)}
  const state=()=>page.evaluate(()=>window.__sourceState())
  try{
   const url=virtual?`${origin}/`:`${origin}/direct`;await page.goto(url);await page.waitForFunction(()=>window.__sourceReady);let frame=page.frameLocator('iframe')
   await frame.locator('#run').waitFor();await page.waitForTimeout(500);check('fixture variants have identical sanitized static HTML',await page.evaluate(()=>window.__staticSourceEqual))
   await frame.locator('#run').click();await frame.locator('#status').filter({hasText:'A-1'}).waitFor();await frame.locator('#field').fill('authored value');await page.waitForTimeout(250)
   states.initial=await state();const requests=pageRequests
   await page.evaluate(()=>window.__sameSourceRender());await page.waitForTimeout(250);states.same=await state()
   check('unrelated render with the same source retains document, input value and runtime',states.same.document===states.initial.document&&states.same.input===states.initial.input&&states.same.inputValue==='authored value'&&states.same.workers.active===(virtual?1:0)&&states.same.workers.created===states.initial.workers.created)
   await page.evaluate(()=>window.__sourceVariant('B'));await page.waitForTimeout(600);states.switched=await state();frame=page.frameLocator('iframe')
   await frame.locator('#run').click();await page.waitForTimeout(300);states.clicked=await state()
   if(before){
    check('pre-fix counterexample: source-only change disposes Worker without recreating iframe',states.switched.document===states.initial.document&&states.switched.workers.active===0&&states.switched.workers.created===states.initial.workers.created)
    check('pre-fix counterexample: new script does not run and stale output remains',states.clicked.status==='A-1')
   }else{
    check('source-only change recreates only the owned iframe/runtime and releases its old Worker',states.switched.document!==states.initial.document&&states.switched.frame!==states.initial.frame&&states.switched.workers.active===(virtual?1:0)&&states.switched.workers.created===states.initial.workers.created+(virtual?1:0)&&states.switched.workers.terminated===states.initial.workers.terminated+(virtual?1:0))
    check('the new source script runs from its own fresh state',states.clicked.status==='B-1')
    await page.evaluate(()=>window.__sourceVariant('A'));await page.waitForTimeout(600);await frame.locator('#run').click();await frame.locator('#status').filter({hasText:'A-1'}).waitFor();states.returned=await state()
    check('returning to an earlier source creates a fresh runtime rather than reviving old state',states.returned.document!==states.initial.document&&states.returned.document!==states.switched.document&&states.returned.workers.active===(virtual?1:0))
   }
   check('only the owned card is recreated; top-level page is never reloaded',pageRequests===requests&&page.url()===url)
   const current=await state();check('sandbox/CSP and default diagnostic-off boundary remain unchanged',current.sandbox==='allow-same-origin'&&current.srcdoc.includes("connect-src 'none'")&&current.srcdoc.includes("script-src 'none'")&&await page.locator('[data-dtv-photo-diagnostic]').count()===0)
   await page.evaluate(()=>window.__sourceUnmount());states.unmounted=await state();check('unmount terminates all owned Workers and removes the iframe',states.unmounted.workers.active===0&&states.unmounted.workers.created===states.unmounted.workers.terminated&&states.unmounted.frame===null)
  }catch(error){errors.push(error.stack)}
  // These are self-authored fixture sources only, never private card text.
  for(const value of Object.values(states))delete value.srcdoc
  writeFileSync(join(output,`report-${width}-${virtual?'virtual':'direct'}.json`),JSON.stringify({width,runtime:virtual?'virtual Worker':'direct VM bridge',mode:before?'expected pre-fix counterexample':'fixed lifecycle regression',results,states,errors,outside},null,2))
  for(const result of results)console.log(`${result.pass?'PASS':'FAIL'} ${width} ${virtual?'virtual':'direct'} ${result.name}`)
  if(errors.length||outside.length){console.error(errors);process.exitCode=1}await context.close()
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true})}
