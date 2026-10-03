// Trusted Worker clock facts only. A wait belongs to one interpreter entry;
// neither guest code nor a later entry can claim its suspended interval.
export function settleCardStorageWait(wait,{current,live,now,deadline}) {
 if(wait.settled)return deadline
 wait.settled=true
 const elapsed=Number.isFinite(now)&&Number.isFinite(wait.started)?Math.max(0,now-wait.started):0
 wait.execution.waitMs+=elapsed
 if(!live||current!==wait.execution||deadline!==wait.deadline||!Number.isFinite(deadline))return deadline
 const credit=Math.min(1000,elapsed)
 wait.execution.creditedWaitMs+=credit
 return deadline+credit
}
