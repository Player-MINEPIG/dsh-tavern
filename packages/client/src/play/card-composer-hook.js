import {useLayoutEffect,useMemo,useRef,useState} from 'react'
import {createComposerAdapter} from './card-composer.js'

export function useCardComposer({sessionId,useInput,inputActions,active,blocked=false,send,onPending}) {
  const state=useInput?.(value=>value) ?? null
  const latest=useRef(null)
  latest.current={sessionId,state,active,blocked,send,onPending}
  const [pending,setPending]=useState(false)
  // Keep the opening dock alive through its accepted request/close task. The
  // owner and private lease still revoke on a real session or input-shell swap.
  const life=useRef(null),request=useRef(null)
  const owner=useMemo(()=>({sessionId}),[sessionId,inputActions])
  useLayoutEffect(()=>{life.current=owner;return()=>{if(life.current===owner)life.current=null;if(request.current?.owner===owner){request.current.onPending?.(owner,false);request.current=null}}},[owner])
  const adapter=useMemo(()=>!inputActions?null:createComposerAdapter({
    inputActions,
    getState:()=>latest.current.state,
    isCurrent:()=>life.current===owner&&latest.current.sessionId===sessionId&&latest.current.active===true,
    isReady:()=>!latest.current.blocked&&request.current===null,
    send:(text,options)=>{request.current={owner,lease:options?.lease,onPending:latest.current.onPending};request.current.onPending?.(owner,true);setPending(true);return latest.current.send(text,options)},
  }),[owner,inputActions])
  if(adapter){adapter.pending=pending&&request.current?.owner===owner;adapter.finishRequest=lease=>{if(request.current?.owner===owner&&request.current.lease===lease){request.current.onPending?.(owner,false);request.current=null;if(life.current===owner)setPending(false)}}}
  return adapter
}
