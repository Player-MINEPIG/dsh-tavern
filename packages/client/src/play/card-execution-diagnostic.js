// Only trusted interpreter timing facts enter this diagnostic. Guest exception
// text, source, variables and storage keys never enter the message.
export function cardExecutionDiagnostic({interrupted=false,phase='execution',elapsedMs=0,bridgeWaitMs=0}={}) {
 const safePhase=['initial','event','snapshot','execution'].includes(phase)?phase:'execution'
 const duration=value=>Number.isFinite(value)?Math.min(60000,Math.max(0,Math.round(value))):0
 return {code:interrupted?'CARD_EXECUTION_TIME':'CARD_EXECUTION_JS',phase:safePhase,elapsedMs:duration(elapsedMs),bridgeWaitMs:duration(bridgeWaitMs)}
}
