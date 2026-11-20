export async function withOperationDeadline(options, work) {
  const deadline = AbortSignal.timeout(35_000)
  const signal = options?.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  signal.throwIfAborted()
  let abort
  const timeout = new Promise((_, reject) => {
    abort = () => reject(options?.signal?.aborted ? options.signal.reason : options?.timeoutError ?? signal.reason)
    signal.addEventListener('abort', abort, {once: true})
  })
  try { return await Promise.race([timeout, work(signal)]) }
  finally { signal.removeEventListener('abort', abort) }
}
