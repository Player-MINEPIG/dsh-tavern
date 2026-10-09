import { actualAssemblyResult } from 'dsh-prompt-assembler/actual-result'

// v3 detail has already verified the durable request. Never use the latest
// /actual endpoint or a current preview to fill a historical record.
export function recordedRequestResult(record) {
  const request = record.requestAssembly ?? record.nativeRequest
  if (!Array.isArray(request?.messages)
    || record.requestContentStatus && record.requestContentStatus !== 'available'
    || request.metadata?.assembly?.preview
    || record.requestAssembly && (request.turn !== record.turn || request.step !== record.step)) return null
  const metadata = { ...request.metadata }
  if (!metadata.assembly && record.nativeProvenance) metadata.assembly = record.nativeProvenance
  return actualAssemblyResult({ ...request, metadata })
}
