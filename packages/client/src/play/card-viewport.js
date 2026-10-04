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
 // Responsive widths and font sizes do not request a viewport-height panel.
 return /(?:\d|\.)\s*(?:d|s|l)?vh\b|\bposition\s*:\s*fixed\b/i.test(css)
}

// Only an explicitly marked Tavern opening pane with one viewport card opts in.
// The frame's grid area, rather than a second independent vh height, owns sizing.
export const OPENING_CARD_VIEWPORT_CSS = `
.dtv-play-opening-body[data-dtv-card-viewport-boundary]:has(> .dtv-play-rich > .dtv-interactive-card[data-dtv-viewport="true"]:only-child){height:clamp(392px,75dvh,800px);max-height:none;min-height:0;padding:0;overflow:hidden;display:flex;flex-direction:column}
.dtv-play-opening-body[data-dtv-card-viewport-boundary]:has(> .dtv-play-rich > .dtv-interactive-card[data-dtv-viewport="true"]:only-child)> .dtv-play-rich{flex:1;min-height:0;display:flex;flex-direction:column}
.dtv-play-opening-body[data-dtv-card-viewport-boundary] > .dtv-play-rich > .dtv-interactive-card[data-dtv-viewport="true"]:only-child{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;gap:0;align-items:start}
.dtv-play-opening-body[data-dtv-card-viewport-boundary] > .dtv-play-rich > .dtv-interactive-card[data-dtv-viewport="true"]:only-child > iframe{grid-row:1;grid-column:1/-1;min-height:0;min-width:0!important;height:100%;max-height:none;align-self:stretch;display:block}
.dtv-play-opening-body[data-dtv-card-viewport-boundary] > .dtv-play-rich > .dtv-interactive-card[data-dtv-viewport="true"]:only-child > .dtv-card-media{grid-row:2;grid-column:1;min-width:0;margin-top:4px;font-size:11px;overflow-wrap:anywhere}
.dtv-play-opening-body[data-dtv-card-viewport-boundary] > .dtv-play-rich > .dtv-interactive-card[data-dtv-viewport="true"]:only-child > :is([role="alert"],.dtv-card-proposal){grid-column:1/-1;max-height:25dvh;overflow:auto}
`
