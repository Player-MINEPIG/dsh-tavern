import { Readable } from 'node:stream'
import { createLivePlayClient } from '../../packages/client/src/play/live.js'
import { createPlayApiHandler } from '../../packages/play/src/server.js'

export function atomicPlayClient(store, host) {
  const handler = createPlayApiHandler({ workspaceStore: store, host, chromeStore: {} })
  return createLivePlayClient({ fetchImpl: async (url, options) => {
    const req = Readable.from(options.body ? [Buffer.from(options.body)] : [])
    Object.assign(req, { url, method: options.method })
    const headers = new Headers()
    const res = { setHeader: (name, value) => headers.set(name, value), end(body) { this.body = body } }
    await handler(req, res)
    return new Response(res.body, { status: res.statusCode, headers })
  } })
}
