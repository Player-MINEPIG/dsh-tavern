// This narrow compatibility facade runs wholly inside QuickJS. Its objects
// contain only the host's bounded JPEG result, never a browser File/canvas.
export const CARD_PHOTO_RUNTIME = `
const __photoFiles=new WeakMap();let __photo=null;
const __photoNotify=(reader,type)=>setTimeout(()=>{if(typeof reader['on'+type]==='function')reader['on'+type]({target:reader,type})},16);
globalThis.__acceptPhoto=(node,value)=>{
 if(node.localName!=='input'||node.type!=='file'||!value||value.type!=='image/jpeg'||typeof value.data!=='string'||value.data.length>65536||!/^data:image\\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.data)||!Number.isSafeInteger(value.width)||!Number.isSafeInteger(value.height)||value.width<1||value.height<1||value.width>640||value.height>640)throw Error('Invalid selected photo');
 __photo=Object.freeze({...value});const file=Object.freeze({name:'selected-photo.jpg',type:'image/jpeg',size:value.size});__photoFiles.set(file,__photo);
 Object.defineProperty(node,'files',{configurable:true,value:Object.freeze([file])});node.value='';
};
globalThis.FileReader=class {
 constructor(){this.result=null;this.error=null;this.readyState=0;this.onload=null;this.onerror=null}
 readAsDataURL(file){const value=__photoFiles.get(file);if(!value||value!==__photo){this.error=Error('Only the current selected photo can be read');this.readyState=2;__photoNotify(this,'error');return}this.result=value.data;this.readyState=2;__photoNotify(this,'load')}
};
const __photoImages=new WeakMap();
globalThis.Image=class {
 constructor(){this.onload=null;this.onerror=null;this.naturalWidth=0;this.naturalHeight=0;this.width=0;this.height=0;this._source=''}
 get src(){return this._source}
 set src(value){const photo=__photo;if(!photo||value!==photo.data){__photoImages.delete(this);__photoNotify(this,'error');return}this._source=value;this.naturalWidth=this.width=photo.width;this.naturalHeight=this.height=photo.height;__photoImages.set(this,photo);__photoNotify(this,'load')}
};
window.FileReader=globalThis.FileReader;window.Image=globalThis.Image;
const __photoCreate=document.createElement.bind(document);
document.createElement=function(tag,...args){
 if(String(tag).toLowerCase()!=='canvas')return __photoCreate(tag,...args);
 let drawn=null;const canvas={width:0,height:0,getContext(type){if(type!=='2d')return null;return Object.freeze({drawImage(image,x,y,width,height){const photo=__photoImages.get(image);if(!photo||photo!==__photo||x!==0||y!==0||width!==photo.width||height!==photo.height||canvas.width!==width||canvas.height!==height)throw Error('Only selected-photo resizing is supported');drawn=photo}})},toDataURL(type,quality){if(!drawn||drawn!==__photo||type!=='image/jpeg'||quality!==.82)throw Error('Only selected-photo JPEG output is supported');return drawn.data}};return canvas;
};
if(__DOM.HTMLInputElement){
 const original=__DOM.HTMLInputElement.prototype.click;
 __DOM.HTMLInputElement.prototype.click=function(){
  if(this.type!=='file')return original.call(this);
  const view=JSON.parse(__view()),id=__ids.get(this);if(!Number.isSafeInteger(id)||id<=0||__nodes.get(id)!==this||!document.body.contains(this))throw Error('Photo input is outside this card');
  __call('photoPick',[id,view]);
 };
}
`
