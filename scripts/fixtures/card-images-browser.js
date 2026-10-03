import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent,cleanCardHtml,CARD_CSP} from '../../packages/client/src/play/scripted-content.js'
import {RichText,sanitizeRenderedHtml} from '../../packages/client/src/play/rich-text.js'
import {imageCss,observeImages,createImagePool} from '../../packages/client/src/play/card-images.js'

;(async()=>{
const results=[], check=(name,pass)=>{results.push({name,pass:Boolean(pass)});if(!pass)console.error(name)}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(test){for(let n=0;n<150;n++){if(test())return;await pause(20)}throw Error('Media condition timed out')}
const fixtureUrl=n=>`https://images.example.com/${n}.png`
const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80
const ctx=canvas.getContext('2d');ctx.fillStyle='#df6128';ctx.fillRect(0,0,120,80);ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText('IMAGE',25,45)
const bytes=Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0))
const requests=[];let active=0,maximum=0,aborted=0
const nativeFetch=globalThis.fetch
// Only self-authored fixture URLs are replaced. No real card JS or remote
// library is evaluated, and no user image URL is requested by this fixture.
globalThis.fetch=(url,options={})=>{
 if(!String(url).startsWith('https://images.example.com/'))return nativeFetch(url,options)
 requests.push({url,options});active++;maximum=Math.max(maximum,active)
 return new Promise((resolve,reject)=>{
  let done=false
  const end=(fn,value)=>{if(done)return;done=true;active--;options.signal?.removeEventListener('abort',cancel);fn(value)}
  const cancel=()=>{aborted++;end(reject,Error('aborted'))};options.signal?.addEventListener('abort',cancel,{once:true})
  if(String(url).includes('hang'))return
  setTimeout(()=>{
   if(String(url).includes('fail'))end(reject,Error('fixture error'))
   else if(String(url).includes('svg'))end(resolve,new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}}))
   else end(resolve,new Response(bytes,{headers:{'content-type':'image/png'}}))
  },25)
 })
}
const container=document.createElement('div');container.id='media-fixture';document.body.append(container);const root=createRoot(container)
const render=element=>flushSync(()=>root.render(element))
try{
 const pseudoRoot=document.createElement('section');document.body.append(pseudoRoot)
 const pseudoStyle=document.createElement('style');pseudoStyle.textContent=imageCss('.pseudo{width:120px;height:80px;display:block}.pseudo::before{display:none;content:"";width:120px;height:80px;background:var(--picture)}.pseudo.show::before{display:block}.pseudo.no-content::before{content:none}.pseudo.invisible::before{visibility:hidden}.pseudo.transparent::before{opacity:0}.pseudo.offset::before{position:relative;left:5000px}.pseudo.translated::before{translate:5000px 0}.pseudo.zero-size::before{max-height:0}.pseudo.pushed::before{display:none}.pseudo.pushed::after{display:block;content:"";width:120px;height:80px;background:var(--picture)}')
 pseudoRoot.append(pseudoStyle)
 for(let n=0;n<6000;n++){const tile=document.createElement('div');tile.className='pseudo';tile.style.cssText=imageCss(`--picture:url("${fixtureUrl('pseudo-'+n)}")`);pseudoRoot.append(tile)}
 const pseudoPool=createImagePool(),pseudoMedia=observeImages(pseudoRoot,{pool:pseudoPool});await pause(180)
 check('6000 hidden pseudo-element image URLs request zero leases/network',requests.length===0&&pseudoPool.stats().leases===0)
 const tile=pseudoRoot.querySelector('.pseudo');tile.className='pseudo show';await until(()=>tile.getAttribute('data-dtv-image-state')==='loaded')
 check('hidden-to-visible generated pseudo loads its actual viewport pixels',requests.length===1&&pseudoPool.stats().leases===1&&!getComputedStyle(tile,'::before').backgroundImage.includes('#dtv='))
 for(const state of ['no-content','invisible','transparent','offset','translated','zero-size']){tile.className='pseudo show '+state;await pause(60);check(`pseudo ${state} does not retain a visible lease`,pseudoPool.stats().leases===0)}
 const child=document.createElement('div');child.style.height='2000px';tile.append(child);tile.className='pseudo pushed';await pause(60);check('normal-flow after pushed outside the viewport cannot acquire a host lease',pseudoPool.stats().leases===0);child.remove()
 tile.className='pseudo';await pause(60);check('visible-to-hidden pseudo releases its image data',pseudoPool.stats().leases===0&&![...tile.style].some(property=>property.startsWith('--dtv-img-')))
 tile.className='pseudo show';await until(()=>pseudoPool.stats().leases===1);await pause(50);check('showing a pseudo again uses bounded cached pixels',requests.length===1)
 // An identical hidden pseudo must not suppress a legitimate ordinary background.
 tile.className='pseudo';tile.style.cssText=imageCss(`background:url("${fixtureUrl('pseudo-0')}");--picture:url("${fixtureUrl('pseudo-0')}")`);await until(()=>pseudoPool.stats().leases===1);check('visible host background remains eligible beside an identical hidden pseudo',requests.length===1)
 pseudoMedia.dispose();pseudoPool.dispose();pseudoRoot.remove();requests.length=0
 const urls=Array.from({length:6000},(_,n)=>fixtureUrl(n)), source=`<details id="gallery"><summary>6000 images</summary>${urls.map(url=>`<img src="${url}">`).join('')}</details>`
 const inert=sanitizeRenderedHtml(source,{liveImages:true});check('import/sanitization of 6000 URLs is inert',requests.length===0&&!inert.includes(' src="https:'))
 render(React.createElement(RichText,{text:source}));await pause(180)
 check('6000 collapsed images produce zero network requests',requests.length===0&&container.querySelectorAll('img').length===6000)
 container.querySelector('details').open=true;await until(()=>requests.length>0);await pause(220)
 check('opening a 6000-image gallery requests only viewport demand',requests.length<=32&&requests.length<6000&&maximum<=4)
 const initialRequests=requests.length;window.scrollTo(0,document.body.scrollHeight);await pause(250)
 check('scrolling loads a new bounded viewport',requests.length>initialRequests&&requests.length-initialRequests<=32)
 container.querySelector('details').open=false;await pause(100)
 check('collapsing releases rendered image data',!container.querySelector('img[src]'))
 window.scrollTo(0,0)
 const cover=fixtureUrl('cover'), background=imageCss(`--identity-cover-image:url("${cover}")`)
 render(React.createElement(RichText,{text:`<div style='${background}'><style>.cover{display:inline-block;width:150px;height:180px;margin:8px;background:var(--identity-cover-image),linear-gradient(#dfa,#789)}</style>${Array.from({length:6},(_,n)=>`<div class="cover">Student ${n+1}</div>`).join('')}</div>`}))
  // The rich-text style boundary may have more than one host; traverse it.
 function deepAll(root,selector){let found=[...root.querySelectorAll(selector)];for(const el of root.querySelectorAll('*'))if(el.shadowRoot)found.push(...deepAll(el.shadowRoot,selector));return found}
 await until(()=>deepAll(container,'.cover').some(el=>getComputedStyle(el).backgroundImage.includes('data:image/png;base64')&&!getComputedStyle(el).backgroundImage.includes('#dtv=')))
 check('six visible CSS covers share one network request and actual decoded raster',requests.filter(request=>request.url===cover).length===1&&deepAll(container,'.cover').every(el=>getComputedStyle(el).backgroundImage.includes('data:image/png;base64')))
 check('media fetch omits credentials/referrer, denies redirects and requires CORS',requests.every(({options})=>options.credentials==='omit'&&options.referrerPolicy==='no-referrer'&&options.redirect==='error'&&options.mode==='cors'&&options.cache==='no-store'))
 window.__mediaSnapshot=()=>({requests:requests.length,maximum,aborted,covers:deepAll(container,'.cover').length})
 window.__mediaReady=true
 if(window.__holdMediaFixture)await window.__holdMediaFixture()
 const template=cleanCardHtml('<suot>outside</suot><template id="raw-data"><SUOT>one &amp; two</SUOT><script>parent.bad=1</script><img src="javascript:bad" onerror="bad()"></template>',{inertImages:true})
 const parsed=document.createElement('template');parsed.innerHTML=template
 check('SUOT markers survive only inside inert templates; active content is removed',!parsed.content.querySelector('suot')&&parsed.content.querySelector('template')?.innerHTML.includes('<suot>one &amp; two</suot>')&&!template.includes('<script')&&!template.includes('onerror')&&!template.includes('javascript:'))
 const script=`<html><body><div id="identity" style="--identity-cover-image:url('${fixtureUrl('runtime')}')"><div style="width:120px;height:100px;background:var(--identity-cover-image)">Runtime cover</div></div><div id="photo-area"><img width="120" height="80" src="${fixtureUrl('start')}"></div><button id="switch">Switch</button><script>document.getElementById('switch').addEventListener('click',()=>document.getElementById('photo-area').innerHTML='<img width="120" height="80" src="${fixtureUrl('next')}">')</script></body></html>`
 render(React.createElement(MessageContent,{text:script,enabled:true,scopeKey:'images'}))
 await until(()=>container.querySelector('iframe')?.contentDocument?.querySelector('img[data-dtv-image-state=loaded]'))
 let doc=container.querySelector('iframe').contentDocument;await pause(200);doc.getElementById('switch').click()
 await until(()=>requests.some(request=>request.url===fixtureUrl('next'))&&doc.querySelector('img[data-dtv-image-state=loaded]'))
 check('script DOM replacement loads only its displayed replacement',doc.querySelector('img').naturalWidth===120&&requests.filter(request=>request.url===fixtureUrl('next')).length===1)
 check('media status is separate from code runtime evidence',container.querySelector('.dtv-card-media')&&CARD_CSP.includes("img-src data:")&&CARD_CSP.includes("connect-src 'none'")&&container.querySelector('iframe').sandbox.value==='allow-same-origin')
 const virtual=script.replace(fixtureUrl('start'),fixtureUrl('virtual-start')).replace(fixtureUrl('next'),fixtureUrl('virtual-next')).replace('<script>','<script>void document.body.scrollHeight;')
 render(React.createElement(MessageContent,{text:virtual,enabled:true,scopeKey:'virtual-images'}))
 await until(()=>container.querySelector('iframe')?.contentDocument?.querySelector('img[data-dtv-image-state=loaded]'))
 doc=container.querySelector('iframe').contentDocument;await pause(350);doc.getElementById('switch').click()
 await until(()=>requests.some(request=>request.url===fixtureUrl('virtual-next'))&&doc.querySelector('img[data-dtv-image-state=loaded]'))
 check('virtual worker views retain inert image sources and display updated pixels',doc.querySelector('img').naturalWidth===120&&!container.querySelector('[role=alert]'))

 const old=doc
 render(React.createElement(MessageContent,{text:`<html><body><button>Fixture</button><img src="${fixtureUrl('hang')}"></body></html>`,enabled:false,scopeKey:'hanging'}))
 await until(()=>requests.some(request=>request.url===fixtureUrl('hang')))
 render(React.createElement(MessageContent,{text:'Next variant',enabled:false,scopeKey:'next'}));await pause(80)
 check('variant switching aborts old work and clears old document pixels',aborted>0&&!old.querySelector('img[src]')&&container.textContent.trim()==='Next variant')
 render(React.createElement(MessageContent,{text:`<html><body><button>Fixture</button><img src="${fixtureUrl('fail')}"><img src="${fixtureUrl('svg')}"></body></html>`,enabled:false,scopeKey:'errors'}))
 await until(()=>container.querySelector('iframe')?.contentDocument?.querySelectorAll('img[data-dtv-image-state=failed]').length===2)
 check('network/format errors produce explicit placeholders without executing SVG',container.querySelector('iframe').contentDocument.querySelectorAll('img[title]').length===2&&!container.querySelector('iframe').contentDocument.querySelector('img[src]'))
 render(React.createElement(MessageContent,{text:`<html><body><button>Fixture</button><img src="${fixtureUrl('hang2')}"></body></html>`,enabled:false,scopeKey:'unmount'}));await until(()=>requests.some(request=>request.url===fixtureUrl('hang2')))
 const before=aborted;root.unmount();await pause(100);check('unmount aborts in-flight media',aborted>before&&container.childElementCount===0)
}catch(error){check(`Unexpected: ${error.stack}`,false)}
window.__mediaResults=results
const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
