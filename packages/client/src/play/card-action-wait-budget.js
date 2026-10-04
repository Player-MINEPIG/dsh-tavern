// Only trusted clock facts from the currently suspended composer operation.
export function settleCardActionWait(wait,{current,live,now,deadline}) {
 if(wait.settled)return deadline
 wait.settled=true
 const elapsed=Number.isFinite(now)&&Number.isFinite(wait.started)?Math.max(0,now-wait.started):0
 wait.execution.waitMs+=elapsed
 if(!live||current!==wait.execution||deadline!==wait.deadline||!Number.isFinite(deadline))return deadline
 const credit=Math.min(10000,elapsed)
 wait.execution.creditedWaitMs+=credit
 return deadline+credit
}
