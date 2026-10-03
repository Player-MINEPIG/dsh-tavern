import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent,cleanCardHtml,CARD_CSP} from '../../packages/client/src/play/scripted-content.js'
import {selectedPhoto,PHOTO_LIMITS} from '../../packages/client/src/play/card-photo.js'

const container=document.createElement('main');document.body.append(container)
const root=createRoot(container),results=[]
window.__photoResults=results
const check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name)}
const card=`<html><body><section hidden id="secret">Hidden</section><input type="radio" data-opening-choice="easy"><input type="checkbox" data-opening-perk="one"><button id="upload">Choose photo</button><input id="photo" type="file" hidden accept="image/*"><img id="preview" width="320" height="250"><output id="status">Ready</output><script>
document.getElementById('upload').addEventListener('click',()=>document.getElementById('photo').click());
document.getElementById('photo').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 try{const data=await new Promise((resolve,reject)=>{
 const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{
 const image=new Image();image.onerror=reject;image.onload=()=>{
 const scale=Math.min(1,640/Math.max(image.naturalWidth,image.naturalHeight));
 const width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(image,0,0,width,height);resolve(canvas.toDataURL('image/jpeg',.82));};image.src=reader.result;};reader.readAsDataURL(file);});
 document.getElementById('preview').src=data;document.getElementById('status').textContent='Selected '+file.name+' '+data.length;
 }catch(error){document.getElementById('status').textContent='Rejected'}
});
</script></body></html>`
window.__renderPhoto=(text=card)=>flushSync(()=>root.render(React.createElement(MessageContent,{text,enabled:true,scopeKey:'photos'})))
window.__photoCheck=check
window.__photoCard=card
window.__photoUnmount=()=>root.unmount()
window.__testPhotoTransform=async()=>{
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=800;const ctx=canvas.getContext('2d');ctx.fillStyle='#286fdc';ctx.fillRect(0,0,1000,800);ctx.fillStyle='white';ctx.font='100px sans-serif';ctx.fillText('PHOTO',250,430)
 const data=canvas.toDataURL('image/png'),bytes=Uint8Array.from(atob(data.split(',')[1]),ch=>ch.charCodeAt(0)),file=new File([bytes],'private-original-name.png',{type:'image/png'})
 const result=await selectedPhoto(file,new AbortController().signal)
 check('trusted photo transform shrinks, strips original metadata and bounds encoding',result.width===640&&result.height===512&&result.data.startsWith('data:image/jpeg;base64,')&&result.data.length<=PHOTO_LIMITS.characters&&!JSON.stringify(result).includes(file.name))
 const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));bitmap.close()
 const aborted=new AbortController();aborted.abort();let stopped=false;try{await selectedPhoto(file,aborted.signal)}catch{stopped=true}check('cancelled photo transform does not return a late result',stopped)
 for(const invalid of [new File(['<svg/>'],'x.svg',{type:'image/svg+xml'}),new File(['x'],'x.png',{type:'image/png'}),{size:9*1024*1024,type:'image/png'}]){let blocked=false;try{await selectedPhoto(invalid,new AbortController().signal)}catch{blocked=true}check('invalid/oversized photo rejected before VM transfer',blocked)}
 return {name:file.name,mimeType:file.type,bytes:[...bytes],expected:result}
}
window.__photoBoundary=()=>{
 const html=cleanCardHtml('<div hidden data-opening-choice="one" data-opening-perk="two" data-unapproved="bad"></div><input type="file" multiple webkitdirectory accept="*" value="/private/x"><iframe src="https://bad.example/"></iframe><canvas></canvas>')
 const template=document.createElement('template');template.innerHTML=html
 const input=template.content.querySelector('input'),div=template.content.querySelector('div')
 check('sanitizer preserves hidden/opening attrs and single raster file input only',input.type==='file'&&input.accept==='image/png,image/jpeg,image/webp'&&!input.hasAttribute('value')&&!input.multiple&&!input.hasAttribute('webkitdirectory')&&div.hidden&&div.dataset.openingChoice==='one'&&div.dataset.openingPerk==='two'&&!div.hasAttribute('data-unapproved')&&!template.content.querySelector('iframe,canvas'))
 check('file support preserves the script-disabled iframe network boundary',CARD_CSP.includes("connect-src 'none'")&&CARD_CSP.includes("img-src data:")&&CARD_CSP.includes("script-src 'none'"))
}
window.__photoBoundary();window.__renderPhoto();window.__photoReady=true
