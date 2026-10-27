import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const browser = process.env.CHROME_PATH ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync)
assert.ok(browser, 'Set CHROME_PATH to a Chrome/Chromium executable')
const sources = ['packages/client/src/index.js', 'packages/character/src/client.js', 'packages/world-book-library/src/client.js', 'packages/user/src/client.js']
const css = sources.map(path => {
  const source = readFileSync(path, 'utf8')
  const match = source.match(/(?:const|export const) css = `([\s\S]*?)`/)
  assert.ok(match, `Styles found in ${path}`)
  return match[1]
}).join('\n')
const directory = mkdtempSync(join(tmpdir(), 'tavern-titlebar-'))
try {
  const fixture = `<!doctype html><meta charset="utf-8"><style id="tavern-css"></style><style>
html,body{height:100%;margin:0}.fixture-overlay{position:absolute;inset:0;pointer-events:none}.fixture-native{position:absolute;top:0;right:0;width:138px;z-index:100;pointer-events:auto}
</style><body><div class="fixture-overlay"><div class="dtv-layer"></div></div><div class="fixture-native"></div><script>
const css=${JSON.stringify(css)};
const results=[],check=(name,pass,detail)=>results.push({name,pass:Boolean(pass),detail});
const layer=document.querySelector('.dtv-layer'),native=document.querySelector('.fixture-native');
let closed=0,nativeClicks=0;native.onclick=()=>nativeClicks++;
function verify(mode){
 // A regular browser tab has no native WCO; substitute its measured CSS env input.
 document.querySelector('#tavern-css').textContent=css.replaceAll('env(titlebar-area-height,0px)',mode.wco+'px');
 document.documentElement.toggleAttribute('data-fullscreen',Boolean(mode.fullscreen));
 document.documentElement.style.setProperty('--dsh-frame-chrome-top',mode.host+'px');native.style.height=mode.height+'px';
 for(const scale of [.75,1,1.5]){
  layer.style.setProperty('--dtv-ui-scale',scale);
  for(const prefix of ['dtv','dcc','dwb','dtu']){
   const panel=document.createElement('section');panel.className=prefix+'-panel';
   panel.innerHTML='<div class="'+prefix+'-header"><div class="'+prefix+'-title">Panel</div><button class="'+prefix+'-close">✕</button></div>';
   const button=panel.querySelector('button');button.onclick=()=>{closed++;panel.remove()};layer.append(panel);
   const bounds=button.getBoundingClientRect(),frame=panel.getBoundingClientRect();
   const hit=document.elementFromPoint(bounds.x+bounds.width/2,bounds.y+Math.min(4,bounds.height/4)),before=closed,beforeNative=nativeClicks;
   check(mode.name+' scale '+scale+' '+prefix+' panel respects titlebar and bottom edge',Math.abs(frame.top-mode.height)<1&&Math.abs(frame.bottom-innerHeight)<1,{top:frame.top,bottom:frame.bottom});
   check(mode.name+' scale '+scale+' '+prefix+' whole close stays below native controls',bounds.top>=mode.height-1,{top:bounds.top,nativeHeight:mode.height});
   check(mode.name+' scale '+scale+' '+prefix+' close receives pointer',hit===button,{top:bounds.top,bottom:bounds.bottom});
   hit?.click();check(mode.name+' scale '+scale+' '+prefix+' closes panel only',closed===before+1&&nativeClicks===beforeNative);panel.remove();
  }
 }
}
for(const mode of [
 {name:'web',height:0,host:0,wco:0},
 {name:'Windows',height:40,host:40,wco:40},
 {name:'host clearance without WCO',height:40,host:40,wco:0},
 {name:'fullscreen',height:0,host:0,wco:0,fullscreen:true},
 {name:'restored with stale fullscreen marker',height:40,host:0,wco:40,fullscreen:true},
 {name:'restored taller native controls',height:58,host:0,wco:58,fullscreen:true},
 {name:'native controls exceed host clearance',height:58,host:40,wco:58},
 {name:'restored synchronized host',height:40,host:40,wco:40},
])verify(mode);
const details=document.createElement('details');details.innerHTML='<summary>All checks</summary>';document.body.append(details);
const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);details.append(report);
const summary=document.createElement('p');document.body.append(summary);
const summarize=()=>{const failed=results.filter(result=>!result.pass);summary.textContent=(results.length-failed.length)+' passed, '+failed.length+' failed';report.textContent=JSON.stringify(results);return failed};summarize();
const start=document.createElement('button');start.textContent='Verify actual fullscreen';start.style.cssText='position:fixed;bottom:0;left:0;z-index:1000';document.body.append(start);
const painted=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
start.onclick=async()=>{
 try{
  await document.documentElement.requestFullscreen();await painted();
  check('actual fullscreen selector matches',document.documentElement.matches(':fullscreen'));
  verify({name:'actual fullscreen with stale Host and WCO',height:0,host:40,wco:40});
  await document.exitFullscreen();await painted();
  check('fullscreen selector cleared after exit',!document.documentElement.matches(':fullscreen'));
  verify({name:'exit fullscreen with stale Host marker',height:40,host:0,wco:40,fullscreen:true});
 }catch(error){check('fullscreen API completed',false,String(error))}
 const failed=summarize();start.textContent='Fullscreen complete: '+failed.length+' failed';
};
</script>`
  writeFileSync(join(directory, 'index.html'), fixture)
  if (process.env.TITLEBAR_FIXTURE_PATH) writeFileSync(process.env.TITLEBAR_FIXTURE_PATH, fixture)
  const result = spawnSync(browser, ['--headless', '--disable-gpu', '--disable-extensions', '--disable-background-networking', '--no-first-run', '--window-size=1024,768', `--user-data-dir=${join(directory, 'profile')}`, '--dump-dom', '--virtual-time-budget=1000', `file://${join(directory, 'index.html')}`], { encoding: 'utf8', timeout: 30000 })
  const raw = result.stdout?.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1]
  assert.ok(raw, result.stderr || 'Browser did not produce a titlebar report')
  const results = JSON.parse(raw.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'))
  const failed = results.filter(check => !check.pass)
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, examples: failed.slice(0, 4) }, null, 2))
  assert.equal(failed.length, 0, 'Panel close buttons remain reachable outside native window controls')
} finally {
  rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
