import {build} from 'esbuild'
import {cardWorkerDefines} from './build-card-worker.mjs'
import {createRequire} from 'node:module'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createServer} from 'node:http'
import assert from 'node:assert/strict'
const {chromium}=createRequire(join(resolve(process.env.TAVERN_BROWSER_TOOLS_ROOT??'.'),'package.json'))('playwright')
const output=resolve('.local/card-photo-diagnostic-browser');mkdirSync(output,{recursive:true})
const dir=mkdtempSync(join(tmpdir(),'tavern-photo-diagnostic-'))
for(const enabled of [false,true])await build({define:{...await cardWorkerDefines(),TAVERN_PHOTO_DIAGNOSTIC:JSON.stringify(enabled)},entryPoints:['scripts/fixtures/card-photo-diagnostic-browser.js'],bundle:true,format:'iife',platform:'browser',outfile:join(dir,`fixture-${enabled}.js`)})
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/html');res.end(req.url.endsWith('.js')?readFileSync(join(dir,req.url.slice(1))):`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script src="fixture-${req.url.includes('off')?'false':'true'}.js"></script>`)})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`
let browser
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-background-networking']})
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],outside=[],results=[]
  let failureState
  page.on('pageerror',error=>errors.push(error.message));await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){outside.push(route.request().url());return route.abort()}return route.continue()})
  const check=(name,pass)=>{results.push({name,pass});assert.ok(pass,name)}
  const read=()=>page.locator('[data-dtv-photo-diagnostic]').evaluate(node=>JSON.parse(node.textContent))
  try{
   await page.goto(`${origin}/off`);await page.waitForFunction(()=>window.__photoReady);await page.frameLocator('iframe').locator('#upload').waitFor();await page.waitForTimeout(300)
   check('normal build has no diagnostic DOM or observer output',await page.locator('[data-dtv-photo-diagnostic]').count()===0)
   await page.goto(origin);await page.waitForFunction(()=>window.__photoReady);await page.evaluate(()=>window.__showPhotoDiagnosticCard(false))
   const frame=page.frameLocator('iframe');await frame.locator('#upload').waitFor();await page.waitForTimeout(400)
   const hidden=await page.locator('[data-dtv-photo-diagnostic]').evaluate(node=>({hidden:node.hidden,rects:node.getClientRects().length,inside:!!node.closest('iframe')}))
   check('trusted diagnostic output is hidden outside the card with no layout box',hidden.hidden&&hidden.rects===0&&!hidden.inside)
   // File chooser interception observes the actual host hooks. It does not
   // exercise the macOS Open panel or establish acceptance of its Open button.
   let chooserEvent=page.waitForEvent('filechooser',{timeout:5000});await frame.locator('#upload').click();let chooser=await chooserEvent
   await page.waitForTimeout(700);let report=await read(),pick=report.events.find(event=>event.kind==='pick-click-start')
   check('unchanged trailing snapshots retain the picked object',!!pick&&report.events.at(-1).picked.token===pick.picked.token&&report.events.at(-1).picked.connected===true&&report.stats.trustedChanges===0)
   const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=16;c.getContext('2d').fillRect(0,0,20,16);return [...Uint8Array.from(atob(c.toDataURL('image/png').split(',')[1]),x=>x.charCodeAt(0))]})
   const path=join(dir,'own-photo.png');writeFileSync(path,Buffer.from(png));await chooser.setFiles(path)
   await frame.locator('#status').filter({hasText:'Selected'}).waitFor();report=await read()
   check('CDP fixture native change is counted without file bytes/name/path',report.stats.trustedChanges===1&&!JSON.stringify(report).includes('own-photo')&&!JSON.stringify(report).includes(path))
   await page.evaluate(()=>window.__showPhotoDiagnosticCard(true));await frame.locator('#upload').waitFor();await page.waitForTimeout(400)
   chooserEvent=page.waitForEvent('filechooser',{timeout:5000});await frame.locator('#upload').click();chooser=await chooserEvent
   await frame.locator('#status').filter({hasText:'OWN_PRIVATE_FIXTURE_TEXT'}).waitFor();report=await read();pick=report.events.find(event=>event.kind==='pick-click-start')
   const replaced=report.events.find(event=>event.kind==='view-replace'&&event.picked.token===pick.picked.token&&event.picked.connected===false)
   check('a deliberately changed snapshot reports the detached picked object and new input token',!!replaced&&replaced.inputs[0].token!==pick.picked.token&&replaced.view.htmlChanged)
   check('snapshot summaries never include authored guest text, attributes or file metadata',!JSON.stringify(report).includes('OWN_PRIVATE_FIXTURE_TEXT')&&report.events.every(event=>event.inputs.every(input=>Object.keys(input).sort().join(',')==='connected,token')))
   await frame.locator('#photo').evaluate(node=>node.dispatchEvent(new Event('change',{bubbles:true})));report=await read()
   check('a synthetic change cannot increment trusted change count',report.stats.trustedChanges===0)
   await page.evaluate(()=>window.__renderPhoto('Next authored variant'));await page.waitForTimeout(100)
   check('variant cleanup removes diagnostic output and picker target',await page.locator('[data-dtv-photo-diagnostic],iframe').count()===0)
   await page.evaluate(()=>window.__photoUnmount());check('unmount leaves no diagnostic output',await page.locator('[data-dtv-photo-diagnostic]').count()===0)
  }catch(error){errors.push(error.stack);failureState=await page.evaluate(()=>({diagnostic:document.querySelector('[data-dtv-photo-diagnostic]')?.textContent,alerts:[...document.querySelectorAll('[role="alert"]')].map(node=>node.textContent),status:document.querySelector('iframe')?.contentDocument?.getElementById('status')?.textContent}));console.error(failureState)}
  writeFileSync(join(output,`report-${width}.json`),JSON.stringify({width,coverage:'authored fixture / CDP chooser interception; not macOS Open panel acceptance',results,errors,outside,failureState},null,2))
  for(const result of results)console.log(`${result.pass?'PASS':'FAIL'} ${width} ${result.name}`)
  if(errors.length||outside.length){console.error(errors);process.exitCode=1}await context.close()
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true})}
