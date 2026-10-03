import {build} from 'esbuild'
import {cardWorkerDefines} from './build-card-worker.mjs'
import {createRequire} from 'node:module'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createServer} from 'node:http'

const browserTools=createRequire(join(resolve(process.env.TAVERN_BROWSER_TOOLS_ROOT??'.'),'package.json'))
const {chromium}=browserTools('playwright')
const output=resolve(process.env.TAVERN_MEDIA_EVIDENCE??'.local/card-images-browser');mkdirSync(output,{recursive:true})
const directory=mkdtempSync(join(tmpdir(),'tavern-images-browser-'))
await build({define:await cardWorkerDefines(),entryPoints:['scripts/fixtures/card-images-browser.js'],bundle:true,format:'iife',platform:'browser',outfile:join(directory,'fixture.js')})
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?readFileSync(join(directory,'fixture.js')):'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script src="fixture.js"></script>')})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin=`http://127.0.0.1:${server.address().port}`
let browser
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-background-networking']})
 for(const width of [1440,480]){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'en-US'})
  const page=await context.newPage(),errors=[],outside=[]
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')console.error(message.text())})
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){outside.push(route.request().url());return route.abort()}return route.continue()})
  await page.addInitScript(()=>{window.__holdMediaFixture=()=>new Promise(resolve=>window.__releaseMediaFixture=resolve);window.__holdLargeMediaFixture=()=>new Promise(resolve=>window.__releaseLargeMediaFixture=resolve)})
  await page.goto(origin)
  await page.waitForFunction(()=>window.__largeMediaReady||window.__mediaResults,{timeout:30000})
  if(await page.evaluate(()=>!!window.__largeMediaReady)){
   const pixels=await page.screenshot({path:join(output,`large-covers-${width}.png`)})
   await page.evaluate(async data=>{
    const image=new Image();image.src=data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0)
    const painted=[...document.querySelectorAll('.large-cover')].every(el=>{const rect=el.getBoundingClientRect();let total=0;for(let y=1;y<5;y++)for(let x=1;x<5;x++){const pixel=ctx.getImageData(Math.floor(rect.left+rect.width*x/5),Math.floor(rect.top+rect.height*y/5),1,1).data;total+=(pixel[0]+pixel[1]+pixel[2])/3}return total/16<210})
    window.__checkMediaPixels('all six large cover boxes paint raster pixels instead of white placeholders',painted)
   },'data:image/png;base64,'+pixels.toString('base64'))
   await page.evaluate(()=>window.__releaseLargeMediaFixture())
  }
  await page.waitForFunction(()=>window.__mediaReady||window.__mediaResults,{timeout:30000})
  if(await page.evaluate(()=>!!window.__mediaReady)){await page.screenshot({path:join(output,`covers-${width}.png`)});await page.evaluate(()=>window.__releaseMediaFixture())}
  await page.waitForFunction(()=>window.__mediaResults,{timeout:30000})
  const report={width,results:await page.evaluate(()=>window.__mediaResults),errors,outside,debug:await page.evaluate(()=>window.__mediaDebug)}
  writeFileSync(join(output,`report-${width}.json`),JSON.stringify(report,null,2))
  for(const result of report.results)console.log(`${result.pass?'PASS':'FAIL'} ${width} ${result.name}`)
  if(report.errors.length||report.results.some(result=>!result.pass)||outside.length)process.exitCode=1
  await context.close()
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true})}
