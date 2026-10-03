import {build} from 'esbuild'
import {cardWorkerDefines} from './build-card-worker.mjs'
import {createRequire} from 'node:module'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createServer} from 'node:http'
const {chromium}=createRequire(join(resolve(process.env.TAVERN_BROWSER_TOOLS_ROOT??'.'),'package.json'))('playwright')
const output=resolve('.local/card-photo-browser');mkdirSync(output,{recursive:true})
const dir=mkdtempSync(join(tmpdir(),'tavern-photo-browser-'))
await build({define:await cardWorkerDefines(),entryPoints:['scripts/fixtures/card-photo-browser.js'],bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')})
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?readFileSync(join(dir,'fixture.js')):'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script src="fixture.js"></script>')})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`
let browser
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-background-networking']})
 for(const width of [1440,480]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],outside=[]
  page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){outside.push(route.request().url());return route.abort()}return route.continue()})
  try{
   await page.goto(origin);await page.waitForFunction(()=>window.__photoReady)
   const photo=await page.evaluate(()=>window.__testPhotoTransform()),frame=page.frameLocator('iframe')
   await frame.locator('#upload').waitFor();await page.waitForTimeout(300)
   // Programmatic clicks have no trusted token; they cannot open a dialog.
   let dialogs=0;page.on('filechooser',()=>dialogs++)
   await frame.locator('#upload').evaluate(el=>el.click());await page.waitForTimeout(300)
   await page.evaluate(value=>window.__photoCheck('synthetic card clicks cannot open file selection',value),dialogs===0)
   writeFileSync(join(dir,'private-original-name.png'),Buffer.from(photo.bytes))
   const chooser=page.waitForEvent('filechooser',{timeout:5000});await frame.locator('#upload').click();await(await chooser).setFiles(join(dir,'private-original-name.png'))
   await frame.locator('#status').filter({hasText:'Selected selected-photo.jpg'}).waitFor({timeout:10000})
   await frame.locator('#preview[data-dtv-image-state=loaded]').waitFor()
   const details=await frame.locator('#preview').evaluate(el=>({width:el.naturalWidth,height:el.naturalHeight,source:el.getAttribute('data-dtv-image-source'),filename:el.ownerDocument.getElementById('photo').value}))
   await page.evaluate(value=>window.__photoCheck('trusted picker delivers bounded pixels through FileReader/Image/canvas facade without original name/path',value),details.width===640&&details.height===512&&details.source.length<=65536&&details.filename===''&&!(await frame.locator('#status').innerText()).includes(photo.name))
   await page.screenshot({path:join(output,`photo-${width}.png`)})
   const before=await frame.locator('#status').innerText()
   await frame.locator('#photo').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(photo.bytes)})
   await page.waitForTimeout(100)
   await page.evaluate(value=>window.__photoCheck('synthetic file-change payload cannot transfer photo bytes',value),(await frame.locator('#status').innerText())===before)
   const errorChooser=page.waitForEvent('filechooser',{timeout:5000});await frame.locator('#upload').click();writeFileSync(join(dir,'bad.svg'),'<svg/>');await(await errorChooser).setFiles(join(dir,'bad.svg'))
   await page.locator('.dtv-card-photo-error').waitFor();await page.evaluate(()=>window.__photoCheck('unsupported selection reports a visible media error without stopping the VM',document.querySelector('.dtv-card-photo-error')&&!document.querySelector('.dtv-interactive-card>[role=alert]:not(.dtv-card-photo-error)')))
   await page.evaluate(()=>{const original=window.createImageBitmap;window.createImageBitmap=async(...args)=>{window.__photoDecodingStarted=true;await new Promise(resolve=>window.__releasePhotoDecode=resolve);return original(...args)}})
   const staleChooser=page.waitForEvent('filechooser',{timeout:5000});await frame.locator('#upload').click();await(await staleChooser).setFiles(join(dir,'private-original-name.png'))
   await page.waitForFunction(()=>window.__photoDecodingStarted)
   await page.evaluate(()=>{window.__renderPhoto('Next variant');window.__releasePhotoDecode()});await page.waitForTimeout(150)
   await page.evaluate(()=>window.__photoCheck('variant switching cancels selected-photo decoding and rejects late pixels',document.querySelector('main').textContent.trim()==='Next variant'&&!document.querySelector('iframe,.dtv-card-photo-error')))
   await page.evaluate(()=>window.__photoUnmount());await page.waitForTimeout(50)
   await page.evaluate(()=>window.__photoCheck('unmount removes picker target and displayed photo',!document.querySelector('iframe')))
  }catch(error){errors.push(error.stack);await page.screenshot({path:join(output,`failure-${width}.png`)})}
  const report={width,results:await page.evaluate(()=>window.__photoResults),errors,outside}
  writeFileSync(join(output,`report-${width}.json`),JSON.stringify(report,null,2));for(const result of report.results)console.log(`${result.pass?'PASS':'FAIL'} ${width} ${result.name}`)
  if(errors.length||outside.length||report.results.some(r=>!r.pass)){console.error(errors);process.exitCode=1}
  await context.close()
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true})}
