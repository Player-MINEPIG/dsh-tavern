import {createElement as h,Fragment,createContext,useContext,useEffect,useId,useMemo,useState} from 'react'

const Diagnostics=createContext(null)

// Host runtime notices are siblings of the message bubble, never card content.
export function CardDiagnosticBoundary({children}){
 const [notices,setNotices]=useState(()=>new Map())
 const sink=useMemo(()=>({
  put(id,messages){setNotices(current=>{
   const next=new Map(current)
   if(messages.length)next.set(id,messages);else next.delete(id)
   return next
  })},
  remove(id){setNotices(current=>{if(!current.has(id))return current;const next=new Map(current);next.delete(id);return next})},
 }),[])
 return h(Fragment,null,h(Diagnostics.Provider,{value:sink},children),
  notices.size?h('div',{className:'dtv-message-diagnostics','data-dtv-card-diagnostics':''},
   ...[...notices].flatMap(([id,messages])=>messages.map((message,index)=>h('p',{key:`${id}:${index}`,role:'alert'},message)))):null)
}

export function useCardDiagnostics(messages){
 const sink=useContext(Diagnostics),id=useId(),key=JSON.stringify(messages)
 useEffect(()=>{
  if(!sink)return
  sink.put(id,JSON.parse(key))
  return()=>sink.remove(id)
 },[sink,id,key])
 return sink!==null
}
