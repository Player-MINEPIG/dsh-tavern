// Only trusted interpreter timing facts enter this diagnostic. Guest exception
// text, source, variables and storage keys never enter the message.
export function cardExecutionDiagnostic({interrupted=false,phase='execution',elapsedMs=0,bridgeWaitMs=0,creditedWaitMs=0,layoutFailure='none'}={}) {
 const safePhase=['initial','event','snapshot','resize','timer','variables','result','execution'].includes(phase)?phase:'execution'
 const safeLayoutFailure=['none','response-deadline','response-error','budget'].includes(layoutFailure)?layoutFailure:'none'
 const duration=value=>Number.isFinite(value)?Math.min(60000,Math.max(0,Math.round(value))):0
 return {code:interrupted?'CARD_EXECUTION_TIME':'CARD_EXECUTION_JS',phase:safePhase,elapsedMs:duration(elapsedMs),bridgeWaitMs:duration(bridgeWaitMs),creditedWaitMs:duration(creditedWaitMs),layoutFailure:safeLayoutFailure}
}

// These are fixed entry strings constructed by the trusted Worker dispatcher.
export function cardExecutionPhase(code,initial=false){
 if(initial)return 'initial'
 if(code==='__view()')return 'snapshot'
 if(code==='__viewportChanged()')return 'resize'
 if(code.startsWith('__domEvent('))return 'event'
 if(code.startsWith('__tick('))return 'timer'
 if(code.startsWith('__notifyVariables('))return 'variables'
 if(/^__(?:writeResult|actionResult|identityOpeningResult|identityActionResult)\(/.test(code))return 'result'
 return 'execution'
}
