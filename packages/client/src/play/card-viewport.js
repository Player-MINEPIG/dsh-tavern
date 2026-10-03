// Only card-owned presentation data crosses this seam; no DOM handles.
export function cardViewport(value) {
 if(!value||!Number.isSafeInteger(value.width)||!Number.isSafeInteger(value.height)||value.width<1||value.height<1||value.width>16384||value.height>16384)throw Error('Card viewport unavailable')
 return {width:value.width,height:value.height}
}
export function cardRootPresentation(value={}) {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid card root presentation')
 const root={}
 for(const key of ['html','body']){
  const entry=value[key]??{},className=entry.className??'',style=entry.style??''
  if(typeof className!=='string'||className.length>4096||typeof style!=='string'||style.length>16384)throw Error('Invalid card root presentation')
  root[key]={className,style}
 }
 return root
}
export function usesCardViewport(html,styles,root) {
 const css=styles+' '+html+' '+root.html.style+' '+root.body.style
 return /(?:\d|\.)\s*(?:d|s|l)?v[wh]\b|\bposition\s*:\s*fixed\b/i.test(css)
}
