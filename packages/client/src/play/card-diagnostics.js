import {createElement as h,Fragment,createContext,useContext,useEffect,useId,useMemo,useState} from 'react'
import {translate} from '../i18n.js'

const Diagnostics=createContext(null)

export function CardDiagnosticNotice({message,cardId}){
 const [closed,setClosed]=useState(false)
 if(closed)return null
 return h('div',{className:'dtv-card-diagnostic',style:{display:'flex',alignItems:'start',gap:12,padding:'8px 10px',border:'1px solid #d6b656',borderRadius:8,background:'#fff5cc',color:'#5f4700'}},
  h('p',{role:'alert','data-dtv-card-instance':cardId,style:{margin:0,flex:1}},message),
  h('button',{type:'button','aria-label':translate('appearance.dismissCardNotice'),onClick:()=>setClosed(true),style:{border:0,background:'transparent',color:'inherit',font:'inherit',cursor:'pointer'}},'×'))
}

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
   ...[...notices].flatMap(([id,messages])=>messages.map((message,index)=>h(CardDiagnosticNotice,{key:JSON.stringify([id,index,message]),message,cardId:id})))):null)
}

export function useCardDiagnostics(messages,cardId){
 const sink=useContext(Diagnostics),fallbackId=useId(),id=cardId??fallbackId,key=JSON.stringify(messages)
 useEffect(()=>{
  if(!sink)return
  sink.put(id,JSON.parse(key))
  return()=>sink.remove(id)
 },[sink,id,key])
 return sink!==null
}
