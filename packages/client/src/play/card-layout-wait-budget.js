// Only a successful native measurement may credit its suspended entry. The
// aggregate one-second ceiling cannot be renewed by repeated layout requests.
export function settleCardLayoutWait(wait,{current,live,now,deadline}) {
 if(wait.settled)return deadline
 wait.settled=true
 const elapsed=Number.isFinite(now)&&Number.isFinite(wait.started)?Math.max(0,now-wait.started):0
 wait.execution.waitMs+=elapsed
 if(!wait.succeeded||!live||current!==wait.execution||deadline!==wait.deadline||!Number.isFinite(deadline))return deadline
 const credit=Math.min(elapsed,Math.max(0,1000-(wait.execution.layoutCreditedMs??0)))
 wait.execution.layoutCreditedMs=(wait.execution.layoutCreditedMs??0)+credit
 wait.execution.creditedWaitMs+=credit
 return deadline+credit
}
